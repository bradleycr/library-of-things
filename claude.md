# Flybrary — context for AI / contributors

**Update this file when you make meaningful changes** so the next session (or another dev) knows where the app stands.

## What it is

- **Flybrary** (Library of Things): trust-based physical book sharing at community nodes.
- Users get a **pseudonymous library card** (card number + PIN); no email required to browse/borrow.
- Books live at **nodes** or as **Pocket Library** (floating, owner keeps book; contact for pickup).
- **QR/NFC** checkout; public **sharing history** (ledger). No late fees.

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind**
- **Postgres** via **Supabase** (`DATABASE_URL`); server layer in `lib/server/` (db, repositories)
- **Vercel** for deploy; env: `DATABASE_URL`, optional `STEWARD_PASSWORD`

## Key routes

| Route | Purpose |
|-------|---------|
| `/` | Home; catalog stats |
| `/explore` | Browse books |
| `/add-book` | Add a book (node or Pocket Library); ISBN lookup |
| `/book/[uuid]` | Book detail; checkout link/QR |
| `/book/[uuid]/checkout` | Checkout flow (requires library card) |
| `/my-books` | User’s borrowed books, added books, history |
| `/profile/[user_id]` | Public profile |
| `/settings` | Link card (PIN), get new card, log in with card |
| `/ledger` | Sharing history |
| `/steward/login`, `/steward/dashboard` | Steward: nodes, books, add book |

## Data & auth

- **Bootstrap:** Client loads `/api/bootstrap`; hook `useBootstrapData()`. Supplies books, users, nodes, loan events, etc.
- **Library card:** Stored in `localStorage`; hook `useLibraryCard()`. Card can have `user_id` (linked) or not (card-only). Login/link via PIN at `/api/library-card/login`.
- **Remove card:** Header “Remove card from this device” shows a confirmation: *“Make sure you save your card and PIN. Otherwise, you won’t have access to this account.”* Then clears local card.

## Code layout

- `app/` — App Router pages and API routes
- `components/` — UI (site-header, modals, book cards, etc.)
- `hooks/` — `useLibraryCard`, `useBootstrapData`
- `lib/` — `types.ts`, `utils`; `lib/server/` — `db.ts`, `repositories.ts`
- `scripts/` — DB provisioning, migrations, backfills

## Docs to use

- **README.md** — Quickstart, scripts, links to other docs
- **DEPLOY.md** — Vercel + Supabase deploy
- **SUPABASE_SETUP.md** — DB connection (Session Pooler, etc.)
- **POCKET_LIBRARY_FEATURE.md** — Pocket Library design
- **CONTRIBUTING.md** — PRs, code style

## Current state (as of last update)

- App is deployable; main branch drives Vercel.
- Remove-card-from-device flow includes the “save your card and PIN” confirmation dialog.
- No mock data in runtime; all data from Postgres via bootstrap and API routes.
