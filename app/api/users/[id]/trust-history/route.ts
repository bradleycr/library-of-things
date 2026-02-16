import { NextResponse } from "next/server"
import { listTrustEventsByUserId } from "@/lib/server/repositories"

/** GET /api/users/[id]/trust-history — trust score breakdown for a user. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params
  if (!userId) {
    return NextResponse.json({ error: "User id required" }, { status: 400 })
  }
  try {
    const events = await listTrustEventsByUserId(userId)
    return NextResponse.json({ events })
  } catch (error) {
    console.error("Trust history error:", error)
    return NextResponse.json(
      { error: "Failed to load trust history" },
      { status: 500 }
    )
  }
}
