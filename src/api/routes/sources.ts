import { Router } from 'express';
import { getPrisma } from '../deps.js';
import { z } from 'zod';
import { requireApiKey } from '../auth.js';

const router = Router();
const prisma = getPrisma();

function getParamId(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const gameEnum = z.enum(['pokemon', 'onepiece', 'mtg']);
const sourceTypeEnum = z.enum(['rss', 'web', 'api']);
const createBody = z.object({
  name: z.string().min(1),
  game: gameEnum,
  sourceType: sourceTypeEnum,
  url: z.string().url(),
  rssFeedUrl: z.string().url().optional(),
  scrapeSelector: z.record(z.string(), z.string()).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
});

router.get('/', async (_req, res) => {
  try {
    const list = await prisma.newsSource.findMany({
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const sourceId = getParamId(req.params.id);
    if (!sourceId) return res.status(400).json({ error: 'Missing source id' });
    const s = await prisma.newsSource.findUnique({ where: { id: sourceId } });
    if (!s) return res.status(404).json({ error: 'Not found' });
    return res.json(s);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.post('/', requireApiKey, async (req, res) => {
  try {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const created = await prisma.newsSource.create({ data: parsed.data });
    return res.status(201).json(created);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.put('/:id', requireApiKey, async (req, res) => {
  try {
    const sourceId = getParamId(req.params.id);
    if (!sourceId) return res.status(400).json({ error: 'Missing source id' });
    const body = req.body as Record<string, unknown>;
    const updated = await prisma.newsSource.update({
      where: { id: sourceId },
      data: {
        name: body.name as string | undefined,
        sourceType: body.sourceType as string | undefined,
        url: body.url as string | undefined,
        rssFeedUrl: body.rssFeedUrl as string | null | undefined,
        scrapeSelector: body.scrapeSelector as object | undefined,
        isActive: body.isActive as boolean | undefined,
        priority: body.priority as number | undefined,
      },
    });
    return res.json(updated);
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2025') {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.delete('/:id', requireApiKey, async (req, res) => {
  try {
    const sourceId = getParamId(req.params.id);
    if (!sourceId) return res.status(400).json({ error: 'Missing source id' });
    await prisma.newsSource.delete({ where: { id: sourceId } });
    return res.status(204).send();
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2025') {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.post('/:id/scrape', requireApiKey, async (_req, res) => {
  try {
    const { runScrapeCycle } = await import('../../scraper/scheduler.js');
    await runScrapeCycle();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

export default router;
