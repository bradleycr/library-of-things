import { NextRequest, NextResponse } from "next/server"
import { getBookById, listNodes } from "@/lib/server/repositories"

/**
 * GET /api/books/[id]/tap?token=xxx
 * Returns book + nodes for the minimal checkout/return page when opened via QR or NFC.
 * Token must match the book's stored checkout_url (validates the link).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = request.nextUrl.searchParams.get("token")

  if (!id) {
    return NextResponse.json({ error: "Book id required" }, { status: 400 })
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

  // Validate token against stored checkout_url (e.g. "/book/uuid/checkout?token=base64...")
  const storedToken = (() => {
    try {
      const q = book.checkout_url.split("?")[1]
      if (!q) return null
      const params = new URLSearchParams(q)
      return params.get("token")
    } catch {
      return null
    }
  })()

  if (storedToken !== token) {
    return NextResponse.json(
      { error: "Invalid or expired link" },
      { status: 403 }
    )
  }

  const nodes = await listNodes()
  return NextResponse.json({ book, nodes })
}
