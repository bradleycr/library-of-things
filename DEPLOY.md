# Deploy Flybrary (Vercel + Supabase)

Use **your existing Supabase** for the database and your **existing Vercel project** for the app. No Vercel Postgres—keep it clean.

## 1. Vercel project

- **Project:** [v0-flybrary](https://vercel.com/bradley-royes-projects/v0-flybrary)  
- **ID:** `prj_QttrjwiTNn4eIKj0ExANas0G2uVp`

If this repo is not yet the project’s source:

- Vercel → **v0-flybrary** → **Settings** → **Git**
- Connect this GitHub repo and choose the branch to deploy (e.g. `main` or `release/ready-for-live`).

## 2. Environment variables (Vercel)

In **Project Settings** → **Environment Variables**, set:

| Name               | Value                    | Environments   |
|--------------------|--------------------------|----------------|
| `DATABASE_URL`     | Your Supabase Postgres connection string | Production, Preview |
| `STEWARD_PASSWORD` | A strong password for the steward dashboard | Production (optional for Preview) |

**Supabase connection string:**

- Supabase Dashboard → **Project Settings** → **Database**
- Copy **Connection string** → **URI** (use the one that includes the password, e.g. `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres` for pooler, or port 5432 for direct).

Use the **pooler** URI (port 6543) if Supabase shows it; it works better with serverless (Vercel).

## 3. Database (Supabase)

Run schema and optional seed **once** against your Supabase DB (from this repo on your machine):

```bash
# From the repo root, with DATABASE_URL pointing at Supabase (e.g. in .env.local)
export DATABASE_URL="your-supabase-connection-string"
pnpm db:ensure-schema
# Optional: seed demo data (only if you want the sample books/nodes)
pnpm db:provision
```

Or set `DATABASE_URL` in `.env.local` and run:

```bash
pnpm db:ensure-schema
pnpm db:provision   # optional
```

## 4. Deploy (sync this code)

Push the branch that Vercel is watching:

```bash
git add .
git commit -m "Sync app for Vercel + Supabase"
git push origin main   # or your connected branch
```

Vercel will build and deploy. The site will use the **Supabase** `DATABASE_URL` you set in step 2.

## 5. After deploy

- **App URL:** `https://v0-flybrary-*.vercel.app` (or your custom domain if added).
- **Steward dashboard:** `/steward/login` (password = `STEWARD_PASSWORD`).
- **Bulk NFC URLs:** Steward Dashboard → “Bulk NFC Tag URLs” — copied URLs will use the live domain.

## Checklist

- [ ] Repo connected to Vercel project **v0-flybrary**
- [ ] `DATABASE_URL` = Supabase Postgres URI (in Vercel env vars)
- [ ] `STEWARD_PASSWORD` set in Vercel (production)
- [ ] `pnpm db:ensure-schema` run once against Supabase
- [ ] Push to connected branch → deploy uses this code + Supabase only
