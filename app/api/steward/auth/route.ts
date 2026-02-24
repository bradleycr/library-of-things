import { NextRequest, NextResponse } from "next/server"
import {
  getStewardCookieName,
  stewardToken,
  verifyStewardPassword,
} from "@/lib/server/steward-auth"
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

/** POST: submit password; on success set cookie and redirect to dashboard. */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`steward-login:${ip}`, 5, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a minute." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)) } }
    )
  }

  const body = await request.json().catch(() => ({}))
  const password = typeof body.password === "string" ? body.password : ""

  if (!verifyStewardPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  }

  const token = stewardToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(getStewardCookieName(), token, COOKIE_OPTIONS)
  return res
}

/** DELETE: clear steward session (logout). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(getStewardCookieName(), "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  })
  return res
}
