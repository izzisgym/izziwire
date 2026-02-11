import { Router } from 'express';
import { getPrisma } from '../deps.js';
import { getConfig } from '../../config.js';
import { getSetting } from '../../settings/store.js';

const router = Router();
const prisma = getPrisma();

router.get('/', async (_req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [pendingCount, publishedToday] = await Promise.all([
      prisma.pendingPost.count({ where: { status: 'pending' } }),
      prisma.publishedPost.count({
        where: { publishedAt: { gte: startOfToday } },
      }),
    ]);
    res.json({ pending: pendingCount, publishedToday });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

/**
 * GET /api/agent/status
 * Explains why the approval queue might be empty and what the agent needs to create posts.
 */
router.get('/agent/status', async (_req, res) => {
  try {
    const cfg = getConfig();
    const [pendingCount, unprocessedCount, activeSources] = await Promise.all([
      prisma.pendingPost.count({ where: { status: 'pending' } }),
      prisma.article.count({ where: { isProcessed: false } }),
      prisma.newsSource.count({ where: { isActive: true } }),
    ]);

    const topicsPokemon = await getSetting('NEWS_TOPICS_POKEMON', []);
    const topicsOnepiece = await getSetting('NEWS_TOPICS_ONEPIECE', []);
    const topicsMtg = await getSetting('NEWS_TOPICS_MTG', []);
    const topicsConfigured =
      (Array.isArray(topicsPokemon) && topicsPokemon.length > 0) ||
      (Array.isArray(topicsOnepiece) && topicsOnepiece.length > 0) ||
      (Array.isArray(topicsMtg) && topicsMtg.length > 0);

    const hints: string[] = [];
    if (pendingCount === 0) {
      if (unprocessedCount === 0) {
        if (activeSources === 0) {
          hints.push('No news sources active. Run the database seed (npm run db:seed) to add RSS sources.');
        }
        if (!topicsConfigured) {
          hints.push('No news topics configured. Add topics in Settings (Pokemon / One Piece / MTG topics) so the search agent can find articles.');
        }
        if (!cfg.TAVILY_API_KEY) {
          hints.push('TAVILY_API_KEY is not set. Web search (and extra articles) will be skipped.');
        }
        if (!cfg.ANTHROPIC_API_KEY) {
          hints.push('ANTHROPIC_API_KEY is not set. The agent cannot generate posts from articles.');
        }
        hints.push('The agent runs automatically every 6 hours (and once on startup). Trigger manually with POST /api/cron/full-cycle (requires CRON_SECRET).');
      }
    }

    res.json({
      pendingPosts: pendingCount,
      unprocessedArticles: unprocessedCount,
      activeNewsSources: activeSources,
      configured: {
        anthropic: !!cfg.ANTHROPIC_API_KEY,
        tavily: !!cfg.TAVILY_API_KEY,
        newsTopics: topicsConfigured,
      },
      hints: hints.length ? hints : ['Agent is configured. Pending posts are in the Approval Queue.'],
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

export default router;
