import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';

export interface ScryfallCard {
  name: string;
  manaCost: string | null;
  typeLine: string;
  oracleText: string | null;
  flavorText: string | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  rarity: string;
  setName: string;
  setCode: string;
  artist: string | null;
  collectorNumber: string;
  colors: string[];
  colorIdentity: string[];
  keywords: string[];
  imageUrl: string | null;
  artCropUrl: string | null;
  scryfallUrl: string;
  tcgplayerUrl: string | null;
  priceUsd: string | null;
  priceFoilUsd: string | null;
  legalities: Record<string, string>;
  releasedAt: string | null;
}

interface ScryfallApiResponse {
  name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity?: string;
  set_name?: string;
  set?: string;
  artist?: string;
  collector_number?: string;
  colors?: string[];
  color_identity?: string[];
  keywords?: string[];
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
    png?: string;
    art_crop?: string;
    border_crop?: string;
  };
  card_faces?: Array<{
    name?: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
    flavor_text?: string;
    power?: string;
    toughness?: string;
    artist?: string;
    image_uris?: {
      normal?: string;
      large?: string;
      art_crop?: string;
    };
  }>;
  scryfall_uri?: string;
  purchase_uris?: {
    tcgplayer?: string;
  };
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
  };
  legalities?: Record<string, string>;
  released_at?: string;
}

function mapCard(raw: ScryfallApiResponse): ScryfallCard {
  // Some cards (e.g. double-faced) have image_uris on card_faces instead of root
  const imageUris = raw.image_uris ?? raw.card_faces?.[0]?.image_uris;

  return {
    name: raw.name ?? 'Unknown',
    manaCost: raw.mana_cost ?? raw.card_faces?.[0]?.mana_cost ?? null,
    typeLine: raw.type_line ?? raw.card_faces?.[0]?.type_line ?? 'Unknown',
    oracleText: raw.oracle_text ?? raw.card_faces?.[0]?.oracle_text ?? null,
    flavorText: raw.flavor_text ?? raw.card_faces?.[0]?.flavor_text ?? null,
    power: raw.power ?? raw.card_faces?.[0]?.power ?? null,
    toughness: raw.toughness ?? raw.card_faces?.[0]?.toughness ?? null,
    loyalty: raw.loyalty ?? null,
    rarity: raw.rarity ?? 'unknown',
    setName: raw.set_name ?? 'Unknown Set',
    setCode: raw.set ?? '',
    artist: raw.artist ?? raw.card_faces?.[0]?.artist ?? null,
    collectorNumber: raw.collector_number ?? '',
    colors: raw.colors ?? raw.color_identity ?? [],
    colorIdentity: raw.color_identity ?? [],
    keywords: raw.keywords ?? [],
    imageUrl: imageUris?.large ?? imageUris?.normal ?? null,
    artCropUrl: imageUris?.art_crop ?? null,
    scryfallUrl: raw.scryfall_uri ?? '',
    tcgplayerUrl: raw.purchase_uris?.tcgplayer ?? null,
    priceUsd: raw.prices?.usd ?? null,
    priceFoilUsd: raw.prices?.usd_foil ?? null,
    legalities: raw.legalities ?? {},
    releasedAt: raw.released_at ?? null,
  };
}

/**
 * Fetch a random MTG card from Scryfall.
 * Optionally filter by query (Scryfall syntax), e.g. "t:creature rarity:rare"
 */
export async function getRandomCard(query?: string): Promise<ScryfallCard> {
  const params = new URLSearchParams();
  // Default: cards worth $5+ only, paper, no tokens (so spotlights are notable/valuable)
  params.set('q', query ?? 'game:paper -t:token -t:emblem usd>=5');

  const url = `https://api.scryfall.com/cards/random?${params.toString()}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      // Scryfall asks for a User-Agent and accepts JSON
      'User-Agent': 'IzziWire/1.0',
      Accept: 'application/json',
    },
  }, 10_000);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Scryfall API error: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as ScryfallApiResponse;
  return mapCard(data);
}

/**
 * Format a card's data into a human-readable context string for Claude.
 */
export function formatCardForPrompt(card: ScryfallCard): string {
  const lines: string[] = [
    `Card Name: ${card.name}`,
    `Type: ${card.typeLine}`,
  ];

  if (card.manaCost) lines.push(`Mana Cost: ${card.manaCost}`);
  if (card.oracleText) lines.push(`Rules Text: ${card.oracleText}`);
  if (card.power && card.toughness) lines.push(`Power/Toughness: ${card.power}/${card.toughness}`);
  if (card.loyalty) lines.push(`Loyalty: ${card.loyalty}`);
  if (card.flavorText) lines.push(`Flavor Text: "${card.flavorText}"`);
  lines.push(`Rarity: ${card.rarity}`);
  lines.push(`Set: ${card.setName} (${card.setCode.toUpperCase()}) #${card.collectorNumber}`);
  if (card.artist) lines.push(`Artist: ${card.artist}`);
  if (card.colors.length) lines.push(`Colors: ${card.colors.join(', ')}`);
  if (card.keywords.length) lines.push(`Keywords: ${card.keywords.join(', ')}`);
  if (card.priceUsd) lines.push(`Market Price: $${card.priceUsd} USD`);
  if (card.priceFoilUsd) lines.push(`Foil Price: $${card.priceFoilUsd} USD`);

  const legalFormats = Object.entries(card.legalities)
    .filter(([, status]) => status === 'legal')
    .map(([fmt]) => fmt);
  if (legalFormats.length) lines.push(`Legal in: ${legalFormats.join(', ')}`);

  if (card.tcgplayerUrl) lines.push(`TCGPlayer: ${card.tcgplayerUrl}`);
  if (card.releasedAt) lines.push(`Released: ${card.releasedAt}`);

  return lines.join('\n');
}
