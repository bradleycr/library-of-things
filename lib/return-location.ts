import {
  distanceToNode,
  formatDistanceMeters,
  geolocationStatusMessage,
  isWithinRadius,
  type GeolocationResult,
  type NodeWithCoords,
} from "./geofence"

export type ReturnLocationPreview = {
  withinRange: boolean
  distanceM: number | null
  message: string
}

/** Client-side preview after a location read — mirrors server geofence logic. */
export function previewReturnLocation(
  result: GeolocationResult,
  node: NodeWithCoords | undefined,
  radiusM: number
): ReturnLocationPreview | null {
  if (result.status !== "success" || !node) return null

  const distanceM = distanceToNode(result.coords, node, radiusM)
  if (distanceM === null) {
    return {
      withinRange: false,
      distanceM: null,
      message: "This node has no map coordinates. Confirm the physical return manually.",
    }
  }

  const withinRange = isWithinRadius(result.coords, node, radiusM)
  const accuracyNote =
    result.coords.accuracyMeters != null && result.coords.accuracyMeters > 100
      ? ` (±${Math.round(result.coords.accuracyMeters)} m accuracy)`
      : ""

  if (withinRange) {
    return {
      withinRange: true,
      distanceM,
      message: `About ${formatDistanceMeters(distanceM)} from ${node.name}${accuracyNote}. You're in the return area.`,
    }
  }

  return {
    withinRange: false,
    distanceM,
    message: `About ${formatDistanceMeters(distanceM)} from ${node.name}${accuracyNote}. If you're at the node, GPS may be imprecise — use manual confirmation below.`,
  }
}

export { geolocationStatusMessage, formatDistanceMeters }
