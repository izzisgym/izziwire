# Deploy to Railway

Get the API (and optionally the dashboard) running on Railway.

The repo includes a **Dockerfile** so Railway builds with Docker instead of Nixpacks, avoiding the `EBUSY` error on `node_modules/.cache` during `npm ci`.

---

## Get everything on Railway (quick path)

1. **Railway dashboard:** [railway.app](https://railway.app) → **New Project** → **+ New** → **Database** → **PostgreSQL**.
2. **API:** **+ New** → **GitHub Repo** → select this repo (`izzisgym/izziwire` or your fork). Root = project root.  
   - In the API service: **Variables** → **Add reference** → Postgres → `DATABASE_URL`.  
   - Add `API_KEY` (required for write/admin endpoints) and other vars from [.env.example](.env.example) as needed (e.g. `CRON_SECRET`, `TAVILY_API_KEY`, WordPress credentials).
3. **Generate domain:** API service → **Settings** → **Networking** → **Generate domain**.  
   - Visit `https://<your-api>.up.railway.app/health` and `/api/health` to confirm.
4. **Dashboard (optional):** **+ New** → **GitHub Repo** → same repo, **Root directory** = `dashboard`.  
   - Railway uses `dashboard/railway.toml` (build + `npm run start`).  
   - Add variable `VITE_API_URL` = `https://<your-api>.up.railway.app` so the UI talks to the API.  
   - Generate a domain for the dashboard service.
5. **Cron (optional):** Use Railway Cron or [cron-job.org](https://cron-job.org) to `POST` to `/api/cron/scrape` and `/api/cron/publish` with header `x-cron-secret: <CRON_SECRET>`.

Migrations in `prisma/migrations/` are applied on deploy; ensure they’re committed and pushed.

### Not responding? (URL times out or 502)

1. **Logs** – API service → **Deployments** → latest deployment → **View Logs**. Look for:
   - `Invalid config: ...` → **Variables** → add or fix `DATABASE_URL` (must be a valid Postgres URL; use **Add reference** → Postgres → `DATABASE_URL`).
   - `prisma migrate deploy` errors → DB unreachable or wrong `DATABASE_URL`; fix the variable and redeploy.
   - `Server listening on 0.0.0.0:XXXX` → app started; if the URL still doesn’t work, check Networking (domain and port).
2. **Variables** – Confirm `DATABASE_URL` is set (reference to your Postgres service). Railway sets `PORT`; the app uses it.
3. **Networking** – API service → **Settings** → **Networking** → ensure a **public domain** is generated and the deployment is using it.

### Using the Railway CLI

From the project root:

```bash
npm i -g @railway/cli
railway login
railway init   # or railway link if you already have a project
railway add    # add PostgreSQL from the menu
railway up     # deploy (uses railway.toml)
```

After the first deploy, **Variables** → add Postgres `DATABASE_URL` reference and any vars from `.env.example`. Redeploy if needed. For the dashboard, create a second service in the same project with **Root directory** = `dashboard` and add `VITE_API_URL`.

---

## 1. New project + Postgres

1. Open [railway.app](https://railway.app), create a **new project**.
2. Click **+ New** → **Database** → **PostgreSQL**.
3. Open the Postgres service → **Variables** (or **Connect**). Copy or note the `DATABASE_URL`; it is automatically available to services in the same project once you link them.

---

## 2. API service

1. **+ New** → **GitHub Repo** (or **Empty Service** and connect later).
2. Point it at this repo. Root = **project root** (where `package.json` and `railway.toml` are).
3. Railway will use `railway.toml`:
   - **Build:** `npm ci && npx prisma generate && npm run build`
   - **Start:** `npx prisma migrate deploy && node dist/index.js`
   - **Health:** `GET /health` every 30s

4. **Link Postgres:** in the API service → **Variables** → **Add variable** → **Add reference** → choose the Postgres `DATABASE_URL`. That sets `DATABASE_URL` for this service.
5. **Port:** Railway sets `PORT` for you; the app listens on it (and on `0.0.0.0` when `RAILWAY_ENVIRONMENT` is set).
6. Add any other variables from [.env.example](.env.example) as **Variables** (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`, Meta keys, Slack webhook, etc.). You can leave optional ones unset.

7. Migrations in `prisma/migrations/` are run on deploy; ensure they’re committed. (If you add schema changes, run `npx prisma migrate dev --name <name>` locally and commit the new migration.)

8. Deploy. After deploy, the API will be at `https://<your-service>.up.railway.app`. Check `/health` and `/api/health`.

---

## 3. (Optional) Dashboard as a second service

1. **+ New** → **GitHub Repo** → same repo.
2. Set **Root directory** to `dashboard` (so the service only sees the dashboard app). Railway will use `dashboard/railway.toml`:
   - **Build:** `npm ci && npm run build`
   - **Start:** `npm run start` (runs `serve dist -s -l $PORT`; the dashboard lists `serve` in devDependencies).
5. Add variable `VITE_API_URL` = `https://<your-api-service>.up.railway.app` if the dashboard calls the API by absolute URL, or configure the dashboard to use relative `/api` and put it behind the same domain/proxy.

If you keep the dashboard on the same repo but different root, the API proxy is not automatic: either point the dashboard at the API URL above or deploy the dashboard as a separate URL and set that in the dashboard env.

---

## 4. Cron (scrape + publish)

Use **Railway Cron** or any external cron (e.g. cron-job.org) to hit your API:

- **Scrape:** `POST https://<your-api>.up.railway.app/api/cron/scrape`
- **Publish:** `POST https://<your-api>.up.railway.app/api/cron/publish`

Send one of:

- Header: `x-cron-secret: <your CRON_SECRET>`
- Or: `Authorization: Bearer <your CRON_SECRET>`

Set `CRON_SECRET` in the API service variables and use the same value in the cron job.

Suggested schedule:

- Scrape: every 6 hours (or match `SCRAPE_INTERVAL_HOURS`).
- Publish: every 15–30 minutes so approved/scheduled posts go out quickly.

---

## 5. Quick checklist

- [ ] Postgres created and `DATABASE_URL` linked to the API service
- [ ] Migrations under `prisma/migrations/` committed and pushed
- [ ] Other variables set in Railway (at least `DATABASE_URL`; add keys and `CRON_SECRET` when you use those features)
- [ ] Deploy successful and `/health` returns 200
- [ ] Cron job(s) configured with `CRON_SECRET` if you use cron endpoints

The app binds to `0.0.0.0` when `RAILWAY_ENVIRONMENT` is set so Railway can route traffic to it.
