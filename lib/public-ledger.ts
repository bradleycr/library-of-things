/**
 * Public ledger must not include temporary keycards or other hidden operational items.
 * Guest emails are stored on those events for stewards; everyone else should not see them.
 */

import type { Book, LoanEvent } from "@/lib/types"

export function hiddenOperationalBookIds(books: Book[]): Set<string> {
  const ids = new Set<string>()
  for (const book of books) {
    if (book.catalog_visible === false || (book.item_type && book.item_type !== "book")) {
      ids.add(book.id)
    }
  }
  return ids
}

function isGuestOrKeycardEvent(event: LoanEvent): boolean {
  const meta = event.metadata
  if (!meta) return false
  if (meta.guest === true) return true
  return meta.item_type === "keycard"
}

/** Drop operational-item history (and the guest emails written onto it). */
export function publicLoanEvents(events: LoanEvent[], books: Book[]): LoanEvent[] {
  const hidden = hiddenOperationalBookIds(books)
  return events.filter((event) => {
    if (event.book_id && hidden.has(event.book_id)) return false
    if (isGuestOrKeycardEvent(event)) return false
    return true
  })
}
