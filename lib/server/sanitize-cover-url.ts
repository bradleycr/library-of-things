import "server-only"

/**
 * Accept data-URI photos (up to ~500 KB base64) or https/http URLs (up to 2048 chars).
 * Rejects javascript:, data:text/html, etc. Use for both create and PATCH book cover.
 */
export function sanitizeCoverUrl(raw: string): string {
  const v = raw.trim()
  if (v.startsWith("data:image/")) {
    const MAX_DATA_URI = 512_000
    return v.length <= MAX_DATA_URI ? v : ""
  }
  if (/^https?:\/\//i.test(v)) {
    return v.slice(0, 2048)
  }
  return ""
}
