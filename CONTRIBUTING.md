# Contributing to Library of Things

Thanks for your interest. This guide covers the project's values, architecture,
and how to make changes that fit.

## Project values

Library of Things is trust-based physical book sharing. These principles shape
every decision:

- **Physical first.** Real books on real shelves in real places. The software
  supports the physical act of sharing — it doesn't replace it.
- **Low barrier.** No app to install, no email to provide, no account to create.
  A pseudonymous library card in the browser is enough to borrow.
- **Trust, not enforcement.** No late fees, no punitive systems. The public
  sharing ledger creates social accountability.
- **Privacy by default.** Pseudonymous cards, optional contact info, no tracking
  beyond what's needed for lending.

When proposing changes, ask: *does this make it easier to share physical books
in a trusted community?* If yes, it probably fits.

## Good first contributions

- **Bug fixes** — especially mobile / responsive issues
- **Accessibility** — ARIA labels, keyboard nav, screen reader support
- **Steward dashboard** — the main admin tool; lots of room to improve
- **Internationalization** — the app is English-only right now
- **Better onboarding UX** — making it clearer how to get a card and borrow

## Running your own nodes

The system is designed for multiple independent nodes. The Foresight Berlin and
SF nodes exist as seed data, but the architecture is node-agnostic.

To add a real node for your community:

1. A node is a row in the `nodes` table (name, address, coordinates, steward).
2. Books are assigned to nodes; the steward dashboard manages books at any node.
3. See `scripts/provision-db.mjs` for the node schema and seed format.

If you're deploying your own instance, seed your own nodes and skip the
Foresight ones. The app works the same regardless of whose shelves the books
sit on.

## Architecture overview

Single Next.js 16 app (App Router). Server-rendered pages with client
interactivity where needed.

- **No ORM.** Direct SQL via `pg`. Queries live in `lib/server/repositories.ts`.
- **No external auth provider.** Session cookies are HMAC-signed tokens derived
  from `DATABASE_URL` — no extra secrets needed.
- **Bootstrap pattern.** The client loads catalog data from `/api/bootstrap` on
  first visit. See `hooks/useBootstrapData.ts`.
- **Library card in localStorage.** See `hooks/useLibraryCard.ts`. Card state
  determines what the user can do (borrow, return, view history).
- **Steward auth.** Separate password-based login (`STEWARD_PASSWORD` env var).
  Cookie-protected dashboard and API routes.

## How to contribute

1. **Open an issue first** for anything non-trivial so we can discuss scope.
2. **Fork the repo**, branch off `main`.
3. Make your changes. Run `pnpm build` before pushing — it type-checks.
4. **Open a PR** against `main`. A short description of what and why is enough.

## What to avoid

- **Scope creep.** This is a book-sharing app, not a social network or marketplace.
- **Mandatory accounts.** The pseudonymous library card is core to the design.
- **Punitive features.** No fines, bans, or reputation-damage mechanics.
- **Heavy client dependencies.** We use Radix + Tailwind. Think twice before
  adding another UI framework or large library.

## Code style

No formal linter (Next.js 16 removed `next lint`). Match the existing patterns:

- TypeScript throughout, strict where practical
- Tailwind for styling, no CSS modules
- Server logic in `lib/server/`, client hooks in `hooks/`
- API routes return JSON; input validation via `lib/server/validate.ts`
- `pnpm build` is the gate — if it builds, it ships

## Questions?

Open an issue. Happy to help.
