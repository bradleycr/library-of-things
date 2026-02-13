import "server-only"

import { Pool } from "pg"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required. Add it to .env.local using your Supabase Postgres connection string."
  )
}

const globalForDb = globalThis as unknown as { pool?: Pool }

export const db =
  globalForDb.pool ??
  new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    // Graceful connection handling for dev
    connectionTimeoutMillis: 5000,
  })

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = db
}

// Test connection on startup (non-blocking)
if (process.env.NODE_ENV !== "production") {
  db.query("SELECT 1").catch((err) => {
    console.warn(
      "Database connection warning:",
      err.message.includes("ENOTFOUND")
        ? "Cannot resolve database hostname. Use Session Pooler connection string for IPv4 networks."
        : err.message
    )
  })
}
