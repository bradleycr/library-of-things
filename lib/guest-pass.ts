/**
 * Guest passes are for people visiting a node, not for joining the library.
 * A library card is a membership. A keycard is a stay. Email confirmation is
 * the only gate, and it lives here so the form and the server agree.
 */

export const GUEST_NAME_MAX = 80

export function guestPassCardLabel(item: { title: string; asset_number?: number | null }): string {
  if (item.asset_number != null && Number.isFinite(Number(item.asset_number))) {
    return `Keycard #${item.asset_number}`
  }
  return item.title.replace(/^Temporary\s+/i, "").trim() || "Keycard"
}

/** A person's name as they typed it. Not an email, not markup. */
export function isPlausibleGuestName(raw: string | null | undefined): boolean {
  const name = raw?.trim() ?? ""
  if (name.length < 1 || name.length > GUEST_NAME_MAX) return false
  if (name.includes("@") || /[<>]/.test(name)) return false
  return true
}

export function normalizeGuestName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, GUEST_NAME_MAX)
}

/** Enough of an address to recognise an inbox, not enough to copy it off a screen. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!local || !domain) return "your email"
  return `${local.slice(0, 1)}•••@${domain}`
}
