import "server-only"

import { timingSafeEqual } from "crypto"
import type { Book } from "@/lib/types"

/**
 * Physical tags carry the opaque token embedded in `checkout_url`. Comparing
 * it server-side proves that the visitor opened the URL from the tag/QR rather
 * than discovering an item's UUID in public data.
 */
export function itemTokenMatches(item: Book, candidate: string | null | undefined): boolean {
  if (!candidate) return false
  try {
    const query = item.checkout_url.split("?")[1]
    const stored = query ? new URLSearchParams(query).get("token") : null
    if (!stored) return false
    const left = Buffer.from(stored)
    const right = Buffer.from(candidate)
    return left.length === right.length && timingSafeEqual(left, right)
  } catch {
    return false
  }
}
