# Library of Things

Trust-based book sharing: physical books at community nodes, NFC/QR checkout, public sharing history. No late fees.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind, Postgres (Supabase).

## Run locally

```bash
git clone https://github.com/bradleycr/library-of-things.git
cd library-of-things
corepack enable && pnpm install
cp env.example .env.local
```

Set `DATABASE_URL` in `.env.local` (Supabase Postgres). Optionally `STEWARD_PASSWORD` for the steward dashboard (default: `password123`). Steward dashboard: edit books (metadata, status, holder, location), add optional ledger notes, and manage members; all changes appear in the public sharing history.

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

## Docs

| Doc | Purpose |
|-----|---------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute (PRs, issues, code style) |
| [DEPLOY.md](./DEPLOY.md) | Deploy to Vercel + Supabase (maintainers) |
| [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) | Supabase DB connection (Session Pooler, local) |
| [POCKET_LIBRARY_FEATURE.md](./POCKET_LIBRARY_FEATURE.md) | Pocket Library (floating books) design |
| [claude.md](./claude.md) | Living context for AI/contributors (routes, data, current state) |

## Contributing

We welcome contributions. Please read **[CONTRIBUTING.md](./CONTRIBUTING.md)** before opening a PR. Run `pnpm build` before pushing.

## Deploy

**Vercel + Supabase:** See **[DEPLOY.md](./DEPLOY.md)** for deploy steps. You need a Supabase Postgres instance and a Vercel project; set `DATABASE_URL` and `STEWARD_PASSWORD`, run `pnpm db:ensure-schema` once, then push to sync.

## License

MIT. See [LICENSE](./LICENSE).
