import type { ArticleSnippet } from './rssFetcher.js';

export interface ScrapeSelector {
  list?: string;
  title?: string;
  link?: string;
  summary?: string;
  image?: string;
  date?: string;
}

export interface Scraper {
  scrape(url: string, selectors: ScrapeSelector): Promise<ArticleSnippet[]>;
}
