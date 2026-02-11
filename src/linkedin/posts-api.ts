const LINKEDIN_POSTS_URL = 'https://api.linkedin.com/rest/posts';
const RESTLI_VERSION = '2.0.0';
const LINKEDIN_VERSION = '202501';

export interface CreatePostParams {
  accessToken: string;
  authorUrn: string;
  commentary: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS' | 'PRIVATE';
}

export interface CreatePostResult {
  id: string;
}

export async function createPost(params: CreatePostParams): Promise<CreatePostResult> {
  const { accessToken, authorUrn, commentary, visibility = 'PUBLIC' } = params;

  const body = {
    author: authorUrn,
    commentary,
    visibility,
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
  };

  const res = await fetch(LINKEDIN_POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': RESTLI_VERSION,
      'LinkedIn-Version': LINKEDIN_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn create post failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return { id: data.id };
}
