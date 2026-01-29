import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config.js';

export async function summarizeNewsItem(params: {
  title: string;
  url: string;
  snippet?: string | null;
}): Promise<string | undefined> {
  const cfg = getConfig();
  if (!cfg.ANTHROPIC_API_KEY) {
    return params.snippet?.slice(0, 500) || undefined;
  }

  const anthropic = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });
  const system = 'Summarize the article in 1-2 concise sentences. No markdown. No speculation.';
  const user = `Title: ${params.title}\nURL: ${params.url}\nSnippet: ${params.snippet ?? ''}`;

  const msg = await anthropic.messages.create({
    model: cfg.DEFAULT_AI_MODEL,
    max_tokens: 200,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text =
    msg.content.find((c) => c.type === 'text')?.type === 'text'
      ? (msg.content.find((c) => c.type === 'text') as { type: 'text'; text: string }).text
      : '';
  return text.trim() || params.snippet?.slice(0, 500) || undefined;
}
