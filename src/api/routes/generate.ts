import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireApiKey } from '../auth.js';
import { getPrisma } from '../deps.js';
import { getConfig } from '../../config.js';
import Anthropic from '@anthropic-ai/sdk';
import type { PostTypeConfig } from './postTypes.js';

const router = Router();
const prisma = getPrisma();

const generateSchema = z.object({
  postTypeSlug: z.string().min(1),
  topic: z.string().min(1),
  game: z.enum(['pokemon', 'onepiece', 'mtg']),
  additionalContext: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

async function getPostTypes(): Promise<PostTypeConfig[]> {
  const row = await prisma.setting.findUnique({ where: { key: 'POST_TYPES' } });
  if (row?.value) return row.value as unknown as PostTypeConfig[];
  const { DEFAULT_POST_TYPES } = await import('./postTypes.js');
  return DEFAULT_POST_TYPES;
}

router.post('/', requireApiKey, async (req, res) => {
  try {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const { postTypeSlug, topic, game, additionalContext, imageUrl: providedImageUrl } = parsed.data;

    const postTypes = await getPostTypes();
    const postType = postTypes.find((t) => t.slug === postTypeSlug);
    if (!postType) {
      return res.status(400).json({ error: `Post type "${postTypeSlug}" not found` });
    }

    const cfg = getConfig();
    if (!cfg.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });
    }

    const anthropic = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });

    const system = `You are a professional blog writer for TCG communities.

POST TYPE: ${postType.name}
${postType.description ? `DESCRIPTION: ${postType.description}` : ''}

WRITING INSTRUCTIONS:
${postType.instructions}

RULES:
- The post MUST be between ${postType.minWords} and ${postType.maxWords} words.
- Output valid JSON only, no extra text.
- Do not attribute sources or mention where information came from.`;

    const user = `Topic: ${topic}
Game: ${game}
${additionalContext ? `Additional context: ${additionalContext}` : ''}

Respond as JSON:
{
  "title": "a compelling blog post title",
  "body": "the full blog post body as HTML (${postType.minWords}-${postType.maxWords} words, use <h2> for sections and <p> for paragraphs)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "excerpt": "a 1-2 sentence excerpt for the post preview"
}`;

    const maxTokens = Math.max(2000, Math.ceil(postType.maxWords * 2));

    const msg = await anthropic.messages.create({
      model: cfg.DEFAULT_AI_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textBlock = msg.content.find((c) => c.type === 'text');
    const rawText = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    // Strip markdown code fences if present, then extract JSON
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

    const title = content.title ?? topic;
    const body = content.body ?? '';
    const tags = Array.isArray(content.tags) ? content.tags : [];
    const excerpt = content.excerpt ?? '';

    // Use user-provided image URL if given
    const imageUrl = providedImageUrl ?? null;

    // Save as pending for review in the Approval Queue
    const pendingPost = await prisma.pendingPost.create({
      data: {
        content: body,
        platform: 'wordpress' as any,
        postType: postType.slug,
        generatedImageUrl: imageUrl,
        imageSource: imageUrl ? 'original' : 'none',
        hashtags: tags,
        status: 'pending',
        generationMetadata: {
          wpTitle: title,
          wpTags: tags,
          wpExcerpt: excerpt,
          postTypeSlug: postType.slug,
          game,
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
      status: 'pending_review',
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

export default router;
