/**
 * Sharing history is public on purpose. Guest email addresses are not.
 *
 * Keycard checkouts used to be dropped from the ledger entirely, because the
 * holder column was the guest's email. The history stays. The address does not.
 * Stewards still read the live address from the keycard panel, which is not
 * this ledger.
 */

import type { Book, LoanEvent } from "@/lib/types"

const EMAIL_IN_TEXT = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

/** Metadata keys that exist for stewards and must never reach a public client. */
const PRIVATE_META_KEYS = new Set([
  "borrower_email",
  "borrower_name",
  "guest_email",
  "holder_email",
  "email",
])

export function isOperationalItem(book: Pick<Book, "catalog_visible" | "item_type"> | undefined): boolean {
  if (!book) return false
  if (book.catalog_visible === false) return true
  return Boolean(book.item_type && book.item_type !== "book")
}

function bookById(books: Book[]): Map<string, Book> {
  return new Map(books.map((book) => [book.id, book]))
}

function isGuestHistory(event: LoanEvent, books: Map<string, Book>): boolean {
  const meta = event.metadata
  if (meta?.guest === true) return true
  if (meta?.item_type === "keycard" || meta?.item_type === "other") return true
  if (!event.book_id) return false
  return isOperationalItem(books.get(event.book_id))
}

/** A ledger name safe to print. Emails never pass through. */
export function ledgerPublicName(event: Pick<LoanEvent, "user_display_name" | "user_id">): string {
  const name = event.user_display_name?.trim()
  if (!name || name.includes("@")) return event.user_id ? "Member" : "Guest"
  return name
}

/** Notes stay, but any address typed into them is removed. */
export function scrubPublicNote(note: string | null | undefined): string | undefined {
  if (!note) return undefined
  const cleaned = note.replace(EMAIL_IN_TEXT, "").replace(/\s{2,}/g, " ").trim()
  return cleaned || undefined
}

function scrubMetadata(meta: LoanEvent["metadata"]): LoanEvent["metadata"] {
  if (!meta) return meta
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (PRIVATE_META_KEYS.has(key.toLowerCase())) continue
    if (typeof value === "string" && value.includes("@")) continue
    next[key] = value
  }
  return next
}

export function redactPublicLoanEvent(event: LoanEvent, books: Map<string, Book>): LoanEvent {
  const guestHistory = isGuestHistory(event, books)
  const rawName = event.user_display_name?.trim()
  const keepSteward = rawName === "Steward"
  const user_display_name = guestHistory && !keepSteward ? "Guest" : ledgerPublicName(event)

  return {
    ...event,
    user_display_name,
    notes: scrubPublicNote(event.notes),
    metadata: scrubMetadata(event.metadata),
  }
}

/**
 * Public ledger rows. Operational cards are included so the node can see that
 * a pass went out and came back. The person holding it is "Guest".
 */
export function publicLoanEvents(events: LoanEvent[], books: Book[]): LoanEvent[] {
  const index = bookById(books)
  return events.map((event) => redactPublicLoanEvent(event, index))
}

/** Holder labels on a public book card. A raw address becomes "Guest". */
export function redactPublicHolderName(name: string | null | undefined): string | undefined {
  const trimmed = name?.trim()
  if (!trimmed) return undefined
  if (trimmed.includes("@")) return "Guest"
  return trimmed
}
