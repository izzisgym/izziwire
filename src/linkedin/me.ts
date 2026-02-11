const LINKEDIN_ME_URL = 'https://api.linkedin.com/v2/me';

export interface LinkedInMe {
  id: string;
  localizedFirstName?: string;
  localizedLastName?: string;
}

export async function getCurrentMember(accessToken: string): Promise<LinkedInMe> {
  const res = await fetch(LINKEDIN_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn me failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    id: string;
    localizedFirstName?: string;
    localizedLastName?: string;
  };
  return {
    id: data.id,
    localizedFirstName: data.localizedFirstName,
    localizedLastName: data.localizedLastName,
  };
}
