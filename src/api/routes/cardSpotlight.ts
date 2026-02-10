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

    const system = `You are a passionate Magic: The Gathering expert and blog writer for a TCG community site.

You are writing a "Card Spotlight" post about a specific MTG card. Your audience are MTG players ranging from casual to competitive.

WRITING GUIDELINES:
- Open with an engaging hook about the card
- Cover the card's abilities and what makes it interesting or powerful
- Discuss strategy: what decks it fits in, key combos, and how to use it effectively
- Mention the artist and comment on the artwork
- Include set context and rarity significance
- If the card has a notable price, mention market value and why
- If the card has flavor text, discuss the lore
- End with a verdict: who should play this card and why
- Format as HTML with <h2> for sections and <p> for paragraphs
- Keep it between 600 and 1200 words
- Be enthusiastic but informative
- Do NOT include <img> tags in the body

Output valid JSON only, no extra text.`;

    const user = `Write a Card Spotlight blog post about this Magic: The Gathering card:

${cardContext}

Respond as JSON:
{
  "title": "a compelling blog post title featuring the card name",
  "body": "the full blog post as HTML (600-1200 words)",
  "tags": ["mtg", "card-spotlight", "and", "3-5", "more relevant tags"],
  "excerpt": "a 1-2 sentence teaser for the post preview"
}`;

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
    const body = content.body ?? '';
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
