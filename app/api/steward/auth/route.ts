import { NextRequest, NextResponse } from "next/server"
import {
  getStewardCookieName,
  getStewardPassword,
  stewardToken,
} from "@/lib/server/steward-auth"

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/", // so cookie is sent to /api/books/* and /api/steward/* when dashboard calls them
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

/** POST: submit password; on success set cookie and redirect to dashboard. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const password = typeof body.password === "string" ? body.password : ""

  const expected = getStewardPassword()
  if (!expected || password !== expected) {
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
