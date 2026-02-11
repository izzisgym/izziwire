const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

export interface LinkedInMe {
  id: string;
  localizedFirstName?: string;
  localizedLastName?: string;
}

/**
 * Get the authenticated member's ID using OpenID Connect userinfo.
 * /v2/me returns 403 with w_member_social; userinfo works when scope includes openid profile.
 */
export async function getCurrentMember(accessToken: string): Promise<LinkedInMe> {
  const res = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn userinfo failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    sub: string;
    given_name?: string;
    family_name?: string;
    name?: string;
  };
  return {
    id: data.sub,
    localizedFirstName: data.given_name,
    localizedLastName: data.family_name,
  };
}
