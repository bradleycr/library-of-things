import "server-only"
import { createHash } from "crypto"
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
