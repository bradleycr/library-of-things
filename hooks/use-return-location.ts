"use client"

import { useEffect, useState } from "react"
import type { Node } from "@/lib/types"
import {
  getCurrentPosition,
  isWithinRadius,
  type Coords,
} from "@/lib/geofence"

/**
 * Optional geolocation for "return at a node" geofencing.
 * Never blocks the flow: if location is denied or fails, nearby is empty but return is still allowed.
 */
export function useReturnLocation(nodes: Node[]) {
  const [position, setPosition] = useState<Coords | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getCurrentPosition()
      .then((coords) => {
        if (!cancelled) setPosition(coords)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Node ids that have coords and are within ~1 km of the user. Empty if no position or no nodes with coords. */
  const nearbyNodeIds = position
    ? nodes
        .filter((n) => n.location_lat != null && n.location_lng != null && isWithinRadius(position, n))
        .map((n) => n.id)
    : []

  /** Whether we have a position (so we can show "Nearby" badges). */
  const hasLocation = position !== null

  return { position, loading, nearbyNodeIds, hasLocation }
}
