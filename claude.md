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
| `/` | Home; catalog stats; “Available now” books first, then How it works, nodes |
| `/explore` | Browse books |
| `/add-book` | Add a book (node or Pocket Library); ISBN lookup; optional cover photo capture |
| `/book/[uuid]` | Book detail; checkout link/QR |
| `/book/[uuid]/checkout` | Checkout flow (requires library card) |
| `/my-books` | User’s borrowed books, added books, history |
| `/profile/[user_id]` | Public profile |
| `/settings` | Link card (PIN), get new card, log in with card |
| `/ledger` | Sharing history (all events; export CSV/JSON) |
| `/members` | Member list (books out, activity); links to profiles |
| `/steward/login`, `/steward/dashboard` | Steward: nodes, books (edit metadata + status/holder/location + optional ledger note), **Library settings** (default loan period), bulk add, member edit/delete; changes write to ledger |

## Data & auth

- **Bootstrap:** Client loads `/api/bootstrap`; hook `useBootstrapData()`. Supplies books, users, nodes, loan events, **config** (e.g. `default_loan_period_days`), etc.
- **Library card:** Stored in `localStorage`; hook `useLibraryCard()`. Card can have `user_id` (linked) or not (card-only). Login/link via PIN at `/api/library-card/login`.
- **Remove card:** Header “Remove card from this device” shows a confirmation: *“Make sure you save your card and PIN. Otherwise, you won’t have access to this account.”* Then clears local card.

## Code layout

- `app/` — App Router pages and API routes
- `components/` — UI (site-header, modals, book cards, etc.)
- `hooks/` — `useLibraryCard`, `useBootstrapData`
- `lib/` — `types.ts`, `utils`, `image-utils.ts` (client-side cover photo compression), **`loan-period.ts`** (default suggested rental period + helpers); `lib/server/` — `db.ts`, `repositories.ts`
- `scripts/` — DB provisioning, migrations, backfills

## Docs

- **README.md** — Quickstart, scripts, project overview
- **CONTRIBUTING.md** — Project values, architecture, how to contribute
- **docs/DEPLOY.md** — Vercel + Supabase deploy
- **docs/DATABASE.md** — DB connection setup (Supabase Session Pooler, local Postgres)
- **docs/POCKET_LIBRARY.md** — Pocket Library (floating books) design

## Security

- **Session auth**: Protected endpoints (`/api/users/[id]`, `/api/books/checkout`, `/api/books/return`, `/api/books/create`) require a valid `lot_session` cookie set during card generation/login. HMAC-signed stateless tokens derived from `DATABASE_URL`.
- **Rate limiting**: Card generation and login are limited to 10 req/min per IP; steward login to 5 req/min.
- **Timing-safe comparisons**: Steward password and cookie token checks use constant-time comparison.
- **Salted PIN hashing**: PINs are hashed with a static salt; legacy unsalted hashes migrate on login.
- **Cover URL sanitization**: Only `https://`, `http://`, and `data:image/` URLs accepted; `javascript:` and other protocols blocked.
- **CSV export**: Formula injection prevented by prefixing dangerous characters with `'`.
- **Health endpoint**: DB error details logged server-side only; generic message returned to client.

## Current state (as of last update)

- App is deployable; main branch drives Vercel.
- Steward dashboard: edit book metadata, set availability (available / checked out / unavailable / missing), assign or change holder, move location; optional note per change; all such changes append to the sharing history (ledger). Member management: edit display name and contact info, delete members (steward-only API).
- Book edit API (`PATCH /api/books/[id]`) and member API (`PATCH|DELETE /api/steward/members/[id]`) require steward cookie auth.
- Remove-card-from-device flow includes the “save your card and PIN” confirmation dialog.
- Ledger: event types `added`, `checkout`, `return`, `transfer`, `report_lost`, `report_damaged`, `removed`; `user_id` can be null (e.g. anonymized after member delete). For `removed` (book deleted from library), `book_id` is null and the row is kept for history.
- No mock data in runtime; all data from Postgres via bootstrap and API routes.
- **Book cover images** — three sources: (1) OpenLibrary URL from ISBN lookup, (2) user-taken photo compressed client-side and stored as JPEG data URI in `cover_image_url`, (3) deterministic pastel-gradient SVG fallback at `/api/books/[id]/cover`; title/author on generated covers use off-black (#1a1a1a) for contrast. Cover API cache is 24h so design updates apply within a day.
- **Add-book success** — after adding a book, user sees checkout URL (copyable), optional “Add to book” guide (NFC Tools link + printable QR via qrcode.react), and “Do this later” to collapse the guide; URL stays visible.
- **Add-book UX** — ISBN: no Look Up button; once 10 or 13 digits are entered (with optional spaces/dashes; ISBN-10 can end with X), lookup runs automatically after 700ms debounce; in-flight lookups are cancelled when the user keeps typing. Cover photo: after capture and compression, the photo is applied immediately (no “Use this photo” step); user can still Retake or Cancel from the preview. When they cancel (or when no URL/photo is set), the form shows a generated cover preview (same pastel generator as live covers) so users see what will be used; long titles/authors on generated covers are truncated with ellipsis so text never overflows.
- **Partner logos** — Foresight in header + footer; Internet Archive in footer (and library card) only, not in header.
- **Book location display** — Under books (cards, explore, book detail) we always show the **node name** (e.g. "Foresight Berlin Node") when the book is at a node; only Pocket Library books show the typed address/location text.
- **Anonymous adds** — When a book is added anonymously, public-facing views (book page, explore, etc.) show "Added by Anonymous" with no link; `added_by_user_id` is stripped from bootstrap for non-steward requests. Only the steward dashboard receives full book data (including who added anonymous books).
- **Return flow** — My Books “Return” opens a dialog; user picks return node and optional notes, then “Confirm Return” calls `POST /api/books/return`, refetches bootstrap, and shows a success toast. Checkout-page return (holder at node): geofencing uses ~1.5 km radius plus device-reported accuracy to reduce false “not nearby”; “Refresh my location” re-requests position.
- **Checkout limit** — Users may have at most 2 books checked out at once. Server rejects a third checkout with 403; checkout page shows “Borrowing limit reached” and link to My books when they already have 2.
- **Notify when available** — On book detail, “Notify Me When Available” stores the book id in localStorage and shows a toast; button state reflects that. Email delivery not yet implemented.
- **Notification preferences** — Settings notification toggles (return reminders, book availability, newsletter) persist to localStorage and show a save toast; backend/email not yet implemented.
- **API robustness** — `/api/books/[id]/cover`, `/api/books/search`, `/api/books/[id]/tap`, `/api/auth/generate-pseudonym`, `/api/ledger/export`, and `/api/users/[id]/trust-history` wrap handlers in try/catch and return 500 on error to avoid unhandled crashes.
- **Schema** — `books.availability_status` CHECK allows `available`, `checked_out`, `in_transit`, `retired`, `unavailable`, `missing` (steward UI uses unavailable/missing; API normalizes to in_transit/retired when writing).
- **Server validation** — Shared `lib/server/validate.ts`: `isUuid()`, `parseJsonBody()` (400 on invalid JSON), `LIMITS` and `clampString()` for input length. Used in books create/checkout/return, books [id] PATCH; cover URLs sanitized via `lib/server/sanitize-cover-url.ts` on create and PATCH.
- **Atomic card creation** — Library card generation uses `createUserAndLibraryCard()` (single transaction); no orphan users if card insert fails.
- **Explore** — Bootstrap `error` state shown with retry; distance filter filters by user location when available; view toggles 44px touch targets; clear-search has `aria-label`.
- **No alert()** — Add-book and checkout/return flows use toast for errors. Tap fetch uses AbortController for cleanup on unmount.
- **DB indexes** — `ensure-schema` adds `idx_books_availability_status`, `idx_books_current_node_id`, `idx_books_current_holder_id`, `idx_loan_events_book_timestamp`, `idx_loan_events_user_timestamp`, and **app_config** table (key/value for e.g. `default_loan_period_days`). Backfill script documented as idempotent.
- **Steward auth** — Invalid JSON body returns 400. Mobile menu and profile button: menu closes on pathname change; profile button has `aria-label` and 44px touch target.
- **Default loan period** — Single source: `lib/loan-period.ts` (`DEFAULT_LOAN_PERIOD_DAYS` = 60) and steward-editable **app_config** (`default_loan_period_days`). Bootstrap returns `config`; create book, checkout, steward edit, book detail, add-book, and return/trust logic use config (or constant when config unavailable). Steward dashboard has a **Library settings** card to change the default; it propagates app-wide.
- **Tap without card** — Checkout page shows "Get Library Card or Log In" (links to `/settings`) instead of "Go to Library of Things" when user has no library card.
- **Dialog scroll** — DialogContent capped at 85vh with overflow-y scroll so bottom buttons (e.g. Confirm Return) are reachable on mobile.
- **Display name propagation** — `updateUserProfile()` cascades display name changes to `books.added_by_display_name`, `books.current_holder_name`, `loan_events.user_display_name`, and `library_cards.pseudonym` so every surface (profile, ledger, book cards, library card display) updates immediately. Login API returns the authoritative `users.display_name` rather than the card's stored pseudonym, so session refreshes never revert a renamed user. Profile page and add-book page prefer `user.display_name` from bootstrap over `card.pseudonym`.
- **Steward dashboard pagination** — Book Management, Bulk NFC Tag URLs, and Member Management sections show 10 items initially with "Show more" progressive disclosure and a "Collapse" option. NFC pagination resets when the node filter changes.
- **Steward cover image editing** — Edit Book dialog supports pasting a URL or uploading a photo (compressed client-side via `compressBookCoverPhoto`) with a live preview. Uploaded images show as "(uploaded photo)" with a Remove button to switch back to URL entry.
- **Delete book from library** — Steward dashboard Book Management: Delete (trash) button opens a confirmation dialog; optional ledger note. `DELETE /api/books/[id]` (steward-only) inserts a `removed` ledger event then deletes the book. `loan_events.book_id` is nullable with ON DELETE SET NULL so removed events remain in the ledger with book title preserved.
- **ensure-schema covers Pocket Library** — `pnpm db:ensure-schema` now adds `owner_contact_email` and `is_pocket_library` columns to `books`; no separate migration script needed for new setups.
- **Docs reorganized** — Operational docs (`DEPLOY.md`, `DATABASE.md`, `POCKET_LIBRARY.md`) live in `docs/`. Root keeps README, CONTRIBUTING, LICENSE, and AI context files (claude.md, AGENTS.md).
