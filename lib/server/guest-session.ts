import "server-only"

import { cookies } from "next/headers"

/** Legacy single cookie — migrated reads only; new checkouts use per-item cookies. */
export const GUEST_SESSION_COOKIE_LEGACY = "lot_guest_loan"

const GUEST_SESSION_COOKIE_PREFIX = "lot_guest_loan_"

export function guestSessionCookieName(itemId: string): string {
  return `${GUEST_SESSION_COOKIE_PREFIX}${itemId}`
}

export const GUEST_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
}

/** Session token for one temporary keycard (supports multiple cards out at once). */
export async function getGuestSessionToken(itemId: string): Promise<string | undefined> {
  const store = await cookies()
  return store.get(guestSessionCookieName(itemId))?.value ?? store.get(GUEST_SESSION_COOKIE_LEGACY)?.value
}
