import { NextResponse } from "next/server"
import {
  listBooks,
  listLoanEvents,
  listNodes,
  listUsers,
} from "@/lib/server/repositories"

/**
 * GET /api/bootstrap — fetch all app data in a single round-trip.
 * Resilient: returns whatever data succeeds even if one query fails,
 * so pages degrade gracefully instead of showing nothing.
 */
export async function GET() {
  try {
    const [books, loanEvents, nodes, users] = await Promise.all([
      listBooks().catch((err) => {
        console.error("Bootstrap: listBooks failed:", err.message)
        return []
      }),
      listLoanEvents().catch((err) => {
        console.error("Bootstrap: listLoanEvents failed:", err.message)
        return []
      }),
      listNodes().catch((err) => {
        console.error("Bootstrap: listNodes failed:", err.message)
        return []
      }),
      listUsers().catch((err) => {
        console.error("Bootstrap: listUsers failed:", err.message)
        return []
      }),
    ])

    return NextResponse.json({ books, loanEvents, nodes, users })
  } catch (error) {
    console.error("Bootstrap: unexpected error:", error)
    return NextResponse.json(
      { books: [], loanEvents: [], nodes: [], users: [] },
      { status: 500 }
    )
  }
}
