import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config.js';
import { getSetting } from '../settings/store.js';

export interface WordPressDraft {
  title: string;
  body: string;
  tags: string[];
  tokensUsed?: number;
}

const DEFAULT_INSTRUCTIONS =
  'Write engaging, well-structured blog posts for a TCG community audience. Use a conversational but knowledgeable tone. Structure with an intro paragraph, 3-4 body sections with subheadings (use HTML <h2> tags), and a conclusion. Include strategic insights and community relevance. Format the body as HTML with <h2> for sections and <p> for paragraphs.';

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

  const instructions = await getSetting('WP_WRITING_INSTRUCTIONS', DEFAULT_INSTRUCTIONS);
  const minWords = await getSetting('WP_MIN_WORDS', 600);
  const maxWords = await getSetting('WP_MAX_WORDS', 1200);

  const anthropic = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });
  const system = `You are a professional blog writer. Follow these instructions exactly:

${instructions}

IMPORTANT RULES:
- The post MUST be between ${minWords} and ${maxWords} words.
- Output valid JSON only, no extra text.`;

  const user = `Topic: ${params.topic}
Game: ${params.game}
Summary: ${params.summary ?? ''}

Respond as JSON:
{
  "title": "a compelling blog post title",
  "body": "the full blog post body as HTML (${minWords}-${maxWords} words)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`;

  const maxTokens = Math.max(2000, Math.ceil(maxWords * 2));

  const msg = await anthropic.messages.create({
    model: cfg.DEFAULT_AI_MODEL,
    max_tokens: maxTokens,
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
