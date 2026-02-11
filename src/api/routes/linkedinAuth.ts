import { Router } from 'express';
import crypto from 'node:crypto';
import { getAuthorizationUrl, exchangeCodeForTokens } from '../../linkedin/oauth.js';
import { getCurrentMember } from '../../linkedin/me.js';
import { getConfig } from '../../config.js';
import { getPrisma } from '../deps.js';

const router = Router();

router.get('/linkedin', (req, res) => {
  const cfg = getConfig();
  const redirectUri =
    cfg.LINKEDIN_REDIRECT_URI?.trim() ||
    `${req.protocol}://${req.get('host') ?? req.hostname}/auth/linkedin/callback`;
  const state = crypto.randomBytes(16).toString('hex');
  const session = req.session as unknown as Record<string, string>;
  session.oauthState = state;
  session.oauthRedirectUri = redirectUri;
  const url = getAuthorizationUrl(state, redirectUri);
  res.redirect(url);
});

router.get('/linkedin/callback', async (req, res) => {
  const session = req.session as unknown as Record<string, string>;
  const state = session?.oauthState;
  let redirectUri = session?.oauthRedirectUri;
  const { code, state: queryState } = req.query as { code?: string; state?: string };

  if (!code || queryState !== state) {
    const base = getConfig().LINKEDIN_REDIRECT_URI?.replace(/\/auth\/linkedin\/callback\/?$/, '') || `${req.protocol}://${req.get('host') ?? req.hostname}`;
    res.redirect(`${base || ''}/linkedin?error=invalid_state`);
    return;
  }

  if (!redirectUri?.trim()) {
    redirectUri = getConfig().LINKEDIN_REDIRECT_URI?.trim() || `${req.protocol}://${req.get('host') ?? req.hostname}/auth/linkedin/callback`;
  }
  const base = redirectUri.replace(/\/auth\/linkedin\/callback\/?$/, '') || '';

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const me = await getCurrentMember(tokens.access_token);
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    const prisma = getPrisma();
    await prisma.linkedInToken.upsert({
      where: { userId: me.id },
      create: {
        userId: me.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt,
      },
    });

    res.redirect(base ? `${base}/linkedin?connected=1` : '/linkedin?connected=1');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('LinkedIn OAuth callback error:', msg, e);
    const safeMsg = encodeURIComponent(msg.slice(0, 200));
    res.redirect(`${base ? `${base}/linkedin` : '/linkedin'}?error=oauth_failed&message=${safeMsg}`);
  }
});

export default router;
