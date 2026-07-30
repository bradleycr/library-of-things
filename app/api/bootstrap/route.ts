import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  listBooks,
  listLoanEvents,
  listNodes,
  listUsers,
  getAppConfig,
} from "@/lib/server/repositories"
import { getStewardCookieName, verifyStewardToken } from "@/lib/server/steward-auth"
import { DEFAULT_LOAN_PERIOD_DAYS } from "@/lib/loan-period"
import type { Book } from "@/lib/types"
import { isAppleWalletConfigured } from "@/lib/server/apple-wallet-pass"
import { getSessionUserId } from "@/lib/server/session"
import type { User } from "@/lib/types"

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
    const [booksResult, loanEventsResult, nodesResult, usersResult, configResult] = await Promise.allSettled([
      listBooks(),
      listLoanEvents(),
      listNodes(),
      listUsers(),
      getAppConfig(),
    ])

    const books = booksResult.status === "fulfilled" ? booksResult.value : null
    const loanEvents = loanEventsResult.status === "fulfilled" ? loanEventsResult.value : null
    const nodes = nodesResult.status === "fulfilled" ? nodesResult.value : null
    const users = usersResult.status === "fulfilled" ? usersResult.value : null
    const config = configResult.status === "fulfilled" ? configResult.value : null

    const allOk = books != null && loanEvents != null && nodes != null && users != null && config != null
    if (!allOk) {
      if (booksResult.status === "rejected") console.error("Bootstrap: listBooks failed:", booksResult.reason?.message)
      if (loanEventsResult.status === "rejected") console.error("Bootstrap: listLoanEvents failed:", loanEventsResult.reason?.message)
      if (nodesResult.status === "rejected") console.error("Bootstrap: listNodes failed:", nodesResult.reason?.message)
      if (usersResult.status === "rejected") console.error("Bootstrap: listUsers failed:", usersResult.reason?.message)
      if (configResult.status === "rejected") console.error("Bootstrap: getAppConfig failed:", configResult.reason?.message)
      return NextResponse.json(
        { error: "Bootstrap partial failure" },
        { status: 503, headers: NO_STORE_HEADERS }
      )
    }

    // Public requests: do not expose added_by_user_id for anonymously-added books.
    // Steward (dashboard) requests get full book data so they can see who added what.
    const cookieStore = await cookies()
    const stewardCookie = cookieStore.get(getStewardCookieName())?.value
    const isSteward = !!stewardCookie && verifyStewardToken(stewardCookie)
    const sessionUserId = await getSessionUserId()
    const booksForClient: Book[] = isSteward
      ? books
      : books
          .filter((book) => book.catalog_visible !== false)
          .map((b) =>
            b.added_by_display_name === "Anonymous"
              ? { ...b, added_by_user_id: undefined }
              : b
          )

    // Contact data supports borrowing but is not public directory data. Only a
    // steward and the signed-in member receive the private fields.
    const usersForClient: User[] = users.map((user) => {
      if (isSteward || user.id === sessionUserId) return user
      const {
        email: _email,
        real_name: _realName,
        ...publicUser
      } = user
      if (user.contact_opt_in) return publicUser
      const {
        contact_email: _contactEmail,
        phone: _phone,
        twitter_url: _twitter,
        linkedin_url: _linkedin,
        website_url: _website,
        ...privateContactRemoved
      } = publicUser
      return privateContactRemoved
    })

    return NextResponse.json(
      {
        books: booksForClient,
        loanEvents,
        nodes,
        users: usersForClient,
        config: {
          ...(config ?? { default_loan_period_days: DEFAULT_LOAN_PERIOD_DAYS }),
          apple_wallet_available: isAppleWalletConfigured(),
        },
      },
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
