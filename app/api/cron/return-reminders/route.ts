import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { sendKeycardDueReminders, sendKeycardReportReminders } from "@/lib/server/keycard-mail"
import { purgeExpiredDropoffPhotos } from "@/lib/server/return-dropoff-photos"
import { sendReturnReminders } from "@/lib/server/return-reminders"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Morning job: the day a book is due, a week later, and a month after that.
 * Vercel calls this with the CRON_SECRET bearer. Localhost may call it
 * while developing, so a reminder can be sent without waiting for the clock.
 */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const header = request.headers.get("authorization") ?? ""
  if (secret && safeBearer(header, secret)) return true
  if (process.env.NODE_ENV === "production") return false
  const host = request.headers.get("host") ?? ""
  return host.startsWith("localhost") || host.startsWith("127.0.0.1")
}

function safeBearer(header: string, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(header)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await sendReturnReminders()
    const keycards = await sendKeycardDueReminders()
    const reports = await sendKeycardReportReminders()
    const purgedPhotos = await purgeExpiredDropoffPhotos()
    return NextResponse.json({
      ok: true,
      sent: result.sent,
      skipped: result.skipped,
      keycards_due: keycards.sent,
      keycard_reports: reports.sent,
      dropoff_photos_purged: purgedPhotos,
    })
  } catch (error) {
    console.error("[return-reminders]", error)
    return NextResponse.json({ error: "Could not send return reminders." }, { status: 500 })
  }
}
