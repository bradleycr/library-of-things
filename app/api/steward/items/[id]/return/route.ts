import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { stewardReturnGuestItem } from "@/lib/server/repositories"
import { notifyKeycardReturned } from "@/lib/server/keycard-mail"
import { getStewardCookieName, verifyStewardToken } from "@/lib/server/steward-auth"
import { isUuid } from "@/lib/server/validate"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = (await cookies()).get(getStewardCookieName())?.value
  if (!token || !verifyStewardToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid item" }, { status: 400 })
  try {
    const notice = await stewardReturnGuestItem(id)
    await notifyKeycardReturned({ ...notice, reportPromised: false, bySteward: true }).catch((error) => {
      console.error("[keycard] steward return notice failed:", error)
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Return failed" },
      { status: 400 }
    )
  }
}
