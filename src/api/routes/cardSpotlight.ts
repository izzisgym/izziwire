import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { requireApiKey } from '../auth.js';
import { getPrisma } from '../deps.js';
import { getConfig } from '../../config.js';
import { getRandomCard } from '../../search/scryfallClient.js';
import { getRandomPokemonCard } from '../../search/pokemonCardClient.js';
import { getRandomOnePieceCard } from '../../search/onepieceCardClient.js';
import { getRandomLorcanaCard } from '../../search/lorcanaCardClient.js';
import type { CardForSpotlight } from '../../search/cardSpotlightTypes.js';
import { formatCardForSpotlightShort } from '../../search/cardSpotlightTypes.js';
import { isValidImageUrl } from '../../search/imageFinder.js';
import Anthropic from '@anthropic-ai/sdk';

const CARD_SPOTLIGHT_GAMES = ['mtg', 'pokemon', 'onepiece', 'lorcana'] as const;
type CardSpotlightGame = (typeof CARD_SPOTLIGHT_GAMES)[number];

const GAME_LABELS: Record<CardSpotlightGame, string> = {
  mtg: 'Magic: The Gathering',
  pokemon: 'Pokemon TCG',
  onepiece: 'One Piece TCG',
  lorcana: 'Disney Lorcana',
};

async function fetchRandomCardForGame(game: CardSpotlightGame): Promise<CardForSpotlight> {
  switch (game) {
    case 'mtg': {
      const mtgCard = await getRandomCard();
      return {
        game: 'mtg',
        name: mtgCard.name,
        imageUrl: mtgCard.imageUrl ?? mtgCard.artCropUrl,
        setName: mtgCard.setName,
        setCode: mtgCard.setCode,
        rarity: mtgCard.rarity,
        artist: mtgCard.artist,
        text: mtgCard.oracleText ?? mtgCard.flavorText,
        price: mtgCard.priceUsd,
      };
    }
    case 'pokemon':
      return getRandomPokemonCard();
    case 'onepiece':
      return getRandomOnePieceCard();
    case 'lorcana':
      return getRandomLorcanaCard();
    default:
      return fetchRandomCardForGame('mtg');
  }
}

const router = Router();
const prisma = getPrisma();

const MAX_WORDS_PER_P = 80;
const MAX_WORDS_TOTAL = 150;

/** Split paragraph content into chunks of at most maxWords; return HTML <p> tags. */
function splitLongParagraphs(html: string, maxWords: number = MAX_WORDS_PER_P): string {
  return html.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, inner) => {
    const text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(/\s+/).filter(Boolean) : [];
    if (words.length <= maxWords) return `<p>${inner}</p>`;
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += maxWords) {
      chunks.push(words.slice(i, i + maxWords).join(' '));
    }
    return chunks.map((c) => `<p>${c}</p>`).join('');
  });
}

/** Safety only: if over maxWords, truncate at last sentence boundary within first maxWords so it doesn't cut mid-sentence. */
function enforceMaxWordsTotal(html: string, maxWords: number = MAX_WORDS_TOTAL): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  if (words.length <= maxWords) return html;
  const withinLimit = words.slice(0, maxWords).join(' ');
  const lastEnd = Math.max(withinLimit.lastIndexOf('. '), withinLimit.lastIndexOf('! '), withinLimit.lastIndexOf('? '));
  const cut = lastEnd >= 0 ? withinLimit.slice(0, lastEnd + 1).trim() : withinLimit;
  const cutWords = cut.split(/\s+/).filter(Boolean);
  const result: string[] = [];
  for (let i = 0; i < cutWords.length; i += MAX_WORDS_PER_P) {
    result.push('<p>' + cutWords.slice(i, i + MAX_WORDS_PER_P).join(' ') + '</p>');
  }
  return result.join('');
}

/**
 * POST /api/card-spotlight
 * Body: { game?: 'mtg' | 'pokemon' | 'onepiece' | 'lorcana' }
 * Fetches a random card for that game, generates a 150-word spotlight, and sends it to the Approval Queue.
 */
router.post('/', requireApiKey, async (req, res) => {
  try {
    const cfg = getConfig();
    if (!cfg.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });
    }

    const game: CardSpotlightGame =
      CARD_SPOTLIGHT_GAMES.includes(req.body?.game as CardSpotlightGame) ? req.body.game : 'mtg';
    const gameLabel = GAME_LABELS[game];

    // 1. Fetch a random card for the chosen game
    let card: CardForSpotlight;
    try {
      card = await fetchRandomCardForGame(game);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(502).json({ error: `Failed to fetch card: ${msg}` });
    }

    // 2. Validate card image loads
    let imageUrl: string | null = card.imageUrl;
    if (imageUrl && !(await isValidImageUrl(imageUrl))) imageUrl = null;

    // 3. Generate the blog post with Claude
    const cardContext = formatCardForSpotlightShort(card);
    const anthropic = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });
    const system = `${gameLabel} Card Spotlight. You MUST write 100-150 words total—no more. Structure: (1) One short hook in one <p>. (2) One <p> with one key point—ability or strategy. (3) One <p> ending with a reader question ("Have you used this card?" etc). Use only <h2> and <p>. Count words; stop at 150. Output only JSON.`;
    const user = `Write a 100-150 word spotlight for this ${gameLabel} card. Exactly 3 short <p> tags: hook, one key point, then reader question. Do not exceed 150 words.\n\n${cardContext}\n\nJSON: {"title":"...","body":"HTML","tags":["${game}","card-spotlight",...],"excerpt":"..."}`;

    const messages: { role: 'user'; content: string }[] = [{ role: 'user', content: user }];
    const createBody = {
      model: cfg.DEFAULT_AI_MODEL,
      max_tokens: 2500,
      system,
      messages,
    };

    type MessageResult = { content: Array<{ type: string; text?: string }> };
    let msg: MessageResult | undefined;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await anthropic.messages.create(createBody);
        msg = response as MessageResult;
        break;
      } catch (e: unknown) {
        lastErr = e;
        const is429 = e && typeof e === 'object' && 'status' in e && (e as { status?: number }).status === 429;
        if (is429 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 65_000));
          continue;
        }
        throw e;
      }
    }
    if (!msg) throw lastErr;

    const textBlock = msg.content.find((c: { type: string }) => c.type === 'text');
    const rawText = (textBlock && textBlock.type === 'text' ? textBlock.text : '') ?? '';
    const cleaned = rawText
      .replace(/^```(?:json)?\s*\n?/m, '')
      .replace(/\n?```\s*$/m, '')
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'AI did not return valid JSON' });
    }

    const content = JSON.parse(jsonMatch[0]) as {
      title?: string;
      body?: string;
      tags?: string[];
      excerpt?: string;
    };

    const postTypeSlug = `${game}-card-spotlight`;
    const title = content.title ?? `Card Spotlight: ${card.name}`;
    let body = content.body ?? '';
    body = splitLongParagraphs(body);
    body = enforceMaxWordsTotal(body);
    const tags = Array.isArray(content.tags) ? content.tags : [game, 'card-spotlight'];
    const excerpt = content.excerpt ?? '';

    // 4. Create pending post in Approval Queue
    const pendingPost = await prisma.pendingPost.create({
      data: {
        content: body,
        platform: 'wordpress' as any,
        postType: postTypeSlug,
        generatedImageUrl: imageUrl,
        imageSource: imageUrl ? 'original' : 'none',
        hashtags: tags,
        status: 'pending',
        generationMetadata: {
          wpTitle: title,
          wpTags: tags,
          wpExcerpt: excerpt,
          postTypeSlug,
          game,
          cardName: card.name,
          cardSet: card.setName,
          cardRarity: card.rarity,
          cardArtist: card.artist,
          priceUsd: card.price ?? undefined,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return res.json({
      ok: true,
      pendingPostId: pendingPost.id,
      title,
      excerpt,
      tags,
      hasImage: !!imageUrl,
      game,
      card: {
        name: card.name,
        set: card.setName,
        rarity: card.rarity,
        artist: card.artist,
        priceUsd: card.price ?? undefined,
        imageUrl,
      },
      status: 'pending_review',
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

/**
 * GET /api/card-spotlight/preview
 * Query: ?game=mtg|pokemon|onepiece|lorcana (default mtg)
 * Fetch a random card without generating a post (for preview/reroll).
 */
router.get('/preview', requireApiKey, async (req, res) => {
  try {
    const game: CardSpotlightGame =
      CARD_SPOTLIGHT_GAMES.includes(req.query?.game as CardSpotlightGame) ? (req.query.game as CardSpotlightGame) : 'mtg';
    const card = await fetchRandomCardForGame(game);
    return res.json({
      game: card.game,
      name: card.name,
      setName: card.setName,
      setCode: card.setCode,
      rarity: card.rarity,
      artist: card.artist,
      text: card.text,
      priceUsd: card.price ?? undefined,
      imageUrl: card.imageUrl,
    });
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : 'Card API error' });
  }
});

export default router;
