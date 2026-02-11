import express from 'express';
import session from 'express-session';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import { getPrisma } from './api/deps.js';
import postsRouter from './api/routes/posts.js';
import webhooksRouter from './api/routes/webhooks.js';
import cronRouter from './api/routes/cron.js';
import sourcesRouter from './api/routes/sources.js';
import articlesRouter from './api/routes/articles.js';
import metricsRouter from './api/routes/metrics.js';
import settingsRouter from './api/routes/settings.js';
import actionsRouter from './api/routes/actions.js';
import postTypesRouter from './api/routes/postTypes.js';
import generateRouter from './api/routes/generate.js';
import cardSpotlightRouter from './api/routes/cardSpotlight.js';
import linkedinAuthRouter from './api/routes/linkedinAuth.js';
import linkedinRouter from './api/routes/linkedin.js';

async function main() {
  process.stdout.write('Starting izziwire...\n');
  const cfg = getConfig();
  const port = cfg.PORT;
  const host = process.env.PORT ? '0.0.0.0' : 'localhost';

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  if (cfg.LINKEDIN_CLIENT_ID && (cfg.SESSION_SECRET ?? cfg.API_KEY)) {
    app.use(
      session({
        secret: cfg.SESSION_SECRET ?? cfg.API_KEY,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' },
      })
    );
    app.use('/auth', linkedinAuthRouter);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dashboardDist = path.resolve(__dirname, '../dashboard/dist');
  const dashboardIndexPath = path.join(dashboardDist, 'index.html');
  const hasDashboard = fs.existsSync(dashboardIndexPath);
  process.stdout.write(
    hasDashboard ? `Dashboard: serving from ${dashboardDist}\n` : `Dashboard: NOT FOUND (missing ${dashboardIndexPath}). /linkedin and other UI routes will show fallback.\n`
  );

  // Health first so Railway can reach us as soon as we listen
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  app.get('/api/dashboard-status', (_req, res) => {
    res.json({ hasDashboard, dashboardPath: dashboardDist });
  });
  app.get('/api/health', async (_req, res) => {
    try {
      const prisma = getPrisma();
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: 'ok',
        db: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(503).json({
        status: 'degraded',
        db: 'disconnected',
        error: err instanceof Error ? err.message : 'unknown',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.use('/api/posts', postsRouter);
  app.use('/api/sources', sourcesRouter);
  app.use('/api/articles', articlesRouter);
  app.use('/api/cron', cronRouter);
  app.use('/api/metrics', metricsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/actions', actionsRouter);
  app.use('/api/post-types', postTypesRouter);
  app.use('/api/generate', generateRouter);
  app.use('/api/card-spotlight', cardSpotlightRouter);
  app.use('/api/linkedin', linkedinRouter);
  app.use('/webhooks', webhooksRouter);

  if (hasDashboard) {
    app.use(express.static(dashboardDist));
    // SPA fallback - serve index.html for non-API routes
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/webhooks') || req.path.startsWith('/auth') || req.path === '/health') {
        return next();
      }
      return res.sendFile(path.join(dashboardDist, 'index.html'));
    });
  } else {
    // Dashboard not built. Serve a helpful page for any SPA-like path so /linkedin always shows something.
    const dashboardMissingHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Izziwire</title></head><body style="font-family:system-ui;max-width:560px;margin:2rem auto;padding:1rem;">
  <h1>Dashboard not deployed</h1>
  <p>The API is running, but the dashboard wasn't built in this deploy. To get the web UI (including <strong>/linkedin</strong>):</p>
  <ul>
    <li><strong>Railway:</strong> Use the project <strong>Dockerfile</strong> (builder = DOCKERFILE) so the image builds both the API and the dashboard, or add a build step that runs <code>npm run build:dashboard</code> after <code>npm run build</code>.</li>
    <li><strong>Local:</strong> Run <code>npm run build:dashboard</code> from the repo root, then restart the server.</li>
  </ul>
  <p>Check <a href="/api/dashboard-status">/api/dashboard-status</a> to confirm. API: <a href="/health">/health</a> · <a href="/api/health">/api/health</a></p>
</body></html>`;
    app.get(['/', '/linkedin', '/queue', '/published', '/post-types', '/settings'], (_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(dashboardMissingHtml);
    });
    // Catch any other GET that looks like a frontend route (e.g. /linkedin/ with trailing slash)
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/webhooks') || req.path.startsWith('/auth') || req.path === '/health') return next();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(dashboardMissingHtml);
    });
  }

  app.listen(port, host, () => {
    process.stdout.write(`Server listening on ${host}:${port}\n`);
  });

  // Start the autonomous content agent
  const { startScheduler } = await import('./scraper/scheduler.js');
  startScheduler();

  if (cfg.SENTRY_DSN) {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: cfg.SENTRY_DSN,
      environment: cfg.DEBUG ? 'development' : 'production',
      tracesSampleRate: 1.0,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
