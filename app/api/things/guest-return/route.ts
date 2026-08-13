import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import {
  haversineDistanceMeters,
  isValidLocationSample,
  MAX_ACCURACY_BONUS_M,
} from "@/lib/geofence"
import {
  getAppConfig,
  getBookById,
  listNodes,
  returnGuestItem,
} from "@/lib/server/repositories"
import { GUEST_SESSION_COOKIE } from "@/lib/server/guest-session"
import { itemTokenMatches } from "@/lib/server/item-token"
import { isUuid, parseJsonBody } from "@/lib/server/validate"

type ReturnBody = {
  item_id?: string
  token?: string
  manual_confirm?: boolean
  location?: {
    lat?: number
    lng?: number
    accuracy_m?: number
    captured_at?: string
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody<ReturnBody>(request)
  if (!parsed.ok) return parsed.response
  const itemId = parsed.data.item_id
  if (!itemId || !isUuid(itemId)) {
    return NextResponse.json({ error: "Invalid item" }, { status: 400 })
  }

  try {
    const [item, nodes, config] = await Promise.all([getBookById(itemId), listNodes(), getAppConfig()])
    if (!item || item.item_type === "book") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }
    if (!itemTokenMatches(item, parsed.data.token)) {
      return NextResponse.json({ error: "Open this page from the item's NFC tag." }, { status: 403 })
    }

    const homeNode = nodes.find((node) => node.id === (item.home_node_id ?? item.current_node_id))
    const sample = parsed.data.location
    let verification: "geofence" | "manual" = "manual"
    let distanceM: number | undefined

    const hasUsableLocation =
      isValidLocationSample(sample) &&
      homeNode?.location_lat != null &&
      homeNode.location_lng != null

    if (hasUsableLocation && sample && homeNode?.location_lat != null && homeNode.location_lng != null) {
      distanceM = haversineDistanceMeters(
        sample.lat!,
        sample.lng!,
        homeNode.location_lat,
        homeNode.location_lng
      )
      const accuracyBonus = Math.min(Math.max(sample.accuracy_m ?? 0, 0), MAX_ACCURACY_BONUS_M)
      if (distanceM > config.return_geofence_radius_m + accuracyBonus) {
        if (!parsed.data.manual_confirm) {
          return NextResponse.json(
            {
              error: `You appear to be about ${Math.max(1, Math.round(distanceM / 1000))} km from ${homeNode.name}. If you are at the node, GPS may be wrong — check the manual return confirmation and try again.`,
              code: "NOT_NEAR_HOME_NODE",
            },
            { status: 403 }
          )
        }
      } else {
        verification = "geofence"
      }
    } else if (!parsed.data.manual_confirm) {
      return NextResponse.json(
        {
          error: "Location could not be verified. Check the box to confirm you have physically returned this keycard.",
          code: "MANUAL_CONFIRM_REQUIRED",
        },
        { status: 422 }
      )
    }

    const guestToken = (await cookies()).get(GUEST_SESSION_COOKIE)?.value
    if (!guestToken) {
      return NextResponse.json({ error: "Return session not found. Ask a steward for help." }, { status: 401 })
    }
    await returnGuestItem({ itemId, token: guestToken, verification, distanceM })
    ;(await cookies()).delete(GUEST_SESSION_COOKIE)
    return NextResponse.json({ success: true, verification })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Return failed" },
      { status: 400 }
    )
  }
}
