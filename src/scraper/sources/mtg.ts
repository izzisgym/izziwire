import type { SourceConfig } from './pokemon.js';

export const mtgSources: SourceConfig[] = [
  { name: 'MTGGoldfish', game: 'mtg', sourceType: 'rss', url: 'https://mtggoldfish.com/', rssFeedUrl: 'https://mtggoldfish.com/feed', priority: 10 },
  { name: 'EDHREC', game: 'mtg', sourceType: 'rss', url: 'https://edhrec.com/', rssFeedUrl: 'https://edhrec.com/articles/feed', priority: 9 },
  { name: 'Scryfall API', game: 'mtg', sourceType: 'api', url: 'https://api.scryfall.com/', priority: 9 },
  { name: 'Star City Games', game: 'mtg', sourceType: 'rss', url: 'https://articles.starcitygames.com/', rssFeedUrl: 'https://articles.starcitygames.com/feed', priority: 8 },
  { name: 'MTG Stocks', game: 'mtg', sourceType: 'rss', url: 'https://api.mtgstocks.com/', rssFeedUrl: 'https://api.mtgstocks.com/news/feed', priority: 7 },
  { name: 'Daily MTG (unofficial)', game: 'mtg', sourceType: 'rss', url: 'https://www.slowley.com/feeds/wotc-articles.rss', rssFeedUrl: 'https://www.slowley.com/feeds/wotc-articles.rss', priority: 9 },
];
