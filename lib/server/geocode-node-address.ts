import "server-only"

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"

type NominatimResult = {
  lat?: string
  lon?: string
}

/**
 * Resolve a human-readable address into coordinates for map links and
 * distance-based node features. Returns null when the address cannot be
 * geocoded so node creation can still succeed with an address-only fallback.
 */
export async function geocodeNodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const trimmedAddress = address.trim()
  if (!trimmedAddress) return null

  const url = new URL(NOMINATIM_SEARCH_URL)
  url.searchParams.set("q", trimmedAddress)
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("limit", "1")

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "LibraryOfThings/1.0 (node geocoding)",
      },
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
    if (!response.ok) return null

    const results = (await response.json()) as NominatimResult[]
    const first = results[0]
    if (!first) return null

    const lat = Number.parseFloat(first.lat ?? "")
    const lng = Number.parseFloat(first.lon ?? "")

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null
    }

    return { lat, lng }
  } catch (error) {
    console.error("Node geocoding failed:", error)
    return null
  }
}
