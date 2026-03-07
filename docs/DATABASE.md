# Database Setup

Library of Things uses PostgreSQL. No ORM — just the `pg` driver with direct SQL.

## Option A: Supabase (recommended)

Supabase provides a free managed Postgres instance that works well with Vercel.

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Go to **Project Settings → Database → Connect to your project**.
3. Select: **Type: URI**, **Source: Primary Database**, **Method: Session pooler**.
4. Copy the connection string — it looks like:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
5. Paste it as `DATABASE_URL` in your `.env.local`.

**Why Session Pooler?** It's included in the free tier, supports IPv4 networks,
and works with Vercel's serverless functions. Same database, different connection path.

## Option B: Local Postgres

For offline development:

```bash
# macOS (Homebrew)
brew install postgresql@16 && brew services start postgresql@16

# Create a database
createdb library_of_things
```

Set in `.env.local`:
```
DATABASE_URL=postgresql://localhost:5432/library_of_things
DB_SSL=none
```

## Schema setup

After setting `DATABASE_URL`, run once:

```bash
pnpm db:ensure-schema
```

This creates all tables (`users`, `nodes`, `books`, `library_cards`, `loan_events`,
`trust_events`, `app_config`) and adds any missing columns (e.g. `profile_public` on
`users`). Safe to re-run — it never deletes data. Run again after pulling if the schema was updated.

### Demo data (optional)

```bash
pnpm db:provision
```

Seeds two nodes (Foresight Berlin, Foresight SF) and sample books. **Destructive** —
truncates existing data. Dev only.

## DB_SSL

| Value | When to use |
|-------|-------------|
| *(unset)* | Supabase (default: encrypted, no CA check) |
| `strict` | Self-hosted Postgres with a proper TLS certificate |
| `none` | Local dev (no encryption) |

## Migration scripts

These live in `scripts/` and are run via `pnpm db:*`. All load env from `.env.local`
via Node's `--env-file` flag.

| Script | Purpose |
|--------|---------|
| `ensure-schema` | Create/update tables and columns (the main one) |
| `provision-db` | Reset + seed demo data |
| `backfill-added-events` | Backfill "added" ledger entries for existing books |
| `normalize-node-names` | Standardize node names (one-time, existing DBs only) |
