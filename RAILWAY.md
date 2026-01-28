# Deploy to Railway

Since you have Railway access, use this to get the API (and optionally the dashboard) running on Railway.

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

7. **Generate a migration (one-off, local):**
   ```bash
   npx prisma migrate dev --name initial
   ```
   Commit the new migration under `prisma/migrations/` so `prisma migrate deploy` on Railway has something to run.

8. Deploy. After deploy, the API will be at `https://<your-service>.up.railway.app`. Check `/health` and `/api/health`.

---

## 3. (Optional) Dashboard as a second service

1. **+ New** → **GitHub Repo** → same repo.
2. Set **Root directory** to `dashboard` (so the service only sees the dashboard app).
3. **Build:** `npm ci && npm run build`
4. **Start:** `npm run start` (runs `serve dist -s -l $PORT`; the dashboard lists `serve` in devDependencies).
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
- [ ] `prisma migrate dev --name initial` run locally and migration committed
- [ ] Other variables set in Railway (at least `DATABASE_URL`; add keys and `CRON_SECRET` when you use those features)
- [ ] Deploy successful and `/health` returns 200
- [ ] Cron job(s) configured with `CRON_SECRET` if you use cron endpoints

The app binds to `0.0.0.0` when `RAILWAY_ENVIRONMENT` is set so Railway can route traffic to it.
