import { NextRequest, NextResponse } from "next/server"
import { checkoutBook } from "@/lib/server/repositories"
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
    await checkoutBook({ bookId: book_id, userId: user_id })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 400 }
    )
  }
}
