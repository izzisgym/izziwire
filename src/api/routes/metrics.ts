import { Router } from 'express';
import { getPrisma } from '../deps.js';

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

export default router;
