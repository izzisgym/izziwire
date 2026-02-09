import { getConfig } from '../config.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';
import { getPrisma } from '../api/deps.js';
import { getSetting } from '../settings/store.js';
import Anthropic from '@anthropic-ai/sdk';

type Game = 'pokemon' | 'onepiece' | 'mtg';

interface SearchResult {
  title: string;
  url: string;
  content: string;
  imageUrl?: string | null;
  publishedAt?: Date | null;
  score?: number;
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

async function tavilySearch(query: string, maxResults: number, recencyDays: number): Promise<SearchResult[]> {
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
      include_raw_content: true,
      max_results: maxResults,
      days: recencyDays,
    }),
  }, 30_000);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Search failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      raw_content?: string;
      image?: string;
      published_date?: string;
      score?: number;
    }>;
  };
  return (data.results ?? [])
    .map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: r.raw_content || r.content || '',
      imageUrl: r.image ?? null,
      publishedAt: r.published_date ? new Date(r.published_date) : null,
      score: r.score,
    }))
    .filter((r) => r.title && r.url && r.content.length > 50);
}

async function analyzeAndSummarize(
  results: SearchResult[],
  game: string,
  searchInstructions: string
): Promise<Array<{ title: string; url: string; summary: string; imageUrl?: string | null; publishedAt?: Date | null }>> {
  const cfg = getConfig();
  if (!cfg.ANTHROPIC_API_KEY) {
    return results.map((r) => ({
      title: r.title,
      url: r.url,
      summary: r.content.slice(0, 500),
      imageUrl: r.imageUrl,
      publishedAt: r.publishedAt,
    }));
  }

  const anthropic = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });

  const articlesForClaude = results.map((r, i) => (
    `[ARTICLE ${i + 1}]\nTitle: ${r.title}\nURL: ${r.url}\nContent: ${r.content.slice(0, 3000)}\n`
  )).join('\n---\n');

  const system = `You are a news editor for a ${game} Trading Card Game community blog.

SELECTION CRITERIA:
${searchInstructions}

Your job:
1. Read all the articles below
2. Select ONLY the ones worth writing a full blog post about
3. For each selected article, write a detailed 3-5 sentence summary capturing the key facts, numbers, dates, and significance
4. Reject articles that are low-quality, irrelevant, or don't contain real news

Output valid JSON only.`;

  const user = `Here are the search results. Analyze each and select the meaningful ones.

${articlesForClaude}

Respond as JSON:
{
  "selected": [
    {
      "index": 1,
      "title": "improved title if needed",
      "summary": "detailed 3-5 sentence summary with key facts",
      "reason": "why this is worth covering"
    }
  ],
  "rejected": [
    {
      "index": 2,
      "reason": "why this was rejected"
    }
  ]
}`;

  const msg = await anthropic.messages.create({
    model: cfg.DEFAULT_AI_MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text =
    msg.content.find((c) => c.type === 'text')?.type === 'text'
      ? (msg.content.find((c) => c.type === 'text') as { type: 'text'; text: string }).text
      : '';

  const parsed = JSON.parse(text.replace(/^[\s\S]*?\{/, '{').replace(/\}[\s\S]*$/, '}')) as {
    selected?: Array<{ index: number; title?: string; summary: string }>;
  };

  return (parsed.selected ?? [])
    .filter((s) => s.index >= 1 && s.index <= results.length)
    .map((s) => {
      const original = results[s.index - 1]!;
      return {
        title: s.title || original.title,
        url: original.url,
        summary: s.summary,
        imageUrl: original.imageUrl,
        publishedAt: original.publishedAt,
      };
    });
}

async function runTopicSearch(topic: string, game: Game, maxResults: number, recencyDays: number, searchInstructions: string): Promise<number> {
  const source = await ensureSearchSource(game);
  const results = await tavilySearch(topic, maxResults, recencyDays);
  if (!results.length) return 0;

  const selected = await analyzeAndSummarize(results, game, searchInstructions);
  let created = 0;

  for (const r of selected) {
    await prisma.article.upsert({
      where: { url: r.url },
      create: {
        sourceId: source.id,
        title: r.title,
        url: r.url,
        summary: r.summary,
        imageUrl: r.imageUrl ?? null,
        publishedAt: r.publishedAt ?? null,
        game,
        contentType: 'search',
        isProcessed: false,
      },
      update: {
        title: r.title,
        summary: r.summary,
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

  const searchInstructions = await getSetting(
    'SEARCH_INSTRUCTIONS',
    'Only select articles with meaningful, actionable news.'
  );
  const maxResults = await getSetting('SEARCH_MAX_RESULTS', 10);
  const recencyDays = await getSetting('SEARCH_RECENCY_DAYS', 7);

  const topicsPokemon = await getSetting('NEWS_TOPICS_POKEMON', []);
  const topicsOnepiece = await getSetting('NEWS_TOPICS_ONEPIECE', []);
  const topicsMtg = await getSetting('NEWS_TOPICS_MTG', []);

  const topics: Array<{ topic: string; game: Game }> = [
    ...topicsPokemon.map((t) => ({ topic: t, game: 'pokemon' as const })),
    ...topicsOnepiece.map((t) => ({ topic: t, game: 'onepiece' as const })),
    ...topicsMtg.map((t) => ({ topic: t, game: 'mtg' as const })),
  ];

  let created = 0;
  const errors: string[] = [];

  for (const t of topics) {
    try {
      created += await runTopicSearch(t.topic, t.game, maxResults, recencyDays, searchInstructions);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${t.game}: ${t.topic}: ${msg}`);
    }
  }

  return { topics: topics.length, created, errors };
}
