import "server-only"

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Each key (typically an IP or IP+route pair) tracks timestamps of recent
 * requests. Old entries are pruned on every check. In serverless environments
 * the window resets on cold-start, which is an acceptable trade-off — the
 * goal is to mitigate brute-force and spam, not enforce an SLA.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

const CLEANUP_INTERVAL_MS = 60_000
let lastCleanup = Date.now()

/** Purge entries whose newest timestamp is older than the longest window we care about. */
function maybeCleanup(windowMs: number) {
  if (Date.now() - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = Date.now()
  const cutoff = Date.now() - windowMs * 2
  for (const [key, entry] of store) {
    if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
      store.delete(key)
    }
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number | null
}

/**
 * Check and record a request against the rate limit.
 *
 * @param key      Unique identifier (e.g. "card-login:" + ip)
 * @param limit    Maximum requests allowed within the window
 * @param windowMs Sliding window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  maybeCleanup(windowMs)

  const now = Date.now()
  const cutoff = now - windowMs
  const entry = store.get(key) ?? { timestamps: [] }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0]
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: oldest + windowMs - now,
    }
  }

  entry.timestamps.push(now)
  store.set(key, entry)

  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    retryAfterMs: null,
  }
}

/** Extract a best-effort client IP from request headers. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const real = request.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}
