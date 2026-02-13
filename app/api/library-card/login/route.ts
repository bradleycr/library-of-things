import { NextRequest, NextResponse } from "next/server"
import { getLibraryCardByNumberAndPin } from "@/lib/server/repositories"

function toNonEmptyString(value: unknown): string {
  if (value == null) return ""
  const s = String(value).trim()
  return s
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const cardNumber = toNonEmptyString(body?.card_number ?? body?.cardNumber)
    const pin = toNonEmptyString(body?.pin)

    if (!cardNumber || !pin) {
      return NextResponse.json(
        { success: false, error: "Card number and PIN are required." },
        { status: 400 }
      )
    }

    const normalizedCardNumber = cardNumber.replace(/\s/g, "")
    const card = await getLibraryCardByNumberAndPin(normalizedCardNumber, pin)
    if (!card) {
      return NextResponse.json(
        { success: false, error: "Invalid card number or PIN" },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      card: {
        id: card.id,
        card_number: card.card_number,
        pseudonym: card.pseudonym,
        user_id: card.user_id,
        created_at: card.created_at,
        access_count: 0,
        status: "active" as const,
      },
      user_id: card.user_id,
    })
  } catch (error) {
    console.error("Library card login error:", error)
    const message =
      error && typeof error === "object" && "code" in error && (error as { code: string }).code === "42P01"
        ? "Server setup incomplete. Please try again later."
        : "Login failed. Please try again."
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
