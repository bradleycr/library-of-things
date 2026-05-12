# Forking And Running Your Own Library

Library of Things is meant to be forked. A fork can run a completely separate
community library with its own database, steward password, nodes, books, and
members.

## What You Get

- A browser-based catalog for physical books.
- Pseudonymous library cards, no email required.
- QR/NFC checkout links for each copy.
- A steward dashboard for nodes, books, members, and settings.
- A public sharing ledger.
- Pocket Library support for books that stay with their owners.

## Fast Path

1. Fork the repo on GitHub.
2. Clone your fork:

   ```bash
   git clone https://github.com/YOUR_ORG/YOUR_REPO.git
   cd YOUR_REPO
   corepack enable
   pnpm install
   cp env.example .env.local
   ```

3. Add `DATABASE_URL` to `.env.local`.
   Use Supabase Session Pooler for the easiest hosted setup, or local Postgres
   with `DB_SSL=none`.

4. Create the schema:

   ```bash
   pnpm db:ensure-schema
   ```

5. Start the app:

   ```bash
   pnpm dev
   ```

6. Open [localhost:3000](http://localhost:3000).

## Make It Yours

### 1. Set A Steward Password

Add a strong password in `.env.local`:

```bash
STEWARD_PASSWORD=replace-this-with-a-long-random-password
```

The steward dashboard is at `/steward/login`.

### 2. Add Your Community Nodes

Nodes are physical places where books live: an office shelf, library room, cafe,
book club table, or event space.

In local development, the easiest route is:

1. Log in as steward.
2. Open `/steward/dashboard`.
3. Add nodes from the Nodes section.
4. Add books and assign them to a node, or mark them as Pocket Library books.

For repeatable seed data, edit `scripts/provision-db.mjs` and run
`pnpm db:provision` against a disposable development database. That script is
destructive, so do not run it against production.

### 3. Print QR Codes Or Write NFC Tags

Each book has a checkout URL. You can:

- Print QR labels from the add-book success screen.
- Copy checkout URLs from the steward dashboard.
- Write checkout URLs to NFC tags with any NFC writer app.

The checkout URL identifies the specific copy. ISBN scanning is useful for
lookup, but QR/NFC tags are best when you need copy-level precision.

### 4. Deploy

Use [DEPLOY.md](./DEPLOY.md) for the full Vercel + Supabase path.

Minimum production env vars:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Supabase Session Pooler URI or Postgres connection string |
| `STEWARD_PASSWORD` | Yes | Use a strong password in production |
| `DB_SSL` | No | Leave unset for Supabase, `none` for local, `strict` for self-hosted TLS |

## Operating A Community Library

- Start with one node and a small shelf.
- Add books slowly; QR/NFC tagging each copy takes time.
- Tell borrowers to save their library card number and PIN.
- Use the ledger to understand activity and resolve confusion.
- Prefer trust and clear copy over enforcement mechanics.

## Staying Up To Date

If you fork and want upstream fixes:

```bash
git remote add upstream https://github.com/bradleycr/library-of-things.git
git fetch upstream
git merge upstream/main
pnpm install
pnpm db:ensure-schema
pnpm check
```

Run `pnpm db:ensure-schema` after pulling upstream changes that mention schema
updates. It is designed to be safe to re-run and does not delete data.

## Things To Customize Carefully

- **Branding**: update logos, copy, and footer links for your community.
- **Seed data**: keep demo seed data out of production databases.
- **Steward password**: never use the default password in production.
- **Database URL**: keep `.env.local` private; it is intentionally gitignored.
- **Trust model**: avoid adding punitive mechanics unless your community has
  agreed to them. The app is built around voluntary return and public history.
