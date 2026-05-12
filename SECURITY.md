# Security Policy

Library of Things stores community lending data: pseudonymous library cards,
optional contact info, book locations, and public ledger events. Please treat
security and privacy reports with care.

## Supported Versions

The `main` branch is the supported line. Forks should merge upstream security
fixes promptly and run:

```bash
pnpm install
pnpm db:ensure-schema
pnpm check
```

## Reporting A Vulnerability

If you find a vulnerability, please do not post exploitable details publicly.

Preferred options:

- Use GitHub's private vulnerability reporting if it is enabled for the repo.
- Otherwise, open a minimal public issue saying you have a security report and
  need a private maintainer contact.

Include:

- A short summary of the issue.
- Affected route, API endpoint, script, or deployment setting.
- Steps to reproduce, using fake data only.
- Impact: what data or action could be exposed or modified.
- Any suggested fix, if you have one.

## Sensitive Data

Never include real values for:

- `DATABASE_URL`
- `STEWARD_PASSWORD`
- `VERCEL_TOKEN`
- Library card numbers or PINs
- Member contact info
- Production database rows or logs that identify people

Use local demo data or a throwaway database when sharing reproduction steps.
