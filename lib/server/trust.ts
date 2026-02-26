/**
 * Trust score system: lightweight, event-driven social credit.
 * All scores start at 50; changes are applied at key actions and recorded
 * in trust_events for transparency (breakdown on hover/click).
 */

import type { PoolClient } from "pg"

/** Bounds and default — everyone starts here. */
export const TRUST = {
  INITIAL: 50,
  MIN: 0,
  MAX: 100,
  /** Returned on or before suggested date (default 60 days). */
  DELTA_RETURN_ON_TIME: 2,
  /** Returned late but within 2 months of checkout. */
  DELTA_RETURN_LATE: -3,
  /** Returned 60+ days after checkout — substantial penalty. */
  DELTA_RETURN_VERY_LATE: -12,
  /** Added a book to the library. */
  DELTA_ADD_BOOK: 5,
} as const

/** Reason codes stored in trust_events; used for display and idempotency. */
export type TrustReason =
  | "return_on_time"
  | "return_late"
  | "return_very_late"
  | "add_book"

/**
 * Applies a trust change inside an existing transaction. Updates users.trust_score
 * and inserts a trust_event row for the breakdown UI. Call from returnBook/createBook
 * with the same client so it commits or rolls back together.
 */
export async function applyTrustChange(
  client: PoolClient,
  params: {
    userId: string
    reason: TrustReason
    delta: number
    bookId?: string | null
    bookTitle?: string | null
  }
): Promise<number> {
  const { userId, reason, delta, bookId, bookTitle } = params

  const {
    rows: [userRow],
  } = await client.query<{ trust_score: number }>(
    "select trust_score from users where id = $1 for update",
    [userId]
  )
  if (!userRow) return TRUST.INITIAL

  const current = userRow.trust_score
  const next = Math.max(TRUST.MIN, Math.min(TRUST.MAX, current + delta))

  await client.query(
    "update users set trust_score = $2 where id = $1",
    [userId, next]
  )

  await client.query(
    `insert into trust_events (id, user_id, reason, delta, score_after, book_id, book_title, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())`,
    [
      crypto.randomUUID(),
      userId,
      reason,
      delta,
      next,
      bookId ?? null,
      bookTitle ?? null,
    ]
  )

  return next
}

/**
 * Classifies a return as on-time, late, or very late based on expected return date.
 * Suggested period is 60 days (2 months); "very late" = 60+ days after expected return date.
 */
export function classifyReturn(
  expectedReturnDate: string | Date | null | undefined
): TrustReason {
  if (!expectedReturnDate) return "return_on_time"
  const expected = new Date(expectedReturnDate).getTime()
  const now = Date.now()
  const msLate = now - expected
  const daysLate = msLate / (24 * 60 * 60 * 1000)
  if (daysLate <= 0) return "return_on_time"
  if (daysLate >= 60) return "return_very_late"
  return "return_late"
}

/** Delta for a given reason (for use when applying). */
export function getDeltaForReason(reason: TrustReason): number {
  switch (reason) {
    case "return_on_time":
      return TRUST.DELTA_RETURN_ON_TIME
    case "return_late":
      return TRUST.DELTA_RETURN_LATE
    case "return_very_late":
      return TRUST.DELTA_RETURN_VERY_LATE
    case "add_book":
      return TRUST.DELTA_ADD_BOOK
    default:
      return 0
  }
}
