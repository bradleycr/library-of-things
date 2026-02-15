/**
 * Lightweight geofencing for "return at a node" flows.
 * Uses haversine distance; no external APIs. Graceful when location is unavailable.
 */

const EARTH_RADIUS_M = 6_371_000
/** Default radius: ~1 km. Return options are only "nearby" when within this. */
export const DEFAULT_RETURN_RADIUS_M = 1000

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
 */
export function isWithinRadius(
  position: Coords,
  node: NodeWithCoords,
  radiusM = DEFAULT_RETURN_RADIUS_M
): boolean {
  const d = distanceToNode(position, node, radiusM)
  return d !== null && d <= radiusM
}

/**
 * Get current position from the browser. Resolves with null if denied or failed.
 * Use for optional geofencing; never block the flow on this.
 */
export function getCurrentPosition(options?: PositionOptions): Promise<Coords | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
        ...options,
      }
    )
  })
}
