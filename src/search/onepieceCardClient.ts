import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';
import type { CardForSpotlight } from './cardSpotlightTypes.js';

const OPTCG_API = 'https://optcgapi.com/api';

interface OnePieceCardResponse {
  card_name?: string;
  set_name?: string;
  set_id?: string;
  card_set_id?: string;
  card_text?: string;
  rarity?: string;
  card_type?: string;
  card_cost?: string;
  card_power?: string;
  card_image?: string;
  market_price?: number;
}

export async function getRandomOnePieceCard(): Promise<CardForSpotlight> {
  const res = await fetchWithTimeout(
    `${OPTCG_API}/allSetCards/?format=json`,
    { headers: { Accept: 'application/json' } },
    30_000
  );
  if (!res.ok) throw new Error(`One Piece TCG API error: ${res.status}`);
  const list = (await res.json()) as OnePieceCardResponse[];
  if (!Array.isArray(list) || list.length === 0) throw new Error('No One Piece cards returned');
  const withImage = list.filter((c) => c.card_image);
  const raw = (withImage.length ? withImage : list)[Math.floor(Math.random() * (withImage.length || list.length))]!;
  return {
    game: 'onepiece',
    name: raw.card_name ?? 'Unknown',
    imageUrl: raw.card_image ?? null,
    setName: raw.set_name ?? 'Unknown Set',
    setCode: raw.set_id ?? undefined,
    rarity: raw.rarity ?? 'Unknown',
    artist: null,
    text: raw.card_text && raw.card_text !== 'NULL' ? raw.card_text : null,
    price: raw.market_price != null ? String(raw.market_price) : null,
  };
}
