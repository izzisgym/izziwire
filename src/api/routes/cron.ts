import { Router, type Request, type Response } from 'express';
import { getConfig } from '../../config.js';
import { runScrapeCycle } from '../../scraper/scheduler.js';
import { runPublishCycle } from '../../queue/publisher.js';

const router = Router();

function requireCronSecret(req: Request, res: Response, next: () => void) {
  const cfg = getConfig();
  const secret = req.headers['x-cron-secret'] ?? req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!cfg.CRON_SECRET || secret !== cfg.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

router.use(requireCronSecret);

router.post('/scrape', async (_req, res) => {
  try {
    const { scraped, errors } = await runScrapeCycle();
    res.json({ ok: true, scraped, errors });
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

router.post('/publish', async (_req, res) => {
  try {
    const { published, errors } = await runPublishCycle();
    res.json({ ok: true, published, errors });
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

export default router;
