import type { Book, LoanEvent, Node, User } from "@/lib/types"

export type BootstrapPayload = {
  books: Book[]
  loanEvents: LoanEvent[]
  nodes: Node[]
  users: User[]
}

/**
 * Fetch the full app dataset from /api/bootstrap.
 * Only returns data on 200. On 503/500 we throw so the client keeps previous
 * data and retries, avoiding "profile then user not found" and "no books" flashes.
 */
export async function fetchBootstrapData(): Promise<BootstrapPayload> {
  const response = await fetch("/api/bootstrap", {
    cache: "no-store",
    headers: { Pragma: "no-cache" },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch bootstrap data: ${response.status}`)
  }

  const body = await response.json()
  return {
    books: Array.isArray(body.books) ? body.books : [],
    loanEvents: Array.isArray(body.loanEvents) ? body.loanEvents : [],
    nodes: Array.isArray(body.nodes) ? body.nodes : [],
    users: Array.isArray(body.users) ? body.users : [],
  }
}
