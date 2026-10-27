import "server-only"

/**
 * Library cards are reached through an inbox.
 *
 * A new address gets a confirm link first — the card does not exist until
 * that link is opened. An address we already verified gets the card number
 * and a new PIN in one email. The old PIN stops working. The plaintext PIN
 * sits on the one-time link only until it is used or it expires.
 */

import { createHash, randomBytes, randomInt } from "crypto"
import { isValidEmail, normalizeEmail } from "@/lib/email"
import { maskEmail } from "@/lib/guest-pass"
import { renderConfirmAddressEmail, renderLibraryCardEmail } from "@/lib/library-card-email"
import { resilientConnect, resilientQuery } from "@/lib/server/db"
import { guestPassReplyTo, sendMail } from "@/lib/server/mail"
import {
  createUserAndLibraryCard,
  hashPin,
  normalizePinForAuth,
} from "@/lib/server/repositories"

const ADJECTIVES = [
  "Clever", "Bright", "Swift", "Curious", "Wandering", "Bold", "Gentle",
  "Keen", "Noble", "Wise", "Calm", "Merry", "Lucky", "Steady", "Quiet",
]

const ANIMALS = [
  "Raven", "Fox", "Owl", "Deer", "Hawk", "Wolf", "Bear", "Hare", "Wren",
  "Lynx", "Otter", "Crane", "Robin", "Finch", "Badger",
]

type Purpose = "signup" | "verify" | "deliver"

type AccountRow = {
  id: string
  display_name: string
  email: string | null
  contact_email: string | null
  email_verified_at: Date | string | null
}

type ChallengeRow = {
  id: string
  email: string
  display_name: string | null
  purpose: Purpose
  user_id: string | null
  card_number: string | null
  delivery_pin: string | null
  expires_at: Date | string
  consumed_at: Date | string | null
}

export type IssuedCard = {
  id: string
  card_number: string
  pin: string
  pseudonym: string
  user_id: string
  created_at: string
}

export type CardEmailRequest =
  | { ok: true; devUrl?: string }
  | { ok: false; reason: "invalid_email" | "ambiguous" | "mail" | "no_card" }

function generatePseudonym(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  const num = Math.floor(Math.random() * 100)
  return `${adj}${animal}${num}`
}

function generateCardNumber(): string {
  const segments = []
  for (let i = 0; i < 4; i++) {
    segments.push(randomInt(0, 10000).toString().padStart(4, "0"))
  }
  return segments.join(" ")
}

function generatePin(): string {
  return randomInt(0, 10000).toString().padStart(4, "0")
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function cleanName(raw: string | null | undefined): string | null {
  const name = (raw ?? "").trim().replace(/\s+/g, " ").slice(0, 80)
  if (!name || name.includes("@") || /[<>]/.test(name)) return null
  return name
}

/** Where the member types the card. Production login already understands card + PIN. */
export function memberSiteOrigin(): string {
  const configured = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, "")
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (production) return `https://${production.replace(/^https?:\/\//, "")}`
  return "https://libraryofthings.vercel.app"
}

function logoUrl(): string {
  return `${memberSiteOrigin()}/foresight-logo.png`
}

function privacyUrl(origin: string): string {
  return `${origin}/privacy`
}

function constraintText(err: unknown): string {
  if (!err || typeof err !== "object") return ""
  const row = err as { constraint?: string; detail?: string; message?: string }
  return `${row.constraint ?? ""} ${row.detail ?? ""} ${row.message ?? ""}`
}

async function findAccounts(email: string): Promise<AccountRow[]> {
  const { rows } = await resilientQuery<AccountRow>(
    `select id, display_name, email, contact_email, email_verified_at
     from users
     where lower(email) = $1 or lower(contact_email) = $1
     order by email_verified_at desc nulls last, created_at asc`,
    [email]
  )
  return rows
}

async function retireOpenChallenges(email: string): Promise<void> {
  await resilientQuery(
    `update library_card_challenges
        set delivery_pin = null,
            consumed_at = coalesce(consumed_at, now())
      where lower(email) = $1
        and consumed_at is null`,
    [email]
  )
}

async function insertChallenge(input: {
  email: string
  displayName: string | null
  purpose: Purpose
  userId: string | null
  cardNumber: string | null
  deliveryPin: string | null
}): Promise<{ id: string; token: string }> {
  const id = crypto.randomUUID()
  const token = randomBytes(32).toString("base64url")
  await resilientQuery(
    `insert into library_card_challenges
       (id, email, display_name, purpose, user_id, token_hash, card_number, delivery_pin, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now() + interval '24 hours')`,
    [
      id,
      input.email,
      input.displayName,
      input.purpose,
      input.userId,
      hashToken(token),
      input.cardNumber,
      input.deliveryPin,
    ]
  )
  return { id, token }
}

async function deleteChallenge(id: string): Promise<void> {
  await resilientQuery(
    `delete from library_card_challenges where id = $1`,
    [id]
  )
}

/**
 * Point the kept card at a new PIN. Returns the previous hash so a failed
 * email can put the old PIN back. Extra cards on the same account are dropped.
 */
async function rotateKeptCard(userId: string, pin: string): Promise<{
  cardId: string
  cardNumber: string
  pseudonym: string
  previousHash: string
} | null> {
  const client = await resilientConnect()
  try {
    await client.query("begin")
    const { rows } = await client.query<{
      id: string
      card_number: string
      pseudonym: string
      pin_hash: string
    }>(
      `select id, card_number, pseudonym, pin_hash
         from library_cards
        where user_id = $1
        order by created_at asc
        for update`,
      [userId]
    )
    if (!rows.length) {
      await client.query("rollback")
      return null
    }
    const keep = rows[0]
    await client.query(`update library_cards set pin_hash = $1 where id = $2`, [
      hashPin(normalizePinForAuth(pin)),
      keep.id,
    ])
    if (rows.length > 1) {
      await client.query(`delete from library_cards where user_id = $1 and id <> $2`, [
        userId,
        keep.id,
      ])
    }
    await client.query("commit")
    return {
      cardId: keep.id,
      cardNumber: keep.card_number,
      pseudonym: keep.pseudonym,
      previousHash: keep.pin_hash,
    }
  } catch (error) {
    await client.query("rollback").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function restorePin(cardId: string, pinHash: string): Promise<void> {
  await resilientQuery(`update library_cards set pin_hash = $1 where id = $2`, [pinHash, cardId])
}

async function sendCardLetter(input: {
  to: string
  userId: string
  cardNumber: string
  pin: string
  origin: string
}): Promise<boolean> {
  const link = await insertChallenge({
    email: input.to,
    displayName: null,
    purpose: "deliver",
    userId: input.userId,
    cardNumber: input.cardNumber,
    deliveryPin: input.pin,
  })
  const letter = renderLibraryCardEmail({
    cardNumber: input.cardNumber,
    pin: input.pin,
    loginUrl: `${memberSiteOrigin()}/settings?mode=login`,
    saveUrl: `${input.origin}/library-card/open?token=${encodeURIComponent(link.token)}`,
    logoUrl: logoUrl(),
    privacyUrl: privacyUrl(input.origin),
  })
  const sent = await sendMail({
    to: input.to,
    replyTo: guestPassReplyTo(),
    subject: letter.subject,
    text: letter.text,
    html: letter.html,
    idempotencyKey: `library-card/${link.id}`,
  })
  if (!sent.sent) {
    await deleteChallenge(link.id)
    return false
  }
  return true
}

async function sendConfirmLetter(input: {
  to: string
  kind: "signup" | "verify"
  displayName: string | null
  userId: string | null
  origin: string
}): Promise<{ ok: true; devUrl: string } | { ok: false }> {
  const link = await insertChallenge({
    email: input.to,
    displayName: input.displayName,
    purpose: input.kind,
    userId: input.userId,
    cardNumber: null,
    deliveryPin: null,
  })
  const confirmUrl = `${input.origin}/library-card/open?token=${encodeURIComponent(link.token)}`
  const letter = renderConfirmAddressEmail({
    kind: input.kind,
    confirmUrl,
    logoUrl: logoUrl(),
    privacyUrl: privacyUrl(input.origin),
  })
  const sent = await sendMail({
    to: input.to,
    replyTo: guestPassReplyTo(),
    subject: letter.subject,
    text: letter.text,
    html: letter.html,
    idempotencyKey: `library-card-confirm/${link.id}`,
  })
  if (!sent.sent) {
    await deleteChallenge(link.id)
    return { ok: false }
  }
  return { ok: true, devUrl: confirmUrl }
}

export async function requestLibraryCardEmail(input: {
  email: string
  displayName?: string | null
  sessionUserId?: string | null
  origin: string
}): Promise<CardEmailRequest> {
  const email = normalizeEmail(input.email)
  if (!isValidEmail(email)) return { ok: false, reason: "invalid_email" }

  const accounts = await findAccounts(email)
  if (accounts.length > 1) {
    console.error("[library-card] refused to email an address shared by more than one account")
    return { ok: false, reason: "ambiguous" }
  }

  await retireOpenChallenges(email)
  const name = cleanName(input.displayName)
  const account = accounts[0]

  if (account?.email_verified_at) {
    const pin = generatePin()
    const rotated = await rotateKeptCard(account.id, pin)
    if (!rotated) return { ok: false, reason: "no_card" }
    const sent = await sendCardLetter({
      to: email,
      userId: account.id,
      cardNumber: rotated.cardNumber,
      pin,
      origin: input.origin,
    })
    if (!sent) {
      await restorePin(rotated.cardId, rotated.previousHash)
      return { ok: false, reason: "mail" }
    }
    return { ok: true }
  }

  if (account) {
    const sent = await sendConfirmLetter({
      to: email,
      kind: "verify",
      displayName: name,
      userId: account.id,
      origin: input.origin,
    })
    if (!sent.ok) return { ok: false, reason: "mail" }
    return process.env.NODE_ENV === "production" ? { ok: true } : { ok: true, devUrl: sent.devUrl }
  }

  // A signed-in card with no email yet claims this address. A stranger starts a new card.
  const sent = await sendConfirmLetter({
    to: email,
    kind: input.sessionUserId ? "verify" : "signup",
    displayName: name,
    userId: input.sessionUserId ?? null,
    origin: input.origin,
  })
  if (!sent.ok) return { ok: false, reason: "mail" }
  return process.env.NODE_ENV === "production" ? { ok: true } : { ok: true, devUrl: sent.devUrl }
}

async function loadChallenge(token: string): Promise<ChallengeRow | null> {
  const trimmed = token.trim()
  if (trimmed.length < 20 || trimmed.length > 200) return null
  const { rows } = await resilientQuery<ChallengeRow>(
    `select id, email, display_name, purpose, user_id, card_number, delivery_pin, expires_at, consumed_at
       from library_card_challenges
      where token_hash = $1`,
    [hashToken(trimmed)]
  )
  return rows[0] ?? null
}

function challengeStatus(row: ChallengeRow): "pending" | "used" | "expired" {
  if (row.consumed_at) return "used"
  if (new Date(row.expires_at).getTime() < Date.now()) return "expired"
  return "pending"
}

export async function previewLibraryCardLink(token: string): Promise<
  | { ok: true; purpose: Purpose; maskedEmail: string; status: "pending" | "used" | "expired" }
  | { ok: false }
> {
  const row = await loadChallenge(token)
  if (!row) return { ok: false }
  if (challengeStatus(row) === "expired" && row.delivery_pin) {
    await resilientQuery(
      `update library_card_challenges set delivery_pin = null, consumed_at = coalesce(consumed_at, now()) where id = $1`,
      [row.id]
    )
  }
  return {
    ok: true,
    purpose: row.purpose,
    maskedEmail: maskEmail(row.email),
    status: challengeStatus(row),
  }
}

async function issueFreshCard(input: {
  email: string
  displayName: string | null
  existingUserId: string | null
}): Promise<IssuedCard> {
  const pin = generatePin()
  const pinHash = hashPin(normalizePinForAuth(pin))

  if (input.existingUserId) {
    try {
      const updated = await resilientQuery(
        `update users
            set email = $2,
                contact_email = $2,
                email_verified_at = now()
          where id = $1`,
        [input.existingUserId, input.email]
      )
      if (!updated.rowCount) throw new Error("This library card no longer exists.")
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? (error as { code: string }).code : ""
      if (code === "23505") {
        throw new Error("This email already has a library card. Request it from the login page.")
      }
      throw error
    }
    const rotated = await rotateKeptCard(input.existingUserId, pin)
    if (!rotated) throw new Error("This library card no longer exists.")
    return {
      id: rotated.cardId,
      card_number: rotated.cardNumber,
      pin,
      pseudonym: rotated.pseudonym,
      user_id: input.existingUserId,
      created_at: new Date().toISOString(),
    }
  }

  let lastError: unknown = null
  for (let attempt = 0; attempt < 4; attempt++) {
    const pseudonym = attempt === 0 && input.displayName ? input.displayName : generatePseudonym()
    const cardNumber = generateCardNumber()
    try {
      const { user, cardId } = await createUserAndLibraryCard({
        pseudonym,
        cardNumber,
        pinHash,
        email: input.email,
      })
      return {
        id: cardId,
        card_number: cardNumber,
        pin,
        pseudonym,
        user_id: user.id,
        created_at: user.created_at,
      }
    } catch (error) {
      lastError = error
      const code = error && typeof error === "object" && "code" in error ? (error as { code: string }).code : ""
      if (code !== "23505") throw error
      if (/email/i.test(constraintText(error))) {
        throw new Error("This email already has a library card. Request it from the login page.")
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not create a library card.")
}

export async function redeemLibraryCardLink(token: string, origin: string): Promise<
  | { ok: true; card: IssuedCard }
  | { ok: false; error: string }
> {
  const client = await resilientConnect()
  let row: ChallengeRow
  try {
    await client.query("begin")
    const { rows } = await client.query<ChallengeRow>(
      `select id, email, display_name, purpose, user_id, card_number, delivery_pin, expires_at, consumed_at
         from library_card_challenges
        where token_hash = $1
        for update`,
      [hashToken(token.trim())]
    )
    const locked = rows[0]
    if (!locked) {
      await client.query("rollback")
      return { ok: false, error: "This link is not valid." }
    }
    const status = challengeStatus(locked)
    if (status === "used") {
      await client.query("rollback")
      return { ok: false, error: "This link has already been used." }
    }
    if (status === "expired") {
      await client.query(
        `update library_card_challenges set delivery_pin = null, consumed_at = now() where id = $1`,
        [locked.id]
      )
      await client.query("commit")
      return { ok: false, error: "This link has expired. Request a new one." }
    }
    await client.query(
      `update library_card_challenges set consumed_at = now(), delivery_pin = null where id = $1`,
      [locked.id]
    )
    await client.query("commit")
    row = locked
  } catch (error) {
    await client.query("rollback").catch(() => {})
    throw error
  } finally {
    client.release()
  }

  if (row.purpose === "deliver") {
    if (!row.user_id || !row.card_number || !row.delivery_pin) {
      return { ok: false, error: "This link is not valid." }
    }
    const { rows } = await resilientQuery<{ id: string; pseudonym: string; created_at: Date | string }>(
      `select id, pseudonym, created_at from library_cards where user_id = $1 and card_number = $2`,
      [row.user_id, row.card_number]
    )
    const card = rows[0]
    if (!card) return { ok: false, error: "This library card no longer exists." }
    await resilientQuery(
      `update library_card_challenges
          set delivery_pin = null, consumed_at = now()
        where id = $1 and consumed_at is null`,
      [row.id]
    )
    return {
      ok: true,
      card: {
        id: card.id,
        card_number: row.card_number,
        pin: row.delivery_pin,
        pseudonym: card.pseudonym,
        user_id: row.user_id,
        created_at: new Date(card.created_at).toISOString(),
      },
    }
  }

  if (row.purpose === "verify" && !row.user_id) {
    return { ok: false, error: "This link is not valid." }
  }
  const existingUserId = row.purpose === "verify" ? row.user_id : null
  let issued: IssuedCard
  try {
    issued = await issueFreshCard({
      email: row.email,
      displayName: cleanName(row.display_name),
      existingUserId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not open this link."
    return { ok: false, error: message }
  }

  if (!issued.card_number) {
    const { rows } = await resilientQuery<{ card_number: string }>(
      `select card_number from library_cards where id = $1`,
      [issued.id]
    )
    issued = { ...issued, card_number: rows[0]?.card_number ?? "" }
  }

  await resilientQuery(
    `update library_card_challenges set consumed_at = now() where id = $1 and consumed_at is null`,
    [row.id]
  )

  const sent = await sendCardLetter({
    to: row.email,
    userId: issued.user_id,
    cardNumber: issued.card_number,
    pin: issued.pin,
    origin,
  })
  if (!sent) {
    console.error("[library-card] card was created but the PIN email could not be sent")
  }

  return { ok: true, card: issued }
}
