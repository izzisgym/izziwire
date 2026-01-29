import { getConfig } from '../config.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';
import { getPrisma } from '../api/deps.js';
import { getSetting } from '../settings/store.js';
import { summarizeNewsItem } from '../ai/newsSummarizer.js';

type Game = 'pokemon' | 'onepiece' | 'mtg';

interface SearchResult {
  title: string;
  url: string;
  snippet?: string | null;
  imageUrl?: string | null;
  publishedAt?: Date | null;
}

const prisma = getPrisma();

async function ensureSearchSource(game: Game) {
  const name = `Open Web Search (${game})`;
  const existing = await prisma.newsSource.findFirst({
    where: { name, game },
  });
  if (existing) return existing;
  return prisma.newsSource.create({
    data: {
      name,
      game,
      sourceType: 'search',
      url: 'open-web',
      isActive: true,
      priority: 5,
    },
  });
}

async function tavilySearch(query: string): Promise<SearchResult[]> {
  const cfg = getConfig();
  if (!cfg.TAVILY_API_KEY) {
    throw new Error('Missing TAVILY_API_KEY');
  }
  const res = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: cfg.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Search failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      image?: string;
      published_date?: string;
    }>;
  };
  return (data.results ?? [])
    .map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? null,
      imageUrl: r.image ?? null,
      publishedAt: r.published_date ? new Date(r.published_date) : null,
    }))
    .filter((r) => r.title && r.url);
}

async function runTopicSearch(topic: string, game: Game): Promise<number> {
  const source = await ensureSearchSource(game);
  const results = await tavilySearch(topic);
  let created = 0;
  for (const r of results) {
    const summary = await summarizeNewsItem({
      title: r.title,
      url: r.url,
      snippet: r.snippet ?? undefined,
    });
    await prisma.article.upsert({
      where: { url: r.url },
      create: {
        sourceId: source.id,
        title: r.title,
        url: r.url,
        summary: summary ?? null,
        imageUrl: r.imageUrl ?? null,
        publishedAt: r.publishedAt ?? null,
        game,
        contentType: 'search',
        isProcessed: false,
      },
      update: {
        title: r.title,
        summary: summary ?? null,
        imageUrl: r.imageUrl ?? null,
        publishedAt: r.publishedAt ?? null,
      },
    });
    created++;
  }
  return created;
}

export async function runSearchCycle(): Promise<{ topics: number; created: number; errors: string[] }> {
  const enabled = await getSetting('NEWS_SEARCH_ENABLED', true);
  if (!enabled) {
    return { topics: 0, created: 0, errors: ['News search disabled'] };
  }

  const topicsPokemon = await getSetting('NEWS_TOPICS_POKEMON', []);
  const topicsOnepiece = await getSetting('NEWS_TOPICS_ONEPIECE', []);
  const topicsMtg = await getSetting('NEWS_TOPICS_MTG', []);

  const topics: Array<{ topic: string; game: Game }> = [
    ...topicsPokemon.map((t) => ({ topic: t, game: 'pokemon' })),
    ...topicsOnepiece.map((t) => ({ topic: t, game: 'onepiece' })),
    ...topicsMtg.map((t) => ({ topic: t, game: 'mtg' })),
  ];

  let created = 0;
  const errors: string[] = [];

  for (const t of topics) {
    try {
      created += await runTopicSearch(t.topic, t.game);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${t.game}: ${t.topic}: ${msg}`);
    }
  }

  return { topics: topics.length, created, errors };
}
