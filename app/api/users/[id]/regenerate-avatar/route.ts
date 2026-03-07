import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/users/[id]/regenerate-avatar
 *
 * Regenerate-avatar is disabled: we keep avatars deterministic from user id only,
 * with no avatar data stored in the database. If we re-enable regeneration later,
 * we could store an optional avatar_seed and add the column back to the schema.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params
  // Feature disabled — return 410 Gone so clients know not to offer the action
  return NextResponse.json(
    {
      error:
        "Regenerating profile images is not available. Avatars are generated from your account and are not stored in the database.",
    },
    { status: 410 }
  )
}
