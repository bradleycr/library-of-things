#!/usr/bin/env node
/**
 * Set Vercel environment variables for the Library of Things project using the Vercel REST API.
 * Uses DATABASE_URL and STEWARD_PASSWORD from .env.local (or env), and VERCEL_TOKEN from env.
 *
 * 1. Create a token: https://vercel.com/account/tokens (scope: Full Account or at least the project)
 * 2. Add to .env.local: VERCEL_TOKEN=your_token (or export VERCEL_TOKEN=...)
 * 3. Ensure .env.local has DATABASE_URL (Supabase Postgres URI) and optionally STEWARD_PASSWORD
 * 4. Run: node --env-file=.env.local scripts/set-vercel-env.mjs
 *    Or: export $(grep -v '^#' .env.local | xargs) && node scripts/set-vercel-env.mjs
 */

import { readFileSync, existsSync } from "fs"
import { join } from "path"

const PROJECT_ID_OR_NAME = process.env.VERCEL_PROJECT_ID || "library-of-things"
const TEAM_SLUG = process.env.VERCEL_TEAM_SLUG || ""
const API = "https://api.vercel.com"

// Load .env.local into process.env if present (so we can use DATABASE_URL / STEWARD_PASSWORD / VERCEL_TOKEN from it)
const envPath = join(process.cwd(), ".env.local")
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8")
  content.split("\n").forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) {
      const key = m[1].trim()
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1)
      process.env[key] = val
    }
  })
}

const token = process.env.VERCEL_TOKEN
const databaseUrl = process.env.DATABASE_URL
const stewardPassword = process.env.STEWARD_PASSWORD

if (!token) {
  console.error("VERCEL_TOKEN is required. Create one at https://vercel.com/account/tokens and set it in .env.local or export VERCEL_TOKEN=...")
  process.exit(1)
}

if (!databaseUrl) {
  console.error("DATABASE_URL is required. Set it in .env.local (your Supabase Postgres connection string).")
  process.exit(1)
}

const target = ["production", "preview"]

async function setEnv(key, value, comment) {
  const url = new URL(`${API}/v10/projects/${PROJECT_ID_OR_NAME}/env`)
  url.searchParams.set("upsert", "true")
  if (TEAM_SLUG) url.searchParams.set("slug", TEAM_SLUG)
  const res = await fetch(
    url.toString(),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
        value,
        type: "encrypted",
        target,
        ...(comment && { comment }),
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    if (res.status === 404) {
      console.error("Project not found. Create a new token with Full Account scope at https://vercel.com/account/tokens, set it as VERCEL_TOKEN in .env.local, then run this script again. Or add DATABASE_URL manually in Vercel → Project → Settings → Environment Variables.")
    }
    throw new Error(`${res.status} ${res.statusText}: ${err}`)
  }
  return res.json()
}

async function main() {
  console.log("Setting Vercel env vars for project", PROJECT_ID_OR_NAME)
  await setEnv("DATABASE_URL", databaseUrl, "Supabase Postgres connection string")
  console.log("  DATABASE_URL: set")
  if (stewardPassword) {
    await setEnv("STEWARD_PASSWORD", stewardPassword, "Steward dashboard password")
    console.log("  STEWARD_PASSWORD: set")
  } else {
    console.log("  STEWARD_PASSWORD: (not in .env.local, skipping)")
  }
  console.log("Done. Redeploy the project for changes to take effect.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
