/**
 * One-off: Add user MaryFox42 and library card 9500 4552 8703 2510 / PIN 4220 to the DB.
 * Run: node --env-file=.env.local scripts/add-maryfox42.mjs
 */

import { Pool } from "pg"
import crypto from "crypto"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("DATABASE_URL missing. Use: node --env-file=.env.local scripts/add-maryfox42.mjs")
  process.exit(1)
}

function normalizePin(pin) {
  const digits = (pin ?? "").replace(/\D/g, "")
  return digits.slice(-4).padStart(4, "0")
}
function hashPin(pin) {
  return crypto.createHash("sha256").update(pin, "utf8").digest("hex")
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })

async function main() {
  const userId = crypto.randomUUID()
  const cardId = crypto.randomUUID()
  const cardNumber = "9500 4552 8703 2510"
  const pin = "4220"
  const pseudonym = "MaryFox42"
  const pinHash = hashPin(normalizePin(pin))

  await pool.query(
    `insert into users (id, display_name, auth_provider, trust_score, community_memberships, created_at)
     values ($1, $2, 'library_card', 50, '{}', now())`,
    [userId, pseudonym]
  )
  await pool.query(
    `insert into library_cards (id, card_number, pin_hash, user_id, pseudonym, created_at)
     values ($1, $2, $3, $4, $5, now())`,
    [cardId, cardNumber, pinHash, userId, pseudonym]
  )

  console.log("Added MaryFox42 to database.")
  console.log("Card number:", cardNumber)
  console.log("PIN: 4220")
  console.log("Clear localStorage, then log in with these credentials.")
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
