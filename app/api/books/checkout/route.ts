import { NextRequest, NextResponse } from "next/server"
import { checkoutBook } from "@/lib/server/repositories"
import { getSessionUserId } from "@/lib/server/session"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { book_id, user_id } = body as {
    book_id: string
    user_id: string
  }

  if (!book_id || !user_id) {
    return NextResponse.json(
      { error: "book_id and user_id are required" },
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
