import { NextRequest, NextResponse } from "next/server"
import { appOrigin } from "@/lib/server/app-origin"
import { previewLibraryCardLink, redeemLibraryCardLink } from "@/lib/server/library-card-account"
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/server/session"
import { parseJsonBody } from "@/lib/server/validate"

const NO_STORE = { "Cache-Control": "no-store" }

/**
 * The email link lands on a page. The page reads this preview, then the
 * person presses the button. A GET must not create a card or reveal a PIN —
 * mail scanners prefetch links.
 */
export async function GET(request: NextRequest) {
  const limited = checkRateLimit(`card-link-preview:${getClientIp(request)}`, 30, 60_000)
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: NO_STORE }
    )
  }

  const preview = await previewLibraryCardLink(request.nextUrl.searchParams.get("token") ?? "")
  if (!preview.ok) {
    return NextResponse.json({ error: "This link is not valid." }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json(
    {
      purpose: preview.purpose,
      masked_email: preview.maskedEmail,
      status: preview.status,
    },
    { headers: NO_STORE }
  )
}

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(`card-link-redeem:${getClientIp(request)}`, 10, 60_000)
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: NO_STORE }
    )
  }

  const parsed = await parseJsonBody<{ token?: string }>(request)
  if (!parsed.ok) return parsed.response
  const token = typeof parsed.data.token === "string" ? parsed.data.token : ""

  try {
    const redeemed = await redeemLibraryCardLink(token, appOrigin(request.headers))
    if (!redeemed.ok) {
      return NextResponse.json({ error: redeemed.error }, { status: 400, headers: NO_STORE })
    }

    const { card } = redeemed
    const res = NextResponse.json({
      success: true,
      card: {
        id: card.id,
        card_number: card.card_number,
        pin: card.pin,
        pseudonym: card.pseudonym,
        user_id: card.user_id,
        created_at: card.created_at,
        access_count: 0,
        status: "active" as const,
      },
    })
    res.cookies.set(SESSION_COOKIE_NAME, createSessionToken(card.user_id), SESSION_COOKIE_OPTIONS)
    return res
  } catch (error) {
    console.error("[library-card] confirm failed:", error)
    return NextResponse.json(
      { error: "Could not open this link. Please try again." },
      { status: 500, headers: NO_STORE }
    )
  }
}
