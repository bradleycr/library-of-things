import type { Book, LoanEvent, Node, User } from "@/lib/types"
import { DEFAULT_LOAN_PERIOD_DAYS } from "@/lib/loan-period"

export type AppConfig = {
  default_loan_period_days: number
}

export type BootstrapPayload = {
  books: Book[]
  loanEvents: LoanEvent[]
  nodes: Node[]
  users: User[]
  config: AppConfig
}

/**
 * Fetch the full app dataset from /api/bootstrap.
 * Only returns data on 200. On 503/500 we throw so the client keeps previous
 * data and retries, avoiding "profile then user not found" and "no books" flashes.
 */
export async function fetchBootstrapData(): Promise<BootstrapPayload> {
  const response = await fetch("/api/bootstrap", {
    cache: "no-store",
    credentials: "include",
    headers: { Pragma: "no-cache" },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch bootstrap data: ${response.status}`)
  }

  const body = await response.json()
  const rawConfig = body.config
  const config: AppConfig =
    rawConfig && typeof rawConfig.default_loan_period_days === "number" && rawConfig.default_loan_period_days >= 1 && rawConfig.default_loan_period_days <= 365
      ? { default_loan_period_days: Math.round(rawConfig.default_loan_period_days) }
      : { default_loan_period_days: DEFAULT_LOAN_PERIOD_DAYS }
  return {
    books: Array.isArray(body.books) ? body.books : [],
    loanEvents: Array.isArray(body.loanEvents) ? body.loanEvents : [],
    nodes: Array.isArray(body.nodes) ? body.nodes : [],
    users: Array.isArray(body.users) ? body.users : [],
    config,
  }
}
