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
    description,
    node_id,
    cover_image_url,
    lending_terms,
    added_by_user_id,
    added_by_display_name,
    is_pocket_library,
    owner_contact_email,
    current_location_text,
  } = body as {
    isbn?: string
    title: string
    author?: string
    edition?: string
    description?: string
    node_id?: string
    cover_image_url?: string
    lending_terms?: Record<string, unknown>
    added_by_user_id?: string
    added_by_display_name?: string
    is_pocket_library?: boolean
    owner_contact_email?: string
    current_location_text?: string
  }

  // Validate title
  if (!title || typeof title !== "string") {
    return NextResponse.json(
      { error: "title is required" },
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

  // Validate location: either node_id OR is_pocket_library must be provided
  if (!node_id && !is_pocket_library) {
    return NextResponse.json(
      { error: "Either node_id or is_pocket_library must be provided" },
      { status: 400 }
    )
  }

  // For Pocket Library books, require owner contact email
  if (is_pocket_library && !owner_contact_email) {
    return NextResponse.json(
      { error: "owner_contact_email is required for Pocket Library books" },
      { status: 400 }
    )
  }

  // For node-based books, node_id is required
  if (!is_pocket_library && (!node_id || typeof node_id !== "string")) {
    return NextResponse.json(
      { error: "node_id is required for node-based books" },
      { status: 400 }
    )
  }

  const defaultTerms: LendingTerms = {
    type: "borrow",
    is_free: true,
    requires_id: false,
    pseudonymous_allowed: true,
    contact_required: false,
    loan_period_days: 21,
    shipping_allowed: false,
    local_only: true,
    contact_opt_in: true,
  }
  const raw = lending_terms && typeof lending_terms === "object" ? lending_terms as Record<string, unknown> : {}
  const mergedTerms: LendingTerms = {
    ...defaultTerms,
    type: (typeof raw.type === "string" ? raw.type : defaultTerms.type) as LendingTerms["type"],
    is_free: typeof raw.is_free === "boolean" ? raw.is_free : defaultTerms.is_free,
    requires_id: typeof raw.requires_id === "boolean" ? raw.requires_id : defaultTerms.requires_id,
    pseudonymous_allowed: typeof raw.pseudonymous_allowed === "boolean" ? raw.pseudonymous_allowed : defaultTerms.pseudonymous_allowed,
    contact_required: typeof raw.contact_required === "boolean" ? raw.contact_required : defaultTerms.contact_required,
    loan_period_days: typeof raw.loan_period_days === "number" && raw.loan_period_days >= 1 ? raw.loan_period_days : defaultTerms.loan_period_days,
    contact_opt_in: typeof raw.contact_opt_in === "boolean" ? raw.contact_opt_in : defaultTerms.contact_opt_in,
  }
  mergedTerms.shipping_allowed = false
  mergedTerms.local_only = true

  const created = await createBook({
    isbn: typeof isbn === "string" ? isbn.trim().slice(0, 20) || undefined : undefined,
    title: trimmedTitle,
    author: typeof author === "string" ? author.trim().slice(0, 500) || undefined : undefined,
    edition: typeof edition === "string" ? edition.trim().slice(0, 200) || undefined : undefined,
    description: typeof description === "string" ? description.trim().slice(0, 3000) || undefined : undefined,
    nodeId: node_id,
    lendingTerms: mergedTerms,
    coverImageUrl: typeof cover_image_url === "string" ? cover_image_url.trim().slice(0, 2048) || undefined : undefined,
    addedByUserId: added_by_user_id,
    addedByDisplayName: added_by_display_name,
    isPocketLibrary: is_pocket_library ?? false,
    ownerContactEmail: typeof owner_contact_email === "string" ? owner_contact_email.trim() || undefined : undefined,
    currentLocationText: typeof current_location_text === "string" ? current_location_text.trim() || undefined : undefined,
  })

  return NextResponse.json({ success: true, ...created })
}
