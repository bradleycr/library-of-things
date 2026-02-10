import { NextRequest, NextResponse } from "next/server"

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

  // TODO: Implement with Supabase
  // 1. Update books.current_holder_id = NULL
  // 2. Update books.availability_status = 'available'
  // 3. Update books.current_node_id (if return_node_id provided)
  // 4. Insert event to loan_events (event_type: 'return')
  // 5. Send confirmation email via Resend

  const loan_event = {
    id: crypto.randomUUID(),
    event_type: "return",
    book_id,
    user_id,
    timestamp: new Date().toISOString(),
    notes,
  }

  return NextResponse.json({ success: true, loan_event })
}
