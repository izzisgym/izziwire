import { Router } from 'express';
import { getConfig } from '../../config.js';

const router = Router();

router.get('/meta', (req, res) => {
  const cfg = getConfig();
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

router.post('/meta', (req, res) => {
  res.status(200).send('OK');
  const body = req.body;
  if (body.object === 'page' && Array.isArray(body.entry)) {
    // Optional: update published_posts engagement from Meta events
  }
});

export default router;
