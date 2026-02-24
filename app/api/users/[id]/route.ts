import { NextRequest, NextResponse } from "next/server"
import { updateUserProfile, deleteUserAccount } from "@/lib/server/repositories"
import { getSessionUserId } from "@/lib/server/session"

/** PATCH /api/users/[id] — update profile (display name and/or optional contact info). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionUserId = await getSessionUserId()
    if (!sessionUserId || sessionUserId !== id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json() as Record<string, unknown>

    const updates: Parameters<typeof updateUserProfile>[1] = {}

    if (body.display_name !== undefined) {
      const displayName = typeof body.display_name === "string" ? body.display_name.trim() : ""
      if (!displayName) {
        return NextResponse.json(
          { error: "display_name must be a non-empty string when provided" },
          { status: 400 }
        )
      }
      updates.display_name = displayName
    }

    if (body.contact_opt_in !== undefined) {
      updates.contact_opt_in = Boolean(body.contact_opt_in)
    }
    if (body.contact_email !== undefined) {
      updates.contact_email = body.contact_email === null || body.contact_email === "" ? null : String(body.contact_email)
    }
    if (body.phone !== undefined) {
      updates.phone = body.phone === null || body.phone === "" ? null : String(body.phone)
    }
    if (body.twitter_url !== undefined) {
      updates.twitter_url = body.twitter_url === null || body.twitter_url === "" ? null : String(body.twitter_url)
    }
    if (body.linkedin_url !== undefined) {
      updates.linkedin_url = body.linkedin_url === null || body.linkedin_url === "" ? null : String(body.linkedin_url)
    }
    if (body.website_url !== undefined) {
      updates.website_url = body.website_url === null || body.website_url === "" ? null : String(body.website_url)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one field to update (display_name, contact_opt_in, contact_email, phone, twitter_url, linkedin_url, website_url)" },
        { status: 400 }
      )
    }

    const result = await updateUserProfile(id, updates)
    if (!result.ok) {
      if (result.reason === "display_name_taken") {
        return NextResponse.json(
          { error: "That display name is already taken. Please choose another." },
          { status: 409 }
        )
      }
      if (result.reason === "validation") {
        return NextResponse.json(
          { error: "Invalid profile data (e.g. display name cannot be empty)." },
          { status: 400 }
        )
      }
      if (result.reason === "not_found") {
        return NextResponse.json(
          { error: "User not found." },
          { status: 404 }
        )
      }
      if (result.reason === "schema_out_of_date") {
        return NextResponse.json(
          { error: "Profile or contact settings couldn't be saved — the database may need an update. Please try again later or contact support." },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("User update error:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id] — permanently delete an account.
 *
 * Anonymises ledger history, returns held books, then removes
 * the user and all associated data (library cards, trust events).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionUserId = await getSessionUserId()
    if (!sessionUserId || sessionUserId !== id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const result = await deleteUserAccount(id)

    if (!result.ok) {
      const messages: Record<string, { msg: string; status: number }> = {
        not_found: { msg: "User not found.", status: 404 },
        steward: {
          msg: "You are currently a steward of one or more book nodes. Please reassign stewardship before deleting your account.",
          status: 409,
        },
        has_checked_out_books: {
          msg: "Please return all checked-out books before deleting your account.",
          status: 409,
        },
        error: { msg: "Failed to delete account. Please try again.", status: 500 },
      }
      const { msg, status } = messages[result.reason] ?? messages.error
      return NextResponse.json({ error: msg }, { status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("User delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    )
  }
}
