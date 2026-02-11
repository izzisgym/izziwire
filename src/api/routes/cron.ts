import { Router, Request, Response, NextFunction } from 'express';
import { getConfig } from '../../config.js';
import { runScrapeCycle, runFullCycle } from '../../scraper/scheduler.js';
import { runPublishCycle } from '../../queue/publisher.js';
import { getPrisma } from '../deps.js';
import { generatePostFromTopic } from '../../linkedin/generate-post.js';

const router = Router();

function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  const cfg = getConfig();
  const secret =
    (req.headers['x-cron-secret'] as string | undefined) ??
    req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!cfg.CRON_SECRET || secret !== cfg.CRON_SECRET) {
    console.warn(`Unauthorized cron request from ${req.ip ?? 'unknown'}`);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

router.use(requireCronSecret);

router.post('/scrape', async (_req, res) => {
  try {
    const { scraped, errors } = await runScrapeCycle();
    return res.json({ ok: true, scraped, errors });
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

router.post('/publish', async (_req, res) => {
  try {
    const { published, errors } = await runPublishCycle();
    return res.json({ ok: true, published, errors });
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

/** Run the full agent cycle: scrape → search → generate (posts for review). */
router.post('/full-cycle', async (_req, res) => {
  try {
    const result = await runFullCycle();
    return res.json({
      ok: true,
      scraped: result.scraped,
      searched: result.searched,
      generated: result.generated,
      errors: result.errors,
    });
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

/** LinkedIn Agent: pick a topic, generate a post, save as draft. */
router.post('/linkedin-generate-draft', async (_req, res) => {
  try {
    const prisma = getPrisma();
    const topics = await prisma.linkedInTopic.findMany({ where: { enabled: true } });
    if (topics.length === 0) {
      return res.json({ ok: true, message: 'No LinkedIn topics' });
    }
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const content = await generatePostFromTopic(topic);
    if (!content) {
      return res.json({ ok: true, message: 'No content generated' });
    }
    const draft = await prisma.linkedInDraft.create({
      data: { content, topicId: topic.id, status: 'draft' },
    });
    return res.json({ ok: true, draftId: draft.id });
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Generation failed',
    });
  }
});

export default router;
