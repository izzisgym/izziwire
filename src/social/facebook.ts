import { getMetaTokens } from './auth.js';

const BASE = 'https://graph.facebook.com/v22.0';

export async function postToPage(params: {
  message: string;
  link?: string;
  picture?: string;
}): Promise<{ id: string; post_id?: string }> {
  const { pageAccessToken, pageId } = getMetaTokens();
  const form = new URLSearchParams();
  form.set('message', params.message);
  form.set('access_token', pageAccessToken);
  if (params.link) form.set('link', params.link);
  if (params.picture) form.set('url', params.picture);

  const res = await fetch(`${BASE}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const data = (await res.json()) as { id?: string; post_id?: string; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  if (!data.id) throw new Error('No post id returned');
  return { id: data.id, post_id: data.post_id };
}
