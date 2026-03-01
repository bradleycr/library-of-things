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
- **Partner logos** — Foresight in header + footer; Internet Archive in footer (and library card) only, not in header.
- **Book location display** — Under books (cards, explore, book detail) we always show the **node name** (e.g. "Foresight Berlin Node") when the book is at a node; only Pocket Library books show the typed address/location text.
- **Anonymous adds** — When a book is added anonymously, public-facing views (book page, explore, etc.) show "Added by Anonymous" with no link; `added_by_user_id` is stripped from bootstrap for non-steward requests. Only the steward dashboard receives full book data (including who added anonymous books).
- **Return flow** — My Books “Return” opens a dialog; user picks return node and optional notes, then “Confirm Return” calls `POST /api/books/return`, refetches bootstrap, and shows a success toast.
- **Notify when available** — On book detail, “Notify Me When Available” stores the book id in localStorage and shows a toast; button state reflects that. Email delivery not yet implemented.
- **Notification preferences** — Settings notification toggles (return reminders, book availability, newsletter) persist to localStorage and show a save toast; backend/email not yet implemented.
- **API robustness** — `/api/books/[id]/cover`, `/api/books/search`, `/api/books/[id]/tap`, `/api/auth/generate-pseudonym`, `/api/ledger/export`, and `/api/users/[id]/trust-history` wrap handlers in try/catch and return 500 on error to avoid unhandled crashes.
- **Schema** — `books.availability_status` CHECK allows `available`, `checked_out`, `in_transit`, `retired`, `unavailable`, `missing` (steward UI uses unavailable/missing; API normalizes to in_transit/retired when writing).
- **Server validation** — Shared `lib/server/validate.ts`: `isUuid()`, `parseJsonBody()` (400 on invalid JSON), `LIMITS` and `clampString()` for input length. Used in books create/checkout/return, books [id] PATCH; cover URLs sanitized via `lib/server/sanitize-cover-url.ts` on create and PATCH.
- **Atomic card creation** — Library card generation uses `createUserAndLibraryCard()` (single transaction); no orphan users if card insert fails.
- **Explore** — Bootstrap `error` state shown with retry; distance filter filters by user location when available; view toggles 44px touch targets; clear-search has `aria-label`.
- **No alert()** — Add-book and checkout/return flows use toast for errors. Tap fetch uses AbortController for cleanup on unmount.
- **DB indexes** — `ensure-schema` adds `idx_books_availability_status`, `idx_books_current_node_id`, `idx_books_current_holder_id`, `idx_loan_events_book_timestamp`, `idx_loan_events_user_timestamp`. Backfill script documented as idempotent.
- **Steward auth** — Invalid JSON body returns 400. Mobile menu and profile button: menu closes on pathname change; profile button has `aria-label` and 44px touch target.
- **Default loan period** — 60 days (2 months), not 21 days. Applied in checkoutBook, steward edit, book create defaults, and all UI fallbacks.
- **Tap without card** — Checkout page shows "Get Library Card or Log In" (links to `/settings`) instead of "Go to Library of Things" when user has no library card.
- **Dialog scroll** — DialogContent capped at 85vh with overflow-y scroll so bottom buttons (e.g. Confirm Return) are reachable on mobile.
- **Display name propagation** — `updateUserProfile()` now cascades display name changes to `books.added_by_display_name`, `books.current_holder_name`, and `loan_events.user_display_name` so "Added by" / holder labels update app-wide immediately.
- **Steward dashboard pagination** — Book Management, Bulk NFC Tag URLs, and Member Management sections show 10 items initially with "Show more" progressive disclosure and a "Collapse" option. NFC pagination resets when the node filter changes.
- **Steward cover image editing** — Edit Book dialog supports pasting a URL or uploading a photo (compressed client-side via `compressBookCoverPhoto`) with a live preview. Uploaded images show as "(uploaded photo)" with a Remove button to switch back to URL entry.
- **Delete book from library** — Steward dashboard Book Management: Delete (trash) button opens a confirmation dialog; optional ledger note. `DELETE /api/books/[id]` (steward-only) inserts a `removed` ledger event then deletes the book. `loan_events.book_id` is nullable with ON DELETE SET NULL so removed events remain in the ledger with book title preserved.
