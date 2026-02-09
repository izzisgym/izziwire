import { Router } from 'express';
import { requireApiKey } from '../auth.js';
import { runScrapeCycle } from '../../scraper/scheduler.js';
import { getPrisma } from '../deps.js';
import { runPipelineForArticle } from '../../queue/pipeline.js';
import { getSetting } from '../../settings/store.js';

const router = Router();
const prisma = getPrisma();

router.post('/run-now', requireApiKey, async (_req, res) => {
  try {
    const { scraped, errors: scrapeErrors } = await runScrapeCycle();

    const limit = await getSetting('AUTO_GENERATE_LIMIT', 5);
    const effectiveLimit = Math.max(limit, 1);

    const totalUnprocessed = await prisma.article.count({ where: { isProcessed: false } });

    const articles = await prisma.article.findMany({
      where: { isProcessed: false },
      orderBy: { scrapedAt: 'desc' },
      take: effectiveLimit,
    });

    const generateErrors: string[] = [];
    const pendingIds: string[] = [];
    for (const a of articles) {
      try {
        const pendingId = await runPipelineForArticle({
          articleId: a.id,
          platform: 'wordpress' as any,
          postType: 'news',
          generateImage: true,
        });
        pendingIds.push(pendingId);
        await prisma.article.update({ where: { id: a.id }, data: { isProcessed: true } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        generateErrors.push(`Article ${a.id}: ${msg}`);
      }
    }

    // Posts are left as 'pending' for manual review in the Approval Queue
    res.json({
      ok: true,
      scraped,
      unprocessedArticles: totalUnprocessed,
      articlesFound: articles.length,
      generated: pendingIds.length,
      pendingReview: pendingIds.length,
      errors: [...scrapeErrors, ...generateErrors],
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.post('/reset-articles', requireApiKey, async (_req, res) => {
  try {
    const result = await prisma.article.updateMany({
      where: { isProcessed: true },
      data: { isProcessed: false },
    });
    res.json({ ok: true, reset: result.count });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

export default router;
