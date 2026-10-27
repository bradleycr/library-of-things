import { NextRequest, NextResponse } from "next/server"
import { redactPublicHolderName } from "@/lib/public-ledger"
import { getBookById, listNodes } from "@/lib/server/repositories"
import { isUuid } from "@/lib/server/validate"
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

    const nodes = await listNodes()
    // Anyone who taps the card can see that it is out. They cannot see to whom.
    const publicBook = {
      ...book,
      current_holder_name: redactPublicHolderName(book.current_holder_name),
      owner_contact_email: book.item_type === "book" ? book.owner_contact_email : undefined,
    }
    return NextResponse.json({
      book: publicBook,
      nodes,
    })
  } catch (error) {
    console.error("[api/books/[id]/tap]", error)
    return NextResponse.json(
      { error: "Failed to load book" },
      { status: 500 }
    )
  }
}
