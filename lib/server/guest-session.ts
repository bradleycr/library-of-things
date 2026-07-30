import "server-only"

import { cookies } from "next/headers"

export const GUEST_SESSION_COOKIE = "lot_guest_loan"

export const GUEST_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
}

export async function getGuestSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(GUEST_SESSION_COOKIE)?.value
}
