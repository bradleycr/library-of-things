"use client"

import { useCallback, useEffect, useState } from "react"
import type { Node } from "@/lib/types"
import {
  getCurrentPosition,
  isWithinRadius,
  type Coords,
} from "@/lib/geofence"

/**
 * Optional geolocation for "return at a node" geofencing.
 * Never blocks the flow: if location is denied or fails, nearby is empty but return is still allowed.
 * Exposes refreshLocation so the user can re-request position (e.g. after moving or a bad first fix).
 */
export function useReturnLocation(nodes: Node[]) {
  const [position, setPosition] = useState<Coords | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPosition = useCallback(() => {
    setLoading(true)
    getCurrentPosition()
      .then((coords) => setPosition(coords))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchPosition()
  }, [fetchPosition])

  /** Node ids that have coords and are within range of the user (radius + accuracy). Empty if no position or no nodes with coords. */
  const nearbyNodeIds = position
    ? nodes
        .filter((n) => n.location_lat != null && n.location_lng != null && isWithinRadius(position, n))
        .map((n) => n.id)
    : []

  /** Whether we have a position (so we can show "Nearby" badges). */
  const hasLocation = position !== null

  return { position, loading, nearbyNodeIds, hasLocation, refreshLocation: fetchPosition }
}
