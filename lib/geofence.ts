/**
 * Lightweight geofencing for "return at a node" flows.
 * Uses haversine distance; no external APIs. Graceful when location is unavailable.
 *
 * Optional: Not used in the current UI. Kept for potential future use (e.g. re-enabling
 * "return only when nearby"). No location is requested anywhere in the app today when this is unused.
 */

const EARTH_RADIUS_M = 6_371_000
/** Default radius for "return at node" geofencing. Slightly generous to allow for GPS drift and node pin placement. */
export const DEFAULT_RETURN_RADIUS_M = 3000

/** Max extra meters we add to radius when device reports position accuracy (avoids over‑lenient when accuracy is huge). */
const MAX_ACCURACY_BONUS_M = 500

/**
 * Haversine distance between two points in meters.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_M * c
}

export interface Coords {
  lat: number
  lng: number
  /** Device-reported accuracy in meters (e.g. from Geolocation API). Used to avoid false "not nearby" when at location. */
  accuracyMeters?: number
}

export type GeolocationResult =
  | { status: "success"; coords: Coords; capturedAt: string }
  | { status: "permission-denied" | "timeout" | "unavailable" }

export interface NodeWithCoords {
  id: string
  name: string
  location_lat?: number
  location_lng?: number
}

/**
 * Returns distance in meters from position to node, or null if node has no coords.
 */
export function distanceToNode(
  position: Coords,
  node: NodeWithCoords,
  radiusM = DEFAULT_RETURN_RADIUS_M
): number | null {
  const lat = node.location_lat
  const lng = node.location_lng
  if (lat == null || lng == null) return null
  return haversineDistanceMeters(position.lat, position.lng, lat, lng)
}

/**
 * True if node has coords and is within radius of position.
 * When position includes accuracyMeters, we allow radius + min(accuracy, MAX_ACCURACY_BONUS_M)
 * so a coarse GPS reading at the actual location doesn't falsely exclude the user.
 */
export function isWithinRadius(
  position: Coords,
  node: NodeWithCoords,
  radiusM = DEFAULT_RETURN_RADIUS_M
): boolean {
  const d = distanceToNode(position, node, radiusM)
  if (d === null) return false
  const accuracyBonus =
    position.accuracyMeters != null
      ? Math.min(position.accuracyMeters, MAX_ACCURACY_BONUS_M)
      : 0
  return d <= radiusM + accuracyBonus
}

/**
 * Get current position from the browser. Resolves with null if denied or failed.
 * Includes device-reported accuracy when available; use for optional geofencing.
 */
export function getCurrentPosition(options?: PositionOptions): Promise<Coords | null> {
  return getCurrentPositionResult(options).then((result) =>
    result.status === "success" ? result.coords : null
  )
}

/**
 * One-shot, user-initiated location lookup with enough error detail to offer
 * an honest fallback. Call this from a button handler, never page mount.
 */
export function getCurrentPositionResult(options?: PositionOptions): Promise<GeolocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ status: "unavailable" })
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracy =
          typeof pos.coords.accuracy === "number" && pos.coords.accuracy >= 0
            ? pos.coords.accuracy
            : undefined
        if (accuracy != null && accuracy > 1000) {
          resolve({ status: "unavailable" })
          return
        }
        resolve({
          status: "success",
          capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: accuracy,
          },
        })
      },
      (error) =>
        resolve({
          status:
            error.code === error.PERMISSION_DENIED
              ? "permission-denied"
              : error.code === error.TIMEOUT
                ? "timeout"
                : "unavailable",
        }),
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 30_000,
        ...options,
      }
    )
  })
}
