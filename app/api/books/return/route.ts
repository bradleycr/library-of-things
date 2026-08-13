import { NextRequest, NextResponse } from "next/server"
import { getAppConfig, listNodes, returnBook } from "@/lib/server/repositories"
import { getSessionUserId } from "@/lib/server/session"
import { parseJsonBody, isUuid, LIMITS, clampString } from "@/lib/server/validate"
import {
  haversineDistanceMeters,
  isValidLocationSample,
  MAX_ACCURACY_BONUS_M,
} from "@/lib/geofence"

/** Server-side cap so we fail eventually, but not before normal DB queueing can clear. */
const RETURN_HANDLER_TIMEOUT_MS = 15_000

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("RETURN_TIMEOUT")), ms)
  )
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody<{
      book_id: string
      user_id: string
      return_node_id?: string
      notes?: string
      manual_confirm?: boolean
      location?: { lat?: number; lng?: number; accuracy_m?: number; captured_at?: string }
    }>(request)
    if (!parsed.ok) return parsed.response

    const { book_id, user_id, return_node_id, notes } = parsed.data

    if (!book_id || !user_id) {
      return NextResponse.json(
        { error: "book_id and user_id are required" },
        { status: 400 }
      )
    }
    if (!isUuid(book_id) || !isUuid(user_id)) {
      return NextResponse.json(
        { error: "Invalid book_id or user_id" },
        { status: 400 }
      )
    }
    if (return_node_id != null && !isUuid(return_node_id)) {
      return NextResponse.json(
        { error: "Invalid return_node_id" },
        { status: 400 }
      )
    }

    const sessionUserId = await getSessionUserId()
    if (!sessionUserId || sessionUserId !== user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
      let locationVerification: "geofence" | "manual" = "manual"
      let returnDistanceM: number | undefined
      if (return_node_id) {
        const [nodes, config] = await Promise.all([listNodes(), getAppConfig()])
        const node = nodes.find((candidate) => candidate.id === return_node_id)
        if (!node) return NextResponse.json({ error: "Return node not found" }, { status: 404 })
        const sample = parsed.data.location
        const usable =
          isValidLocationSample(sample) &&
          node.location_lat != null &&
          node.location_lng != null
        if (usable && sample && node.location_lat != null && node.location_lng != null) {
          returnDistanceM = haversineDistanceMeters(
            sample.lat!,
            sample.lng!,
            node.location_lat,
            node.location_lng
          )
          const accuracyBonus = Math.min(Math.max(sample.accuracy_m ?? 0, 0), MAX_ACCURACY_BONUS_M)
          if (returnDistanceM > config.return_geofence_radius_m + accuracyBonus) {
            if (!parsed.data.manual_confirm) {
              return NextResponse.json(
                {
                  error: `You appear to be outside the return area for ${node.name}. If you are at the node, confirm the physical return manually.`,
                  code: "NOT_NEAR_NODE",
                },
                { status: 403 }
              )
            }
          } else {
            locationVerification = "geofence"
          }
        } else if (!parsed.data.manual_confirm) {
          return NextResponse.json(
            { error: "Verify your location or confirm the physical return manually.", code: "MANUAL_CONFIRM_REQUIRED" },
            { status: 422 }
          )
        }
      }
      await Promise.race([
        returnBook({
          bookId: book_id,
          userId: user_id,
          returnNodeId: return_node_id,
          notes: clampString(notes, LIMITS.ledgerNote) ?? undefined,
          locationVerification,
          returnDistanceM,
        }),
        timeoutPromise(RETURN_HANDLER_TIMEOUT_MS),
      ])
      return NextResponse.json({ success: true })
    } catch (error) {
      if (error instanceof Error && error.message === "RETURN_TIMEOUT") {
        console.error("[api/books/return] handler timeout", { book_id, user_id })
        return NextResponse.json(
          { error: "Return is taking too long. Please try again, or open the return page by scanning the book's QR or NFC tag." },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Return failed" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("[api/books/return]", error)
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
