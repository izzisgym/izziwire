import { Router } from 'express';
import crypto from 'node:crypto';
import { getAuthorizationUrl, exchangeCodeForTokens } from '../../linkedin/oauth.js';
import { getCurrentMember } from '../../linkedin/me.js';
import { getConfig } from '../../config.js';
import { getPrisma } from '../deps.js';

const router = Router();

router.get('/linkedin', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  (req.session as unknown as Record<string, string>).oauthState = state;
  const url = getAuthorizationUrl(state);
  res.redirect(url);
});

router.get('/linkedin/callback', async (req, res) => {
  const state = (req.session as unknown as Record<string, string>).oauthState;
  const { code, state: queryState } = req.query as { code?: string; state?: string };

  if (!code || queryState !== state) {
    res.status(400).send('Invalid or missing state/code');
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
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

    const cfg = getConfig();
    const base = cfg.LINKEDIN_REDIRECT_URI?.replace(/\/auth\/linkedin\/callback\/?$/, '') ?? '';
    res.redirect(base ? `${base}/linkedin?connected=1` : '/linkedin?connected=1');
  } catch (e) {
    console.error('LinkedIn OAuth callback error', e);
    res.status(500).send('OAuth failed. Check server logs.');
  }
});

export default router;
