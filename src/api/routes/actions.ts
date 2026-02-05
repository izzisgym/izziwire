import { Router } from 'express';
import { requireApiKey } from '../auth.js';
import { runScrapeCycle } from '../../scraper/scheduler.js';
import { getPrisma } from '../deps.js';
import { runPipelineForArticle } from '../../queue/pipeline.js';
import * as workflow from '../../queue/workflow.js';
import { runPublishCycle } from '../../queue/publisher.js';
import { getSetting } from '../../settings/store.js';

const router = Router();
const prisma = getPrisma();

router.post('/run-now', requireApiKey, async (_req, res) => {
  try {
    const { scraped, errors: scrapeErrors } = await runScrapeCycle();

    const windowHours = await getSetting('AUTO_GENERATE_WINDOW_HOURS', 6);
    const limit = await getSetting('AUTO_GENERATE_LIMIT', 5);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const articles = await prisma.article.findMany({
      where: { isProcessed: false, scrapedAt: { gte: since } },
      orderBy: { scrapedAt: 'desc' },
      take: limit,
    });

    const pendingIds: string[] = [];
    for (const a of articles) {
      const pendingId = await runPipelineForArticle({
        articleId: a.id,
        platform: 'wordpress',
        postType: 'news',
        generateImage: true,
      });
      pendingIds.push(pendingId);
      await prisma.article.update({ where: { id: a.id }, data: { isProcessed: true } });
    }

    for (const id of pendingIds) {
      await workflow.approvePost(id, {});
    }

    const { published, errors: publishErrors } = await runPublishCycle();

    res.json({
      ok: true,
      scraped,
      generated: pendingIds.length,
      published,
      errors: [...scrapeErrors, ...publishErrors],
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

export default router;
