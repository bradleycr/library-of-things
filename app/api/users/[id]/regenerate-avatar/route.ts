import { NextRequest, NextResponse } from "next/server"
import { updateUserProfile } from "@/lib/server/repositories"
import { getSessionUserId } from "@/lib/server/session"

/**
 * POST /api/users/[id]/regenerate-avatar
 * Generate a new DiceBear avatar by saving a new random seed for this user.
 * The new avatar is persisted immediately; no separate "save" step.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionUserId = await getSessionUserId()
    if (!sessionUserId || sessionUserId !== id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // New random seed so DiceBear yields a different avatar every time
    const newSeed = crypto.randomUUID()
    const result = await updateUserProfile(id, { avatar_seed: newSeed })

    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "User not found." }, { status: 404 })
      }
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Regenerate avatar error:", error)
    return NextResponse.json(
      { error: "Failed to regenerate avatar" },
      { status: 500 }
    )
  }
}
