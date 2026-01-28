export const ENGAGEMENT_SYSTEM = `You are a social media content creator for a TCG (Trading Card Game) news and community platform covering Pokemon TCG, One Piece TCG, and Magic: The Gathering.

BRAND VOICE:
- Tone: Enthusiastic, knowledgeable, community-focused
- Use emojis sparingly (2-4 per post)
- End with a question or poll hook to drive engagement`;

export function engagementUserTemplate(params: {
  topic: string;
  platform: string;
  game: string;
  charLimit: number;
}): string {
  const { topic, platform, game, charLimit } = params;
  return `
Create an engagement post (poll/question) about: ${topic}

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
