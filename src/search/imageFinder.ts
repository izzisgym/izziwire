import { getConfig } from '../config.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';

/**
 * Search for a relevant image for a given topic using Tavily's image search.
 * Returns the URL of the best matching image, or null if none found.
 */
export async function findImageForTopic(topic: string, game: string): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg.TAVILY_API_KEY) return null;

  try {
    const query = `${topic} ${game} trading card game`;
    const res = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: cfg.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        include_answer: false,
        include_images: true,
        include_raw_content: false,
        max_results: 5,
      }),
    }, 15_000);

    if (!res.ok) return null;

    const data = (await res.json()) as {
      images?: Array<{ url?: string }>;
      results?: Array<{ url?: string; image?: string }>;
    };

    // First try the dedicated images array
    if (data.images?.length) {
      const url = typeof data.images[0] === 'string'
        ? data.images[0]
        : data.images[0]?.url;
      if (url) return url;
    }

    // Fall back to images from search results
    for (const r of data.results ?? []) {
      if (r.image) return r.image;
    }

    return null;
  } catch {
    return null;
  }
}
