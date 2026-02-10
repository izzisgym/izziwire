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
  'Lead with the hook right in the first sentence — the most exciting or urgent fact up front (e.g. "New Pokemon drop this Friday" or "Free tournament this Saturday"). Keep paragraphs SHORT — 2-3 sentences max, with line breaks between them. No walls of text. Write at an 8th-grade reading level: simple words, short sentences, easy to scan. Include one clear call to action (visit, buy, sign up, check it out) — don\'t bury it. Structure with an intro hook, 2-4 body sections with subheadings (use HTML <h2> tags), and a short punchy conclusion. Format the body as HTML with <h2> for sections and <p> for paragraphs.';

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
  const system = `You are a professional blog writer for TCG communities. Follow these instructions exactly:

${instructions}

WRITING STYLE (always follow):
- Lead with the hook. First sentence = the most exciting or urgent fact.
- Short paragraphs: 2-3 sentences max per <p> tag. Break up the text.
- 8th-grade reading level. Simple words, short sentences, easy to scan.
- One clear call to action — don't bury it at the end.
- Do NOT include <img> tags in the body.

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
