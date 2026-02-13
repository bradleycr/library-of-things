import { NextRequest, NextResponse } from "next/server"
import type { LendingTerms } from "@/lib/types"
import { createBook } from "@/lib/server/repositories"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    isbn,
    title,
    author,
    edition,
    node_id,
    cover_image_url,
    lending_terms,
    added_by_user_id,
    added_by_display_name,
  } = body as {
    isbn?: string
    title: string
    author?: string
    edition?: string
    node_id: string
    cover_image_url?: string
    lending_terms?: Record<string, unknown>
    added_by_user_id?: string
    added_by_display_name?: string
  }

  if (!title || !node_id) {
    return NextResponse.json(
      { error: "title and node_id are required" },
      { status: 400 }
    )
  }

  const defaultTerms: LendingTerms = {
    type: "borrow",
    is_free: true,
    requires_id: false,
    pseudonymous_allowed: true,
    contact_required: false,
    loan_period_days: 21, // default 3 weeks; suggestion only
    shipping_allowed: false,
    local_only: true,
    contact_opt_in: true,
  }
  const mergedTerms: LendingTerms = {
    ...defaultTerms,
    ...(lending_terms && typeof lending_terms === "object" ? lending_terms : {}),
  }
  if (mergedTerms.loan_period_days == null) mergedTerms.loan_period_days = 21
  mergedTerms.shipping_allowed = false
  mergedTerms.local_only = true

  const created = await createBook({
    isbn,
    title,
    author,
    edition,
    nodeId: node_id,
    lendingTerms: mergedTerms,
    coverImageUrl: cover_image_url,
    addedByUserId: added_by_user_id,
    addedByDisplayName: added_by_display_name,
  })

  // QR code URL can be added when /api/qr/[id] is implemented for physical tags.
  return NextResponse.json({ success: true, ...created })
}
