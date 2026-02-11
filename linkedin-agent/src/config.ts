import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 3001,
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    redirectUri: process.env.LINKEDIN_REDIRECT_URI ?? "http://localhost:3001/auth/linkedin/callback",
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    defaultModel: process.env.DEFAULT_AI_MODEL ?? "claude-sonnet-4-5-20250514",
  },
  apiKey: process.env.API_KEY ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? process.env.API_KEY ?? "linkedin-agent-dev-secret",
} as const;
