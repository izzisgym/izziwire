import express from 'express';
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

async function main() {
  process.stdout.write('Starting izziwire...\n');
  const cfg = getConfig();
  const port = cfg.PORT;
  const host = process.env.PORT ? '0.0.0.0' : 'localhost';

  const app = express();
  app.use(express.json());

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dashboardDist = path.resolve(__dirname, '../dashboard/dist');
  const hasDashboard = fs.existsSync(path.join(dashboardDist, 'index.html'));

  // Health first so Railway can reach us as soon as we listen
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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
  app.use('/webhooks', webhooksRouter);

  if (hasDashboard) {
    app.use(express.static(dashboardDist));
    // SPA fallback - serve index.html for non-API routes
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/webhooks') || req.path === '/health') {
        return next();
      }
      return res.sendFile(path.join(dashboardDist, 'index.html'));
    });
  }

  app.listen(port, host, () => {
    process.stdout.write(`Server listening on ${host}:${port}\n`);
  });

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
