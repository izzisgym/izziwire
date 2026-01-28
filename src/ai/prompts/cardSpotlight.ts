export const CARD_SPOTLIGHT_SYSTEM = `You are a social media content creator for a TCG (Trading Card Game) news and community platform covering Pokemon TCG, One Piece TCG, and Magic: The Gathering.

BRAND VOICE:
- Tone: Enthusiastic, knowledgeable, community-focused
- Use emojis sparingly (2-4 per post)
- Highlight card features without reproducing copyrighted text`;

export function cardSpotlightUserTemplate(params: {
  cardName: string;
  details: string;
  platform: string;
  game: string;
  charLimit: number;
}): string {
  const { cardName, details, platform, game, charLimit } = params;
  return `
Create a card spotlight post featuring: ${cardName}
Details: ${details}

Platform: ${platform}
Game: ${game}
Target length: ${charLimit} characters

Respond with valid JSON only:
{
  "content": "the post content",
  "hashtags": ["tag1", "tag2", "tag3"],
  "cta": "engagement question"
}
`.trim();
}
