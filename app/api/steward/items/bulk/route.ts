import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import {
  createNumberedItems,
  getAppConfig,
} from "@/lib/server/repositories"
import { getStewardCookieName, verifyStewardToken } from "@/lib/server/steward-auth"
import { isUuid, parseJsonBody } from "@/lib/server/validate"
import type { ItemType, LendingTerms } from "@/lib/types"

type BulkBody = {
  item_type?: ItemType
  node_id?: string
  title_prefix?: string
  start_number?: number
  count?: number
  loan_period_days?: number
  contact_required?: boolean
  catalog_visible?: boolean
}

export async function POST(request: NextRequest) {
  const stewardToken = (await cookies()).get(getStewardCookieName())?.value
  if (!stewardToken || !verifyStewardToken(stewardToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const parsed = await parseJsonBody<BulkBody>(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const count = Number(body.count)
  const startNumber = Number(body.start_number)
  if (
    !body.node_id ||
    !isUuid(body.node_id) ||
    !["keycard", "other"].includes(body.item_type ?? "") ||
    !body.title_prefix?.trim() ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 100 ||
    !Number.isInteger(startNumber) ||
    startNumber < 1
  ) {
    return NextResponse.json({ error: "Invalid numbered-item request." }, { status: 400 })
  }

  try {
    const config = await getAppConfig()
    const terms: LendingTerms = {
      type: "borrow",
      is_free: true,
      requires_id: false,
      pseudonymous_allowed: true,
      contact_required: body.contact_required ?? true,
      loan_period_days:
        typeof body.loan_period_days === "number"
          ? Math.max(1, Math.min(365, Math.round(body.loan_period_days)))
          : config.default_loan_period_days,
      shipping_allowed: false,
      local_only: true,
      contact_opt_in: false,
    }
    const items = await createNumberedItems({
      itemType: body.item_type as Exclude<ItemType, "book">,
      nodeId: body.node_id,
      titlePrefix: body.title_prefix.trim().slice(0, 100),
      startNumber,
      count,
      lendingTerms: terms,
      catalogVisible: body.catalog_visible ?? false,
    })
    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create items" },
      { status: 400 }
    )
  }
}
