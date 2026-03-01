import { NextRequest, NextResponse } from "next/server"
import { returnBook } from "@/lib/server/repositories"
import { getSessionUserId } from "@/lib/server/session"
import { parseJsonBody, isUuid, LIMITS, clampString } from "@/lib/server/validate"

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody<{ book_id: string; user_id: string; return_node_id?: string; notes?: string }>(request)
  if (!parsed.ok) return parsed.response

  const { book_id, user_id, return_node_id, notes } = parsed.data

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
  if (return_node_id != null && !isUuid(return_node_id)) {
    return NextResponse.json(
      { error: "Invalid return_node_id" },
      { status: 400 }
    )
  }

  const sessionUserId = await getSessionUserId()
  if (!sessionUserId || sessionUserId !== user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await returnBook({
      bookId: book_id,
      userId: user_id,
      returnNodeId: return_node_id,
      notes: clampString(notes, LIMITS.notes) ?? undefined,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Return failed" },
      { status: 400 }
    )
  }
}
