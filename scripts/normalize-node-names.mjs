#!/usr/bin/env node
/**
 * One-time normalization: rename nodes to "Foresight Berlin Node" / "Foresight SF Node"
 * (no Flybrary), set Berlin address to Lothmenstraße 56, and make all books at a node
 * show the node name uniformly (current_node_name and current_location_text).
 *
 * Run with: node --env-file=.env.local scripts/normalize-node-names.mjs
 */

import { Pool } from "pg"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("DATABASE_URL missing. Set it before running.")
  process.exit(1)
}

const isLocal = /localhost|127\.0\.0\.1|::1/.test(connectionString)
const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

const BERLIN_ADDRESS = "Lothmenstraße 56, 12435 Berlin, Germany"

async function main() {
  const client = await pool.connect()
  try {
    // 1) Normalize node names and Berlin address
    const nodeRes = await client.query(
      `UPDATE nodes
       SET name = 'Foresight Berlin Node', location_address = $1
       WHERE (name ILIKE '%berlin%' OR location_address ILIKE '%berlin%' OR name ILIKE '%flybrary%')
         AND (name NOT ILIKE '%SF%' AND location_address NOT ILIKE '%Francisco%' AND location_address NOT ILIKE '%94110%')
       RETURNING id, name`,
      [BERLIN_ADDRESS]
    )
    if (nodeRes.rowCount > 0) {
      console.log(`Updated ${nodeRes.rowCount} node(s) to Foresight Berlin Node at ${BERLIN_ADDRESS}`)
    }

    const sfRes = await client.query(
      `UPDATE nodes
       SET name = 'Foresight SF Node'
       WHERE name ILIKE '%SF%' OR location_address ILIKE '%Francisco%' OR location_address ILIKE '%94110%'
       RETURNING id, name`
    )
    if (sfRes.rowCount > 0) {
      console.log(`Updated ${sfRes.rowCount} node(s) to Foresight SF Node`)
    }

    // 2) Make every book at a node use that node's name for display (uniform)
    const bookRes = await client.query(
      `UPDATE books b
       SET current_node_name = n.name, current_location_text = n.name
       FROM nodes n
       WHERE b.current_node_id = n.id
         AND (b.current_node_name IS DISTINCT FROM n.name OR b.current_location_text IS DISTINCT FROM n.name)
       RETURNING b.id`
    )
    if (bookRes.rowCount > 0) {
      console.log(`Normalized location display for ${bookRes.rowCount} book(s) to node name`)
    }

    console.log("Done.")
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
