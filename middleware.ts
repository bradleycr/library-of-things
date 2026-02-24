import { NextRequest, NextResponse } from "next/server"
import {
  STEWARD_COOKIE_NAME,
  STEWARD_DEFAULT_PASSWORD,
  STEWARD_SALT,
} from "@/lib/steward-auth-constants"

/** SHA-256 digest of a string, hex-encoded. Usable in Edge (middleware). */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Constant-time comparison safe for Edge runtime (no Node crypto needed). */
function timingSafeEqualEdge(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith("/steward")) {
    return NextResponse.next()
  }
  if (pathname === "/steward/login" || pathname === "/steward/add-book") {
    return NextResponse.next()
  }

  const password =
    process.env.STEWARD_PASSWORD ?? STEWARD_DEFAULT_PASSWORD
  const expectedToken = await sha256Hex(password + STEWARD_SALT)
  const cookieToken = request.cookies.get(STEWARD_COOKIE_NAME)?.value ?? ""

  if (!timingSafeEqualEdge(cookieToken, expectedToken)) {
    const login = new URL("/steward/login", request.url)
    login.searchParams.set("from", pathname)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/steward/:path*"],
}
