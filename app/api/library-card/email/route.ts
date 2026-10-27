import { NextRequest, NextResponse } from "next/server"
import { appOrigin } from "@/lib/server/app-origin"
import { requestLibraryCardEmail } from "@/lib/server/library-card-account"
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"
import { getSessionUserId } from "@/lib/server/session"
import { clampString, LIMITS, parseJsonBody } from "@/lib/server/validate"

const NO_STORE = { "Cache-Control": "no-store" }

const GENERIC = {
  success: true,
  message:
    "Check your inbox. A new address gets a confirmation link. An address that already has a card gets the card number and a new PIN. Don’t share that email.",
}

/**
 * Ask the inbox on a library card to send the card.
 * The response is the same whether or not the address is on file.
 * The PIN is never in this response — it travels only in the email.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const ipLimit = checkRateLimit(`card-email-ip:${ip}`, 8, 10 * 60_000)
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a few minutes." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": "600" } }
    )
  }

  const parsed = await parseJsonBody<{ email?: string; display_name?: string }>(request)
  if (!parsed.ok) return parsed.response

  const email = typeof parsed.data.email === "string" ? parsed.data.email : ""
  const emailLimit = checkRateLimit(`card-email:${email.trim().toLowerCase()}`, 5, 60 * 60_000)
  if (!emailLimit.allowed) {
    return NextResponse.json(GENERIC, { headers: NO_STORE })
  }

  const displayName =
    typeof parsed.data.display_name === "string"
      ? clampString(parsed.data.display_name, LIMITS.displayName ?? 80)
      : null

  try {
    const result = await requestLibraryCardEmail({
      email,
      displayName,
      sessionUserId: await getSessionUserId(),
      origin: appOrigin(request.headers),
    })

    if (!result.ok && result.reason === "invalid_email") {
      return NextResponse.json(
        { success: false, error: "Enter an email address you can open." },
        { status: 400, headers: NO_STORE }
      )
    }
    if (!result.ok && result.reason === "mail") {
      return NextResponse.json(
        { success: false, error: "We couldn’t send that email. Please try again in a moment." },
        { status: 503, headers: NO_STORE }
      )
    }

    return NextResponse.json(
      {
        ...GENERIC,
        ...(result.ok && result.devUrl && process.env.NODE_ENV !== "production"
          ? { dev_url: result.devUrl }
          : {}),
      },
      { headers: NO_STORE }
    )
  } catch (error) {
    console.error("[library-card] email request failed:", error)
    return NextResponse.json(
      { success: false, error: "We couldn’t send that email. Please try again in a moment." },
      { status: 500, headers: NO_STORE }
    )
  }
}
