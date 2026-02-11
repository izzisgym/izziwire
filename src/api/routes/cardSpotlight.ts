import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { requireApiKey } from '../auth.js';
import { getPrisma } from '../deps.js';
import { getConfig } from '../../config.js';
import { getRandomCard, formatCardForPromptShort } from '../../search/scryfallClient.js';
import type { ScryfallCard } from '../../search/scryfallClient.js';
import { isValidImageUrl } from '../../search/imageFinder.js';
import Anthropic from '@anthropic-ai/sdk';

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
 * Fetches a random MTG card from Scryfall, generates a blog post about it,
 * and sends it to the Approval Queue.
 */
router.post('/', requireApiKey, async (_req, res) => {
  try {
    const cfg = getConfig();
    if (!cfg.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });
    }

    // 1. Fetch a random MTG card from Scryfall
    let card: ScryfallCard;
    try {
      card = await getRandomCard();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(502).json({ error: `Failed to fetch card from Scryfall: ${msg}` });
    }

    // 2. Use full card image (not art crop); validate it loads
    let imageUrl: string | null = card.imageUrl ?? card.artCropUrl;
    if (imageUrl) {
      const valid = await isValidImageUrl(imageUrl);
      if (!valid && card.artCropUrl && card.artCropUrl !== imageUrl)
        imageUrl = card.artCropUrl;
      if (imageUrl && !(await isValidImageUrl(imageUrl))) imageUrl = null;
    }

    // 3. Generate the blog post with Claude (minimal prompt + short card context to stay under rate limit)
    const cardContext = formatCardForPromptShort(card);
    const anthropic = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });
    const system = `MTG Card Spotlight. You MUST write 100-150 words total—no more. Structure: (1) One short hook in one <p>. (2) One <p> with one key point—ability or strategy. (3) One <p> ending with a reader question ("Have you used this card?" etc). Use only <h2> and <p>. Count words; stop at 150. Output only JSON.`;
    const user = `Write a 100-150 word spotlight for this card. Exactly 3 short <p> tags: hook, one key point, then reader question. Do not exceed 150 words.\n\n${cardContext}\n\nJSON: {"title":"...","body":"HTML","tags":["mtg","card-spotlight",...],"excerpt":"..."}`;

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

    const title = content.title ?? `Card Spotlight: ${card.name}`;
    let body = content.body ?? '';
    body = splitLongParagraphs(body);
    body = enforceMaxWordsTotal(body);
    const tags = Array.isArray(content.tags) ? content.tags : ['mtg', 'card-spotlight'];
    const excerpt = content.excerpt ?? '';

    // 4. Create pending post in Approval Queue
    const pendingPost = await prisma.pendingPost.create({
      data: {
        content: body,
        platform: 'wordpress' as any,
        postType: 'mtg-card-spotlight',
        generatedImageUrl: imageUrl,
        imageSource: imageUrl ? 'original' : 'none',
        hashtags: tags,
        status: 'pending',
        generationMetadata: {
          wpTitle: title,
          wpTags: tags,
          wpExcerpt: excerpt,
          postTypeSlug: 'mtg-card-spotlight',
          game: 'mtg',
          cardName: card.name,
          cardSet: card.setName,
          cardRarity: card.rarity,
          cardArtist: card.artist,
          tcgplayerUrl: card.tcgplayerUrl,
          scryfallUrl: card.scryfallUrl,
          priceUsd: card.priceUsd,
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
      card: {
        name: card.name,
        set: card.setName,
        rarity: card.rarity,
        artist: card.artist,
        priceUsd: card.priceUsd,
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
 * Fetch a random card without generating a post (for preview/reroll).
 */
router.get('/preview', requireApiKey, async (_req, res) => {
  try {
    const card = await getRandomCard();
    return res.json({
      name: card.name,
      typeLine: card.typeLine,
      manaCost: card.manaCost,
      oracleText: card.oracleText,
      power: card.power,
      toughness: card.toughness,
      rarity: card.rarity,
      setName: card.setName,
      artist: card.artist,
      imageUrl: card.imageUrl,
      artCropUrl: card.artCropUrl,
      priceUsd: card.priceUsd,
      tcgplayerUrl: card.tcgplayerUrl,
    });
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : 'Scryfall error' });
  }
});

export default router;
