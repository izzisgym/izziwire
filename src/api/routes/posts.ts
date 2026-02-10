import { Router } from 'express';
import * as workflow from '../../queue/workflow.js';
import { z } from 'zod';
import { requireApiKey } from '../auth.js';
import { getPrisma } from '../deps.js';
import { getConfig } from '../../config.js';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';
import { publishWordPressDraft } from '../../publish/wordpress.js';
import { getSetting } from '../../settings/store.js';

const router = Router();

function getParamId(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

router.get('/published', async (_req, res) => {
  try {
    const { getPrisma } = await import('../deps.js');
    const prisma = getPrisma();
    const list = await prisma.publishedPost.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 100,
      include: { pendingPost: { select: { content: true, postType: true } } },
    });
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

const approveBody = z.object({
  scheduledFor: z.string().datetime().optional(),
  notes: z.string().optional(),
});
const rejectBody = z.object({ reason: z.string().min(1) });

// Debug endpoint to test WordPress connection (must be before /:id)
router.get('/wp-test', requireApiKey, async (_req, res) => {
  try {
    const cfg = getConfig();
    if (!cfg.WORDPRESS_URL || !cfg.WORDPRESS_USERNAME || !cfg.WORDPRESS_APP_PASSWORD) {
      return res.json({
        ok: false,
        error: 'Missing credentials',
        hasUrl: !!cfg.WORDPRESS_URL,
        hasUsername: !!cfg.WORDPRESS_USERNAME,
        hasPassword: !!cfg.WORDPRESS_APP_PASSWORD,
      });
    }

    const baseUrl = cfg.WORDPRESS_URL.replace(/\/$/, '');
    const token = Buffer.from(`${cfg.WORDPRESS_USERNAME}:${cfg.WORDPRESS_APP_PASSWORD}`).toString('base64');

    const apiRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Basic ${token}` },
    });
    const apiBody = await apiRes.text();

    return res.json({
      ok: apiRes.ok,
      status: apiRes.status,
      url: `${baseUrl}/wp-json/wp/v2/users/me`,
      username: cfg.WORDPRESS_USERNAME,
      passwordLength: cfg.WORDPRESS_APP_PASSWORD.length,
      response: apiBody.slice(0, 500),
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.get('/pending', async (_req, res) => {
  try {
    const list = await workflow.getPendingPosts(50);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const post = await workflow.getPostById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    return res.json(post);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.post('/:id/approve', requireApiKey, async (req, res) => {
  try {
    const postId = getParamId(req.params.id);
    if (!postId) return res.status(400).json({ error: 'Missing post id' });
    const parsed = approveBody.safeParse(req.body);
    const input = parsed.success
      ? {
          scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : undefined,
          notes: parsed.data.notes,
        }
      : {};
    await workflow.approvePost(postId, input);
    return res.json({ ok: true, status: input.scheduledFor ? 'scheduled' : 'approved' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const code = msg === 'Post not found' ? 404 : msg.startsWith('Invalid transition') ? 400 : 500;
    return res.status(code).json({ error: msg });
  }
});

router.post('/:id/reject', requireApiKey, async (req, res) => {
  try {
    const postId = getParamId(req.params.id);
    if (!postId) return res.status(400).json({ error: 'Missing post id' });
    const parsed = rejectBody.safeParse(req.body);
    const reason = parsed.success ? parsed.data.reason : (req.body?.reason as string) ?? 'No reason';
    await workflow.rejectPost(postId, reason);
    return res.json({ ok: true, status: 'rejected' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const code = msg === 'Post not found' ? 404 : msg.startsWith('Invalid transition') ? 400 : 500;
    return res.status(code).json({ error: msg });
  }
});

router.post('/:id/schedule', requireApiKey, async (req, res) => {
  try {
    const postId = getParamId(req.params.id);
    if (!postId) return res.status(400).json({ error: 'Missing post id' });
    const scheduledFor = req.body?.scheduledFor;
    const d = scheduledFor ? new Date(scheduledFor) : undefined;
    if (!d || Number.isNaN(d.getTime())) {
      return res.status(400).json({ error: 'scheduledFor must be a valid ISO date string' });
    }
    await workflow.approvePost(postId, { scheduledFor: d, notes: req.body?.notes });
    return res.json({ ok: true, status: 'scheduled', scheduledFor: d.toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const code = msg === 'Post not found' ? 404 : msg.startsWith('Invalid transition') ? 400 : 500;
    return res.status(code).json({ error: msg });
  }
});

// Publish an approved post to WordPress
router.post('/:id/publish', requireApiKey, async (req, res) => {
  try {
    const postId = getParamId(req.params.id);
    if (!postId) return res.status(400).json({ error: 'Missing post id' });

    const prisma = getPrisma();
    const post = await prisma.pendingPost.findUnique({
      where: { id: postId },
      include: { article: true },
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.status !== 'approved' && post.status !== 'pending') {
      return res.status(400).json({ error: `Cannot publish post with status "${post.status}"` });
    }

    const meta = (post.generationMetadata ?? {}) as {
      wpTitle?: string;
      wpTags?: string[];
      game?: string;
    };
    const title = meta.wpTitle ?? post.content.slice(0, 80);
    const tags = meta.wpTags ?? post.hashtags ?? [];
    const game = meta.game ?? post.article?.game;

    const categoryId =
      game === 'pokemon'
        ? await getSetting('WP_CATEGORY_POKEMON', 0)
        : game === 'onepiece'
          ? await getSetting('WP_CATEGORY_ONEPIECE', 0)
          : await getSetting('WP_CATEGORY_MTG', 0);

    let wpResult: { id: number; link?: string };
    try {
      wpResult = await publishWordPressDraft({
        title,
        body: post.content,
        tags,
        categoryId,
        featuredImageUrl: post.generatedImageUrl ?? null,
      });
    } catch (wpErr) {
      const wpMsg = wpErr instanceof Error ? wpErr.message : 'Unknown WordPress error';
      return res.status(500).json({ error: `WordPress publish failed: ${wpMsg}` });
    }

    await prisma.pendingPost.update({
      where: { id: postId },
      data: { status: 'published' },
    });

    await prisma.publishedPost.create({
      data: {
        pendingPostId: postId,
        platform: 'wordpress',
        platformPostId: String(wpResult.id),
        postUrl: wpResult.link ?? undefined,
      },
    });

    return res.json({
      ok: true,
      wpPostId: wpResult.id,
      link: wpResult.link,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
});

export default router;
