import { NextRequest, NextResponse } from "next/server"
import { isValidEmail, normalizeEmail } from "@/lib/email"
import { checkoutBook, getBookById, getUserById, updateUserProfile } from "@/lib/server/repositories"
import { getSessionUserId } from "@/lib/server/session"
import { parseJsonBody, isUuid } from "@/lib/server/validate"

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody<{ book_id: string; user_id: string; contact_email?: string }>(request)
  if (!parsed.ok) return parsed.response

  const { book_id, user_id } = parsed.data
  const submittedEmail = normalizeEmail(parsed.data.contact_email)

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
    const book = await getBookById(book_id)
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 })
    }
    if (book.item_type === "keycard") {
      return NextResponse.json(
        { error: "Temporary keycards are signed out from their physical NFC tag." },
        { status: 400 }
      )
    }

    // Books always need a private contact email on the account (keycards use guest flow).
    const user = await getUserById(user_id)
    const emailOnFile = normalizeEmail(user?.contact_email)
    const email = emailOnFile || submittedEmail
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "An email address is required on your account before checkout." },
        { status: 403 }
      )
    }
    if (!emailOnFile && submittedEmail) {
      await updateUserProfile(user_id, { contact_email: email })
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
