import { getConfig } from '../config.js';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const SCOPE = 'w_member_social openid profile';

export function getAuthorizationUrl(state: string, redirectUri?: string): string {
  const cfg = getConfig();
  const uri = redirectUri ?? cfg.LINKEDIN_REDIRECT_URI ?? '';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.LINKEDIN_CLIENT_ID ?? '',
    redirect_uri: uri,
    state,
    scope: SCOPE,
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri?: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const cfg = getConfig();
  const uri = redirectUri ?? cfg.LINKEDIN_REDIRECT_URI ?? '';
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: cfg.LINKEDIN_CLIENT_ID ?? '',
    client_secret: cfg.LINKEDIN_CLIENT_SECRET ?? '',
    redirect_uri: uri,
  });

  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return data;
}
