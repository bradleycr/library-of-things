import "server-only"

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg"

/* ─── Connection-string hygiene ───
 * Supabase and Vercel sometimes inject literal "\n" or trailing whitespace
 * into the DATABASE_URL.  Strip it so the pg driver sees a clean URI.
 */
function cleanConnectionString(raw: string): string {
  return raw.replace(/\\n/g, "").replace(/[\r\n]+/g, "").trim()
}

/* ─── Transient-error detection ───
 * These are the failures where retrying (after a brief pause) has a real
 * chance of succeeding — mostly network / pooler hiccups in serverless.
 */
function isTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const m = err.message.toLowerCase()
  return (
    m.includes("timeout") ||
    m.includes("econnreset") ||
    m.includes("econnrefused") ||
    m.includes("connection terminated") ||
    m.includes("unexpected eof") ||
    m.includes("too many clients") ||
    m.includes("remaining connection slots") ||
    m.includes("network") ||
    m.includes("socket hang up") ||
    m.includes("client has encountered a connection error")
  )
}

const RETRY_LIMIT = 2
const RETRY_BASE_MS = 600

function pause(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

/* ─── Singleton pool (one per serverless cold-start) ───
 *
 * max: 1 — each Vercel serverless instance holds at most one connection;
 *          with ~1100 users the real concurrency is low, and the Supabase
 *          Transaction Pooler (port 6543) multiplexes them server-side.
 *
 * idleTimeoutMillis: 20s — keep the connection alive long enough to serve
 *          a cluster of requests (page + bootstrap + actions) without
 *          forcing a new TLS handshake every time.
 *
 * connectionTimeoutMillis: 8s — aggressive enough to fail fast so our
 *          retry logic can spin up a fresh attempt rather than blocking
 *          for ages on a single try.
 */
const globalForDb = globalThis as unknown as { pool?: Pool }

function getPool(): Pool {
  if (globalForDb.pool) return globalForDb.pool

  const raw = process.env.DATABASE_URL
  if (!raw) {
    throw new Error(
      "DATABASE_URL is required. Add it to .env.local (or Vercel env vars) " +
        "using your Supabase Postgres connection string."
    )
  }

  const connStr = cleanConnectionString(raw)
  const isLocalhost = /localhost|127\.0\.0\.1|::1/.test(connStr)
  const pool = new Pool({
    connectionString: connStr,
    ...(isLocalhost ? {} : { ssl: { rejectUnauthorized: true } }),
    max: 1,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 8_000,
  })

  /* Surface idle-client errors so Node doesn't crash with unhandled rejection. */
  pool.on("error", (err) => {
    console.error("[db] idle pool client error:", err.message)
  })

  /* Dev warm-check: surface DNS / credential issues at startup. */
  if (process.env.NODE_ENV !== "production") {
    pool.query("SELECT 1").catch((err) => {
      console.warn(
        "[db] warm-check:",
        err.message.includes("ENOTFOUND")
          ? "Cannot resolve DB host. Use the Supabase Session Pooler string for IPv4."
          : err.message
      )
    })
  }

  globalForDb.pool = pool
  return pool
}

/* ═══════════════════════════════════════════════════════
 *  Public API — every DB call in the app should use one
 *  of these two helpers so transient failures auto-retry.
 * ═══════════════════════════════════════════════════════ */

/**
 * Execute a single SQL query with automatic retry on transient failures.
 * Prefer this over `db.query()` for all read queries and simple writes.
 */
export async function resilientQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool()
  let lastErr: unknown

  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    try {
      return await pool.query<T>(text, values)
    } catch (err) {
      lastErr = err
      if (attempt < RETRY_LIMIT && isTransient(err)) {
        console.warn(`[db] query retry ${attempt + 1}/${RETRY_LIMIT}: ${(err as Error).message}`)
        await pause(RETRY_BASE_MS * (attempt + 1))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

/**
 * Acquire a PoolClient for transactions, with automatic retry on the
 * initial connect.  Callers MUST call `client.release()` in a `finally`.
 */
export async function resilientConnect(): Promise<PoolClient> {
  const pool = getPool()
  let lastErr: unknown

  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    try {
      return await pool.connect()
    } catch (err) {
      lastErr = err
      if (attempt < RETRY_LIMIT && isTransient(err)) {
        console.warn(`[db] connect retry ${attempt + 1}/${RETRY_LIMIT}: ${(err as Error).message}`)
        await pause(RETRY_BASE_MS * (attempt + 1))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

/**
 * Backwards-compatible pool proxy.  New code should prefer
 * `resilientQuery` / `resilientConnect` for automatic retries.
 */
export const db = new Proxy({} as Pool, {
  get(_, prop) {
    return (getPool() as unknown as Record<string, unknown>)[prop as string]
  },
})
