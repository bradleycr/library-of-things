/**
 * ISBN normalization for barcode scanner and form input.
 * Produces a canonical string (digits + optional trailing X for ISBN-10)
 * or null if the value doesn't look like a valid ISBN length.
 */

/** Max length we consider (server LIMITS.isbn is 20). */
const MAX_ISBN_LENGTH = 20

/**
 * Normalizes a raw barcode or typed string to a canonical ISBN form.
 * - Strips spaces, dashes, and other non-ISBN characters.
 * - Allows only digits and a trailing 'X' (ISBN-10 check digit).
 * - Returns null if the result is not exactly 10 or 13 characters.
 */
export function normalizeIsbn(raw: string): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed.length || trimmed.length > MAX_ISBN_LENGTH) return null

  const cleaned = trimmed.replace(/[\s-]/g, "").toUpperCase()
  if (cleaned.length === 10 && /^\d{9}[\dX]$/.test(cleaned)) return cleaned
  if (cleaned.length === 13 && /^\d{13}$/.test(cleaned)) return cleaned
  return null
}

/**
 * Convert a normalized ISBN-10 to ISBN-13 (978 prefix + 9 digits + EAN-13 check digit).
 * Returns null if input is not a valid 10-digit ISBN.
 */
export function isbn10To13(isbn10: string): string | null {
  const n = normalizeIsbn(isbn10)
  if (!n || n.length !== 10) return null
  const nine = n.replace(/X$/i, "9").slice(0, 9)
  const prefix = "978"
  const sum = (prefix + nine).split("").reduce(
    (acc, d, i) => acc + parseInt(d, 10) * (i % 2 === 0 ? 1 : 3),
    0,
  )
  const check = (10 - (sum % 10)) % 10
  return prefix + nine + String(check)
}
