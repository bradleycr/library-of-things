import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { checkoutGuestItem, getBookById } from "@/lib/server/repositories"
import {
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_COOKIE_OPTIONS,
} from "@/lib/server/guest-session"
import { itemTokenMatches } from "@/lib/server/item-token"
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"
import { isUuid, parseJsonBody } from "@/lib/server/validate"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(`guest-checkout:${getClientIp(request)}`, 10, 60_000)
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 })
  }

  const parsed = await parseJsonBody<{ item_id?: string; email?: string; token?: string }>(request)
  if (!parsed.ok) return parsed.response
  const itemId = parsed.data.item_id
  const email = parsed.data.email?.trim().toLowerCase()
  if (!itemId || !isUuid(itemId) || !email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "A valid item and email address are required." }, { status: 400 })
  }

  try {
    const item = await getBookById(itemId)
    if (!item || item.item_type === "book") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }
    if (!itemTokenMatches(item, parsed.data.token)) {
      return NextResponse.json({ error: "Open this page from the item's NFC tag." }, { status: 403 })
    }

    const result = await checkoutGuestItem({ itemId, borrowerEmail: email })
    const cookieStore = await cookies()
    cookieStore.set(GUEST_SESSION_COOKIE, result.token, GUEST_SESSION_COOKIE_OPTIONS)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 400 }
    )
  }
}
