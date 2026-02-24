import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"

export const SESSION_COOKIE_NAME = "lot_session"

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Derive a stable secret from DATABASE_URL so we don't need yet another env var.
 * Falls back to a dev-only key when DATABASE_URL is unset (e.g. build step).
 */
function getSessionSecret(): string {
  const raw = process.env.DATABASE_URL ?? "dev-fallback-not-for-production"
  return createHmac("sha256", "lot-session-key-v1").update(raw).digest("hex")
}

/** Create an HMAC-signed session token encoding the user id and issued-at time. */
export function createSessionToken(userId: string): string {
  const payload = JSON.stringify({ uid: userId, iat: Date.now() })
  const data = Buffer.from(payload).toString("base64url")
  const sig = createHmac("sha256", getSessionSecret()).update(data).digest("base64url")
  return `${data}.${sig}`
}

/**
 * Verify a session token and return the user id, or null if invalid/expired.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifySessionToken(token: string): string | null {
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [data, sig] = parts

  const expected = createHmac("sha256", getSessionSecret()).update(data).digest("base64url")

  const sigBuf = Buffer.from(sig, "utf8")
  const expBuf = Buffer.from(expected, "utf8")
  if (sigBuf.length !== expBuf.length) return null
  if (!timingSafeEqual(sigBuf, expBuf)) return null

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as {
      uid: string
      iat: number
    }
    if (Date.now() - payload.iat > SESSION_MAX_AGE_MS) return null
    return payload.uid
  } catch {
    return null
  }
}

/** Cookie options matching the steward cookie pattern. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days (seconds)
}

/**
 * Read the session cookie from the current request and return the authenticated
 * user id, or null if the session is missing/invalid.
 */
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}
