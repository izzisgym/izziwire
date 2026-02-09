import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config.js';
import { NEWS_POST_SYSTEM, newsPostUserTemplate } from './prompts/newsPost.js';
import { ENGAGEMENT_SYSTEM, engagementUserTemplate } from './prompts/engagement.js';
import { CARD_SPOTLIGHT_SYSTEM, cardSpotlightUserTemplate } from './prompts/cardSpotlight.js';
import { pickOpening, pickCharLimit } from './variation.js';

function getSystemPrompt(postType: string): string {
  switch (postType) {
    case 'news':
      return NEWS_POST_SYSTEM;
    case 'engagement':
    case 'poll':
      return ENGAGEMENT_SYSTEM;
    case 'card_spotlight':
      return CARD_SPOTLIGHT_SYSTEM;
    default:
      return NEWS_POST_SYSTEM;
  }
}

export async function generatePost(params: {
  topic: string;
  postType?: string;
  platform?: string;
  game?: string;
  facts?: string;
  cardName?: string;
  details?: string;
}): Promise<{
  content: string;
  hashtags: string[];
  cta?: string;
  tokensUsed?: number;
  model?: string;
}> {
  const cfg = getConfig();
  const postType = params.postType ?? 'news';
  const platform = params.platform ?? 'instagram';
  const game = params.game ?? 'pokemon';
  const charLimit = pickCharLimit(platform);
  const opening = pickOpening();

  let userPrompt: string;
  if (postType === 'card_spotlight' && params.cardName != null) {
    userPrompt = cardSpotlightUserTemplate({
      cardName: params.cardName,
      details: params.details ?? '',
      platform,
      game,
      charLimit,
    });
  } else if (postType === 'engagement' || postType === 'poll') {
    userPrompt = engagementUserTemplate({
      topic: params.topic,
      platform,
      game,
      charLimit,
    });
  } else {
    userPrompt = newsPostUserTemplate({
      topic: params.topic,
      facts: params.facts ?? '',
      platform,
      game,
      charLimit,
      opening,
    });
  }

  const anthropic = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY ?? '' });
  const model = cfg.DEFAULT_AI_MODEL;
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 500,
    system: getSystemPrompt(postType),
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = msg.content.find((c) => c.type === 'text');
  const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';
  const parsed = JSON.parse(text.replace(/^[\s\S]*?\{/, '{').replace(/\}[\s\S]*$/, '}')) as {
    content?: string;
    hashtags?: string[];
    cta?: string;
  };

  const tokensUsed =
    msg.usage?.input_tokens != null && msg.usage?.output_tokens != null
      ? msg.usage.input_tokens + msg.usage.output_tokens
      : undefined;

  return {
    content: parsed.content ?? '',
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    cta: parsed.cta ?? '',
    tokensUsed,
    model,
  };
}
