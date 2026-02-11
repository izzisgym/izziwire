import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';
import { getConfig } from '../config.js';
import type { CardForSpotlight } from './cardSpotlightTypes.js';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const PAGE_SIZE = 250;
const TIMEOUT_MS = 45_000;
const MAX_PAGE = 80;

function getHeaders(): Record<string, string> {
  const key = getConfig().POKEMON_TCG_API_KEY;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (key) headers['X-Api-Key'] = key;
  return headers;
}

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

async function fetchPage(page: number): Promise<PokemonCardResponse[]> {
  const res = await fetchWithTimeout(
    `${POKEMON_TCG_API}/cards?pageSize=${PAGE_SIZE}&page=${page}`,
    { headers: getHeaders() },
    TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Pokemon TCG API error: ${res.status}`);
  const json = (await res.json()) as PokemonCardsResponse;
  return json.data?.filter((c) => c.images?.large || c.images?.small) ?? [];
}

export async function getRandomPokemonCard(): Promise<CardForSpotlight> {
  const page = Math.floor(Math.random() * MAX_PAGE) + 1;
  let list: PokemonCardResponse[] = [];
  try {
    list = await fetchPage(page);
  } catch (e) {
    const isAbort =
      e instanceof Error && (e.name === 'AbortError' || e.message?.includes('aborted'));
    if (isAbort) {
      try {
        list = await fetchPage(1);
      } catch {
        throw new Error('Pokemon TCG API timed out. Try again in a moment.');
      }
    } else {
      throw e;
    }
  }
  if (list.length === 0) {
    list = await fetchPage(1);
  }
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
