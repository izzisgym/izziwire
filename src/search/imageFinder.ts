import { getConfig } from '../config.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';

const VALID_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
]);

const MIN_IMAGE_BYTES = 2_000; // reject tiny tracking pixels

/**
 * Probe a URL with a HEAD request to verify it's a real image.
 * Exported so other modules (e.g. newsSearch) can reuse it.
 */
export async function isValidImageUrl(url: string): Promise<boolean> {
  try {
    // Try HEAD first (cheap, no body transfer)
    const head = await fetchWithTimeout(url, { method: 'HEAD' }, 8_000);
    if (!head.ok) return false;

    const ct = (head.headers.get('content-type') || '').split(';')[0]!.trim().toLowerCase();
    if (!VALID_IMAGE_TYPES.has(ct)) return false;

    // Check Content-Length if available
    const cl = head.headers.get('content-length');
    if (cl && parseInt(cl, 10) < MIN_IMAGE_BYTES) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Collect all candidate image URLs from Tavily response.
 */
function extractCandidateUrls(data: {
  images?: Array<string | { url?: string }>;
  results?: Array<{ url?: string; image?: string }>;
}): string[] {
  const urls: string[] = [];

  for (const img of data.images ?? []) {
    const url = typeof img === 'string' ? img : img?.url;
    if (url) urls.push(url);
  }

  for (const r of data.results ?? []) {
    if (r.image) urls.push(r.image);
  }

  return urls;
}

/**
 * Search for a relevant image for a given topic using Tavily's image search.
 * Returns the URL of the best matching image, or null if none found.
 * Validates each candidate URL to ensure it actually points to a real image.
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
      images?: Array<string | { url?: string }>;
      results?: Array<{ url?: string; image?: string }>;
    };

    const candidates = extractCandidateUrls(data);

    // Validate candidates -- return the first one that's a real, reachable image
    for (const url of candidates) {
      if (await isValidImageUrl(url)) {
        return url;
      }
    }

    return null;
  } catch {
    return null;
  }
}
