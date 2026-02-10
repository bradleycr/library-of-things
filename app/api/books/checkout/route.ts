import { NextRequest, NextResponse } from "next/server"

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

  // TODO: Implement with Supabase
  // 1. Check if book is available
  // 2. Update books.current_holder_id = user_id
  // 3. Update books.availability_status = 'checked_out'
  // 4. Insert event to loan_events (event_type: 'checkout')
  // 5. Send confirmation email via Resend

  const loan_event = {
    id: crypto.randomUUID(),
    event_type: "checkout",
    book_id,
    user_id,
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json({ success: true, loan_event })
}
