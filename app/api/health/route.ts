import { NextResponse } from "next/server"
import { db } from "@/lib/server/db"

/**
 * GET /api/health — verify database connectivity (e.g. on live Vercel deploy).
 * Returns 200 { ok: true } if DB responds, 503 { ok: false } otherwise.
 */
export async function GET() {
  try {
    await db.query("SELECT 1")
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[health] DB check failed:", err instanceof Error ? err.message : err)
    return NextResponse.json(
      { ok: false, error: "Database unavailable" },
      { status: 503 }
    )
  }
}
