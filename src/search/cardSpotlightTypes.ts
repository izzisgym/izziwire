/** Normalized card data for card spotlight generation (any game). */
export interface CardForSpotlight {
  game: 'mtg' | 'pokemon' | 'onepiece' | 'lorcana';
  name: string;
  imageUrl: string | null;
  setName: string;
  setCode?: string;
  rarity: string;
  artist: string | null;
  text: string | null;
  price?: string | null;
}

export function formatCardForSpotlightShort(card: CardForSpotlight): string {
  const parts = [
    `${card.name} | ${card.setName}${card.setCode ? ` (${card.setCode})` : ''}`,
    card.rarity,
    card.text || '',
  ];
  if (card.artist) parts.push(`Artist: ${card.artist}`);
  if (card.price) parts.push(`$${card.price}`);
  return parts.filter(Boolean).join('\n');
}
