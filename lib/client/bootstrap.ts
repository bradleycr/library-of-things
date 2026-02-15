import type { Book, LoanEvent, Node, User } from "@/lib/types"

export type BootstrapPayload = {
  books: Book[]
  loanEvents: LoanEvent[]
  nodes: Node[]
  users: User[]
}

export async function fetchBootstrapData() {
  const response = await fetch("/api/bootstrap", {
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch bootstrap data: ${response.status}`)
  }
  return (await response.json()) as BootstrapPayload
}
