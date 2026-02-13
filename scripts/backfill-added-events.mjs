/**
 * Inserts "added" ledger events for books that don't have one.
 * Use after deploying the "added" event feature so existing books (e.g. Susan Sontag)
 * show up in the sharing history.
 *
 * Usage: pnpm db:backfill-added-events
 * (requires DATABASE_URL in .env.local)
 */

import { Pool } from "pg"
import { randomUUID } from "crypto"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error("DATABASE_URL is missing. Set it in .env.local and run: pnpm db:backfill-added-events")
  process.exit(1)
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const client = await pool.connect()
  try {
    // Books that have no "added" event yet
    const { rows: booksWithoutAdded } = await client.query(`
      select b.id, b.title, b.created_at, b.current_node_id, b.added_by_user_id, b.added_by_display_name,
             n.steward_id, n.location_address, n.name as node_name
      from books b
      join nodes n on n.id = b.current_node_id
      left join loan_events le on le.book_id = b.id and le.event_type = 'added'
      where le.id is null
    `)

    if (booksWithoutAdded.length === 0) {
      console.log("No books missing an 'added' event. Nothing to do.")
      return
    }

    console.log(`Found ${booksWithoutAdded.length} book(s) missing an "added" ledger event.`)

    for (const book of booksWithoutAdded) {
      const userId = book.added_by_user_id ?? book.steward_id
      let displayName = book.added_by_display_name
      if (displayName == null) {
        const { rows: userRows } = await client.query(
          "select display_name from users where id = $1",
          [userId]
        )
        displayName = userRows[0]?.display_name ?? "—"
      }
      const locationText = book.location_address ?? book.node_name

      await client.query(
        `insert into loan_events
          (id, event_type, book_id, book_title, user_id, user_display_name, timestamp, location_text)
         values ($1, 'added', $2, $3, $4, $5, $6, $7)`,
        [
          randomUUID(),
          book.id,
          book.title,
          userId,
          displayName,
          book.created_at,
          locationText,
        ]
      )
      console.log(`  Added ledger event for: ${book.title}`)
    }

    console.log("Done. Sharing history now includes these books.")
  } catch (error) {
    console.error("Backfill failed:", error.message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

void main()
