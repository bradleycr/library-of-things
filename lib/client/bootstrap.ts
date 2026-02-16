import type { Book, LoanEvent, Node, User } from "@/lib/types"

export type BootstrapPayload = {
  books: Book[]
  loanEvents: LoanEvent[]
  nodes: Node[]
  users: User[]
}

/** Empty payload used as fallback when the API fails entirely. */
const EMPTY_PAYLOAD: BootstrapPayload = {
  books: [],
  loanEvents: [],
  nodes: [],
  users: [],
}

/**
 * Fetch the full app dataset from /api/bootstrap.
 * Returns whatever data the server provides; falls back to empty arrays
 * if the response is malformed or fields are missing.
 */
export async function fetchBootstrapData(): Promise<BootstrapPayload> {
  const response = await fetch("/api/bootstrap", { cache: "no-store" })

  if (!response.ok) {
    // Try to parse partial data from the error response body
    try {
      const body = await response.json()
      if (body && typeof body === "object") {
        return {
          books: Array.isArray(body.books) ? body.books : [],
          loanEvents: Array.isArray(body.loanEvents) ? body.loanEvents : [],
          nodes: Array.isArray(body.nodes) ? body.nodes : [],
          users: Array.isArray(body.users) ? body.users : [],
        }
      }
    } catch {
      // Body wasn't JSON
    }
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
