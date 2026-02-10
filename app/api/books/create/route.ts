import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { isbn, title, author, edition, node_id, lending_terms } = body as {
    isbn?: string
    title: string
    author?: string
    edition?: string
    node_id: string
    lending_terms?: Record<string, unknown>
  }

  if (!title || !node_id) {
    return NextResponse.json(
      { error: "title and node_id are required" },
      { status: 400 }
    )
  }

  // TODO: Implement with Supabase
  // 1. Fetch book metadata from Open Library API (if ISBN provided)
  // 2. Generate UUID for book
  // 3. Generate QR code image (save to Supabase Storage)
  // 4. Insert to books table
  // 5. Verify steward permissions

  const book = {
    id: crypto.randomUUID(),
    isbn,
    title,
    author,
    edition,
    qr_tag_id: `qr-${Date.now()}`,
    current_node_id: node_id,
    availability_status: "available",
    lending_terms: lending_terms || {
      type: "borrow",
      deposit_required: false,
      loan_period_days: 21,
      shipping_allowed: false,
      local_only: true,
      member_only: false,
      contact_opt_in: true,
    },
    created_at: new Date().toISOString(),
  }

  const qr_code_url = `/api/qr/${book.id}` // Placeholder

  return NextResponse.json({ success: true, book, qr_code_url })
}
