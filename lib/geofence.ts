/**
 * Lightweight geofencing for "return at a node" flows.
 * Uses haversine distance; no external APIs. Graceful when location is unavailable.
 */

const EARTH_RADIUS_M = 6_371_000
/** Default radius for "return at node" geofencing. Slightly generous to allow for GPS drift and node pin placement. */
export const DEFAULT_RETURN_RADIUS_M = 1500

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
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters:
            typeof pos.coords.accuracy === "number" && pos.coords.accuracy >= 0
              ? pos.coords.accuracy
              : undefined,
        }),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 30_000,
        ...options,
      }
    )
  })
}
