import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { maskEmail } from "@/lib/guest-pass"
import { GUEST_SESSION_COOKIE_OPTIONS, guestSessionCookieName } from "@/lib/server/guest-session"
import { confirmGuestCheckout, previewGuestCheckout } from "@/lib/server/repositories"
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"

const NO_STORE = { "Cache-Control": "no-store" }

/**
 * The email link opens a page. That page reads this preview, then the person
 * presses Confirm. A GET must not check the card out — mail scanners prefetch links.
 */
export async function GET(request: NextRequest) {
  const limited = checkRateLimit(`guest-confirm-preview:${getClientIp(request)}`, 30, 60_000)
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429, headers: NO_STORE })
  }

  const token = request.nextUrl.searchParams.get("token") ?? ""
  const preview = await previewGuestCheckout(token)
  if (!preview) {
    return NextResponse.json({ error: "This confirmation link is not valid." }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json(
    {
      status: preview.status,
      guest_name: preview.guestName,
      masked_email: maskEmail(preview.email),
      node_name: preview.nodeName,
      card_label: preview.cardLabel,
      valid_from_label: preview.validFromLabel,
      valid_until_label: preview.validUntilLabel,
    },
    { headers: NO_STORE }
  )
}

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(`guest-confirm:${getClientIp(request)}`, 10, 60_000)
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429, headers: NO_STORE })
  }

  let token = ""
  try {
    const body = (await request.json()) as { token?: string }
    token = body.token?.trim() ?? ""
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: NO_STORE })
  }

  try {
    const result = await confirmGuestCheckout(token)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400, headers: NO_STORE })
    }

    if (result.token) {
      const cookieStore = await cookies()
      cookieStore.set(guestSessionCookieName(result.preview.itemId), result.token, GUEST_SESSION_COOKIE_OPTIONS)
    }

    return NextResponse.json(
      {
        ok: true,
        already: result.already,
        card_label: result.preview.cardLabel,
        node_name: result.preview.nodeName,
        valid_from_label: result.preview.validFromLabel,
        valid_until_label: result.preview.validUntilLabel,
      },
      { headers: NO_STORE }
    )
  } catch (error) {
    console.error("[guest-checkout/confirm]", error)
    return NextResponse.json({ error: "Could not confirm the checkout." }, { status: 500, headers: NO_STORE })
  }
}
