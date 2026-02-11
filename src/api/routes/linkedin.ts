import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../deps.js';
import { getConfig } from '../../config.js';
import { getCurrentMember } from '../../linkedin/me.js';
import { createPost } from '../../linkedin/posts-api.js';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// Status
router.get('/status', async (_req, res) => {
  const prisma = getPrisma();
  const token = await prisma.linkedInToken.findFirst();
  res.json({ linkedInConnected: !!token });
});

// Publish post (manual)
const postBodySchema = z.object({ commentary: z.string().min(1).max(3000) });
router.post('/posts', async (req, res) => {
  const parsed = postBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  const prisma = getPrisma();
  const tokenRow = await prisma.linkedInToken.findFirst();
  if (!tokenRow) {
    res.status(401).json({ error: 'LinkedIn not connected' });
    return;
  }

  try {
    const me = await getCurrentMember(tokenRow.accessToken);
    const authorUrn = `urn:li:person:${me.id}`;
    const result = await createPost({
      accessToken: tokenRow.accessToken,
      authorUrn,
      commentary: parsed.data.commentary,
    });
    res.json({ id: result.id, author: me.id });
  } catch (e) {
    console.error('LinkedIn create post error', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Publish failed' });
  }
});

// Topics
const topicCreateSchema = z.object({ name: z.string().min(1), keywords: z.string().optional() });
const topicUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  keywords: z.string().optional(),
  enabled: z.boolean().optional(),
});

router.get('/topics', async (_req, res) => {
  const prisma = getPrisma();
  const list = await prisma.linkedInTopic.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(list);
});

router.post('/topics', async (req, res) => {
  const parsed = topicCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const prisma = getPrisma();
  const topic = await prisma.linkedInTopic.create({
    data: { name: parsed.data.name, keywords: parsed.data.keywords ?? undefined },
  });
  res.json(topic);
});

router.patch('/topics/:id', async (req, res) => {
  const parsed = topicUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const prisma = getPrisma();
  const topic = await prisma.linkedInTopic.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(topic);
});

router.delete('/topics/:id', async (req, res) => {
  const prisma = getPrisma();
  await prisma.linkedInTopic.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// Drafts
const draftCreateSchema = z.object({ content: z.string().min(1), topicId: z.string().optional() });

router.get('/drafts', async (_req, res) => {
  const prisma = getPrisma();
  const list = await prisma.linkedInDraft.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(list);
});

router.post('/drafts', async (req, res) => {
  const parsed = draftCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const prisma = getPrisma();
  const draft = await prisma.linkedInDraft.create({
    data: {
      content: parsed.data.content,
      topicId: parsed.data.topicId ?? undefined,
      status: 'draft',
    },
  });
  res.json(draft);
});

router.post('/drafts/:id/approve', async (req, res) => {
  const prisma = getPrisma();
  const draft = await prisma.linkedInDraft.findUnique({ where: { id: req.params.id } });
  if (!draft) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  if (draft.status !== 'draft' && draft.status !== 'approved') {
    res.status(400).json({ error: 'Draft already published or rejected' });
    return;
  }

  const tokenRow = await prisma.linkedInToken.findFirst();
  if (!tokenRow) {
    res.status(401).json({ error: 'LinkedIn not connected' });
    return;
  }

  try {
    const me = await getCurrentMember(tokenRow.accessToken);
    const authorUrn = `urn:li:person:${me.id}`;
    await createPost({
      accessToken: tokenRow.accessToken,
      authorUrn,
      commentary: draft.content,
    });
    await prisma.linkedInDraft.update({
      where: { id: draft.id },
      data: { status: 'published', publishedAt: new Date() },
    });
    res.json({ ok: true, draftId: draft.id });
  } catch (e) {
    console.error('LinkedIn publish draft error', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Publish failed' });
  }
});

router.patch('/drafts/:id', async (req, res) => {
  const { status } = req.body as { status?: string };
  if (status && !['draft', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const prisma = getPrisma();
  const draft = await prisma.linkedInDraft.update({
    where: { id: req.params.id },
    data: status ? { status } : {},
  });
  res.json(draft);
});

// Generate a post that agrees or disagrees with pasted content
const generateResponseSchema = z.object({
  postText: z.string().min(1).max(10000),
  stance: z.enum(['agree', 'disagree']),
});

router.post('/generate-response', async (req, res) => {
  const parsed = generateResponseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  const cfg = getConfig();
  if (!cfg.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'AI not configured (ANTHROPIC_API_KEY)' });
    return;
  }

  const { postText, stance } = parsed.data;
  const anthropic = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });
  const stanceInstruction =
    stance === 'agree'
      ? 'Write a short LinkedIn post that agrees with the ideas below. Add your own angle or example; be genuine and professional.'
      : 'Write a short LinkedIn post that respectfully disagrees or offers a different perspective. Be constructive and professional, not combative.';

  try {
    const msg = await anthropic.messages.create({
      model: cfg.DEFAULT_AI_MODEL,
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `You are writing a LinkedIn post for the user. ${stanceInstruction}\n\nOutput only the post text (no "Here's my take" or preamble). Keep it under 200 words, suitable for LinkedIn.\n\n---\nPost to respond to:\n${postText}`,
        },
      ],
    });

    const block = msg.content.find((b) => b.type === 'text');
    const content = block && block.type === 'text' ? block.text.trim() : '';
    res.json({ content });
  } catch (e) {
    console.error('LinkedIn generate-response error', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Generation failed' });
  }
});

// Suggest comment
const commentBodySchema = z
  .object({
    postText: z.string().min(1).optional(),
    postUrl: z.string().url().optional(),
  })
  .refine((d) => d.postText ?? d.postUrl, { message: 'Provide postText or postUrl' });

router.post('/comment/suggest', async (req, res) => {
  const parsed = commentBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  const cfg = getConfig();
  if (!cfg.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'AI not configured (ANTHROPIC_API_KEY)' });
    return;
  }

  const text =
    parsed.data.postText ??
    `Post at URL: ${parsed.data.postUrl}. (User will paste the post content if needed.)`;
  const anthropic = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });

  try {
    const msg = await anthropic.messages.create({
      model: cfg.DEFAULT_AI_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `You are a professional LinkedIn comment assistant. Given the following LinkedIn post (or its URL/context), write a short, genuine, professional comment (2-4 sentences) that adds value—e.g. insight, question, or appreciation. Do not be generic or salesy. Output only the comment text, no preamble.\n\nPost:\n${text}`,
        },
      ],
    });

    const block = msg.content.find((b) => b.type === 'text');
    const suggestedComment = block && block.type === 'text' ? block.text.trim() : '';
    res.json({ suggestedComment });
  } catch (e) {
    console.error('LinkedIn comment suggest error', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Suggestion failed' });
  }
});

export default router;
