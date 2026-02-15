/**
 * Ensures loan_events.event_type check constraint allows 'added'.
 * Run once if backfill-added-events fails with "violates check constraint".
 *
 * Usage: node --env-file=.env.local scripts/fix-loan-events-constraint.mjs
 */

import { Pool } from "pg"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("DATABASE_URL is missing.")
  process.exit(1)
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const client = await pool.connect()
  try {
    const { rows } = await client.query(`
      select conname from pg_constraint
      where conrelid = 'loan_events'::regclass and contype = 'c'
    `)
    for (const { conname } of rows) {
      await client.query(`alter table loan_events drop constraint if exists "${conname}"`)
      console.log("Dropped constraint:", conname)
    }
    await client.query(`
      alter table loan_events add constraint loan_events_event_type_check
        check (event_type in ('added','checkout','return','transfer','report_lost','report_damaged'))
    `)
    console.log("Added loan_events_event_type_check with 'added' allowed.")
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

void main()
