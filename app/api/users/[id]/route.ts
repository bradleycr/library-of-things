import { NextRequest, NextResponse } from "next/server"
import { updateUserProfile } from "@/lib/server/repositories"

/** PATCH /api/users/[id] — update profile (display name and/or optional contact info). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const ok = await updateUserProfile(id, updates)
    if (!ok) {
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
