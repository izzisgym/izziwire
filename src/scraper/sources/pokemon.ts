export interface SourceConfig {
  name: string;
  game: 'pokemon' | 'onepiece' | 'mtg';
  sourceType: 'rss' | 'web' | 'api';
  url: string;
  rssFeedUrl?: string;
  priority: number;
  scrapeSelector?: Record<string, string>;
}

export const pokemonSources: SourceConfig[] = [
  { name: 'PokeBeach', game: 'pokemon', sourceType: 'web', url: 'https://www.pokebeach.com/', priority: 10 },
  { name: 'PokeGuardian', game: 'pokemon', sourceType: 'rss', url: 'https://pokeguardian.com/', rssFeedUrl: 'https://pokeguardian.com/feed', priority: 9 },
  { name: 'Pokemon TCG API', game: 'pokemon', sourceType: 'api', url: 'https://api.pokemontcg.io/v2/', priority: 8 },
  { name: 'Limitless TCG', game: 'pokemon', sourceType: 'web', url: 'https://limitlesstcg.com/', priority: 8 },
  { name: 'RetreatCost', game: 'pokemon', sourceType: 'rss', url: 'https://retreatcost.com/', rssFeedUrl: 'https://retreatcost.com/rss-syndication/', priority: 7 },
];
