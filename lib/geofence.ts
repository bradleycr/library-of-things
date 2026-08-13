/**
 * Geofencing for "return at a node" flows (books + temporary keycards).
 * Uses haversine distance; no external APIs. Graceful when location is unavailable.
 */

const EARTH_RADIUS_M = 6_371_000

/** Default radius for "return at node" geofencing. Slightly generous for GPS drift and node pin placement. */
export const DEFAULT_RETURN_RADIUS_M = 3000

/** Max extra meters added to radius from device-reported accuracy (server + client preview). */
export const MAX_ACCURACY_BONUS_M = 500

/** Location samples older than this are rejected server-side. */
export const LOCATION_SAMPLE_MAX_AGE_MS = 3 * 60_000

/** Reject only absurd accuracy values; coarse cell/Wi‑Fi fixes are allowed. */
export const LOCATION_MAX_REPORTED_ACCURACY_M = 10_000

const HIGH_ACCURACY_TIMEOUT_MS = 8_000
const LOW_ACCURACY_TIMEOUT_MS = 8_000

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
  /** Device-reported accuracy in meters (e.g. from Geolocation API). */
  accuracyMeters?: number
}

export type GeolocationStatus = "success" | "permission-denied" | "timeout" | "unavailable"

export type GeolocationResult =
  | { status: "success"; coords: Coords; capturedAt: string }
  | { status: Exclude<GeolocationStatus, "success"> }

export interface NodeWithCoords {
  id: string
  name: string
  location_lat?: number
  location_lng?: number
}

export interface LocationSample {
  lat?: number
  lng?: number
  accuracy_m?: number
  captured_at?: string
}

/**
 * Returns distance in meters from position to node, or null if node has no coords.
 */
export function distanceToNode(
  position: Coords,
  node: NodeWithCoords,
  _radiusM = DEFAULT_RETURN_RADIUS_M
): number | null {
  const lat = node.location_lat
  const lng = node.location_lng
  if (lat == null || lng == null) return null
  return haversineDistanceMeters(position.lat, position.lng, lat, lng)
}

/**
 * True if node has coords and is within radius of position.
 * When position includes accuracyMeters, we allow radius + min(accuracy, MAX_ACCURACY_BONUS_M).
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

export function isFreshLocationSample(
  capturedAt: string | undefined,
  maxAgeMs = LOCATION_SAMPLE_MAX_AGE_MS
): boolean {
  if (!capturedAt || !Number.isFinite(Date.parse(capturedAt))) return false
  return Math.abs(Date.now() - Date.parse(capturedAt)) <= maxAgeMs
}

/** Shared server/client validation for a one-shot location sample. */
export function isValidLocationSample(sample: LocationSample | undefined): boolean {
  if (!sample) return false
  const accuracyOk =
    sample.accuracy_m == null ||
    (sample.accuracy_m >= 0 && sample.accuracy_m <= LOCATION_MAX_REPORTED_ACCURACY_M)
  return (
    typeof sample.lat === "number" &&
    sample.lat >= -90 &&
    sample.lat <= 90 &&
    typeof sample.lng === "number" &&
    sample.lng >= -180 &&
    sample.lng <= 180 &&
    accuracyOk &&
    isFreshLocationSample(sample.captured_at)
  )
}

export function locationSampleFromResult(result: GeolocationResult): LocationSample | undefined {
  if (result.status !== "success") return undefined
  return {
    lat: result.coords.lat,
    lng: result.coords.lng,
    accuracy_m: result.coords.accuracyMeters,
    captured_at: result.capturedAt,
  }
}

export function formatDistanceMeters(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM)} m`
  return `${(distanceM / 1000).toFixed(1)} km`
}

/** User-facing copy for geolocation failures (iPhone-friendly). */
export function geolocationStatusMessage(status: Exclude<GeolocationStatus, "success">): string {
  switch (status) {
    case "permission-denied":
      return "Location access was denied. On iPhone: Settings → Safari → Location → Allow, then try again."
    case "timeout":
      return "Location took too long. Move near a window or outdoors, or confirm the physical return manually."
    case "unavailable":
      return "Location is unavailable on this device. Confirm the physical return manually to continue."
  }
}

function getPositionOnce(options: PositionOptions): Promise<GeolocationResult> {
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
      options
    )
  })
}

/**
 * Get current position from the browser. Resolves with null if denied or failed.
 */
export function getCurrentPosition(options?: PositionOptions): Promise<Coords | null> {
  return getCurrentPositionResult(options).then((result) =>
    result.status === "success" ? result.coords : null
  )
}

/**
 * One-shot, user-initiated location lookup.
 * Starts GPS and network/cell lookups together so iPhone Safari treats both as
 * a user gesture (a sequential retry after timeout is often ignored).
 * Uses the first successful fix — 3 km geofence does not need a perfect GPS lock.
 * Call from a button handler, never on page mount.
 */
export async function getCurrentPositionResult(
  options?: PositionOptions
): Promise<GeolocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { status: "unavailable" }
  }

  const highAccuracyPromise = getPositionOnce({
    enableHighAccuracy: true,
    timeout: HIGH_ACCURACY_TIMEOUT_MS,
    ...options,
    maximumAge: 0,
  })
  const lowAccuracyPromise = getPositionOnce({
    enableHighAccuracy: false,
    timeout: LOW_ACCURACY_TIMEOUT_MS,
    ...options,
    maximumAge: 0,
  })

  return new Promise((resolve) => {
    let remaining = 2
    let denied = false
    let fallback: GeolocationResult | null = null
    let settled = false

    const finish = (result: GeolocationResult) => {
      if (settled) return
      remaining -= 1
      if (result.status === "success") {
        settled = true
        resolve(result)
        return
      }
      if (result.status === "permission-denied") denied = true
      fallback = fallback ?? result
      if (remaining === 0) {
        settled = true
        resolve(denied ? { status: "permission-denied" } : fallback!)
      }
    }

    void highAccuracyPromise.then(finish)
    void lowAccuracyPromise.then(finish)
  })
}
