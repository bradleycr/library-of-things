import { NextResponse } from "next/server"
import { listTrustEventsByUserId } from "@/lib/server/repositories"
import { isUuid } from "@/lib/server/validate"

/** GET /api/users/[id]/trust-history — trust score breakdown for a user. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    if (!userId || !isUuid(userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
    }
    const events = await listTrustEventsByUserId(userId)
    return NextResponse.json({ events })
  } catch (error) {
    console.error("[api/users/[id]/trust-history]", error)
    return NextResponse.json(
      { error: "Failed to load trust history" },
      { status: 500 }
    )
  }
}
