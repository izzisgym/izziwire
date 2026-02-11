import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';
import type { CardForSpotlight } from './cardSpotlightTypes.js';

const LORCANA_API = 'https://api.lorcana-api.com/cards';
const PAGE_SIZE = 100;

interface LorcanaCardResponse {
  Name?: string;
  Image?: string;
  Set_Name?: string;
  Set_ID?: string;
  Rarity?: string;
  Artist?: string;
  Body_Text?: string;
  Flavor_Text?: string;
  Type?: string;
  Cost?: number;
  Strength?: number;
  Willpower?: number;
  Lore?: number;
}

export async function getRandomLorcanaCard(): Promise<CardForSpotlight> {
  const page = Math.floor(Math.random() * 20) + 1;
  const url = `${LORCANA_API}/all?pagesize=${PAGE_SIZE}&page=${page}`;
  const res = await fetchWithTimeout(
    url,
    { headers: { Accept: 'application/json' } },
    15_000
  );
  if (!res.ok) throw new Error(`Lorcana API error: ${res.status}`);
  const list = (await res.json()) as LorcanaCardResponse[];
  if (!Array.isArray(list) || list.length === 0) throw new Error('No Lorcana cards returned');
  const raw = list[Math.floor(Math.random() * list.length)]!;
  const text = [raw.Body_Text, raw.Flavor_Text].filter(Boolean).join(' ');
  return {
    game: 'lorcana',
    name: raw.Name ?? 'Unknown',
    imageUrl: raw.Image ?? null,
    setName: raw.Set_Name ?? 'Unknown Set',
    setCode: raw.Set_ID ?? undefined,
    rarity: raw.Rarity ?? 'Unknown',
    artist: raw.Artist ?? null,
    text: text || null,
    price: undefined,
  };
}
