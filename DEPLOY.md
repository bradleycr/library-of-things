# Deploy Library of Things (Vercel + Supabase)

This doc is for maintainers (or anyone deploying their own instance). Use **Supabase** for the database and **Vercel** for the app. No Vercel Postgres.

## 1. Vercel project

- **Project:** [library-of-things](https://vercel.com/bradley-royes-projects/library-of-things)  
- **ID:** `prj_QttrjwiTNn4eIKj0ExANas0G2uVp`

### GitHub repo name

The codebase and docs use **Library of Things** and the repo name **library-of-things**. If the repo is still named `flybrary` on GitHub, rename it so clone URLs and links stay consistent:

1. On GitHub: **Settings** → **General** → **Repository name** → change to `library-of-things` → **Rename**.
2. GitHub will redirect old URLs; Vercel will keep deploying from the same repo. Locally, update the remote if needed:  
   `git remote set-url origin https://github.com/bradleycr/library-of-things.git`

### Auto-sync from GitHub (deploy on every push)

For **every push to `main`** to trigger a new Vercel deployment:

1. Open **Settings → Git**:  
   [library-of-things → Settings → Git](https://vercel.com/bradley-royes-projects/library-of-things/settings/git)

2. **Connect repository** (if not already):
   - Click **Connect Git Repository**.
   - Choose **GitHub** and authorize if prompted.
   - Select the **library-of-things** repo (e.g. `bradleycr/library-of-things`).

3. **Production branch:**
   - Set **Production Branch** to `main` (so pushes to `main` deploy to production).

4. **Confirm:**
   - **Deploy Hooks** should show “Deploy on push” for the connected repo.
   - After saving, each `git push origin main` will start a new deployment automatically.

5. **Verify:** Push a commit to `main`, then open [Deployments](https://vercel.com/bradley-royes-projects/library-of-things/deployments) — a new deployment should appear within a few seconds.

If the project was created with **Vercel CLI** (e.g. `vercel`) and never linked to GitHub, you must connect the repo in **Settings → Git** as above; otherwise pushes will not trigger builds.

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
- Use the **Transaction pooler** (port **6543**) for Vercel serverless — avoid the direct port 5432. Format:  
  `postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`
- Replace `[YOUR-PASSWORD]` with your database password and paste the full string as `DATABASE_URL`.
- **Important:** Add the variable for **Production** (and Preview if you use preview deploys). If it’s only set for Preview, the live site won’t see it.

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

### If profile/contact updates fail on the live site

If users see *"Profile or contact settings couldn't be saved — the database may need an update"* when changing display name or contact info, the **production** database is missing columns. Run the schema updater against the **same** `DATABASE_URL` that Vercel uses:

1. Copy the Production `DATABASE_URL` from [Vercel → Environment Variables](https://vercel.com/bradley-royes-projects/library-of-things/settings/environment-variables) (or use your Supabase connection string; it must be the **pooler** URL on port **6543**).
2. From the repo root, run once:
   ```bash
   DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres" pnpm db:ensure-schema
   ```
3. You should see: `Schema ensured. Tables: users, nodes, books, library_cards, loan_events.`
4. Try saving profile/settings again on the live site.

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

## Troubleshooting: “0 in catalog” / database not connected

1. **Check health:** Open **https://libraryofthings.vercel.app/api/health**
   - If it returns `{ "ok": true }`, the DB is connected; the catalog may just be empty (run `pnpm db:provision` to seed).
   - If it returns **503** and `{ "ok": false, "error": "..." }`, the app can’t reach the database.

2. **Fix 503 / connection:**
   - In Vercel → **Settings** → **Environment Variables**, confirm `DATABASE_URL` exists for **Production** (not only Preview).
   - Use Supabase’s **Transaction pooler** URL with port **6543** (not 5432). In Supabase → Project Settings → Database, copy the URI that uses **port 6543** and set that as `DATABASE_URL` in Vercel.
   - Save, then **Redeploy** (Deployments → latest → ⋯ → Redeploy).

## Checklist

- [ ] **Git:** Repo connected in **Settings → Git**, Production Branch = `main` (auto-deploy on push)
- [ ] **Domains:** add `libraryofthings.vercel.app` (Settings → Domains)
- [ ] `DATABASE_URL` = Supabase Postgres URI **with port 6543** (Production + Preview in Vercel)
- [ ] `STEWARD_PASSWORD` set in Vercel (production)
- [ ] `pnpm db:ensure-schema` run once against Supabase
- [ ] Push to `main` (or Redeploy) → live at **https://libraryofthings.vercel.app**
