import { NextResponse } from "next/server"
import {
  listBooks,
  listLoanEvents,
  listNodes,
  listUsers,
} from "@/lib/server/repositories"

/** Cache-Control so browsers (e.g. Safari) don't cache a partial or error response. */
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
}

/**
 * GET /api/bootstrap — fetch all app data in a single round-trip.
 * Returns 200 only when all four queries succeed. If any query fails, returns 503
 * so the client does not overwrite good data with partial/empty payloads (which
 * caused profile to appear then disappear, and Safari to show "no books found").
 */
export async function GET() {
  try {
    const [booksResult, loanEventsResult, nodesResult, usersResult] = await Promise.allSettled([
      listBooks(),
      listLoanEvents(),
      listNodes(),
      listUsers(),
    ])

    const books = booksResult.status === "fulfilled" ? booksResult.value : null
    const loanEvents = loanEventsResult.status === "fulfilled" ? loanEventsResult.value : null
    const nodes = nodesResult.status === "fulfilled" ? nodesResult.value : null
    const users = usersResult.status === "fulfilled" ? usersResult.value : null

    const allOk = books != null && loanEvents != null && nodes != null && users != null
    if (!allOk) {
      if (booksResult.status === "rejected") console.error("Bootstrap: listBooks failed:", booksResult.reason?.message)
      if (loanEventsResult.status === "rejected") console.error("Bootstrap: listLoanEvents failed:", loanEventsResult.reason?.message)
      if (nodesResult.status === "rejected") console.error("Bootstrap: listNodes failed:", nodesResult.reason?.message)
      if (usersResult.status === "rejected") console.error("Bootstrap: listUsers failed:", usersResult.reason?.message)
      return NextResponse.json(
        { error: "Bootstrap partial failure" },
        { status: 503, headers: NO_STORE_HEADERS }
      )
    }

    return NextResponse.json(
      { books, loanEvents, nodes, users },
      { headers: NO_STORE_HEADERS }
    )
  } catch (error) {
    console.error("Bootstrap: unexpected error:", error)
    return NextResponse.json(
      { error: "Bootstrap failed" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
