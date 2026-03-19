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
| `/` | Home; catalog stats; hero CTAs (**Find a book**, **Get library card** when no card on device, **Add a book**); “Available now” books first, then How it works, **library nodes** (View Collection + address link for directions) |
| `/explore` | Browse books; supports node-specific collection views via `?node=` |
| `/add-book` | Add a book (node or Pocket Library); ISBN lookup with optional **Scan** (camera or photo); optional cover photo capture |
| `/add-book/print-qr` | Print-ready QR code page (?url= checkout URL); centered 2″ label with cut line; Print or Save as PDF |
| `/book/[uuid]` | Book detail; checkout link/QR |
| `/book/[uuid]/checkout` | Checkout flow (requires library card) |
| `/my-books` | User's borrowed books, added books, history; optional `?user=<id>` shows that member's books (read-only, with profile header) |
| `/profile/[user_id]` | Public profile; own profile shows "My Books" → `/my-books`, other profiles show "[Name]'s Books" → `/my-books?user=<id>` |
| `/settings` | Link card (PIN), get new card, log in with card |
| `/ledger` | Sharing history (all events; export CSV/JSON) |
| `/members` | Member list (books out, activity); links to profiles |
| `/steward/login`, `/steward/dashboard` | Steward: nodes, books (edit metadata + status/holder/location + optional ledger note), **Library settings** (default loan period), bulk add, member edit/delete; changes write to ledger |

## Data & auth

- **Bootstrap:** Client loads `/api/bootstrap`; hook `useBootstrapData()`. Supplies books, users, nodes, loan events, **config** (e.g. `default_loan_period_days`), etc.
- **Library card:** Stored in `localStorage`; hook `useLibraryCard()`. Card can have `user_id` (linked) or not (card-only). Login/link via PIN at `/api/library-card/login`.
- **Remove card:** Settings page has "Remove card from this device" with the same confirmation; Profile menu no longer includes Settings or Remove card (Profile + View library card only). Settings is reached from Profile via "Manage contact info". (Previously in header.) “Remove card from this device” shows a confirmation: *“Make sure you save your card and PIN. Otherwise, you won’t have access to this account.”* Then clears local card.

## Code layout

- `app/` — App Router pages and API routes
- `components/` — UI (site-header, modals, book cards, etc.)
- `hooks/` — `useLibraryCard`, `useBootstrapData`
- `lib/` — `types.ts`, `utils`, `image-utils.ts` (client-side cover photo compression), **`isbn-utils.ts`** (ISBN normalization for scanner/form), **`isbn-checkout.ts`** (find books by ISBN, copy label for picker), **`feature-flags.ts`** (e.g. `ISBN_CHECKOUT_RETURN_ENABLED` to toggle ISBN-based checkout/return), **`loan-period.ts`** (default suggested rental period + helpers); `lib/server/` — `db.ts`, `repositories.ts`, **`geocode-node-address.ts`** (address → lat/lng for new nodes)
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
- **Add-book success** — after adding a book, the form is hidden and only a “Book added” view is shown (no editing); checkout URL (copyable), optional “Add to book” guide with **Print QR code** (opens `/add-book/print-qr?url=...` for a ready-to-print page with 2″ QR and cut line), NFC Tools link, and “Do this later” to collapse the guide; “Add another book” and “Browse catalog” links.
- **Add-book from scan** — Opening `/add-book?isbn=...` (e.g. from “Scan to checkout” when book not in library → “Yes, add it”) prefills the ISBN field and triggers lookup so metadata can be filled from the barcode.
- **Add-book UX** — ISBN: no Look Up button; once 10 or 13 digits are entered (with optional spaces/dashes; ISBN-10 can end with X), lookup runs automatically after 700ms debounce; in-flight lookups are cancelled when the user keeps typing. **Scan** button next to the ISBN field opens an optional scanner (live camera or take/choose a photo of the barcode); scanned ISBN is normalized and triggers the same lookup; manual entry remains available. ISBN metadata lookup now goes through **`/api/isbn/lookup`** (server-side Open Library proxy with timeout and search fallback) instead of direct browser fetches, which avoids client-side `load failed`/network/CORS issues and gives the same behavior to add-book and steward bulk add. All ISBN scanner entry points now share a hardened dialog: static Quagga import (avoids intermittent dynamic-import “load failed” issues), **EAN-13 only** decoding for live/photo scan, centered scan guide overlay, ~1.2s camera warmup before accepting reads, four matching reads before accept, fallback to generic camera constraints if back-camera preference fails, and a built-in manual ISBN input for recovery when camera/photo scanning is unreliable. Cover photo: after capture and compression, the photo is applied immediately (no “Use this photo” step); user can still Retake or Cancel from the preview. When they cancel (or when no URL/photo is set), the form shows a generated cover preview (same pastel generator as live covers) so users see what will be used; long titles/authors on generated covers are truncated with ellipsis so text never overflows.
- **ISBN-based checkout/return** — Optional feature (gated by `lib/feature-flags.ts`: `ISBN_CHECKOUT_RETURN_ENABLED`). Nav: “Scan to checkout or return”; book page: “Check out via ISBN scanner” / “Return via ISBN scanner” (holder); add-book success when “Do this later”: line about using scanner from menu. Scan → lookup by ISBN now uses fresh server lookup at **`/api/books/by-isbn`** instead of the client bootstrap cache, so newly added books are found immediately and scan-to-checkout does not depend on stale in-memory catalog data. **Matching** uses ISBN-10/13 cross-match (`isbn10To13` in `isbn-utils.ts`) so barcode (often 13-digit) matches DB (10 or 13). **1 match** → redirect to that book’s checkout URL; **2+** → copy picker (with “Add another copy” → add-book?isbn=) then redirect; **0 matches** → “This book is not yet in the library. Would you like to add it?” with “Yes, add it” → `/add-book?isbn=...`. Lookup failures now show a retry state instead of being conflated with “book not found”. Checkout page when book is checked out and user is **not** the holder shows “Contact the person who has it” (profile of holder) plus “View book details”. **Scanner dialog** is responsive (`max-w-[calc(100vw-2rem)]`, `min-w-0` on viewport). To disable: set flag to false.
- **Partner logos** — Foresight in header + footer; Internet Archive in footer (and library card) only, not in header.
- **Book location display** — Under books (cards, explore, book detail) we always show the **node name** (e.g. "Foresight Berlin Node") when the book is at a node; only Pocket Library books show the typed address/location text.
- **Anonymous adds** — When a book is added anonymously, public-facing views (book page, explore, etc.) show "Added by Anonymous" with no link; `added_by_user_id` is stripped from bootstrap for non-steward requests. Only the steward dashboard receives full book data (including who added anonymous books).
- **Return flow** — My Books “Return” opens a **return gate** first: user must verify they have the book by either using the ISBN scanner (when `ISBN_CHECKOUT_RETURN_ENABLED`) or opening the return page by scanning the book’s QR or NFC tag. After that, the return form (node, notes, required acknowledgment checkbox) is shown. The **location promise** applies only when returning to a node: checkbox text says they are at the selected return location (or will return there) and will only mark as returned when physically done; for **Pocket Library** (floating) books the checkbox is only “I will only mark as returned when I have physically returned the book” (no location promise). Checkout-page return (holder): same note and same node vs pocket distinction. Return API now has a **15s** server-side cap and **12s** client timeout (was 10s/8s), and the shared Postgres pool now allows a few concurrent connections instead of `max: 1`, reducing self-inflicted queueing when bootstrap reads and a return request overlap. On client timeout or 503, My Books and checkout-page return both refetch bootstrap and, if the book was returned after the abort, show success; otherwise toast suggests trying again or opening the return page via QR/NFC. “Edit Terms” was removed from borrowed books on My Books.
- **Checkout limit** — Users may have at most 2 books checked out at once. Server rejects a third checkout with 403; checkout page shows “Borrowing limit reached” and link to My books when they already have 2.
- **Notify when available** — On book detail, “Notify Me When Available” stores the book id in localStorage and shows a toast; button state reflects that. Email delivery not yet implemented.
- **Notification preferences** — Settings notification toggles (return reminders, book availability, newsletter) persist to localStorage and show a save toast; backend/email not yet implemented.
- **API robustness** — `/api/books/[id]/cover`, `/api/books/search`, `/api/books/[id]/tap`, `/api/auth/generate-pseudonym`, `/api/ledger/export`, and `/api/users/[id]/trust-history` wrap handlers in try/catch and return 500 on error to avoid unhandled crashes.
- **Schema** — `books.availability_status` CHECK allows `available`, `checked_out`, `in_transit`, `retired`, `unavailable`, `missing` (steward UI uses unavailable/missing; API normalizes to in_transit/retired when writing).
- **Server validation** — Shared `lib/server/validate.ts`: `isUuid()`, `parseJsonBody()` (400 on invalid JSON), `LIMITS` and `clampString()` for input length. **Ledger notes** use `LIMITS.ledgerNote` (200 chars) for return and steward book-edit notes. Used in books create/checkout/return, books [id] PATCH; cover URLs sanitized via `lib/server/sanitize-cover-url.ts` on create and PATCH.
- **Atomic card creation** — Library card generation uses `createUserAndLibraryCard()` (single transaction); no orphan users if card insert fails.
- **Explore** — Bootstrap `error` state shown with retry. No location or geolocation request anywhere in the app (geofencing disabled; add-book no longer auto-requests location). View toggles 44px touch targets; clear-search has `aria-label`. Supports `?node=<id>` to open filtered to a node (e.g. from homepage View Collection).
- **No alert()** — Add-book and checkout/return flows use toast for errors. Tap fetch uses AbortController for cleanup on unmount.
- **DB indexes** — `ensure-schema` adds `idx_books_availability_status`, `idx_books_current_node_id`, `idx_books_current_holder_id`, `idx_loan_events_book_timestamp`, `idx_loan_events_user_timestamp`, and **app_config** table (key/value for e.g. `default_loan_period_days`). Backfill script documented as idempotent.
- **Steward auth** — Invalid JSON body returns 400. Mobile menu and profile button: menu closes on pathname change; profile button has `aria-label` and 44px touch target.
- **Default loan period** — Single source: `lib/loan-period.ts` (`DEFAULT_LOAN_PERIOD_DAYS` = 60) and steward-editable **app_config** (`default_loan_period_days`). Bootstrap returns `config`; create book, checkout, steward edit, book detail, add-book, and return/trust logic use config (or constant when config unavailable). Steward dashboard has a **Library settings** card to change the default; it propagates app-wide.
- **Tap without card** — Checkout page shows "Get Library Card or Log In" (links to `/settings`) instead of "Go to Library of Things" when user has no library card.
- **Dialog scroll** — DialogContent capped at 85vh with overflow-y scroll so bottom buttons (e.g. Confirm Return) are reachable on mobile.
- **Display name propagation** — `updateUserProfile()` cascades display name changes to `books.added_by_display_name`, `books.current_holder_name`, `loan_events.user_display_name`, and `library_cards.pseudonym` so every surface (profile, ledger, book cards, library card display) updates immediately. Login API returns the authoritative `users.display_name` rather than the card's stored pseudonym, so session refreshes never revert a renamed user. Profile page and add-book page prefer `user.display_name` from bootstrap over `card.pseudonym`.
- **Steward dashboard pagination** — Book Management, Bulk NFC Tag URLs, and Member Management sections show 10 items initially with "Show more" progressive disclosure and a "Collapse" option. NFC pagination resets when the node filter changes.
- **Steward overdue** — Clicking the "Overdue" stat card opens a dialog listing overdue books, holder name (link to profile), and contact (email, phone) when set; steward can copy email or phone to clipboard via Copy button (shows checkmark briefly).
- **Ledger notes** — All event notes (returns, steward edits) are short: max **200 characters** (`LIMITS.ledgerNote`). Ledger page and My Books sharing history show notes; notes column uses line-clamp and tooltip so long text doesn’t break layout. Steward “Ledger note” in edit book dialog is also capped at 200 characters.
- **Node collections** — Homepage node cards include a **View Collection** button linking to `/explore?node=<id>`. Explore stays the same layout as before; the URL sets the Community Node filter so the list shows only that node’s books. No location or geolocation is requested anywhere in the app.
- **Node creation** — Steward add-node flow no longer asks for manual latitude/longitude; when an address is provided, the server tries to geocode it automatically for directions and distance-based features. Node type now includes `other`.
- **Profile avatars** — DiceBear (dicebear.com) generates deterministic pixel-art avatars from the user id (no avatar images or seeds stored in the database). Regenerate-avatar feature is disabled; avatars are stable per account.
- **Steward cover image editing** — Edit Book dialog supports pasting a URL or uploading a photo (compressed client-side via `compressBookCoverPhoto`) with a live preview. Uploaded images show as "(uploaded photo)" with a Remove button to switch back to URL entry.
- **Delete book from library** — Steward dashboard Book Management: Delete (trash) button opens a confirmation dialog; optional ledger note. `DELETE /api/books/[id]` (steward-only) inserts a `removed` ledger event then deletes the book. `loan_events.book_id` is nullable with ON DELETE SET NULL so removed events remain in the ledger with book title preserved.
- **ensure-schema covers Pocket Library** — `pnpm db:ensure-schema` now adds `owner_contact_email` and `is_pocket_library` columns to `books`; no separate migration script needed for new setups.
- **API smoke test** — `pnpm test:api-smoke` (with `pnpm dev` running) calls generate → checkout → tap → return and asserts bootstrap + optional direct Postgres checks on `loan_events` / `books`. See README.
- **Home hero — Get library card** — `components/home-hero-actions.tsx` (client): shows **Get library card** → `/settings` next to Find a book / Add a book only after hydration when `useLibraryCard()` reports no stored card.
- **Docs reorganized** — Operational docs (`DEPLOY.md`, `DATABASE.md`, `POCKET_LIBRARY.md`) live in `docs/`. Root keeps README, CONTRIBUTING, LICENSE, and AI context files (claude.md, AGENTS.md). `docs/DIAGNOSE_CARD_LOGIN.md` has SQL snippets to check if a library card exists and troubleshoot login (card number normalized by removing spaces; PIN is hashed so cannot be read back).
- **Profile "Their books"** — On another member's profile, the quick action shows "[Name]'s Books" and links to `/my-books?user=<id>`. My Books page supports `?user=` for a read-only view (borrowed, added, sharing history) with that member's avatar, name, and trust score in the header; "View profile" back link when viewing someone else. Own My Books shows "My Books" with avatar and "You" so it's clear whose page it is.
- **Settings buttons** — Profile card: "Update display name" (sends only display_name). Contact card: "Update contact info."
- **Deleted account** — On delete, ledger and "added by" show "Deleted account"; profile not-found: "This profile doesn't exist or the account has been deleted."
- **Public/private profile** — `profile_public` (default true). When private: confirmation dialog; name becomes "Anonymous" app-wide; new events use getPublicDisplayName(); profile page shows "Anonymous" when viewing a private profile.
- **Geofencing disabled** — No location or geolocation is requested in the app. Optional geofence code lives in `lib/geofence.ts` and `hooks/use-return-location.ts` for potential future use. Return flows (My Books dialog and checkout-page return) use a required checkbox: for **node returns** the user confirms they are at the return location (or will return there) and will only mark as returned when physically done; for **Pocket Library** books the checkbox is only that they will only mark as returned when they have physically returned the book. Checkout success screen tells users to tap/scan again to return and to only mark books as returned when they have actually returned them.
