/**
 * Shared helpers for steward “how long has this been out?” views.
 * Checkout/transfer timestamps come from the public ledger (newest first).
 */

import type { LoanEvent } from "@/lib/types"

/**
 * Newest checkout/transfer per book — when the current loan started.
 * Assumes `events` are sorted newest-first (bootstrap / listLoanEvents).
 */
export function buildLoanStartedAtByBookId(events: LoanEvent[]): Map<string, Date> {
  const started = new Map<string, Date>()
  for (const event of events) {
    if (!event.book_id) continue
    if (event.event_type !== "checkout" && event.event_type !== "transfer") continue
    if (started.has(event.book_id)) continue
    const at = new Date(event.timestamp)
    if (Number.isNaN(at.getTime())) continue
    started.set(event.book_id, at)
  }
  return started
}

export function formatCheckoutDateTime(at: Date): string {
  return at.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Human loan age: "2 hours", "5 days", "3 months". */
export function formatOutFor(since: Date, now = new Date()): string {
  const ms = Math.max(0, now.getTime() - since.getTime())
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return minutes <= 1 ? "1 minute" : `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return hours === 1 ? "1 hour" : `${hours} hours`
  const days = Math.floor(hours / 24)
  if (days < 60) return days === 1 ? "1 day" : `${days} days`
  const months = Math.floor(days / 30)
  return months === 1 ? "1 month" : `${months} months`
}

export function daysOut(since: Date, now = new Date()): number {
  return Math.floor(Math.max(0, now.getTime() - since.getTime()) / 86_400_000)
}

export function isPastExpectedReturn(expectedReturnDate: string | undefined | null, now = new Date()): boolean {
  if (!expectedReturnDate) return false
  const at = new Date(expectedReturnDate)
  if (Number.isNaN(at.getTime())) return false
  return at < now
}
