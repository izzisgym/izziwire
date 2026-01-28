import OpenAI from 'openai';
import { getConfig } from '../config.js';

const cfg = getConfig();

export async function generateImage(params: {
  topic: string;
  game: string;
  style?: string;
}): Promise<string> {
  const { topic, game, style = 'modern_tcg' } = params;
  const safePrompt = `Create a ${style} themed illustration for social media.
Theme: ${topic}
Style: Modern, vibrant trading card game aesthetic
Colors: Rich, saturated colors typical of ${game} card games
DO NOT include any copyrighted characters, logos, or specific card designs.
Focus on: Abstract card shapes, energy effects, generic fantasy elements.`;

  const openai = new OpenAI({ apiKey: cfg.OPENAI_API_KEY ?? '' });
  const model = cfg.IMAGE_MODEL as 'dall-e-3' | 'dall-e-2';
  const res = await openai.images.generate({
    model,
    prompt: safePrompt,
    size: '1024x1024',
    quality: 'standard',
    n: 1,
  });
  const url = res.data?.[0]?.url;
  if (!url) throw new Error('No image URL returned');
  return url;
}
