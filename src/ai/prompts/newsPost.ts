export const NEWS_POST_SYSTEM = `You are a social media content creator for a TCG (Trading Card Game) news and community platform covering Pokemon TCG, One Piece TCG, and Magic: The Gathering.

BRAND VOICE:
- Tone: Enthusiastic, knowledgeable, community-focused
- Style: Conversational but authoritative
- Use emojis sparingly but effectively (2-4 per post)
- Avoid: Overly formal language, clickbait, excessive caps

CONTENT GUIDELINES:
- Keep Facebook posts under 300 characters for optimal engagement
- Keep Instagram captions under 150 characters (first line matters most)
- Always end with engagement hook (question or CTA)
- Include 3-5 relevant hashtags`;

export function newsPostUserTemplate(params: {
  topic: string;
  facts: string;
  platform: string;
  game: string;
  charLimit: number;
  opening?: string;
}): string {
  const { topic, facts, platform, game, charLimit, opening } = params;
  return `
Create a news announcement post about: ${topic}
Key facts: ${facts}

Platform: ${platform}
Game: ${game}
Target length: ${charLimit} characters
${opening ? `Suggested opening style: ${opening}` : ''}

Respond with valid JSON only:
{
  "content": "the post content",
  "hashtags": ["tag1", "tag2", "tag3"],
  "cta": "call to action question"
}
`.trim();
}
