import { Router } from 'express';
import { requireApiKey } from '../auth.js';
import { getPrisma } from '../deps.js';
import { runFullCycle } from '../../scraper/scheduler.js';

const router = Router();
const prisma = getPrisma();

router.post('/run-now', requireApiKey, async (_req, res) => {
  try {
    const result = await runFullCycle();
    res.json({
      ok: true,
      scraped: result.scraped,
      searched: result.searched,
      generated: result.generated,
      errors: result.errors,
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
