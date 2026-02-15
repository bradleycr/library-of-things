# Deploy Flybrary (Vercel + Supabase)

Use **your existing Supabase** for the database and your **existing Vercel project** for the app. No Vercel Postgres—keep it clean.

## 1. Vercel project

- **Project:** [library-of-things](https://vercel.com/bradley-royes-projects/library-of-things)  
- **ID:** `prj_QttrjwiTNn4eIKj0ExANas0G2uVp`

If this repo is not yet the project’s source:

- Vercel → **library-of-things** → **Settings** → **Git**
- Connect this GitHub repo and choose the branch to deploy (e.g. `main` or `release/ready-for-live`).

## 2. Environment variables (Vercel)

You need `DATABASE_URL` (Supabase Postgres) and optionally `STEWARD_PASSWORD` in Vercel.

**Option A – Script (uses your existing .env.local)**

1. Create a Vercel token: [vercel.com/account/tokens](https://vercel.com/account/tokens) (Full Account or project scope).
2. Add to `.env.local`: `VERCEL_TOKEN=your_token_here` (your `.env.local` already has `DATABASE_URL` and optionally `STEWARD_PASSWORD`).
3. Run from the repo root:
   ```bash
   node --env-file=.env.local scripts/set-vercel-env.mjs
   ```
   This pushes `DATABASE_URL` and `STEWARD_PASSWORD` from `.env.local` to the Vercel project via the API. Then redeploy.

**Option B – Manual in Vercel**

In **Project Settings** → **Environment Variables**, add:

| Name               | Value                    | Environments   |
|--------------------|--------------------------|----------------|
| `DATABASE_URL`     | Your Supabase Postgres connection string | Production, Preview |
| `STEWARD_PASSWORD` | A strong password for the steward dashboard | Production (optional for Preview) |

**Where to get DATABASE_URL (Supabase):**

- [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** (gear) → **Database**
- Under **Connection string**, choose **URI**
- Use the **Session pooler** (port **6543**) URL when shown; it works best with Vercel serverless. Format:  
  `postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`
- Replace `[YOUR-PASSWORD]` with your database password and paste the full string as `DATABASE_URL`.

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

## 5. Use libraryofthings.vercel.app as the live URL

1. In Vercel, open your project → **Settings** → **Domains**.
2. In **Domain**, type: `libraryofthings.vercel.app`
3. Click **Add**.
4. Vercel assigns that address to this project (no DNS needed for *.vercel.app).
5. The app will be live at **https://libraryofthings.vercel.app** once the next deployment is done.

## 6. Get a deployment out

- **If the project is already connected to GitHub:** Pushing to the connected branch (e.g. `release/ready-for-live`) triggers a new deployment. In **Deployments**, wait for the latest build to be **Ready**, then open **https://libraryofthings.vercel.app**.
- **No new deployment?** Open **Deployments** → latest deployment → **...** menu → **Redeploy**. When it finishes, the live URL will show the new build.

## 7. After deploy

- **App URL:** **https://libraryofthings.vercel.app**
- **Steward dashboard:** https://libraryofthings.vercel.app/steward/login (password = `STEWARD_PASSWORD`).
- **Bulk NFC URLs:** Steward Dashboard → “Bulk NFC Tag URLs” — copied URLs will use the live domain.

## Checklist

- [ ] Repo connected to Vercel project **library-of-things**
- [ ] **Domains:** add `libraryofthings.vercel.app` (Settings → Domains)
- [ ] `DATABASE_URL` = Supabase Postgres URI (in Vercel env vars)
- [ ] `STEWARD_PASSWORD` set in Vercel (production)
- [ ] `pnpm db:ensure-schema` run once against Supabase
- [ ] Push to connected branch (or Redeploy) → live at **https://libraryofthings.vercel.app**
