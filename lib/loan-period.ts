/**
 * Single source of truth for the default suggested rental period.
 * Used app-wide when a book has no custom loan_period_days and when no
 * steward-configured default exists. Steward dashboard can override via app_config.
 */

/** Default suggested borrow period in days (2 months). Used when config is missing. */
export const DEFAULT_LOAN_PERIOD_DAYS = 60

/** Human-readable label for the default period (e.g. "2 months (60 days)"). */
export function formatDefaultLoanPeriod(days: number = DEFAULT_LOAN_PERIOD_DAYS): string {
  if (days === 60) return "2 months (60 days)"
  if (days === 30) return "1 month (30 days)"
  if (days >= 30 && days % 30 === 0) return `${days / 30} months (${days} days)`
  return `${days} days`
}

/** Clamp loan period to allowed range (1–365 days). */
export function clampLoanPeriodDays(value: number): number {
  return Math.max(1, Math.min(365, Math.round(value)))
}
