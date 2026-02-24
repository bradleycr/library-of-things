import "server-only"
import { createHash, timingSafeEqual } from "crypto"
import {
  STEWARD_COOKIE_NAME,
  STEWARD_DEFAULT_PASSWORD,
  STEWARD_SALT,
} from "@/lib/steward-auth-constants"

/** Password for steward area. Default for local dev only; set STEWARD_PASSWORD in production. */
export function getStewardPassword(): string {
  return process.env.STEWARD_PASSWORD ?? STEWARD_DEFAULT_PASSWORD
}

/** Produces the token we store in the cookie (hash of password + salt). */
export function stewardToken(): string {
  return createHash("sha256")
    .update(getStewardPassword() + STEWARD_SALT)
    .digest("hex")
}

export function getStewardCookieName(): string {
  return STEWARD_COOKIE_NAME
}

/** Constant-time comparison of a candidate steward password against the expected value. */
export function verifyStewardPassword(candidate: string): boolean {
  const expected = getStewardPassword()
  const a = Buffer.from(candidate, "utf8")
  const b = Buffer.from(expected, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Constant-time verification that a cookie token matches the expected steward token. */
export function verifyStewardToken(candidateToken: string): boolean {
  const expected = stewardToken()
  const a = Buffer.from(candidateToken, "utf8")
  const b = Buffer.from(expected, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
