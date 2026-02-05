import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config.js';

export interface WordPressDraft {
  title: string;
  body: string;
  tags: string[];
  tokensUsed?: number;
}

export async function generateWordPressPost(params: {
  topic: string;
  summary?: string;
  game: string;
}): Promise<WordPressDraft> {
  const cfg = getConfig();
  if (!cfg.ANTHROPIC_API_KEY) {
    return {
      title: params.topic,
      body: params.summary ?? params.topic,
      tags: [],
    };
  }

  const anthropic = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });
  const system =
    'You write concise, informative blog posts for TCG communities. Output JSON only.';
  const user = `Topic: ${params.topic}
Game: ${params.game}
Summary: ${params.summary ?? ''}

Respond as JSON:
{
  "title": "post title",
  "body": "post body in plain text (no markdown)",
  "tags": ["tag1","tag2","tag3"]
}`;

  const msg = await anthropic.messages.create({
    model: cfg.DEFAULT_AI_MODEL,
    max_tokens: 800,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text =
    msg.content.find((c) => c.type === 'text')?.type === 'text'
      ? (msg.content.find((c) => c.type === 'text') as { type: 'text'; text: string }).text
      : '';
  const parsed = JSON.parse(text.replace(/^[\s\S]*?\{/, '{').replace(/\}[\s\S]*$/, '}')) as {
    title?: string;
    body?: string;
    tags?: string[];
  };

  const tokensUsed =
    msg.usage?.input_tokens != null && msg.usage?.output_tokens != null
      ? msg.usage.input_tokens + msg.usage.output_tokens
      : undefined;

  return {
    title: parsed.title ?? params.topic,
    body: parsed.body ?? params.summary ?? params.topic,
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    tokensUsed,
  };
}
