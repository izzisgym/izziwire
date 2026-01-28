import { Router } from 'express';
import * as workflow from '../../queue/workflow.js';
import { z } from 'zod';

const router = Router();

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

router.post('/:id/approve', async (req, res) => {
  try {
    const parsed = approveBody.safeParse(req.body);
    const input = parsed.success
      ? {
          scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : undefined,
          notes: parsed.data.notes,
        }
      : {};
    await workflow.approvePost(req.params.id, input);
    return res.json({ ok: true, status: input.scheduledFor ? 'scheduled' : 'approved' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const code = msg === 'Post not found' ? 404 : msg.startsWith('Invalid transition') ? 400 : 500;
    return res.status(code).json({ error: msg });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const parsed = rejectBody.safeParse(req.body);
    const reason = parsed.success ? parsed.data.reason : (req.body?.reason as string) ?? 'No reason';
    await workflow.rejectPost(req.params.id, reason);
    return res.json({ ok: true, status: 'rejected' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const code = msg === 'Post not found' ? 404 : msg.startsWith('Invalid transition') ? 400 : 500;
    return res.status(code).json({ error: msg });
  }
});

router.post('/:id/schedule', async (req, res) => {
  try {
    const scheduledFor = req.body?.scheduledFor;
    const d = scheduledFor ? new Date(scheduledFor) : undefined;
    if (!d || Number.isNaN(d.getTime())) {
      return res.status(400).json({ error: 'scheduledFor must be a valid ISO date string' });
    }
    await workflow.approvePost(req.params.id, { scheduledFor: d, notes: req.body?.notes });
    return res.json({ ok: true, status: 'scheduled', scheduledFor: d.toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const code = msg === 'Post not found' ? 404 : msg.startsWith('Invalid transition') ? 400 : 500;
    return res.status(code).json({ error: msg });
  }
});

export default router;
