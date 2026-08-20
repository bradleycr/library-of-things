import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { getBookById, returnGuestItem } from "@/lib/server/repositories"
import {
  GUEST_SESSION_COOKIE_LEGACY,
  guestSessionCookieName,
} from "@/lib/server/guest-session"
import { itemTokenMatches } from "@/lib/server/item-token"
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"
import { isUuid, parseJsonBody } from "@/lib/server/validate"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ReturnBody = {
  item_id?: string
  token?: string
  email?: string
  email_confirmed?: boolean
  /** Borrower promise they are physically at the home node with the keycard. */
  physical_confirm?: boolean
  /** @deprecated Prefer physical_confirm; still accepted from older clients. */
  manual_confirm?: boolean
}

/**
 * Guest return is email-first: any browser can return by tapping the NFC tag and
 * entering the same private email used at sign-out. Browser cookies are optional
 * convenience only and are cleared when present.
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

    const confirmed =
      parsed.data.physical_confirm === true || parsed.data.manual_confirm === true
    if (!confirmed) {
      return NextResponse.json(
        {
          error: "Confirm you are physically at the home node with this keycard before returning.",
          code: "PHYSICAL_CONFIRM_REQUIRED",
        },
        { status: 422 }
      )
    }

    const returnEmail = parsed.data.email?.trim().toLowerCase()
    if (!returnEmail || !EMAIL_PATTERN.test(returnEmail) || parsed.data.email_confirmed !== true) {
      return NextResponse.json(
        {
          error: "Enter the same email you used when signing out and confirm it.",
          code: "EMAIL_REQUIRED",
        },
        { status: 400 }
      )
    }

    await returnGuestItem({
      itemId,
      borrowerEmail: returnEmail,
      verification: "manual",
    })

    const cookieStore = await cookies()
    cookieStore.delete(guestSessionCookieName(itemId))
    cookieStore.delete(GUEST_SESSION_COOKIE_LEGACY)
    return NextResponse.json({ success: true, verification: "manual" })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Return failed" },
      { status: 400 }
    )
  }
}
