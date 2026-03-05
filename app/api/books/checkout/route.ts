import { NextRequest, NextResponse } from "next/server"
import { checkoutBook, getBookById, getUserById } from "@/lib/server/repositories"
import { getSessionUserId } from "@/lib/server/session"
import { parseJsonBody, isUuid } from "@/lib/server/validate"

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody<{ book_id: string; user_id: string }>(request)
  if (!parsed.ok) return parsed.response

  const { book_id, user_id } = parsed.data

  if (!book_id || !user_id) {
    return NextResponse.json(
      { error: "book_id and user_id are required" },
      { status: 400 }
    )
  }
  if (!isUuid(book_id) || !isUuid(user_id)) {
    return NextResponse.json(
      { error: "Invalid book_id or user_id" },
      { status: 400 }
    )
  }

  const sessionUserId = await getSessionUserId()
  if (!sessionUserId || sessionUserId !== user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Enforce contact-required lending terms server-side
    const book = await getBookById(book_id)
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 })
    }
    const terms = book.lending_terms
    const contactRequired =
      typeof terms === "object" && terms !== null && terms.contact_required === true
    if (contactRequired) {
      const user = await getUserById(user_id)
      const hasContact = !!(
        user?.contact_email?.trim() ||
        user?.phone?.trim() ||
        user?.twitter_url?.trim() ||
        user?.linkedin_url?.trim() ||
        user?.website_url?.trim()
      )
      if (!hasContact) {
        return NextResponse.json(
          { error: "This book requires contact info. Add yours in Settings before checking out." },
          { status: 403 }
        )
      }
    }

    await checkoutBook({ bookId: book_id, userId: user_id })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 400 }
    )
  }
}
