# Supabase Connection Setup

## Quick Fix: Use Session Pooler (Free, IPv4 Compatible)

Your existing Supabase project works fine - you just need the **Session Pooler** connection string instead of Direct connection.

### Steps:

1. **Go to your Supabase Dashboard:**
   - https://supabase.com/dashboard/project/ymndipepdnuidxpqlwdd

2. **Navigate to Settings → Database**

3. **Click "Connect to your project"**

4. **Select these settings:**
   - **Type:** URI
   - **Source:** Primary Database
   - **Method:** **Session pooler** ← This is the key!

5. **Copy the connection string** (it will look like):
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

6. **Update `.env.local`:**
   ```bash
   DATABASE_URL=<paste_session_pooler_connection_string_here>
   ```

7. **Create database tables** (pick one):
   - **Full reset + seed (dev):** `pnpm db:provision` — creates tables and seeds demo data (wipes existing data).
   - **Add missing tables only (e.g. "Server setup incomplete"):** `pnpm db:ensure-schema` — creates any missing tables (e.g. `library_cards`) without wiping data.

8. **Restart dev server:**
   ```bash
   pnpm dev
   ```

## Why Session Pooler?

- ✅ **Free** (included in free tier)
- ✅ **IPv4 compatible** (works on your network)
- ✅ **Same database** (your existing Supabase project)
- ✅ **No Docker needed**

The Session Pooler is just a different connection method - it connects to the same database, just through a pooler that supports IPv4 networks.

## Alternative: Local Supabase (If You Want Offline Development)

If you want completely local development (no internet needed), you can install Docker and use Supabase CLI:

```bash
# Install Docker Desktop (if not installed)
# Then:
npm install supabase --save-dev
npx supabase init
npx supabase start
```

But for now, Session Pooler is the quickest solution!

## Production readiness

- **No mocks:** All API routes use the real Postgres database via `DATABASE_URL`. No mock data.
- **Schema:** Use **`pnpm db:ensure-schema`** to create missing tables (`users`, `nodes`, `books`, `library_cards`, `loan_events`) and **add missing columns** (e.g. `contact_opt_in`, `contact_email`, `phone`, social/website URLs on `users`) without wiping data. Use **`pnpm db:provision`** only when you want a full reset + demo seed (it truncates and re-seeds).
- **After going live:** Run **`pnpm db:ensure-schema`** once against your production `DATABASE_URL` so profile and contact settings can be saved (otherwise "Failed to update user" or "database may need an update" can occur when saving display name or contact info).
- If you see **"Server setup incomplete"**, run: **`pnpm db:ensure-schema`** then try again.
- **Session pooler:** Use the Session pooler connection string (port 6543) in production.
