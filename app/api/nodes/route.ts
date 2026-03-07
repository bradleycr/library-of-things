import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import {
  getStewardCookieName,
  verifyStewardToken,
} from "@/lib/server/steward-auth"
import { createNode } from "@/lib/server/repositories"
import { geocodeNodeAddress } from "@/lib/server/geocode-node-address"
import type { Node } from "@/lib/types"

const NODE_TYPES: Node["type"][] = [
  "home",
  "cafe",
  "coworking",
  "library",
  "bookstore",
  "little_free_library",
  "other",
]

/**
 * POST /api/nodes
 * Steward-only: create a new node. Cookie must be set (steward login).
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(getStewardCookieName())?.value
  if (!token || !verifyStewardToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const {
    name,
    type,
    steward_id,
    location_address,
    location_lat,
    location_lng,
    public: isPublic,
    capacity,
    operating_hours,
  } = body as {
    name?: string
    type?: string
    steward_id?: string
    location_address?: string
    location_lat?: number
    location_lng?: number
    public?: boolean
    capacity?: number
    operating_hours?: string
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    )
  }
  if (!type || typeof type !== "string" || !NODE_TYPES.includes(type as Node["type"])) {
    return NextResponse.json(
      { error: "type must be one of: " + NODE_TYPES.join(", ") },
      { status: 400 }
    )
  }
  if (!steward_id || typeof steward_id !== "string" || !steward_id.trim()) {
    return NextResponse.json(
      { error: "steward_id is required" },
      { status: 400 }
    )
  }

  try {
    const trimmedAddress =
      typeof location_address === "string" ? location_address.trim().slice(0, 1000) : undefined
    const providedLat =
      typeof location_lat === "number" && Number.isFinite(location_lat) ? location_lat : undefined
    const providedLng =
      typeof location_lng === "number" && Number.isFinite(location_lng) ? location_lng : undefined
    const geocoded =
      trimmedAddress && (providedLat == null || providedLng == null)
        ? await geocodeNodeAddress(trimmedAddress)
        : null

    const node = await createNode({
      name: name.trim().slice(0, 500),
      type: type as Node["type"],
      steward_id: steward_id.trim(),
      location_address: trimmedAddress,
      location_lat: providedLat ?? geocoded?.lat,
      location_lng: providedLng ?? geocoded?.lng,
      public: typeof isPublic === "boolean" ? isPublic : true,
      capacity:
        typeof capacity === "number" && Number.isInteger(capacity) && capacity >= 0
          ? capacity
          : undefined,
      operating_hours:
        typeof operating_hours === "string" ? operating_hours.trim().slice(0, 500) : undefined,
    })
    revalidatePath("/")
    return NextResponse.json(node)
  } catch (error) {
    console.error("Create node error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create node" },
      { status: 500 }
    )
  }
}
