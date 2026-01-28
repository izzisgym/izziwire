import cron from 'node-cron';
import { getPrisma } from '../api/deps.js';
import { getConfig } from '../config.js';
import { fetchFeed } from './rssFetcher.js';
import { scrape } from './webScraper.js';

const prisma = getPrisma();

export async function runScrapeCycle(): Promise<{ scraped: number; errors: string[] }> {
  const cfg = getConfig();
  const sources = await prisma.newsSource.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });
  let scraped = 0;
  const errors: string[] = [];

  for (const src of sources) {
    try {
      if (src.sourceType === 'rss' && src.rssFeedUrl) {
        const { articles, etag, modified } = await fetchFeed(
          src.rssFeedUrl,
          src.lastEtag,
          src.lastModified
        );
        for (const a of articles) {
          await prisma.article.upsert({
            where: { url: a.url },
            create: {
              sourceId: src.id,
              title: a.title,
              url: a.url,
              summary: a.summary ?? null,
              imageUrl: a.imageUrl ?? null,
              publishedAt: a.publishedAt ?? null,
              game: src.game,
            },
            update: {
              title: a.title,
              summary: a.summary ?? null,
              imageUrl: a.imageUrl ?? null,
              publishedAt: a.publishedAt ?? null,
            },
          });
          scraped++;
        }
        await prisma.newsSource.update({
          where: { id: src.id },
          data: {
            lastScrapedAt: new Date(),
            lastEtag: etag,
            lastModified: modified,
          },
        });
      } else if (src.sourceType === 'web') {
        const selectors = (src.scrapeSelector as Record<string, string> | null) ?? {};
        const articles = await scrape(src.url, selectors);
        for (const a of articles) {
          await prisma.article.upsert({
            where: { url: a.url },
            create: {
              sourceId: src.id,
              title: a.title,
              url: a.url,
              summary: a.summary ?? null,
              imageUrl: a.imageUrl ?? null,
              publishedAt: a.publishedAt ?? null,
              game: src.game,
            },
            update: {
              title: a.title,
              summary: a.summary ?? null,
              imageUrl: a.imageUrl ?? null,
              publishedAt: a.publishedAt ?? null,
            },
          });
          scraped++;
        }
        await prisma.newsSource.update({
          where: { id: src.id },
          data: { lastScrapedAt: new Date() },
        });
      }
      // api sources: could add later (pokemontcg.io, scryfall, etc.)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${src.name}: ${msg}`);
    }
  }

  return { scraped, errors };
}

export function startScheduler(): void {
  const cfg = getConfig();
  const expr = `0 */${cfg.SCRAPE_INTERVAL_HOURS} * * *`; // every N hours
  cron.schedule(expr, async () => {
    try {
      const { scraped, errors } = await runScrapeCycle();
      console.log(`Scrape cycle completed: ${scraped} articles; ${errors.length} errors`);
      if (errors.length) console.error(errors);
    } catch (e) {
      console.error('Scrape cycle failed:', e);
    }
  });
  console.log(`Scheduler started: every ${cfg.SCRAPE_INTERVAL_HOURS} hours`);
}
