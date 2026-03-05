# Open-source readiness checklist

Use this when preparing to share the repo or accept contributions.

## In this repo (already in good shape)

- **License** — MIT in root (`LICENSE`). Clear and permissive.
- **README** — Describes the project, quickstart, scripts, docs, and links to CONTRIBUTING.
- **CONTRIBUTING** — Values, architecture, how to contribute, what to avoid. Points to “open an issue first” and PR against `main`.
- **Secrets** — `.env*.local` is in `.gitignore`; `env.example` has placeholders only (no real `DATABASE_URL` or `STEWARD_PASSWORD`). Default steward password in code is documented as dev-only.
- **PR template** — `.github/PULL_REQUEST_TEMPLATE.md` exists (What / Why).
- **Docs** — `docs/` has DEPLOY, DATABASE, POCKET_LIBRARY; README links to them.
- **package.json** — `"private": true` avoids accidental npm publish; fine for GitHub-only sharing.

## Before you share the URL

1. **Clone URL in README**  
   Update the `git clone` URL in README to the repo you’re actually sharing (e.g. `https://github.com/YOUR_ORG/flybrary.git` if the repo is named `flybrary`). Right now it says `bradleycr/library-of-things`.

2. **package.json `repository` (optional)**  
   Add so GitHub/npm can link back:
   ```json
   "repository": {
     "type": "git",
     "url": "https://github.com/YOUR_ORG/YOUR_REPO.git"
   }
   ```
   Use the same URL as the one you’ll give contributors.

## On GitHub (settings to check)

- **Visibility** — Set to **Public** if you want anyone to see and clone it.
- **Issues** — **Enable Issues** (Settings → General → Issues). Contributors will open issues and PRs from forks.
- **Branches** — Default branch `main` is standard. Optional: add a branch protection rule so `main` only accepts merges via PR (Settings → Branches).
- **Forking** — Forks are allowed by default for public repos; no change needed.
- **Discussions** (optional) — Enable in Settings → General if you want a discussion space instead of only issues/PRs.
- **Security** — No need to enable Dependabot unless you want automated dependency PRs.

## After you share

- Share the repo URL (e.g. `https://github.com/YOUR_ORG/YOUR_REPO`).
- New contributors: fork → branch off `main` → change → run `pnpm build` → open PR (see CONTRIBUTING.md).
- You can merge PRs from the GitHub UI or locally as you did in the add-book UX flow.

No other repo changes are required for “share the URL and let people contribute.”
