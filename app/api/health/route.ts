import { NextResponse } from "next/server"
import { db } from "@/lib/server/db"

/**
 * GET /api/health — verify database connectivity (e.g. on live Vercel deploy).
 * Returns 200 { ok: true } if DB responds, 503 { ok: false, error } otherwise.
 */
export async function GET() {
  try {
    await db.query("SELECT 1")
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, error: message },
      { status: 503 }
    )
  }
}
