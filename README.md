# Library of Things

Open-source, trust-based book sharing for physical communities.

**Live app:** [libraryofthings.vercel.app](https://libraryofthings.vercel.app)

Books sit on real shelves at community nodes. Stick a QR code on the spine,
and anyone can scan it to check out — no app install, no email, no late fees.
Just a pseudonymous library card generated in the browser.

```
                ┌─────────────────────────────┐
                │    shelf at a community      │
                │    node (office, café...)     │
                │                              │
                │     ┌──┐ ┌──┐ ┌──┐ ┌──┐     │
                │     └──┘ └──┘ └──┘ └──┘     │
                └──────────────┬───────────────┘
                               │
                      QR code / NFC tag
                               │
                ┌──────────────▼───────────────┐
                │       Library of Things       │
                │                               │
                │   get a library card  (anon)  │
                │   check out the book          │
                │   return when done            │
                │   browse the full catalog     │
                │                               │
                │   ── works in any browser     │
                │   ── no install needed        │
                └───────────────────────────────┘
```

Built for [Foresight Institute](https://foresight.org)'s office libraries in
Berlin and San Francisco, but designed so any community can run its own nodes
and curate its own collections.

## Quickstart

```bash
git clone https://github.com/bradleycr/library-of-things.git
cd library-of-things
corepack enable && pnpm install
cp env.example .env.local
# set DATABASE_URL in .env.local (see "Database" below)
pnpm db:ensure-schema
pnpm dev
```

Open [localhost:3000](http://localhost:3000). The app is also currently hosted at [libraryofthings.vercel.app](https://libraryofthings.vercel.app).

### Database

You need PostgreSQL. Two options:

| Option | Setup |
|--------|-------|
| **Supabase** (recommended) | Create a free project at [supabase.com](https://supabase.com). Copy the **Session Pooler** URI (port 6543) and paste it as `DATABASE_URL`. See [docs/DATABASE.md](./docs/DATABASE.md). |
| **Local Postgres** | Set `DATABASE_URL=postgresql://user:pass@localhost:5432/dbname` and `DB_SSL=none`. |

Run `pnpm db:ensure-schema` once to create tables. Optionally `pnpm db:provision`
to seed demo data (destructive — dev only).

### API smoke test (checkout + return + ledger)

With the dev server running (`pnpm dev` in another terminal):

```bash
pnpm test:api-smoke
```

This exercises card generation, checkout, the tap endpoint, return, and confirms bootstrap + (if `DATABASE_URL` is set for the script) `loan_events` / `books` rows. Override base URL with `BASE_URL=http://localhost:3000`.

### Environment

Copy `env.example` → `.env.local`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `STEWARD_PASSWORD` | No | Steward dashboard password (default: `password123`) |
| `DB_SSL` | No | `none` for local dev; omit for Supabase |

## How it works

- **Nodes** are physical locations — shelves, offices, reading rooms — where books live.
- Each book gets a **QR code** (or NFC tag) linking to its checkout page.
- Borrowers get a **pseudonymous library card** — no email or real name required.
- All activity is recorded on a **public sharing ledger**.
- A **steward dashboard** lets node managers edit books, manage members, and track activity.
- **Pocket Library** lets owners list books they keep at home; borrowers contact them to arrange pickup.

## Scripts

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build + type-check |
| `pnpm db:ensure-schema` | Create / update all tables |
| `pnpm db:provision` | Reset + seed demo data (dev only) |

## Project layout

```
app/                    Next.js App Router pages + API routes
  explore/                Browse the catalog
  book/[uuid]/            Book detail + checkout
  my-books/               Borrowed & added books
  ledger/                 Public sharing history
  steward/                Steward dashboard (login-protected)
  settings/               Library card, profile, preferences
  api/                    REST endpoints
components/             Shared UI (header, modals, book cards)
hooks/                  useLibraryCard, useBootstrapData
lib/                    Types, utilities, image compression
  server/                 DB queries, repositories, validation
scripts/                Database provisioning & migrations
docs/                   Operational guides
```

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS · PostgreSQL (via `pg`, no ORM) · Vercel

## Docs

| Doc | What it covers |
|-----|---------------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Project values, architecture, how to submit changes |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Deploy your own instance (Vercel + Supabase) |
| [docs/DATABASE.md](./docs/DATABASE.md) | Supabase connection setup, local Postgres |
| [docs/POCKET_LIBRARY.md](./docs/POCKET_LIBRARY.md) | How the floating-book feature works |
| [docs/OSS_READINESS.md](./docs/OSS_READINESS.md) | Checklist for sharing the repo as open source |

## Contributing

We'd love contributions — see **[CONTRIBUTING.md](./CONTRIBUTING.md)** for the
project's values, what kinds of changes fit, and how to get started.

## License

MIT — see [LICENSE](./LICENSE).
