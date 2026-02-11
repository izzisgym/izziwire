import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config.js';
import type { LinkedInTopic } from '@prisma/client';

export async function generatePostFromTopic(topic: LinkedInTopic): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg.ANTHROPIC_API_KEY) return null;

  const anthropic = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });
  const prompt = `Generate a single LinkedIn post (organic, professional tone). 
Topic: ${topic.name}${topic.keywords ? ` Keywords: ${topic.keywords}` : ''}
Requirements: hook in first line, 1-2 short paragraphs, optional soft CTA at the end. No hashtag spam. Output only the post text, no preamble.`;

  const msg = await anthropic.messages.create({
    model: cfg.DEFAULT_AI_MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = msg.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text.trim() : null;
}
