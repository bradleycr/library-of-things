import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/server/session"
import { parseJsonBody } from "@/lib/server/validate"
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"
import {
  buildAppleLibraryCardPkpass,
  isAppleWalletConfigured,
} from "@/lib/server/apple-wallet-pass"

const PKPASS_HEADERS = {
  "Content-Type": "application/vnd.apple.pkpass",
  "Content-Disposition": 'attachment; filename="library-card.pkpass"',
  "Cache-Control": "no-store",
}

/**
 * POST /api/wallet/apple-library-pass
 *
 * Requires a valid library session cookie and correct card number + PIN for that user.
 * Returns a signed Apple Wallet .pkpass when APPLE_WALLET_* signing env vars are set.
 *
 * Google Wallet: not supported here — see docs/WALLET.md (Wallet API + service account).
 */
export async function POST(request: NextRequest) {
  if (!isAppleWalletConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "Apple Wallet passes are not configured for this deployment.",
        code: "wallet_not_configured",
      },
      { status: 503 },
    )
  }

  const ip = getClientIp(request)
  const rl = checkRateLimit(`wallet-pkpass:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a minute." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)) },
      },
    )
  }

  const sessionUserId = await getSessionUserId()
  if (!sessionUserId) {
    return NextResponse.json(
      { success: false, error: "Sign in with your library card first." },
      { status: 401 },
    )
  }

  const parsed = await parseJsonBody<{ card_number?: unknown; pin?: unknown }>(request)
  if (!parsed.ok) return parsed.response

  const cardNumber =
    typeof parsed.data.card_number === "string" ? parsed.data.card_number.trim() : ""
  const pin = typeof parsed.data.pin === "string" ? parsed.data.pin.trim() : ""
  if (!cardNumber || !pin) {
    return NextResponse.json(
      { success: false, error: "card_number and pin are required." },
      { status: 400 },
    )
  }

  const origin = request.nextUrl.origin
  if (!origin.startsWith("https://") && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "Wallet passes require HTTPS in production." },
      { status: 400 },
    )
  }

  try {
    const buffer = await buildAppleLibraryCardPkpass({
      sessionUserId,
      cardNumber,
      pin,
      publicOrigin: origin,
    })
    return new NextResponse(new Uint8Array(buffer), { status: 200, headers: PKPASS_HEADERS })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "CARD_AUTH_FAILED") {
      return NextResponse.json(
        { success: false, error: "Card number or PIN does not match your session." },
        { status: 403 },
      )
    }
    console.error("[wallet] Apple pass generation failed:", e)
    return NextResponse.json(
      { success: false, error: "Could not build wallet pass. Check server logs." },
      { status: 500 },
    )
  }
}
