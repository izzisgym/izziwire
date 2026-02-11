# LinkedIn Agent

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

## Hosted dashboard (deploy anywhere)

The app can run on any host that supports Node or Docker. Set these when hosting:

- **LINKEDIN_REDIRECT_URI** – Must be your public callback URL, e.g. `https://your-app.railway.app/auth/linkedin/callback`. Add this exact URL in your [LinkedIn app](https://www.linkedin.com/developers/apps) under Auth → Redirect URLs.
- **SESSION_SECRET** – A long random string (e.g. `openssl rand -hex 32`) so session cookies are signed.
- **DATABASE_URL** – For production, prefer Postgres (e.g. Railway/Render add-on). SQLite works for a single instance if the DB file is on a persistent volume.

### Docker

```bash
cd linkedin-agent
docker build -t linkedin-agent .
docker run -p 3001:3001 \
  -e PORT=3001 \
  -e SESSION_SECRET="your-secret" \
  -e LINKEDIN_CLIENT_ID="..." \
  -e LINKEDIN_CLIENT_SECRET="..." \
  -e LINKEDIN_REDIRECT_URI="https://your-domain.com/auth/linkedin/callback" \
  -e ANTHROPIC_API_KEY="..." \
  -v linkedin-data:/app/data \
  linkedin-agent
```

Then open **https://your-domain.com** (use a reverse proxy or your host’s HTTPS).

### Railway / Render / Fly.io

1. Connect the `linkedin-agent` folder (or repo) to the platform.
2. Set **root directory** to `linkedin-agent` if the repo contains other projects.
3. Add env vars: `PORT`, `SESSION_SECRET`, `LINKEDIN_*`, `ANTHROPIC_API_KEY`, and optionally `DATABASE_URL` (Postgres) or use SQLite with a persistent disk if the host supports it.
4. **Build:** `npm install && npx prisma generate && npm run build`
5. **Start:** `node dist/index.js`
6. Set **LINKEDIN_REDIRECT_URI** to your app URL + `/auth/linkedin/callback` and add that URL in the LinkedIn developer console.

After deploy, open the dashboard at your app’s URL (e.g. `https://linkedin-agent.up.railway.app`).
