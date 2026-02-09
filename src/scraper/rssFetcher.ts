import Parser from 'rss-parser';
import { getConfig } from '../config.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const limitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): void {
  const now = Date.now();
  const cur = limitMap.get(key) ?? { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now >= cur.resetAt) {
    cur.count = 0;
    cur.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  cur.count++;
  limitMap.set(key, cur);
  if (cur.count > RATE_LIMIT_MAX) {
    const wait = cur.resetAt - now;
    throw new Error(`RSS rate limit exceeded. Retry after ${Math.ceil(wait / 1000)}s`);
  }
}

function parseDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function extractImage(entry: Record<string, any>): string | undefined {
  const item = entry as any;
  if (item.media?.[0]) {
    const u = item.media[0].$?.url ?? item.media[0].url;
    if (u) return u;
  }
  const mediaContent = item['media:content'];
  if (mediaContent?.[0]) {
    const u = mediaContent[0].$?.url ?? mediaContent[0].url;
    if (u) return u;
  }
  if (item.enclosure?.type?.startsWith('image/') && item.enclosure.url) {
    return item.enclosure.url;
  }
  return undefined;
}

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
    ],
  },
});

export interface ArticleSnippet {
  title: string;
  url: string;
  summary?: string;
  publishedAt?: Date;
  imageUrl?: string;
}

type FeedArticle = ArticleSnippet;

export async function fetchFeed(
  feedUrl: string,
  etag: string | null = null,
  modified: string | null = null,
): Promise<{ articles: FeedArticle[]; etag: string | null; modified: string | null }> {
  checkRateLimit(feedUrl);
  const cfg = getConfig();
  const opts: RequestInit & { headers: Record<string, string> } = {
    headers: { 'User-Agent': cfg.USER_AGENT },
  };
  if (etag) opts.headers['If-None-Match'] = etag;
  if (modified) opts.headers['If-Modified-Since'] = modified;

  const res = await fetchWithTimeout(feedUrl, opts);
  if (res.status === 304) {
    return { articles: [], etag, modified };
  }
  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  const feed = await parser.parseString(text);
  const newEtag = res.headers.get('etag') ?? null;
  const newModified = res.headers.get('last-modified') ?? null;

  const articles: FeedArticle[] = (feed.items ?? []).map((entry) => ({
    title: entry.title ?? '',
    url: entry.link ?? '',
    summary: entry.contentSnippet ?? entry.content?.slice(0, 500),
    publishedAt: parseDate(entry.pubDate ?? entry.isoDate ?? undefined),
    imageUrl: extractImage(entry),
  }));

  return { articles, etag: newEtag, modified: newModified };
}
