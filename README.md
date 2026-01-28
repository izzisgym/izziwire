# Izziwire – TCG Social Media Agent

AI-powered content pipeline for Pokemon, One Piece, and Magic: The Gathering communities: news aggregation, AI post generation, human approval, and Meta (Facebook/Instagram) publishing.

**Stack:** Node.js 20+, TypeScript, Express, Prisma + PostgreSQL, Vite + React (dashboard). All compute and data run on **Railway** (no Supabase or Streamlit Cloud).

---

## Quick start

### Prerequisites

- Node.js 20+
- PostgreSQL (e.g. Railway Postgres)
- `.env` with required variables (see [.env.example](.env.example))

### 1. Install and generate Prisma client

```bash
npm install
npx prisma generate
```

### 2. Database

Create a PostgreSQL database (e.g. add Postgres in Railway), set `DATABASE_URL` in `.env`, then run migrations:

```bash
npx prisma migrate dev --name initial
```

Seed news sources (optional):

```bash
npm run db:seed
```

### 3. Run the API

```bash
npm run dev
```

- Health: [http://localhost:3000/health](http://localhost:3000/health)
- API health (DB): [http://localhost:3000/api/health](http://localhost:3000/api/health)

### 4. Run the dashboard

```bash
cd dashboard && npm install && npm run dev
```

Dashboard runs on port 5173 and proxies `/api` to the API (default port 3000).

---

## Environment variables

Copy [.env.example](.env.example) to `.env` and set:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | For AI | Claude API key |
| `OPENAI_API_KEY` | For images | OpenAI API key (DALL-E) |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | For publish | Meta Page token |
| `FACEBOOK_PAGE_ID` | For publish | Page ID |
| `INSTAGRAM_USER_ID` | For publish | IG Business Account user ID |
| `SLACK_WEBHOOK_URL` | Optional | Slack notifications for new posts / failures |
| `CRON_SECRET` | For cron | Secret for `POST /api/cron/scrape` and `/api/cron/publish` |
| `META_VERIFY_TOKEN` | Optional | Token for Meta webhook verification (`GET /webhooks/meta`) |
| `SENTRY_DSN` | Optional | Sentry error tracking |

---

## API overview

- `GET /health` – Liveness
- `GET /api/health` – DB connectivity
- `GET /api/posts/pending` – Pending posts
- `GET /api/posts/:id` – Post by id
- `POST /api/posts/:id/approve` – Approve (body: `{ scheduledFor?, notes? }`)
- `POST /api/posts/:id/reject` – Reject (body: `{ reason }`)
- `POST /api/posts/:id/schedule` – Schedule (body: `{ scheduledFor, notes? }`)
- `GET /api/posts/published` – Published posts
- `GET /api/sources` – News sources
- `POST /api/sources` – Create source
- `PUT /api/sources/:id` – Update source
- `DELETE /api/sources/:id` – Delete source
- `POST /api/sources/:id/scrape` – Trigger scrape
- `GET /api/articles` – Articles (query: `game`, `processed`, `limit`)
- `GET /api/articles/:id` – Article by id
- `POST /api/articles/:id/generate` – Generate pending post (body: `{ platform?, postType?, generateImage? }`)
- `GET /api/metrics` – Counts (pending, published today)
- `POST /api/cron/scrape` – Run scrape cycle (header: `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`)
- `POST /api/cron/publish` – Run publish cycle (same auth)
- `GET /webhooks/meta` – Meta webhook verification
- `POST /webhooks/meta` – Meta webhook events

---

## Deploy on Railway

1. **Create a Railway project** and add PostgreSQL (use generated `DATABASE_URL`).

2. **API service**
   - Connect repo, root = project root.
   - Build: `npm install && npx prisma generate && npm run build`
   - Start: `node dist/index.js`
   - Add all env vars from `.env.example` (including `DATABASE_URL`, `PORT`).
   - Run migrations: `npx prisma migrate deploy` (e.g. in a one-off or deploy hook).

3. **Dashboard** (optional second service)
   - Same repo, root = `dashboard`.
   - Build: `npm install && npm run build`
   - Start: `npx serve dist -s -l $PORT`
   - Set `PORT` or use Railway’s default.

4. **Cron**
   - Use Railway Cron or an external cron to call:
     - `POST https://your-api.up.railway.app/api/cron/scrape`
     - `POST https://your-api.up.railway.app/api/cron/publish`
   - Header: `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.

---

## Project layout

```
├── src/
│   ├── config.ts           # Env and settings
│   ├── index.ts            # Express app
│   ├── api/
│   │   ├── deps.ts         # getConfig, getPrisma
│   │   └── routes/         # posts, sources, articles, cron, metrics, webhooks
│   ├── scraper/            # RSS, web scraper, sources, scheduler
│   ├── ai/                 # Content generator, image generator, prompts, variation
│   ├── queue/              # Repository, workflow, pipeline, publisher
│   ├── social/             # auth, facebook, instagram, media
│   ├── notifications/      # slack
│   └── lib/                # retry
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── dashboard/              # Vite + React SPA
├── railway.toml
└── README.md
```

---

## Licence

MIT
