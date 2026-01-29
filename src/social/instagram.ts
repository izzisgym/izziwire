import { getMetaTokens } from './auth.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';

const BASE = 'https://graph.facebook.com/v22.0';

export async function publishPhoto(params: {
  imageUrl: string;
  caption: string;
  hashtags?: string[];
}): Promise<{ id: string }> {
  const { pageAccessToken, instagramUserId } = getMetaTokens();
  const caption =
    params.hashtags?.length ?
      `${params.caption}\n\n${params.hashtags.map((t) => `#${t}`).join(' ')}`
    : params.caption;

  const createRes = await fetchWithTimeout(
    `${BASE}/${instagramUserId}/media?image_url=${encodeURIComponent(params.imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${encodeURIComponent(pageAccessToken)}`,
    { method: 'POST' }
  );
  const createData = (await createRes.json()) as { id?: string; error?: { message: string } };
  if (createData.error) throw new Error(createData.error.message);
  const containerId = createData.id;
  if (!containerId) throw new Error('No container id');

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetchWithTimeout(
      `${BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(pageAccessToken)}`
    );
    const statusData = (await statusRes.json()) as { status_code?: string; error?: { message: string } };
    if (statusData.error) throw new Error(statusData.error.message);
    if (statusData.status_code === 'FINISHED') break;
    if (statusData.status_code === 'ERROR') throw new Error('Container creation failed');
  }

  const publishRes = await fetchWithTimeout(
    `${BASE}/${instagramUserId}/media_publish?creation_id=${containerId}&access_token=${encodeURIComponent(pageAccessToken)}`,
    { method: 'POST' }
  );
  const publishData = (await publishRes.json()) as { id?: string; error?: { message: string } };
  if (publishData.error) throw new Error(publishData.error.message);
  if (!publishData.id) throw new Error('Publish failed');
  return { id: publishData.id };
}
