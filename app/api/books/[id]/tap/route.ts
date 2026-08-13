import { NextRequest, NextResponse } from "next/server"
import { getAppConfig, getBookById, hasActiveGuestSession, listNodes } from "@/lib/server/repositories"
import { isUuid } from "@/lib/server/validate"
import { getGuestSessionToken } from "@/lib/server/guest-session"
import { itemTokenMatches } from "@/lib/server/item-token"

/**
 * GET /api/books/[id]/tap?token=xxx
 * Returns book + nodes for the minimal checkout/return page when opened via QR or NFC.
 * Token must match the book's stored checkout_url (validates the link).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.nextUrl.searchParams.get("token")

    if (!id) {
      return NextResponse.json({ error: "Book id required" }, { status: 400 })
    }
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid book id" }, { status: 400 })
    }
    if (!token) {
      return NextResponse.json(
        { error: "Token required (use the full QR/NFC link)" },
        { status: 400 }
      )
    }

    const book = await getBookById(id)
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 })
    }

    if (!itemTokenMatches(book, token)) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 403 }
      )
    }

    const [nodes, config] = await Promise.all([listNodes(), getAppConfig()])
    const guestSessionActive =
      book.item_type !== "book"
        ? await hasActiveGuestSession(book.id, await getGuestSessionToken())
        : false
    return NextResponse.json({
      book,
      nodes,
      guest_session_active: guestSessionActive,
      return_geofence_radius_m: config.return_geofence_radius_m,
    })
  } catch (error) {
    console.error("[api/books/[id]/tap]", error)
    return NextResponse.json(
      { error: "Failed to load book" },
      { status: 500 }
    )
  }
}
