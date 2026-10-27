# Library of Things

Open-source, trust-based sharing for books and useful physical things.

**Live app:** [libraryofthings.vercel.app](https://libraryofthings.vercel.app)

Books and useful objects live at community nodes. A QR code or NFC tag opens
the checkout and return flow in any browser—no app install and no late fees.
Members use a pseudonymous library card; temporary keycards can use an
email-only sign-out.

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
Berlin and San Francisco, and open for other communities to join or self-host.

### Join this library, or run your own

| Path | What to do |
|------|------------|
| **Add a node here** | Want a shelf on the live [Foresight Library of Things](https://libraryofthings.vercel.app)? Email **[bradley@foresight.org](mailto:bradley@foresight.org)** with your place, address, and who will steward it. |
| **Run your own** | Fork this repo, deploy with your own database and steward password — see **[docs/FORKING.md](./docs/FORKING.md)**. Keep it open source under the same AGPL license, and please contribute useful improvements back upstream via pull request. |

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

Open [localhost:3000](http://localhost:3000). The reference deployment is
[libraryofthings.vercel.app](https://libraryofthings.vercel.app).

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
| `STEWARD_PASSWORD` | No | Steward dashboard password (**default `password123` is for local dev only — set a strong value in production**) |
| `DB_SSL` | No | `none` for local dev; omit for Supabase |
| `APPLE_WALLET_*` | No | Optional pass signing — see [docs/WALLET.md](./docs/WALLET.md) |

## How it works

- **Nodes** are physical locations — shelves, offices, reading rooms — where books live.
- Each book gets a **QR code** (or NFC tag) linking to its checkout page.
- Borrowers get a **pseudonymous library card**; a private contact email is required to borrow books (showing it on a public profile is optional).
- **Temporary keycards and other operational items** can use email-only sign-out without creating a member account.
- All activity is recorded on a **public sharing ledger**.
- A **steward dashboard** lets node managers edit books, manage members, and track activity.
- **Pocket Library** lets owners list books they keep at home; borrowers contact them to arrange pickup.

## Scripts

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build + type-check |
| `pnpm check` | Supported repo gate; currently aliases `pnpm build` |
| `pnpm lint` | Compatibility alias that explains Next.js 16 lint removal, then runs `pnpm check` |
| `pnpm db:ensure-schema` | Create / update all tables |
| `pnpm db:provision` | Reset + seed demo data (dev only) |

## Project layout

```
app/                    Next.js App Router pages + API routes
  explore/                Browse the catalog
  book/[uuid]/            Book detail + checkout
  thing/[uuid]/           Temporary keycard / operational item checkout
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
docs/                   Guides for deploy, privacy, forks, and ops
```

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS · PostgreSQL (via `pg`, no ORM) · Vercel

## Docs

| Doc | What it covers |
|-----|---------------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Project values, architecture, how to submit changes |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Collaboration expectations |
| [SECURITY.md](./SECURITY.md) | Vulnerability reporting and sensitive data guidance |
| [docs/PRIVACY.md](./docs/PRIVACY.md) | What is public vs private in the app |
| [docs/FORKING.md](./docs/FORKING.md) | Run an independent community library from your fork |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Deploy your own instance (Vercel + Supabase) |
| [docs/DATABASE.md](./docs/DATABASE.md) | Supabase connection setup, local Postgres |
| [docs/TEMPORARY_KEYCARDS.md](./docs/TEMPORARY_KEYCARDS.md) | Numbered temporary keycards, NFC/QR labels, simple checkout and return |
| [docs/POCKET_LIBRARY.md](./docs/POCKET_LIBRARY.md) | How the floating-book feature works |
| [docs/WALLET.md](./docs/WALLET.md) | Optional Apple Wallet pass signing; Google Wallet notes |
| [docs/ISBN_CHECKOUT_RETURN_PLAN.md](./docs/ISBN_CHECKOUT_RETURN_PLAN.md) | Optional ISBN scan checkout/return |

Maintainer / QA notes (not required for forks): [OSS readiness](./docs/OSS_READINESS.md), [manual test checklist](./docs/MANUAL_TEST_CHECKLIST.md), [card login SQL](./docs/DIAGNOSE_CARD_LOGIN.md).

## Security & privacy

Report vulnerabilities privately via [SECURITY.md](./SECURITY.md). For how member
and guest data is exposed in the product, see [docs/PRIVACY.md](./docs/PRIVACY.md).

## Contributing

We'd love contributions — see **[CONTRIBUTING.md](./CONTRIBUTING.md)** for the
project's values, what kinds of changes fit, and how to get started.

If you run a fork in production, please open pull requests for fixes and
features that would help other communities too. That keeps the commons healthy
and satisfies the spirit of the license.

## License

**[AGPL-3.0](./LICENSE)** (GNU Affero General Public License v3).

Copyright © 2025–2026 [Foresight Institute](https://foresight.org).

You may use, modify, and run Library of Things, including as a hosted service,
as long as you keep the software free and open under AGPL-3.0. If you modify
it and offer it over a network, you must provide the complete corresponding
source to users. Please also contribute meaningful improvements back to the
[original repository](https://github.com/bradleycr/library-of-things) when you can.
