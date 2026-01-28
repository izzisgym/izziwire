import type { SourceConfig } from './pokemon.js';

export const onepieceSources: SourceConfig[] = [
  { name: 'Official Bandai', game: 'onepiece', sourceType: 'web', url: 'https://en.onepiece-cardgame.com/', priority: 10 },
  { name: 'OnePiece.gg', game: 'onepiece', sourceType: 'web', url: 'https://onepiece.gg/news/', priority: 9 },
  { name: 'OPTCG API', game: 'onepiece', sourceType: 'api', url: 'https://optcgapi.com/', priority: 8 },
  { name: 'Limitless One Piece', game: 'onepiece', sourceType: 'web', url: 'https://onepiece.limitlesstcg.com/', priority: 8 },
];
