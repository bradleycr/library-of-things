import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { setAppConfig } from "@/lib/server/repositories"
import { getStewardCookieName, verifyStewardToken } from "@/lib/server/steward-auth"
import { clampLoanPeriodDays } from "@/lib/loan-period"

async function assertSteward(): Promise<NextResponse | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(getStewardCookieName())?.value
  if (!token || !verifyStewardToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

/**
 * PATCH /api/steward/config — update app-wide settings (e.g. default loan period).
 * Steward-only. Propagates to bootstrap and all flows that use the default.
 */
export async function PATCH(request: NextRequest) {
  const authFailure = await assertSteward()
  if (authFailure) return authFailure

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const updates: Parameters<typeof setAppConfig>[0] = {}
  if (body.default_loan_period_days !== undefined) {
    const raw = Number(body.default_loan_period_days)
    if (Number.isNaN(raw) || raw < 1 || raw > 365) {
      return NextResponse.json(
        { error: "default_loan_period_days must be a number between 1 and 365" },
        { status: 400 }
      )
    }
    updates.default_loan_period_days = clampLoanPeriodDays(raw)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid config fields provided" }, { status: 400 })
  }

  const config = await setAppConfig(updates)
  return NextResponse.json({ success: true, config })
}
