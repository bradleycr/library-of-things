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

  if (!title || typeof title !== "string" || !node_id || typeof node_id !== "string") {
    return NextResponse.json(
      { error: "title and node_id are required" },
      { status: 400 }
    )
  }
  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    return NextResponse.json(
      { error: "title cannot be empty" },
      { status: 400 }
    )
  }
  if (trimmedTitle.length > 1000) {
    return NextResponse.json(
      { error: "title is too long" },
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
    isbn: typeof isbn === "string" ? isbn.trim().slice(0, 20) || undefined : undefined,
    title: trimmedTitle,
    author: typeof author === "string" ? author.trim().slice(0, 500) || undefined : undefined,
    edition: typeof edition === "string" ? edition.trim().slice(0, 200) || undefined : undefined,
    nodeId: node_id,
    lendingTerms: mergedTerms,
    coverImageUrl: typeof cover_image_url === "string" ? cover_image_url.trim().slice(0, 2048) || undefined : undefined,
    addedByUserId: added_by_user_id,
    addedByDisplayName: added_by_display_name,
  })

  return NextResponse.json({ success: true, ...created })
}
