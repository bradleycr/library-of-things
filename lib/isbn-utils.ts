/**
 * ISBN normalization and validation for barcode scanner and form input.
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
 * - Does NOT validate check digits; use validateIsbnCheckDigit for that.
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
 * Validates the check digit of a normalized ISBN (10 or 13 digits).
 * Rejects misreads from the scanner (wrong digit → wrong check digit).
 * - EAN-13: weighted sum (1,3,1,3,...) mod 10 must be 0.
 * - ISBN-10: weighted sum (10,9,...,1) mod 11 must be 0; X = 10.
 */
export function validateIsbnCheckDigit(normalized: string): boolean {
  if (typeof normalized !== "string" || !normalized.length) return false
  const len = normalized.length
  if (len === 13) {
    let sum = 0
    for (let i = 0; i < 12; i++) {
      sum += parseInt(normalized[i]!, 10) * (i % 2 === 0 ? 1 : 3)
    }
    const check = (10 - (sum % 10)) % 10
    return check === parseInt(normalized[12]!, 10)
  }
  if (len === 10) {
    let sum = 0
    for (let i = 0; i < 9; i++) {
      sum += parseInt(normalized[i]!, 10) * (10 - i)
    }
    const last = normalized[9]!
    sum += last.toUpperCase() === "X" ? 10 : parseInt(last, 10)
    return sum % 11 === 0
  }
  return false
}

/**
 * For scanner use: 13-digit EAN must be Bookland (978/979) so we don't accept
 * random other barcodes (e.g. 07... product codes) that pass check digit.
 */
export function isBooklandEan13(normalized: string): boolean {
  if (typeof normalized !== "string" || normalized.length !== 13) return false
  const prefix = normalized.slice(0, 3)
  return prefix === "978" || prefix === "979"
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
