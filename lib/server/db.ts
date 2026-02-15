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
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 5000,
  })
  if (process.env.NODE_ENV !== "production") {
    globalForDb.pool = pool
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
