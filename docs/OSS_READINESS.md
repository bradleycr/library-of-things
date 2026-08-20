# Open-source maintenance checklist

This repo is already **public** on GitHub. Use this list when reviewing whether
it stays safe and welcoming for contributors.

## Repo hygiene (keep true)

- [ ] MIT `LICENSE` present
- [ ] `SECURITY.md` and private vulnerability reporting available
- [ ] `CODE_OF_CONDUCT.md` with a clear reporting path
- [ ] `CONTRIBUTING.md` matches current product defaults (email, keycards)
- [ ] `env.example` has placeholders only — no real secrets
- [ ] `.gitignore` covers `.env*`, `certs/`, `*.pem`, `*.key`, `*.p12`
- [ ] CI runs `pnpm check` on pushes and pull requests
- [ ] README clone URL and homepage match the public repo

## GitHub settings

- [ ] Description and homepage set
- [ ] Issues enabled
- [ ] Secret scanning + push protection enabled
- [ ] Dependabot security updates enabled (optional but recommended)
- [ ] Production `STEWARD_PASSWORD` is **not** the local default `password123`

## Before accepting contributions

- New contributors: fork → branch off `main` → change → `pnpm check` → open PR
  (see CONTRIBUTING.md).
- Never ask reporters to paste production `DATABASE_URL`, card numbers, PINs, or
  member emails into issues.

## Maintainer-only docs

| Doc | Use |
|-----|-----|
| [DIAGNOSE_CARD_LOGIN.md](./DIAGNOSE_CARD_LOGIN.md) | SQL steps for card login issues |
| [MANUAL_TEST_CHECKLIST.md](./MANUAL_TEST_CHECKLIST.md) | Cross-device QA after deploys |
| [NOTIFY_WHEN_AVAILABLE.md](./NOTIFY_WHEN_AVAILABLE.md) | Future email-notify design notes |
