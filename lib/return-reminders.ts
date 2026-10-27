/**
 * When a borrowed book should hear from the library.
 *
 * The calendar is Europe/Berlin, where the nodes are. A book is due on the
 * Berlin date of its expected return. The letter goes out that day, again
 * seven days later, and again thirty days later. If a day is missed, the
 * next morning still sends the stage that has come due, and only that one.
 */

export const RETURN_REMINDER_TIME_ZONE = "Europe/Berlin"

export const RETURN_COWORKING = {
  when: "every second Thursday",
  partner: "aisafety.berlin",
  url: "https://luma.com/AISafetyBerlin",
} as const

export type ReminderStage = "due" | "week" | "month"

const STAGE_ORDER: ReminderStage[] = ["due", "week", "month"]

/** YYYY-MM-DD in Berlin. */
export function berlinDay(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RETURN_REMINDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value)
}

/** Whole Berlin days since the due date. Negative means it is not due yet. */
export function daysPastDue(due: Date, now: Date): number {
  const dueMs = Date.parse(`${berlinDay(due)}T00:00:00Z`)
  const nowMs = Date.parse(`${berlinDay(now)}T00:00:00Z`)
  return Math.round((nowMs - dueMs) / 86_400_000)
}

/** The reminder a book has earned, or nothing if it is still within its loan. */
export function stageForDays(days: number): ReminderStage | null {
  if (days >= 30) return "month"
  if (days >= 7) return "week"
  if (days >= 0) return "due"
  return null
}

/** This stage and every earlier one, so a late first send does not stack three letters. */
export function stagesThrough(stage: ReminderStage): ReminderStage[] {
  return STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(stage) + 1)
}

export function laterStage(a: ReminderStage, b: ReminderStage): ReminderStage {
  return STAGE_ORDER.indexOf(a) >= STAGE_ORDER.indexOf(b) ? a : b
}

/** How late a book is, in the voice of the letter. */
export function lateLabel(days: number): string {
  if (days <= 0) return "due today"
  if (days === 1) return "1 day overdue"
  if (days === 7) return "a week overdue"
  if (days < 30) return `${days} days overdue`
  const months = Math.max(1, Math.round(days / 30))
  return months === 1 ? "about a month overdue" : `${months} months overdue`
}

/** "14 June 2026", in Berlin. */
export function formatDueDate(value: Date): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: RETURN_REMINDER_TIME_ZONE,
  }).format(value)
  return formatted.replace(/,/g, "")
}
