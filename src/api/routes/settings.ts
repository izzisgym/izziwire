import { Router } from 'express';
import { z } from 'zod';
import { getConfig } from '../../config.js';
import { requireApiKey } from '../auth.js';
import { getAllSettings, setSettings } from '../../settings/store.js';

const router = Router();

const settingsSchema = z.object({
  SCRAPE_INTERVAL_HOURS: z.number().int().positive().optional(),
  USER_AGENT: z.string().min(1).optional(),
  DEFAULT_AI_MODEL: z.string().min(1).optional(),
  IMAGE_MODEL: z.string().min(1).optional(),
  SCRAPE_ENABLED: z.boolean().optional(),
  PUBLISH_ENABLED: z.boolean().optional(),
});

function defaultsFromConfig() {
  const cfg = getConfig();
  return {
    SCRAPE_INTERVAL_HOURS: cfg.SCRAPE_INTERVAL_HOURS,
    USER_AGENT: cfg.USER_AGENT,
    DEFAULT_AI_MODEL: cfg.DEFAULT_AI_MODEL,
    IMAGE_MODEL: cfg.IMAGE_MODEL,
    SCRAPE_ENABLED: true,
    PUBLISH_ENABLED: true,
  };
}

router.get('/', async (_req, res) => {
  try {
    const defaults = defaultsFromConfig();
    const settings = await getAllSettings(defaults);
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.put('/', requireApiKey, async (req, res) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    await setSettings(parsed.data);
    const defaults = defaultsFromConfig();
    const settings = await getAllSettings(defaults);
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

export default router;
