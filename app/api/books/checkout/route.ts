import { NextRequest, NextResponse } from "next/server"
import { checkoutBook, getBookById, getUserById, updateUserProfile } from "@/lib/server/repositories"
import { getSessionUserId } from "@/lib/server/session"
import { parseJsonBody, isUuid } from "@/lib/server/validate"

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody<{ book_id: string; user_id: string; contact_email?: string }>(request)
  if (!parsed.ok) return parsed.response

  const { book_id, user_id } = parsed.data
  const submittedEmail = parsed.data.contact_email?.trim().toLowerCase()

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
    if (book.item_type === "keycard") {
      return NextResponse.json(
        { error: "Guest keycards are signed out from their physical NFC tag." },
        { status: 400 }
      )
    }
    const terms = book.lending_terms
    const contactRequired =
      typeof terms === "object" && terms !== null && terms.contact_required === true
    if (contactRequired) {
      const user = await getUserById(user_id)
      const email = user?.contact_email?.trim() || submittedEmail
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
        return NextResponse.json(
          { error: "This item requires an email address before checkout." },
          { status: 403 }
        )
      }
      if (!user?.contact_email?.trim() && submittedEmail) {
        await updateUserProfile(user_id, { contact_email: submittedEmail })
      }
    }

    await checkoutBook({ bookId: book_id, userId: user_id })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed"
    const isBorrowingLimit =
      /at most \d+ books checked out/i.test(message) || /return one to check out another/i.test(message)
    return NextResponse.json(
      { error: message },
      { status: isBorrowingLimit ? 403 : 400 }
    )
  }
}
