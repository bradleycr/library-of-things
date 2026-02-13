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

Set `DATABASE_URL` and a strong `STEWARD_PASSWORD`. Run `pnpm db:ensure-schema` against the production DB once.

## License

MIT.
