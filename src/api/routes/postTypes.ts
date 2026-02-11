import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../deps.js';
import { requireApiKey } from '../auth.js';

const router = Router();
const prisma = getPrisma();

const postTypeSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9_-]+$/),
  description: z.string().optional(),
  instructions: z.string().min(1),
  minWords: z.number().int().positive().default(600),
  maxWords: z.number().int().positive().default(1200),
  generateImage: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

// GET all post types (seeds defaults on first access)
router.get('/', async (_req, res) => {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'POST_TYPES' } });
    if (row?.value) {
      return res.json(row.value as unknown as PostTypeConfig[]);
    }
    // Seed defaults
    await prisma.setting.upsert({
      where: { key: 'POST_TYPES' },
      update: { value: DEFAULT_POST_TYPES as unknown as any },
      create: { key: 'POST_TYPES', value: DEFAULT_POST_TYPES as unknown as any },
    });
    return res.json(DEFAULT_POST_TYPES);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// PUT save all post types
router.put('/', requireApiKey, async (req, res) => {
  try {
    const parsed = z.array(postTypeSchema).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    await prisma.setting.upsert({
      where: { key: 'POST_TYPES' },
      update: { value: parsed.data as unknown as any },
      create: { key: 'POST_TYPES', value: parsed.data as unknown as any },
    });
    return res.json(parsed.data);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

export interface PostTypeConfig {
  name: string;
  slug: string;
  description?: string;
  instructions: string;
  minWords: number;
  maxWords: number;
  generateImage: boolean;
  isActive: boolean;
}

export const DEFAULT_POST_TYPES: PostTypeConfig[] = [
  {
    name: 'News Post',
    slug: 'news',
    description: 'Breaking news and announcements',
    instructions:
      'Write a news article covering the topic. Include the key facts, what happened, why it matters to the TCG community, and what to expect next. Use an engaging headline. Structure with intro, details, and community impact sections. Format as HTML with <h2> and <p> tags.',
    minWords: 600,
    maxWords: 1200,
    generateImage: true,
    isActive: true,
  },
  {
    name: 'Card Spotlight',
    slug: 'card-spotlight',
    description: 'Deep dive analysis on a specific card',
    instructions:
      'Write a detailed card analysis. Cover the card\'s strengths, weaknesses, best decks to use it in, combos, and competitive viability. Include strategy tips. Format as HTML with <h2> and <p> tags.',
    minWords: 800,
    maxWords: 1500,
    generateImage: true,
    isActive: true,
  },
  {
    name: 'Tier List / Meta Analysis',
    slug: 'tier-list',
    description: 'Competitive rankings and meta breakdown',
    instructions:
      'Write a meta analysis covering the current competitive landscape. Rank the top decks/strategies in tiers (S, A, B, C). Explain why each is placed where it is, recent shifts, and predictions. Format as HTML with <h2> and <p> tags.',
    minWords: 1000,
    maxWords: 2000,
    generateImage: true,
    isActive: true,
  },
  {
    name: 'Deck Guide',
    slug: 'deck-guide',
    description: 'How to build and play a specific deck',
    instructions:
      'Write a comprehensive deck guide. Cover the core strategy, key cards, budget vs premium options, matchup tips, mulligan advice, and sideboard/tech choices. Format as HTML with <h2> and <p> tags.',
    minWords: 1000,
    maxWords: 2000,
    generateImage: true,
    isActive: true,
  },
  {
    name: 'Product Review',
    slug: 'product-review',
    description: 'Reviews of booster boxes, starter decks, accessories',
    instructions:
      'Write an honest product review. Cover what\'s included, value for money, pull rates (if applicable), who it\'s best for, and a final verdict with a rating. Format as HTML with <h2> and <p> tags.',
    minWords: 600,
    maxWords: 1200,
    generateImage: true,
    isActive: true,
  },
  {
    name: 'Community Engagement',
    slug: 'engagement',
    description: 'Polls, questions, and community discussion starters',
    instructions:
      'Write an engaging community post that sparks discussion. Pose interesting questions, present a debate topic, or create a "would you rather" scenario. Keep it fun and inclusive. Encourage comments. Format as HTML with <h2> and <p> tags.',
    minWords: 300,
    maxWords: 600,
    generateImage: true,
    isActive: true,
  },
  {
    name: 'Listicle',
    slug: 'listicle',
    description: 'Top 10 lists, rankings, best-of compilations',
    instructions:
      'Write a numbered list article (e.g. "Top 10..."). Each item should have a brief explanation of why it made the list. Include an intro and conclusion. Make it scannable and entertaining. Format as HTML with <h2> for each item and <p> tags.',
    minWords: 800,
    maxWords: 1500,
    generateImage: true,
    isActive: true,
  },
  {
    name: 'Event Coverage',
    slug: 'event-coverage',
    description: 'Tournament recaps and event highlights',
    instructions:
      'Write event coverage summarizing key results, standout performances, surprise decks, and the overall story of the tournament. Include final standings if available. Format as HTML with <h2> and <p> tags.',
    minWords: 600,
    maxWords: 1200,
    generateImage: true,
    isActive: true,
  },
  {
    name: 'MTG Card Spotlight (Random)',
    slug: 'mtg-card-spotlight',
    description: 'Auto-fetches a random MTG card from Scryfall; generates a short spotlight post.',
    instructions: 'Card spotlight under 150 words. Hook, one key point, reader question. HTML with <h2> and <p>.',
    minWords: 100,
    maxWords: 150,
    generateImage: false,
    isActive: true,
  },
  {
    name: 'Pokemon Card Spotlight (Random)',
    slug: 'pokemon-card-spotlight',
    description: 'Auto-fetches a random Pokemon TCG card; generates a short spotlight post.',
    instructions: 'Card spotlight under 150 words. Hook, one key point, reader question. HTML with <h2> and <p>.',
    minWords: 100,
    maxWords: 150,
    generateImage: false,
    isActive: true,
  },
  {
    name: 'One Piece Card Spotlight (Random)',
    slug: 'onepiece-card-spotlight',
    description: 'Auto-fetches a random One Piece TCG card; generates a short spotlight post.',
    instructions: 'Card spotlight under 150 words. Hook, one key point, reader question. HTML with <h2> and <p>.',
    minWords: 100,
    maxWords: 150,
    generateImage: false,
    isActive: true,
  },
  {
    name: 'Lorcana Card Spotlight (Random)',
    slug: 'lorcana-card-spotlight',
    description: 'Auto-fetches a random Disney Lorcana card; generates a short spotlight post.',
    instructions: 'Card spotlight under 150 words. Hook, one key point, reader question. HTML with <h2> and <p>.',
    minWords: 100,
    maxWords: 150,
    generateImage: false,
    isActive: true,
  },
];

export default router;
