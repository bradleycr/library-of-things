# Deploying Library of Things

Deploy your own instance using **Vercel** (app hosting) and **Supabase** (Postgres database).

The reference deployment for this repo is **[libraryofthings.vercel.app](https://libraryofthings.vercel.app)**.

## 1. Supabase database

1. Create a project at [supabase.com](https://supabase.com) (free tier works).
2. Go to **Project Settings → Database → Connect to your project**.
3. Choose **URI** and **Session pooler** — copy the connection string (port 6543).
4. From the repo root, set `DATABASE_URL` and run the schema script:

```bash
export DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
pnpm db:ensure-schema
```

Optionally seed demo data with `pnpm db:provision` (destructive).

## 2. Vercel project

1. Create a project at [vercel.com](https://vercel.com) and connect your GitHub fork/repo.
2. Set **Production Branch** to `main` (Settings → Git).
3. Add environment variables (Settings → Environment Variables):

| Variable | Value | Environments |
|----------|-------|-------------|
| `DATABASE_URL` | Supabase Session Pooler URI (port 6543) | Production, Preview |
| `STEWARD_PASSWORD` | A strong password for the steward dashboard | Production |

4. Push to `main` — Vercel builds and deploys automatically.

### Setting env vars via script (optional)

If you prefer the CLI, add `VERCEL_TOKEN` to your `.env.local` and run:

```bash
node --env-file=.env.local scripts/set-vercel-env.mjs
```

This pushes `DATABASE_URL` and `STEWARD_PASSWORD` to the Vercel project via the API.

## 3. After deploy

- **Steward dashboard** — `/steward/login` (password = your `STEWARD_PASSWORD`).
  From here you can manage books, bulk-add by ISBN, manage members, and copy
  NFC tag URLs.
- **Schema updates** — when you pull new code that adds columns, run
  `pnpm db:ensure-schema` against your production `DATABASE_URL` once. Otherwise features like profile image regeneration may return "Database needs an update".

## Troubleshooting

### "0 in catalog" / database not connected

1. Check `/api/health` — if `{ "ok": true }`, the DB is connected but empty (run `pnpm db:provision` to seed).
2. If 503: confirm `DATABASE_URL` is set for **Production** (not only Preview) in Vercel. Use the **Session Pooler** URL with port **6543**.
3. Save and **Redeploy** (Deployments → latest → Redeploy).

### 401 Unauthorized

If Vercel's **Deployment Protection** is on, it blocks public access. Turn it off
in Settings → Deployment Protection — the steward area has its own password auth.

### Profile updates fail ("database may need an update")

Run `pnpm db:ensure-schema` against production once — a schema migration is probably missing.

## Custom domain

In Vercel → Settings → Domains, add your domain. For `*.vercel.app` subdomains,
just type the name and click Add.
