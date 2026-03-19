#!/usr/bin/env node
/**
 * API smoke test — checkout → return → ledger + DB verification.
 *
 * Prerequisites:
 *   - Next.js app running (default http://127.0.0.1:3000), e.g. `pnpm dev`
 *   - Same DATABASE_URL as the app if you want SQL cross-checks (via --env-file)
 *
 * Usage:
 *   pnpm test:api-smoke
 *   BASE_URL=http://localhost:3000 pnpm test:api-smoke
 *
 * Exits 0 on success, 1 on failure.
 */

import { Pool } from "pg"

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "")

function fail(msg) {
  console.error(`\x1b[31m✖\x1b[0m ${msg}`)
  process.exit(1)
}

function ok(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`)
}

/** @param {Response} res */
function extractSessionCookiePair(res) {
  if (typeof res.headers.getSetCookie === "function") {
    const list = res.headers.getSetCookie()
    const line = list.find((c) => c.startsWith("lot_session="))
    if (line) return line.split(";")[0].trim()
  }
  const raw = res.headers.get("set-cookie")
  if (!raw) return null
  const m = raw.match(/lot_session=[^;]+/)
  return m ? m[0] : null
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { _raw: text }
  }
  return { res, body }
}

async function main() {
  console.log(`API smoke test → ${BASE}\n`)

  // --- Bootstrap: pick a book we can borrow ---
  const boot1 = await fetchJson(`${BASE}/api/bootstrap`)
  if (!boot1.res.ok) {
    fail(
      `GET /api/bootstrap failed (${boot1.res.status}). Is the dev server running? (${BASE})`,
    )
  }
  const { books, nodes, loanEvents: eventsBefore } = boot1.body
  if (!Array.isArray(books) || !Array.isArray(nodes)) {
    fail("Bootstrap payload missing books or nodes")
  }
  const nodeId = nodes[0]?.id
  if (!nodeId) fail("No nodes in database — add a node before running this test")

  const available = books.find(
    (b) =>
      b.availability_status === "available" &&
      !(b.lending_terms && b.lending_terms.contact_required === true),
  )
  if (!available) {
    fail(
      "No available book without contact_required — free one in the DB or use a book with contact_optional",
    )
  }

  ok(`Using book "${available.title}" (${available.id}) and node ${nodeId}`)

  // --- New library card (sets lot_session cookie) ---
  const gen = await fetch(`${BASE}/api/library-card/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: "{}",
  })
  const cookiePair = extractSessionCookiePair(gen)
  const genBody = await gen.json().catch(() => ({}))
  if (!gen.ok || !genBody.success || !genBody.card?.user_id || !cookiePair) {
    fail(
      `POST /api/library-card/generate failed (${gen.status}): ${JSON.stringify(genBody)}`,
    )
  }
  const userId = genBody.card.user_id
  ok(`New test user ${userId} (session cookie present)`)

  const cookieHeader = { Cookie: cookiePair }

  // --- Checkout ---
  const co = await fetchJson(`${BASE}/api/books/checkout`, {
    method: "POST",
    headers: { ...cookieHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ book_id: available.id, user_id: userId }),
  })
  if (!co.res.ok) {
    fail(`POST /api/books/checkout failed (${co.res.status}): ${JSON.stringify(co.body)}`)
  }
  ok("POST /api/books/checkout → success")

  // --- Tap API (token from checkout_url) ---
  let checkoutPath = available.checkout_url
  if (!checkoutPath.startsWith("/")) checkoutPath = `/${checkoutPath}`
  const tapUrl = new URL(checkoutPath, "http://local.invalid")
  const token = tapUrl.searchParams.get("token")
  if (!token) fail("Book has no token in checkout_url — cannot test tap endpoint")
  const tap = await fetchJson(
    `${BASE}/api/books/${available.id}/tap?token=${encodeURIComponent(token)}`,
  )
  if (!tap.res.ok) {
    fail(`GET /api/books/[id]/tap failed (${tap.res.status}): ${JSON.stringify(tap.body)}`)
  }
  if (!tap.body.book || !Array.isArray(tap.body.nodes)) {
    fail("Tap response missing book or nodes")
  }
  ok("GET /api/books/[id]/tap → valid token, book + nodes")

  const note = `api-smoke ${new Date().toISOString()}`

  // --- Return ---
  const ret = await fetchJson(`${BASE}/api/books/return`, {
    method: "POST",
    headers: { ...cookieHeader, "Content-Type": "application/json" },
    body: JSON.stringify({
      book_id: available.id,
      user_id: userId,
      return_node_id: nodeId,
      notes: note,
    }),
  })
  if (!ret.res.ok) {
    fail(`POST /api/books/return failed (${ret.res.status}): ${JSON.stringify(ret.body)}`)
  }
  ok("POST /api/books/return → success")

  // --- Bootstrap: book available again ---
  const boot2 = await fetchJson(`${BASE}/api/bootstrap`)
  if (!boot2.res.ok) fail(`Second bootstrap failed (${boot2.res.status})`)
  const bookAfter = boot2.body.books?.find((b) => b.id === available.id)
  if (!bookAfter) fail("Book missing after return")
  if (bookAfter.availability_status !== "available" || bookAfter.current_holder_id != null) {
    fail(
      `Book state after return unexpected: status=${bookAfter.availability_status} holder=${bookAfter.current_holder_id}`,
    )
  }
  ok("Bootstrap confirms book is available and unassigned")

  const eventsAfter = boot2.body.loanEvents ?? []
  const newReturns = eventsAfter.filter(
    (e) =>
      e.event_type === "return" &&
      e.book_id === available.id &&
      e.user_id === userId &&
      (e.notes === note || (e.notes && e.notes.includes("api-smoke"))),
  )
  if (newReturns.length < 1) {
    console.warn(
      "Warning: could not find new return event in bootstrap loanEvents (timing or filter). Checking DB…",
    )
  } else {
    ok(`Ledger (bootstrap) includes return event for this user with smoke note`)
  }

  // --- Optional SQL verification ---
  const cs = process.env.DATABASE_URL
  if (cs) {
    const isLocal = /localhost|127\.0\.0\.1|::1/.test(cs)
    const pool = new Pool({
      connectionString: cs,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    })
    try {
      const { rows } = await pool.query(
        `select event_type, notes, user_id::text as uid
         from loan_events
         where book_id = $1
         order by timestamp desc
         limit 5`,
        [available.id],
      )
      const top = rows[0]
      if (!top || top.event_type !== "return") {
        fail(`DB: expected latest loan_event for book to be return, got ${JSON.stringify(top)}`)
      }
      if (String(top.uid) !== userId) {
        fail(`DB: return event user_id mismatch: ${top.uid} vs ${userId}`)
      }
      ok(`DB loan_events: latest row is return for test user (notes: ${top.notes?.slice(0, 40)}…)`)

      const { rows: bRows } = await pool.query(
        `select availability_status, current_holder_id::text as hid
         from books where id = $1`,
        [available.id],
      )
      const br = bRows[0]
      if (br.availability_status !== "available" || br.hid != null) {
        fail(`DB books row not updated: ${JSON.stringify(br)}`)
      }
      ok("DB books: available, holder cleared")
    } finally {
      await pool.end()
    }
  } else {
    console.log("(Skip SQL checks: DATABASE_URL unset in this process)")
  }

  const checkoutCount = eventsAfter.filter(
    (e) => e.event_type === "checkout" && e.book_id === available.id && e.user_id === userId,
  ).length
  if (checkoutCount < 1) {
    console.warn("Could not confirm checkout event in bootstrap for this user (non-fatal)")
  } else {
    ok("Bootstrap includes checkout event for this user")
  }

  console.log(`\n\x1b[32mAll checks passed.\x1b[0m (events in ledger before: ${eventsBefore?.length ?? "?"})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
