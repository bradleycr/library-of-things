/**
 * Planned end date for a temporary keycard.
 * The morning reminder fires on this calendar day in Europe/Berlin.
 */

import { formatStayDate, GUEST_PASS_TIME_ZONE } from "@/lib/guest-pass-email"

export const KEYCARD_STAY_MAX_DAYS = 180

/** YYYY-MM-DD in Berlin. */
export function berlinDayKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: GUEST_PASS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value)
}

export function addCalendarDays(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, "0")
  const d = String(next.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export type PlannedStay = {
  /** Noon-ish UTC so the Berlin calendar day does not shift. */
  until: Date
  dayKey: string
  label: string
  days: number
}

/**
 * Accept a date input (YYYY-MM-DD). Today through 180 days ahead, Berlin time.
 */
export function parsePlannedEndDate(raw: unknown, now = new Date()): PlannedStay | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const today = berlinDayKey(now)
  const latest = addCalendarDays(today, KEYCARD_STAY_MAX_DAYS)
  if (raw < today || raw > latest) return null
  const until = new Date(`${raw}T11:00:00.000Z`)
  if (Number.isNaN(until.getTime())) return null
  const days = Math.max(1, Math.round((until.getTime() - now.getTime()) / 86_400_000))
  return {
    until,
    dayKey: raw,
    label: formatStayDate(until),
    days,
  }
}
