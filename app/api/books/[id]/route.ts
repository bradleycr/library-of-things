import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import type { LendingTerms } from "@/lib/types"
import { updateBook } from "@/lib/server/repositories"
import { getStewardCookieName, verifyStewardToken } from "@/lib/server/steward-auth"
import { parseJsonBody, isUuid } from "@/lib/server/validate"
import { sanitizeCoverUrl } from "@/lib/server/sanitize-cover-url"

/**
 * PATCH /api/books/[id]
 * Steward-only: update book metadata (title, author, edition, isbn, cover, node, lending_terms).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get(getStewardCookieName())?.value
  if (!token || !verifyStewardToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: "Invalid book id" }, { status: 400 })
  }

  const parsed = await parseJsonBody<Record<string, unknown>>(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const {
    title,
    author,
    edition,
    isbn,
    description,
    cover_image_url,
    node_id,
    lending_terms,
    availability_status,
    current_holder_id,
    note,
  } = body as {
    title?: string
    author?: string | null
    edition?: string | null
    isbn?: string | null
    description?: string | null
    cover_image_url?: string | null
    node_id?: string
    lending_terms?: Record<string, unknown>
    availability_status?: string
    current_holder_id?: string | null
    note?: string | null
  }

  const trimmedTitle =
    title !== undefined && typeof title === "string" ? title.trim() : undefined
  if (trimmedTitle !== undefined && !trimmedTitle) {
    return NextResponse.json(
      { error: "Title cannot be empty" },
      { status: 400 }
    )
  }

  const normalizedStatus =
    availability_status === "unavailable"
      ? "in_transit"
      : availability_status === "missing"
        ? "retired"
        : availability_status
  if (
    normalizedStatus !== undefined &&
    normalizedStatus !== "available" &&
    normalizedStatus !== "checked_out" &&
    normalizedStatus !== "in_transit" &&
    normalizedStatus !== "retired"
  ) {
    return NextResponse.json(
      { error: "Invalid availability_status" },
      { status: 400 }
    )
  }

  let parsedTerms: LendingTerms | undefined
  if (lending_terms != null && typeof lending_terms === "object") {
    parsedTerms = lending_terms as unknown as LendingTerms
  }

  try {
    const updated = await updateBook(id, {
      title: trimmedTitle,
      author:
        author === undefined
          ? undefined
          : (typeof author === "string" ? author : null),
      edition:
        edition === undefined
          ? undefined
          : (typeof edition === "string" ? edition : null),
      isbn:
        isbn === undefined
          ? undefined
          : (typeof isbn === "string" ? isbn : null),
      description:
        description === undefined
          ? undefined
          : (typeof description === "string" ? description : null),
      cover_image_url:
        cover_image_url === undefined
          ? undefined
          : (typeof cover_image_url === "string"
              ? (sanitizeCoverUrl(cover_image_url) || null)
              : null),
      node_id: typeof node_id === "string" && node_id ? node_id : undefined,
      lending_terms: parsedTerms,
      availability_status: normalizedStatus,
      current_holder_id:
        current_holder_id === undefined
          ? undefined
          : (typeof current_holder_id === "string" && current_holder_id
              ? current_holder_id
              : null),
      ledger_note:
        note === undefined ? undefined : (typeof note === "string" ? note : null),
      actor_display_name: "Steward",
    })

    if (!updated) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Book update error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    )
  }
}
