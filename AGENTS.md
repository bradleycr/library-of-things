# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Library of Things is a single Next.js 16 full-stack app (App Router, React 19, TypeScript, Tailwind). It uses PostgreSQL via the `pg` driver (no ORM). See `claude.md` for route table, data/auth model, and current feature state. See `README.md` for standard dev commands.

### Services

| Service | How to run | Notes |
|---------|-----------|-------|
| PostgreSQL | `sudo pg_ctlcluster 16 main start` | Must be running before dev server or DB scripts. Local DB: `library_of_things`, user: `lotdev`, password: `lotdev`. |
| Next.js dev server | `pnpm dev` | Runs on port 3000 with Turbopack (`next dev --turbo`). |

### Environment

- `.env.local` must contain `DATABASE_URL` (PostgreSQL connection string) and optionally `STEWARD_PASSWORD` (defaults to `password123`).
- For local PostgreSQL: `DATABASE_URL=postgresql://lotdev:lotdev@localhost:5432/library_of_things`
- `DB_SSL` controls TLS mode: unset = encrypted/no CA check (Supabase default), `strict` = full cert verification (self-hosted), `none` = no SSL (local dev).

### Non-obvious caveats

- **Lint script is broken**: `pnpm lint` calls `next lint`, which was removed in Next.js 16. This is a pre-existing issue. Use `pnpm build` (which includes TypeScript checking) as the primary correctness check.
- **Checkout requires a token**: The `/book/[uuid]/checkout` route requires a `?token=` query param generated from QR/NFC tags. Direct navigation without a token shows "Invalid link". The steward dashboard shows full checkout URLs under "Bulk NFC Tag URLs".
- **DB scripts use `--env-file`**: All `pnpm db:*` scripts load env from `.env.local` via Node's `--env-file` flag. The `.env.local` file must exist for these to work.
- **Schema before first run**: Run `pnpm db:ensure-schema` before the first `pnpm dev` to create tables. Optionally `pnpm db:provision` to seed demo data (destructive).
- **No automated test suite**: The project has no unit/integration tests. Validation is done via `pnpm build` (TypeScript + Next.js compilation).

### Authentication model

- **Steward auth**: password → SHA-256 cookie token. Middleware + API routes verify via timing-safe comparison.
- **User auth**: Library card login/generation sets an `lot_session` httpOnly cookie containing an HMAC-signed token (user id + timestamp). Protected endpoints (`/api/users/[id]`, `/api/books/checkout`, `/api/books/return`, `/api/books/create` when `added_by_user_id` is claimed) verify this session cookie and reject mismatches.
- **Session secret** is derived from `DATABASE_URL` via HMAC — no extra env var needed.
- **Rate limiting**: In-memory sliding-window limiter on card generation (10/min), card login (10/min), and steward login (5/min). Resets on cold start (acceptable for serverless).
- **PIN hashing**: Salted SHA-256 with backward-compatible migration — legacy unsalted hashes are upgraded on successful login.
