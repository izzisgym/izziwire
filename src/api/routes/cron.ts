import { Router, Request, Response, NextFunction } from 'express';
import { getConfig } from '../../config.js';
import { runScrapeCycle } from '../../scraper/scheduler.js';
import { runPublishCycle } from '../../queue/publisher.js';

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

export default router;
