import { pokemonSources } from './pokemon.js';
import { onepieceSources } from './onepiece.js';
import { mtgSources } from './mtg.js';
import type { SourceConfig } from './pokemon.js';

export type { SourceConfig };
export { pokemonSources, onepieceSources, mtgSources };

export const allSources: SourceConfig[] = [
  ...pokemonSources,
  ...onepieceSources,
  ...mtgSources,
];
