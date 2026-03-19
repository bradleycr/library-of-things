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

/**
 * The app’s default is 60 days, and **21 days should not be used anywhere**.
 * Older deployments may have baked 21 into `books.lending_terms` and/or config.
 * We normalize it away to keep all copy + due dates aligned.
 */
export const LEGACY_BAKED_IN_LOAN_PERIOD_DAYS = 21

/** Clamp + normalize disallowed legacy value (21 → 60). */
export function normalizeLoanPeriodDays(value: number): number {
  const clamped = clampLoanPeriodDays(value)
  return clamped === LEGACY_BAKED_IN_LOAN_PERIOD_DAYS ? DEFAULT_LOAN_PERIOD_DAYS : clamped
}

/**
 * Effective borrow window for a book: steward/custom value when set, otherwise
 * library default, with legacy 21 → 60 normalization.
 */
export function resolveLoanPeriodDays(
  storedLoanPeriodDays: unknown,
  configDefault: number
): number {
  const fallback = normalizeLoanPeriodDays(configDefault)
  const raw =
    typeof storedLoanPeriodDays === "number"
      ? storedLoanPeriodDays
      : storedLoanPeriodDays != null && String(storedLoanPeriodDays).trim() !== ""
        ? Number(storedLoanPeriodDays)
        : NaN
  if (!Number.isFinite(raw) || raw < 1) return fallback
  const normalized = normalizeLoanPeriodDays(raw)
  return normalized
}
