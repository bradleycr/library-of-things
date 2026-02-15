import { NextRequest, NextResponse } from "next/server"
import { returnBook } from "@/lib/server/repositories"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { book_id, user_id, return_node_id, notes } = body as {
    book_id: string
    user_id: string
    return_node_id?: string
    notes?: string
  }

  if (!book_id || !user_id) {
    return NextResponse.json(
      { error: "book_id and user_id are required" },
      { status: 400 }
    )
  }

  try {
    await returnBook({
      bookId: book_id,
      userId: user_id,
      returnNodeId: return_node_id,
      notes,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Return failed" },
      { status: 400 }
    )
  }
}
