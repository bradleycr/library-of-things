import "server-only"

import { Pool } from "pg"

const globalForDb = globalThis as unknown as { pool?: Pool }

function getPool(): Pool {
  if (globalForDb.pool) return globalForDb.pool

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required. Add it to .env.local (or Vercel env vars) using your Supabase Postgres connection string."
    )
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    // Vercel serverless: keep pool small to avoid exhausting Supabase connection limits.
    // Each serverless function gets its own pool; with many concurrent invocations the
    // total connection count = max × concurrent_functions.
    max: 3,
    // Release idle clients quickly so connections don't linger between invocations.
    idleTimeoutMillis: 10_000,
    // Vercel cold start + Supabase pooler can take >5s; use 12s so first connection can succeed.
    connectionTimeoutMillis: 12_000,
  })

  // Warm-check in dev so we see connection issues immediately
  if (process.env.NODE_ENV !== "production") {
    pool.query("SELECT 1").catch((err) => {
      console.warn(
        "Database connection warning:",
        err.message.includes("ENOTFOUND")
          ? "Cannot resolve database hostname. Use Session Pooler connection string for IPv4 networks."
          : err.message
      )
    })
  }

  globalForDb.pool = pool
  return pool
}

/** Lazy-initialized so build can succeed without DATABASE_URL; required at runtime for API routes. */
export const db = new Proxy({} as Pool, {
  get(_, prop) {
    return (getPool() as unknown as Record<string, unknown>)[prop as string]
  },
})
