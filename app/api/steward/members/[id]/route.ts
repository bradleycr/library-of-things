import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  deleteUserAccount,
  updateUserProfile,
} from "@/lib/server/repositories"
import { getStewardCookieName, stewardToken } from "@/lib/server/steward-auth"

async function assertSteward(): Promise<NextResponse | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(getStewardCookieName())?.value
  if (token !== stewardToken()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFailure = await assertSteward()
  if (authFailure) return authFailure

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "User id required" }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const updates: Parameters<typeof updateUserProfile>[1] = {}
  if (body.display_name !== undefined) {
    const displayName = typeof body.display_name === "string" ? body.display_name.trim() : ""
    if (!displayName) {
      return NextResponse.json({ error: "display_name cannot be empty" }, { status: 400 })
    }
    updates.display_name = displayName
  }
  if (body.contact_opt_in !== undefined) {
    updates.contact_opt_in = Boolean(body.contact_opt_in)
  }
  if (body.contact_email !== undefined) {
    updates.contact_email =
      body.contact_email === null || body.contact_email === ""
        ? null
        : String(body.contact_email)
  }
  if (body.phone !== undefined) {
    updates.phone = body.phone === null || body.phone === "" ? null : String(body.phone)
  }
  if (body.twitter_url !== undefined) {
    updates.twitter_url =
      body.twitter_url === null || body.twitter_url === "" ? null : String(body.twitter_url)
  }
  if (body.linkedin_url !== undefined) {
    updates.linkedin_url =
      body.linkedin_url === null || body.linkedin_url === "" ? null : String(body.linkedin_url)
  }
  if (body.website_url !== undefined) {
    updates.website_url =
      body.website_url === null || body.website_url === "" ? null : String(body.website_url)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields provided for update" }, { status: 400 })
  }

  const result = await updateUserProfile(id, updates)
  if (!result.ok) {
    if (result.reason === "display_name_taken") {
      return NextResponse.json(
        { error: "That display name is already taken." },
        { status: 409 }
      )
    }
    if (result.reason === "validation") {
      return NextResponse.json({ error: "Invalid member profile data." }, { status: 400 })
    }
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Member not found." }, { status: 404 })
    }
    if (result.reason === "schema_out_of_date") {
      return NextResponse.json(
        { error: "Profile fields are unavailable until schema is updated." },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFailure = await assertSteward()
  if (authFailure) return authFailure

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "User id required" }, { status: 400 })
  }

  const result = await deleteUserAccount(id)
  if (!result.ok) {
    const messages: Record<string, { msg: string; status: number }> = {
      not_found: { msg: "Member not found.", status: 404 },
      steward: {
        msg: "This member is assigned as steward to a node. Reassign stewardship first.",
        status: 409,
      },
      has_checked_out_books: {
        msg: "Member must return checked-out books before deletion.",
        status: 409,
      },
      error: { msg: "Failed to delete member.", status: 500 },
    }
    const selected = messages[result.reason] ?? messages.error
    return NextResponse.json({ error: selected.msg }, { status: selected.status })
  }

  return NextResponse.json({ success: true })
}
