import "server-only"

/**
 * Absolute origin for links we email. Production links must not point at a
 * preview deployment, or the guest confirms against the wrong host.
 */
export function appOrigin(headers?: Headers): string {
  const configured = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, "")

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (production) return `https://${production.replace(/^https?:\/\//, "")}`

  const host = headers?.get("x-forwarded-host") ?? headers?.get("host")
  if (host) {
    const forwarded = headers?.get("x-forwarded-proto")
    const proto = forwarded ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")
    return `${proto}://${host}`
  }

  return "https://libraryofthings.vercel.app"
}
