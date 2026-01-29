import Parser from 'rss-parser';
import { getConfig } from '../config.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';
import { getSetting } from '../settings/store.js';

export interface ArticleSnippet {
  title: string;
  url: string;
  summary?: string;
  publishedAt?: Date;
  imageUrl?: string;
}

interface RateLimit {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const limitMap = new Map<string, RateLimit>();

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

function parseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function extractImage(entry: Parser.Item): string | undefined {
  const item = entry as Parser.Item & {
    media?: { $?: { url?: string }; url?: string }[];
    'media:content'?: { $?: { url?: string }; url?: string }[];
    enclosure?: { url?: string; type?: string };
  };
  if (item.media?.[0]) {
    const u = item.media[0].$?.url ?? item.media[0].url;
    if (u) return u;
  }
  const mediaContent = item['media:content'] as unknown as Array<{ $?: { url?: string }; url?: string }> | undefined;
  if (mediaContent?.[0]) {
    const u = mediaContent[0].$?.url ?? mediaContent[0].url;
    if (u) return u;
  }
  if (item.enclosure?.type?.startsWith('image/') && item.enclosure.url) {
    return item.enclosure.url;
  }
  return undefined;
}

export interface FetchFeedResult {
  articles: ArticleSnippet[];
  etag: string | null;
  modified: string | null;
}

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
    ],
  },
});

export async function fetchFeed(
  feedUrl: string,
  etag: string | null = null,
  modified: string | null = null
): Promise<FetchFeedResult> {
  checkRateLimit(feedUrl);
  const cfg = getConfig();
  const userAgent = await getSetting('USER_AGENT', cfg.USER_AGENT);

  const opts: RequestInit = {
    headers: { 'User-Agent': userAgent },
  };
  if (etag) (opts.headers as Record<string, string>)['If-None-Match'] = etag;
  if (modified) (opts.headers as Record<string, string>)['If-Modified-Since'] = modified;

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

  const articles: ArticleSnippet[] = (feed.items ?? []).map((entry) => ({
    title: entry.title ?? '',
    url: entry.link ?? '',
    summary: entry.contentSnippet ?? entry.content?.slice(0, 500),
    publishedAt: parseDate(entry.pubDate ?? entry.isoDate ?? undefined),
    imageUrl: extractImage(entry),
  }));

  return { articles, etag: newEtag, modified: newModified };
}
