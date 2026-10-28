import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { getBookById, returnGuestItem } from "@/lib/server/repositories"
import { notifyKeycardReturned } from "@/lib/server/keycard-mail"
import { saveReturnDropoffPhoto } from "@/lib/server/return-dropoff-photos"
import {
  GUEST_SESSION_COOKIE_LEGACY,
  guestSessionCookieName,
} from "@/lib/server/guest-session"
import { itemTokenMatches } from "@/lib/server/item-token"
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"
import { isUuid, parseJsonBody } from "@/lib/server/validate"

type ReturnBody = {
  item_id?: string
  token?: string
  report_ack?: boolean
  /** Optional JPEG data URI of the card left at reception or in the locker. */
  dropoff_photo?: string
}

/**
 * Return is NFC-first: anyone who taps the physical tag can mark the card home.
 * No email re-entry and no GPS. The tag token is the possession check.
 * An optional drop-off photo lets a steward confirm the physical leave.
 */
export async function POST(request: NextRequest) {
  const limited = checkRateLimit(`guest-return:${getClientIp(request)}`, 15, 60_000)
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 })
  }

  const parsed = await parseJsonBody<ReturnBody>(request)
  if (!parsed.ok) return parsed.response
  const itemId = parsed.data.item_id
  if (!itemId || !isUuid(itemId)) {
    return NextResponse.json({ error: "Invalid item" }, { status: 400 })
  }

  try {
    const item = await getBookById(itemId)
    if (!item || item.item_type === "book") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }
    if (!itemTokenMatches(item, parsed.data.token)) {
      return NextResponse.json({ error: "Open this page from the item's NFC tag." }, { status: 403 })
    }

    if (parsed.data.report_ack !== true) {
      return NextResponse.json(
        { error: "Confirm you will email a short report before returning the card." },
        { status: 400 }
      )
    }

    const notice = await returnGuestItem({
      itemId,
      verification: "manual",
      reportPromised: true,
    })

    const rawPhoto = parsed.data.dropoff_photo?.trim()
    if (rawPhoto) {
      await saveReturnDropoffPhoto({
        bookId: itemId,
        imageData: rawPhoto,
        loanEventId: notice.loanEventId,
      }).catch((error) => {
        console.error("[keycard] drop-off photo was not saved:", error)
      })
    }

    await notifyKeycardReturned({ ...notice, reportPromised: true, bySteward: false }).catch((error) => {
      console.error("[keycard] return notice failed:", error)
    })

    const cookieStore = await cookies()
    cookieStore.delete(guestSessionCookieName(itemId))
    cookieStore.delete(GUEST_SESSION_COOKIE_LEGACY)
    return NextResponse.json({
      success: true,
      dropoff_photo_saved: Boolean(rawPhoto),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Return failed" },
      { status: 400 }
    )
  }
}
