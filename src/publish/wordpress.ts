import { getConfig } from '../config.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';

const tagCache = new Map<string, number>();

function getAuthHeader() {
  const cfg = getConfig();
  if (!cfg.WORDPRESS_URL || !cfg.WORDPRESS_USERNAME || !cfg.WORDPRESS_APP_PASSWORD) {
    throw new Error('Missing WordPress credentials');
  }
  const token = Buffer.from(`${cfg.WORDPRESS_USERNAME}:${cfg.WORDPRESS_APP_PASSWORD}`).toString('base64');
  return { baseUrl: cfg.WORDPRESS_URL.replace(/\/$/, ''), auth: `Basic ${token}` };
}

async function ensureTagId(name: string): Promise<number> {
  if (tagCache.has(name)) return tagCache.get(name)!;
  const { baseUrl, auth } = getAuthHeader();
  const searchRes = await fetchWithTimeout(
    `${baseUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}&per_page=100`,
    { headers: { Authorization: auth } }
  );
  if (!searchRes.ok) {
    const text = await searchRes.text();
    throw new Error(`Tag search failed: ${searchRes.status} ${text}`);
  }
  const existing = (await searchRes.json()) as Array<{ id: number; name: string }>;
  const match = existing.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (match) {
    tagCache.set(name, match.id);
    return match.id;
  }

  const createRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/tags`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Tag create failed: ${createRes.status} ${text}`);
  }
  const created = (await createRes.json()) as { id: number };
  tagCache.set(name, created.id);
  return created.id;
}

async function uploadFeaturedImage(imageUrl: string, title: string): Promise<number> {
  const { baseUrl, auth } = getAuthHeader();
  const imgRes = await fetchWithTimeout(imageUrl);
  if (!imgRes.ok) {
    const text = await imgRes.text();
    throw new Error(`Image fetch failed: ${imgRes.status} ${text}`);
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) || 'featured';
  const filename = `${safeName}.jpg`;

  const uploadRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
    body: buf,
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Media upload failed: ${uploadRes.status} ${text}`);
  }
  const media = (await uploadRes.json()) as { id: number };
  return media.id;
}

export async function publishWordPressDraft(params: {
  title: string;
  body: string;
  tags?: string[];
  categoryId?: number;
  featuredImageUrl?: string | null;
}): Promise<{ id: number; link?: string }> {
  const { baseUrl, auth } = getAuthHeader();
  const tagIds: number[] = [];
  for (const tag of params.tags ?? []) {
    tagIds.push(await ensureTagId(tag));
  }
  const featuredMedia =
    params.featuredImageUrl ? await uploadFeaturedImage(params.featuredImageUrl, params.title) : undefined;

  const res = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: params.title,
      content: params.body,
      status: 'draft',
      categories: params.categoryId && params.categoryId > 0 ? [params.categoryId] : undefined,
      tags: tagIds.length ? tagIds : undefined,
      featured_media: featuredMedia,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Post create failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { id: number; link?: string };
  return { id: data.id, link: data.link };
}
