import { getConfig } from '../config.js';
import { getSetting } from '../settings/store.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';

export async function generateImage(params: {
  topic: string;
  game: string;
  style?: string;
}): Promise<string> {
  const cfg = getConfig();
  const { topic, game, style = 'modern_tcg' } = params;
  const safePrompt = `Create a ${style} themed illustration for social media.
Theme: ${topic}
Style: Modern, vibrant trading card game aesthetic
Colors: Rich, saturated colors typical of ${game} card games
DO NOT include any copyrighted characters, logos, or specific card designs.
Focus on: Abstract card shapes, energy effects, generic fantasy elements.`;

  const apiKey = cfg.IDEOGRAM_API_KEY;
  if (!apiKey) throw new Error('Missing IDEOGRAM_API_KEY');

  const form = new FormData();
  form.append('prompt', safePrompt);
  form.append('resolution', '1024x1024');
  form.append('rendering_speed', 'DEFAULT');

  const res = await fetchWithTimeout('https://api.ideogram.ai/v1/ideogram-v3/generate', {
    method: 'POST',
    headers: { 'Api-Key': apiKey },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ideogram generate failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { data?: Array<{ url?: string }> };
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('No image URL returned');
  return url;
}
