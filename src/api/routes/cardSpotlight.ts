import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { requireApiKey } from '../auth.js';
import { getPrisma } from '../deps.js';
import { getConfig } from '../../config.js';
import { getRandomCard, formatCardForPrompt } from '../../search/scryfallClient.js';
import type { ScryfallCard } from '../../search/scryfallClient.js';
import { isValidImageUrl } from '../../search/imageFinder.js';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const prisma = getPrisma();

const MAX_WORDS_PER_P = 80;

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

    // 2. Validate the card image
    let imageUrl: string | null = card.artCropUrl ?? card.imageUrl;
    if (imageUrl) {
      const valid = await isValidImageUrl(imageUrl);
      if (!valid) imageUrl = card.imageUrl; // fall back to full card image
      if (imageUrl && !(await isValidImageUrl(imageUrl))) imageUrl = null;
    }

    // 3. Generate the blog post with Claude
    const cardContext = formatCardForPrompt(card);
    const anthropic = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });

    const system = `MTG Card Spotlight writer for a TCG site. Audience: casual to competitive players.

HARD RULE — PARAGRAPH LENGTH: Every <p> MUST be 80 words or fewer. Count the words in each paragraph. If any <p> has more than 80 words, split it into multiple <p> tags. No exceptions. Prefer 2–4 short <p> per section rather than one long one.

Content: Hook, abilities, strategy/decks/combos, artist & art, set/rarity, price if notable, flavor/lore, verdict. End with one reader question (e.g. "Have you ever used this card?" / "Do you have this card?").

Style: First sentence = strongest hook. Short sentences. 8th-grade level. One clear CTA. HTML: <h2> sections, <p> only. 600–1200 words total. No <img>.

Process: Before outputting, verify every <p> is ≤80 words; split any that are longer. Output only final JSON.`;

    const user = `Card Spotlight for this MTG card. CRITICAL: each <p> must be 80 words or less — split long paragraphs into multiple <p>.

${cardContext}

JSON:
{"title":"...","body":"HTML; every <p> max 80 words","tags":["mtg","card-spotlight",...],"excerpt":"1-2 sentence teaser"}`;

    const msg = await anthropic.messages.create({
      model: cfg.DEFAULT_AI_MODEL,
      max_tokens: 3000,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textBlock = msg.content.find((c) => c.type === 'text');
    const rawText = textBlock && textBlock.type === 'text' ? textBlock.text : '';
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
