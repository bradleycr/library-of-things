# Security Policy

Library of Things stores community lending data: pseudonymous library cards,
optional contact info, book locations, guest loan emails (temporary keycards),
and public ledger events. Please treat security and privacy reports with care.

## Supported Versions

The `main` branch is the supported line. Forks should merge upstream security
fixes promptly and run:

```bash
pnpm install
pnpm db:ensure-schema
pnpm check
```

## Reporting A Vulnerability

Do **not** post exploitable details in a public issue.

Preferred (in order):

1. Use [GitHub private vulnerability reporting](https://github.com/bradleycr/library-of-things/security/advisories/new) when available.
2. Otherwise, open a minimal public issue stating that you have a security report
   and need a private maintainer contact.

Include:

- A short summary of the issue
- Affected route, API endpoint, script, or deployment setting
- Steps to reproduce using **fake data only**
- Impact: what data or action could be exposed or modified
- Any suggested fix, if you have one

## Sensitive Data — Never Commit Or Paste

Never include real values for:

- `DATABASE_URL` or any Postgres connection string
- `STEWARD_PASSWORD` (production must not use the default `password123`)
- `VERCEL_TOKEN`, Supabase service-role keys, OIDC tokens
- Apple Wallet PEMs / passphrases (`APPLE_WALLET_*`)
- Library card numbers or PINs
- Member or guest borrower emails and phone numbers
- Production database dumps, logs, or screenshots that identify people

Use local demo data or a throwaway database when sharing reproduction steps.
Copy `env.example` → `.env.local`; keep `.env*` out of git.

## Operator Notes (threat model highlights)

- **Steward password** defaults to `password123` for local development only.
  Always set a strong `STEWARD_PASSWORD` in production.
- **Session cookies** are HMAC-signed using a secret derived from `DATABASE_URL`.
  Protect that connection string like a root credential.
- **Guest loan emails** (temporary keycards) live only in private `guest_loans`
  while a card is signed out; they are erased on return. Stewards can force a
  return without seeing the email in the public ledger.
- **Checkout tokens** in QR/NFC URLs identify a physical copy. Catalog bootstrap
  may include `checkout_url` for visible books so in-app ISBN scan can deep-link.
  Treat tokens as “has the link,” not as proof of standing at the shelf.
  Temporary keycards are hidden from the public catalog.
- **Borrower email** is required by default for books unless an item opts out;
  it is not shown on the public ledger unless the member separately opts into
  public contact.

See also [PRIVACY.md](./docs/PRIVACY.md) for what is public vs private in the app.
