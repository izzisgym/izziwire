import { Router, type Request, type Response } from 'express';
import { getConfig } from '../../config.js';

const router = Router();
const cfg = getConfig();

router.get('/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = cfg.META_VERIFY_TOKEN ?? cfg.CRON_SECRET;
  if (mode === 'subscribe' && token === verifyToken && typeof challenge === 'string') {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

router.post('/meta', (req: Request, res: Response) => {
  res.status(200).send('OK');
  const body = req.body as { object?: string; entry?: unknown[] };
  if (body.object === 'page' && Array.isArray(body.entry)) {
    // Optional: update published_posts engagement from Meta events
    // body.entry contains changes (comments, likes, etc.)
  }
});

export default router;
