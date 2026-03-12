/**
 * ISBN-based checkout/return — lookup and copy picker helpers.
 * Pure functions; no React. Used by isbn-checkout-return-dialog and book page.
 */

import type { Book } from "@/lib/types"
import { normalizeIsbn, isbn10To13 } from "@/lib/isbn-utils"

/**
 * Normalize book's ISBN and optionally convert to 13 for comparison.
 * Returns [norm10, norm13] where at least one is set (norm13 only if 10-digit input).
 */
function normalizedForms(isbn: string | null | undefined): { n10: string | null; n13: string | null } {
  const n = isbn ? normalizeIsbn(isbn) : null
  if (!n) return { n10: null, n13: null }
  if (n.length === 13) return { n10: null, n13: n }
  const n13 = isbn10To13(n)
  return { n10: n, n13: n13 }
}

/**
 * Find all books whose normalized ISBN matches the given normalized ISBN.
 * Matches ISBN-10 to ISBN-13 (978-prefix) so barcode and DB format can differ.
 * Uses client-side bootstrap book list; no API call.
 */
export function findBooksByIsbn(books: Book[], normalizedIsbn: string): Book[] {
  if (!normalizedIsbn || !books?.length) return []
  const scanForms = normalizedForms(normalizedIsbn)
  const scan13 = scanForms.n13 ?? (scanForms.n10 ? isbn10To13(scanForms.n10) : null)
  const scan10 = scanForms.n10

  return books.filter((b) => {
    const book = normalizedForms(b.isbn)
    if (book.n10 === null && book.n13 === null) return false
    if (scan13 && book.n13 && scan13 === book.n13) return true
    if (scan10 && book.n10 && scan10 === book.n10) return true
    if (scan13 && book.n10) {
      const book13 = isbn10To13(book.n10)
      if (book13 && book13 === scan13) return true
    }
    if (scan10 && book.n13) {
      const scanAs13 = isbn10To13(scan10)
      if (scanAs13 && scanAs13 === book.n13) return true
    }
    return false
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
