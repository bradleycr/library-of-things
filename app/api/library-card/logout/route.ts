import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { SESSION_COOKIE_NAME } from "@/lib/server/session"

export async function POST() {
  (await cookies()).delete(SESSION_COOKIE_NAME)
  return NextResponse.json({ success: true })
}
