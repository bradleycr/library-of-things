# Flybrary

Trust-based book sharing: physical books at community nodes, NFC/QR checkout, public sharing history. No late fees.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind, Postgres (Supabase).

## Run locally

```bash
git clone https://github.com/bradleycr/flybrary.git
cd flybrary
corepack enable && pnpm install
cp env.example .env.local
```

Set `DATABASE_URL` in `.env.local` (Supabase Postgres). Optionally `STEWARD_PASSWORD` for the steward dashboard (default: `password123`).

```bash
pnpm db:ensure-schema    # create/update tables
pnpm db:provision        # optional: reset + seed demo data
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Command | Purpose |
|--------|---------|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm db:ensure-schema` | Apply schema migrations |
| `pnpm db:provision` | Reset DB + seed (dev only) |
| `pnpm db:backfill-added-events` | Backfill “added” events for existing books |

## Deploy

**Vercel + Supabase:** See **[DEPLOY.md](./DEPLOY.md)** for steps using your existing [Vercel project](https://vercel.com/bradley-royes-projects/library-of-things) and Supabase (no Vercel DB). Set `DATABASE_URL` (Supabase) and `STEWARD_PASSWORD` in Vercel, run `pnpm db:ensure-schema` once, then push to sync.

## License

MIT.
