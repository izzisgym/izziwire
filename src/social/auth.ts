import { getConfig } from '../config.js';

/**
 * Meta app setup (documentation):
 * 1. Create app at developers.facebook.com
 * 2. Add Facebook Login product, request pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish
 * 3. Get Page Access Token (long-lived) for the Page; use it as FACEBOOK_PAGE_ACCESS_TOKEN
 * 4. Link Instagram Business Account to the Page, get IG User ID via Graph API /me/accounts?fields=instagram_business_account
 * 5. Set FACEBOOK_PAGE_ID and INSTAGRAM_USER_ID in env
 *
 * Optional: debug_token (GET /debug_token?input_token=...) to validate token.
 */
export function getMetaTokens(): {
  pageAccessToken: string;
  pageId: string;
  instagramUserId: string;
} {
  const cfg = getConfig();
  const token = cfg.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = cfg.FACEBOOK_PAGE_ID;
  const igUserId = cfg.INSTAGRAM_USER_ID;
  if (!token || !pageId || !igUserId) {
    throw new Error('Missing FACEBOOK_PAGE_ACCESS_TOKEN, FACEBOOK_PAGE_ID, or INSTAGRAM_USER_ID');
  }
  return { pageAccessToken: token, pageId, instagramUserId: igUserId };
}
