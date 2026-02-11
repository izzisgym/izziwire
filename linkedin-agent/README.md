# LinkedIn Agent (standalone)

> **The LinkedIn Agent is now built into the main Izziwire app.** Use the main repo’s dashboard at **/linkedin** and the API at `/api/linkedin` and `/auth/linkedin`. See the root [README](../README.md) and [RAILWAY.md](../RAILWAY.md). This folder remains as a standalone reference.

Separate product for LinkedIn automation: OAuth, post creation from topics, approval queue, and “draft a comment” assistant. Uses the official LinkedIn Posts API and `w_member_social` only; no scraping or auto-engagement.

## Setup

1. Copy `.env.example` to `.env` and set:
   - `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI` (from [LinkedIn Developer Apps](https://www.linkedin.com/developers/apps))
   - `ANTHROPIC_API_KEY` for AI-generated posts and comment suggestions
   - `DATABASE_URL` (Postgres; for local dev use Docker Postgres or e.g. [Neon](https://neon.tech))

2. Install and DB:
   ```bash
   npm install
   npx prisma db push
   ```

3. Run:
   ```bash
   npm run dev
   ```
   Open http://localhost:3001 (or `PORT` from `.env`).

## Features

- **Connect LinkedIn:** `/auth/linkedin` → OAuth → tokens stored in DB.
- **Post now:** Dashboard “Post now” or `POST /api/posts` with `{ "commentary": "..." }`.
- **Topics:** Add topics (and optional keywords); used for AI post generation.
- **Drafts:** Create drafts via UI or cron; approve to publish to LinkedIn.
- **Cron:** `POST /cron/generate-draft` (optional `X-Cron-Secret` or `?secret=`) picks a random topic, generates a post with AI, saves as draft.
- **Draft a comment:** Paste post text or URL → `POST /api/comment/suggest` → suggested comment to copy and post manually.

## API

- `GET /api/status` – LinkedIn connection status
- `POST /api/posts` – Publish a post (body: `{ commentary }`)
- `GET/POST /api/topics` – List / create topics
- `GET /api/drafts`, `POST /api/drafts`, `POST /api/drafts/:id/approve` – Drafts and approve → publish
- `POST /api/comment/suggest` – Suggest comment (body: `{ postText }` or `{ postUrl }`)
- `POST /cron/generate-draft` – Generate one draft from a random topic (optional `CRON_SECRET`)

## Deploy (Railway – same project as the rest of the app)

This repo is set up to run the API, dashboard, and LinkedIn Agent **all on Railway** in one project. Deploy the LinkedIn Agent as a separate service with **Root directory** = `linkedin-agent`.

See the root **[RAILWAY.md](../RAILWAY.md)** for the full deploy guide. Summary:

1. In your Railway project: **+ New** → **GitHub Repo** → same repo, **Root directory** = `linkedin-agent`.
2. Add **Variables:** `DATABASE_URL` (reference a Postgres; use a dedicated DB or a second database in the same Postgres), `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI` = `https://<this-service>.up.railway.app/auth/linkedin/callback`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`.
3. In the [LinkedIn app](https://www.linkedin.com/developers/apps), add that redirect URL under Auth → Redirect URLs.
4. Generate a domain for the service. The dashboard is at that URL.
