/** Shared email helpers for checkout / profile contact. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase()
}

export function isValidEmail(raw: string | null | undefined): boolean {
  const email = normalizeEmail(raw)
  return email.length > 0 && email.length <= 320 && EMAIL_RE.test(email)
}

/** True when both fields are valid and identical (case-insensitive). */
export function emailsMatch(a: string, b: string): boolean {
  if (!isValidEmail(a) || !isValidEmail(b)) return false
  return normalizeEmail(a) === normalizeEmail(b)
}
