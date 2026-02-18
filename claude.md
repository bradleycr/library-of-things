# Library of Things — context for AI / contributors

**Update this file when you make meaningful changes** so the next session (or another dev) knows where the app stands.

## What it is

- **Library of Things:** trust-based physical book sharing at community nodes.
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
| `/add-book` | Add a book (node or Pocket Library); ISBN lookup; optional cover photo capture |
| `/book/[uuid]` | Book detail; checkout link/QR |
| `/book/[uuid]/checkout` | Checkout flow (requires library card) |
| `/my-books` | User’s borrowed books, added books, history |
| `/profile/[user_id]` | Public profile |
| `/settings` | Link card (PIN), get new card, log in with card |
| `/ledger` | Sharing history (all events; export CSV/JSON) |
| `/members` | Member list (books out, activity); links to profiles |
| `/steward/login`, `/steward/dashboard` | Steward: nodes, books (edit metadata + status/holder/location + optional ledger note), bulk add, member edit/delete; changes write to ledger |

## Data & auth

- **Bootstrap:** Client loads `/api/bootstrap`; hook `useBootstrapData()`. Supplies books, users, nodes, loan events, etc.
- **Library card:** Stored in `localStorage`; hook `useLibraryCard()`. Card can have `user_id` (linked) or not (card-only). Login/link via PIN at `/api/library-card/login`.
- **Remove card:** Header “Remove card from this device” shows a confirmation: *“Make sure you save your card and PIN. Otherwise, you won’t have access to this account.”* Then clears local card.

## Code layout

- `app/` — App Router pages and API routes
- `components/` — UI (site-header, modals, book cards, etc.)
- `hooks/` — `useLibraryCard`, `useBootstrapData`
- `lib/` — `types.ts`, `utils`, `image-utils.ts` (client-side cover photo compression); `lib/server/` — `db.ts`, `repositories.ts`
- `scripts/` — DB provisioning, migrations, backfills

## Docs to use

- **README.md** — Quickstart, scripts, links to other docs
- **DEPLOY.md** — Vercel + Supabase deploy
- **SUPABASE_SETUP.md** — DB connection (Session Pooler, etc.)
- **POCKET_LIBRARY_FEATURE.md** — Pocket Library design
- **CONTRIBUTING.md** — PRs, code style

## Current state (as of last update)

- App is deployable; main branch drives Vercel.
- Steward dashboard: edit book metadata, set availability (available / checked out / unavailable / missing), assign or change holder, move location; optional note per change; all such changes append to the sharing history (ledger). Member management: edit display name and contact info, delete members (steward-only API).
- Book edit API (`PATCH /api/books/[id]`) and member API (`PATCH|DELETE /api/steward/members/[id]`) require steward cookie auth.
- Remove-card-from-device flow includes the “save your card and PIN” confirmation dialog.
- Ledger: event types `added`, `checkout`, `return`, `transfer`, `report_lost`, `report_damaged`; `user_id` can be null (e.g. anonymized after member delete).
- No mock data in runtime; all data from Postgres via bootstrap and API routes.
- **Book cover images** — three sources: (1) OpenLibrary URL from ISBN lookup, (2) user-taken photo compressed client-side and stored as JPEG data URI in `cover_image_url`, (3) deterministic pastel-gradient SVG fallback at `/api/books/[id]/cover`; title/author on generated covers use off-black (#1a1a1a) for contrast.
- **Add-book success** — after adding a book, user sees checkout URL (copyable), optional “Add to book” guide (NFC Tools link + printable QR via qrcode.react), and “Do this later” to collapse the guide; URL stays visible.
- **Partner logos** — Foresight Institute (`/public/foresight-logo.png`) and Internet Archive (`/public/internet-archive-logo-sf.png`); referenced in site-header, site-footer, and library-card components.
