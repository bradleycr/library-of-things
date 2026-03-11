/**
 * ISBN-based checkout/return — lookup and copy picker helpers.
 * Pure functions; no React. Used by isbn-checkout-return-dialog and book page.
 */

import type { Book } from "@/lib/types"
import { normalizeIsbn } from "@/lib/isbn-utils"

/**
 * Find all books whose normalized ISBN matches the given normalized ISBN.
 * Uses client-side bootstrap book list; no API call.
 */
export function findBooksByIsbn(books: Book[], normalizedIsbn: string): Book[] {
  if (!normalizedIsbn || !books?.length) return []
  return books.filter((b) => {
    const bookNorm = b.isbn ? normalizeIsbn(b.isbn) : null
    return bookNorm !== null && bookNorm === normalizedIsbn
  })
}

/**
 * Short label for a book copy in the picker (location, not full metadata).
 */
export function formatBookCopyLabel(book: Book): string {
  if (book.is_pocket_library) {
    const loc = book.current_location_text?.trim() || book.owner_contact_email || "Pocket Library"
    return loc
  }
  return book.current_node_name?.trim() || "Library node"
}
