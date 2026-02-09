import { Router } from 'express';
import { getPrisma } from '../deps.js';
import { runPipelineForArticle } from '../../queue/pipeline.js';
import { requireApiKey } from '../auth.js';

const router = Router();
const prisma = getPrisma();

function getParamId(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

router.get('/', async (req, res) => {
  try {
    const game = req.query.game as string | undefined;
    const processed = req.query.processed as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const list = await prisma.article.findMany({
      where: {
        ...(game ? { game: game as 'pokemon' | 'onepiece' | 'mtg' } : {}),
        ...(processed === 'true' ? { isProcessed: true } : processed === 'false' ? { isProcessed: false } : {}),
      },
      orderBy: { scrapedAt: 'desc' },
      take: limit,
      include: { source: { select: { name: true, url: true } } },
    });
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const a = await prisma.article.findUnique({
      where: { id: req.params.id },
      include: { source: true },
    });
    if (!a) return res.status(404).json({ error: 'Not found' });
    return res.json(a);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.post('/:id/generate', requireApiKey, async (req, res) => {
  try {
    const articleId = getParamId(req.params.id);
    if (!articleId) return res.status(400).json({ error: 'Missing article id' });
    const platform = (req.body?.platform ?? 'instagram') as string;
    const postType = (req.body?.postType ?? 'news') as string;
    const generateImage = Boolean(req.body?.generateImage);
    const pendingId = await runPipelineForArticle({
      articleId,
      platform: platform as any,
      postType,
      generateImage,
    });
    return res.status(201).json({ pendingPostId: pendingId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const code = msg.includes('not found') ? 404 : 500;
    return res.status(code).json({ error: msg });
  }
});

export default router;
