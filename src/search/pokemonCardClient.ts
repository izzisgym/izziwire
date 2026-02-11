import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';
import type { CardForSpotlight } from './cardSpotlightTypes.js';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const PAGE_SIZE = 250;

interface PokemonCardImage {
  small?: string;
  large?: string;
}

interface PokemonCardAttack {
  name?: string;
  text?: string;
  damage?: string;
  cost?: string[];
}

interface PokemonCardResponse {
  id: string;
  name: string;
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  rules?: string[];
  attacks?: PokemonCardAttack[];
  set?: { id?: string; name?: string };
  number?: string;
  artist?: string;
  rarity?: string;
  flavorText?: string;
  images?: PokemonCardImage;
  tcgplayer?: { url?: string; prices?: { holofoil?: { market?: number }; reverseHolofoil?: { market?: number } } };
}

interface PokemonCardsResponse {
  data: PokemonCardResponse[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

export async function getRandomPokemonCard(): Promise<CardForSpotlight> {
  const first = await fetchWithTimeout(
    `${POKEMON_TCG_API}/cards?pageSize=1&page=1`,
    { headers: { Accept: 'application/json' } },
    10_000
  );
  if (!first.ok) throw new Error(`Pokemon TCG API error: ${first.status}`);
  const firstJson = (await first.json()) as PokemonCardsResponse;
  const totalCount = firstJson.totalCount ?? 0;
  const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.floor(Math.random() * maxPage) + 1;
  const res = await fetchWithTimeout(
    `${POKEMON_TCG_API}/cards?pageSize=${PAGE_SIZE}&page=${page}`,
    { headers: { Accept: 'application/json' } },
    15_000
  );
  if (!res.ok) throw new Error(`Pokemon TCG API error: ${res.status}`);
  const json = (await res.json()) as PokemonCardsResponse;
  const list = json.data?.filter((c) => c.images?.large || c.images?.small) ?? [];
  if (list.length === 0) throw new Error('No Pokemon cards returned');
  const raw = list[Math.floor(Math.random() * list.length)]!;
  const textParts: string[] = [];
  if (raw.rules?.length) textParts.push(raw.rules.join(' '));
  if (raw.attacks?.length) {
    raw.attacks.forEach((a) => {
      if (a.name) textParts.push(`${a.name}: ${a.text || a.damage || ''}`);
    });
  }
  if (raw.flavorText) textParts.push(`"${raw.flavorText}"`);
  const price =
    raw.tcgplayer?.prices?.holofoil?.market ?? raw.tcgplayer?.prices?.reverseHolofoil?.market;
  return {
    game: 'pokemon',
    name: raw.name ?? 'Unknown',
    imageUrl: raw.images?.large ?? raw.images?.small ?? null,
    setName: raw.set?.name ?? 'Unknown Set',
    setCode: raw.set?.id ?? undefined,
    rarity: raw.rarity ?? 'Unknown',
    artist: raw.artist ?? null,
    text: textParts.length ? textParts.join(' ') : null,
    price: price != null ? String(price) : null,
  };
}
