import cheerio from 'cheerio';
import { getConfig } from '../config.js';
import type { ArticleSnippet } from './rssFetcher.js';
import type { ScrapeSelector } from './base.js';

export async function scrape(
  url: string,
  selectors: ScrapeSelector
): Promise<ArticleSnippet[]> {
  const cfg = getConfig();
  const res = await fetch(url, {
    headers: { 'User-Agent': cfg.USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Scrape failed: ${res.status} ${res.statusText} ${url}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const listSel = selectors.list ?? 'article, .post, .item, [role="article"]';
  const items: ArticleSnippet[] = [];

  $(listSel).each((_, el) => {
    const $el = $(el);
    const linkSel = selectors.link ?? 'a[href]';
    const href = $el.find(linkSel).first().attr('href');
    let urlRes = href ?? '';
    if (urlRes && !urlRes.startsWith('http')) {
      try {
        const base = new URL(url);
        urlRes = new URL(urlRes, base.origin).href;
      } catch {
        urlRes = '';
      }
    }
    const title =
      selectors.title
        ? $el.find(selectors.title).first().text().trim()
        : $el.find('h1, h2, h3, a').first().text().trim();
    const summary = selectors.summary
      ? $el.find(selectors.summary).first().text().trim()
      : $el.find('p').first().text().trim();
    const imageUrl = selectors.image
      ? $el.find(selectors.image).first().attr('src') ?? undefined
      : $el.find('img').first().attr('src') ?? undefined;
    const dateStr = selectors.date
      ? $el.find(selectors.date).first().attr('datetime') ?? $el.find(selectors.date).first().text().trim()
      : undefined;
    const publishedAt = dateStr ? (() => {
      const d = new Date(dateStr);
      return Number.isNaN(d.getTime()) ? undefined : d;
    })() : undefined;

    if (title && urlRes) {
      items.push({
        title,
        url: urlRes,
        summary: summary || undefined,
        publishedAt,
        imageUrl: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : new URL(imageUrl, url).href) : undefined,
      });
    }
  });

  return items;
}
