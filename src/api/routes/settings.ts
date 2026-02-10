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
  NEWS_SEARCH_ENABLED: z.boolean().optional(),
  NEWS_TOPICS_POKEMON: z.array(z.string().min(1)).optional(),
  NEWS_TOPICS_ONEPIECE: z.array(z.string().min(1)).optional(),
  NEWS_TOPICS_MTG: z.array(z.string().min(1)).optional(),
  WP_CATEGORY_POKEMON: z.number().int().nonnegative().optional(),
  WP_CATEGORY_ONEPIECE: z.number().int().nonnegative().optional(),
  WP_CATEGORY_MTG: z.number().int().nonnegative().optional(),
  AUTO_GENERATE_LIMIT: z.number().int().positive().max(50).optional(),
  AUTO_GENERATE_WINDOW_HOURS: z.number().int().positive().max(168).optional(),
  WP_WRITING_INSTRUCTIONS: z.string().optional(),
  WP_MIN_WORDS: z.number().int().nonnegative().optional(),
  WP_MAX_WORDS: z.number().int().nonnegative().optional(),
  SEARCH_INSTRUCTIONS: z.string().optional(),
  SEARCH_MAX_RESULTS: z.number().int().positive().max(20).optional(),
  SEARCH_RECENCY_DAYS: z.number().int().positive().max(30).optional(),
  SEARCH_LANG_EN: z.boolean().optional(),
  SEARCH_LANG_ZH: z.boolean().optional(),
  SEARCH_LANG_JA: z.boolean().optional(),
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
    NEWS_SEARCH_ENABLED: true,
    NEWS_TOPICS_POKEMON: [],
    NEWS_TOPICS_ONEPIECE: [],
    NEWS_TOPICS_MTG: [],
    WP_CATEGORY_POKEMON: 0,
    WP_CATEGORY_ONEPIECE: 0,
    WP_CATEGORY_MTG: 0,
    AUTO_GENERATE_LIMIT: 5,
    AUTO_GENERATE_WINDOW_HOURS: 6,
    WP_WRITING_INSTRUCTIONS:
      'Write engaging, well-structured blog posts for a TCG community audience. Use a conversational but knowledgeable tone. Structure with an intro paragraph, 3-4 body sections with subheadings (use HTML <h2> tags), and a conclusion. Include strategic insights and community relevance. Format the body as HTML with <h2> for sections and <p> for paragraphs.',
    WP_MIN_WORDS: 600,
    WP_MAX_WORDS: 1200,
    SEARCH_INSTRUCTIONS:
      'Only select articles that contain meaningful, actionable news: new set announcements, card reveals, ban list updates, tournament results, meta shifts, or official rule changes. Skip generic listicles, opinion pieces with no new info, and articles older than a week.',
    SEARCH_MAX_RESULTS: 10,
    SEARCH_RECENCY_DAYS: 7,
    SEARCH_LANG_EN: true,
    SEARCH_LANG_ZH: true,
    SEARCH_LANG_JA: true,
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
