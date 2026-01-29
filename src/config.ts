import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // AI
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  TAVILY_API_KEY: z.string().min(1).optional(),

  // Meta
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  FACEBOOK_PAGE_ACCESS_TOKEN: z.string().optional(),
  FACEBOOK_PAGE_ID: z.string().optional(),
  INSTAGRAM_USER_ID: z.string().optional(),

  // Notifications
  SLACK_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  RESEND_API_KEY: z.string().optional(),
  NOTIFICATION_EMAIL: z.string().email().optional(),

  // Scraping
  SCRAPE_INTERVAL_HOURS: z.coerce.number().int().positive().default(6),
  USER_AGENT: z.string().default('TCGNewsBot/1.0 (contact@example.com)'),

  // Cron & Webhooks
  CRON_SECRET: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),

  // Sentry
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),

  // App
  DEFAULT_AI_MODEL: z.string().default('claude-sonnet-4-5-20250514'),
  IMAGE_MODEL: z.string().default('dall-e-3'),
  DEBUG: z.coerce.boolean().default(false),
  API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Config = z.infer<typeof envSchema>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid config: ${msg}`);
  }
  cached = parsed.data;
  return cached;
}
