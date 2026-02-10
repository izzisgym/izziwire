import cron from 'node-cron';
import { getPrisma } from '../api/deps.js';
import { getConfig } from '../config.js';
import { getSetting } from '../settings/store.js';
import { fetchFeed } from './rssFetcher.js';
import { scrape } from './webScraper.js';
import { runSearchCycle } from '../search/newsSearch.js';
import { runPipelineForArticle } from '../queue/pipeline.js';

const prisma = getPrisma();

/**
 * Step 1: Scrape RSS feeds and web sources for articles
 */
export async function runScrapeCycle(): Promise<{ scraped: number; errors: string[] }> {
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
          src.lastModified,
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
        const selectors = (src.scrapeSelector ?? {}) as Record<string, string>;
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${src.name}: ${msg}`);
    }
  }
  return { scraped, errors };
}

/**
 * Step 2: Search the open web for news via Tavily + Claude
 */
async function runSearchStep(): Promise<{ found: number; errors: string[] }> {
  try {
    const result = await runSearchCycle();
    return { found: result.created, errors: result.errors };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { found: 0, errors: [msg] };
  }
}

/**
 * Step 3: Generate WordPress posts from unprocessed articles
 */
async function runGenerateStep(): Promise<{ generated: number; errors: string[] }> {
  const limit = await getSetting('AUTO_GENERATE_LIMIT', 5);
  const effectiveLimit = Math.max(limit, 1);
  const errors: string[] = [];

  const articles = await prisma.article.findMany({
    where: { isProcessed: false },
    orderBy: { scrapedAt: 'desc' },
    take: effectiveLimit,
  });

  let generated = 0;
  for (const article of articles) {
    try {
      await runPipelineForArticle({
        articleId: article.id,
        platform: 'wordpress' as any,
        postType: 'news',
      });
      await prisma.article.update({
        where: { id: article.id },
        data: { isProcessed: true },
      });
      generated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Article "${article.title.slice(0, 50)}": ${msg}`);
      // Mark as processed so we don't retry endlessly
      await prisma.article.update({
        where: { id: article.id },
        data: { isProcessed: true },
      }).catch(() => {});
    }
  }

  return { generated, errors };
}

/**
 * Full autonomous cycle: search → scrape → generate → queue for review
 */
export async function runFullCycle(): Promise<{
  scraped: number;
  searched: number;
  generated: number;
  errors: string[];
}> {
  const allErrors: string[] = [];

  // Step 1: Scrape RSS/web sources
  console.log('[Agent] Starting scrape cycle...');
  const { scraped, errors: scrapeErrors } = await runScrapeCycle();
  allErrors.push(...scrapeErrors);
  console.log(`[Agent] Scraped ${scraped} articles (${scrapeErrors.length} errors)`);

  // Step 2: Search open web via Tavily + Claude
  console.log('[Agent] Starting search cycle...');
  const { found: searched, errors: searchErrors } = await runSearchStep();
  allErrors.push(...searchErrors);
  console.log(`[Agent] Found ${searched} articles from web search (${searchErrors.length} errors)`);

  // Step 3: Generate posts from unprocessed articles
  console.log('[Agent] Starting content generation...');
  const { generated, errors: genErrors } = await runGenerateStep();
  allErrors.push(...genErrors);
  console.log(`[Agent] Generated ${generated} posts for review (${genErrors.length} errors)`);

  if (allErrors.length) {
    console.warn('[Agent] Errors:', allErrors);
  }

  return { scraped, searched, generated, errors: allErrors };
}

/**
 * Start the autonomous agent on a cron schedule
 */
export function startScheduler(): void {
  const cfg = getConfig();
  const hours = cfg.SCRAPE_INTERVAL_HOURS;
  const expr = `0 */${hours} * * *`;

  // Run once on startup after a short delay
  setTimeout(async () => {
    console.log('[Agent] Running initial cycle on startup...');
    try {
      const result = await runFullCycle();
      console.log(
        `[Agent] Startup cycle complete: scraped=${result.scraped}, searched=${result.searched}, generated=${result.generated}, errors=${result.errors.length}`,
      );
    } catch (e) {
      console.error('[Agent] Startup cycle failed:', e);
    }
  }, 10_000); // 10 second delay to let everything initialize

  // Then run on schedule
  cron.schedule(expr, async () => {
    console.log(`[Agent] Scheduled cycle starting...`);
    try {
      const result = await runFullCycle();
      console.log(
        `[Agent] Cycle complete: scraped=${result.scraped}, searched=${result.searched}, generated=${result.generated}, errors=${result.errors.length}`,
      );
    } catch (e) {
      console.error('[Agent] Cycle failed:', e);
    }
  });

  console.log(`[Agent] Scheduler started: runs every ${hours} hours + once on startup`);
}
