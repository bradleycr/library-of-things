import "server-only"

import type { Book, LoanEvent, Node, User } from "@/lib/types"
import { db } from "@/lib/server/db"

type DbBook = Omit<Book, "created_at" | "expected_return_date"> & {
  created_at: string | Date
  expected_return_date?: string | Date | null
  owner_contact_email?: string | null
  is_pocket_library?: boolean
}

type DbLoanEvent = Omit<LoanEvent, "timestamp"> & {
  timestamp: string | Date
}

type DbNode = Omit<Node, "created_at"> & {
  created_at: string | Date
}

type DbUser = Omit<User, "created_at"> & {
  created_at: string | Date
}

function asIso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined
  return new Date(value).toISOString()
}

function mapBook(row: DbBook): Book {
  return {
    ...row,
    created_at: asIso(row.created_at)!,
    expected_return_date: asIso(row.expected_return_date),
    owner_contact_email: row.owner_contact_email ?? undefined,
    is_pocket_library: row.is_pocket_library ?? false,
  }
}

function mapLoanEvent(row: DbLoanEvent): LoanEvent {
  return {
    ...row,
    timestamp: asIso(row.timestamp)!,
  }
}

function mapNode(row: DbNode): Node {
  return {
    ...row,
    created_at: asIso(row.created_at)!,
  }
}

function mapUser(row: DbUser): User {
  return {
    ...row,
    created_at: asIso(row.created_at)!,
  }
}

/** Lists all books; throws if DB is unavailable (so we don't show "0 in catalog" when env is wrong). */
export async function listBooks() {
  const { rows } = await db.query<DbBook>(
    "select * from books order by created_at desc, id asc"
  )
  return rows.map(mapBook)
}

/** Lists all nodes; throws if DB is unavailable. */
export async function listNodes() {
  const { rows } = await db.query<DbNode>("select * from nodes order by name asc")
  return rows.map(mapNode)
}

/** Lists all users; throws if DB is unavailable. */
export async function listUsers() {
  const { rows } = await db.query<DbUser>(
    "select * from public.users order by created_at asc, id asc"
  )
  return rows.map(mapUser)
}

/** Lists all loan events; throws if DB is unavailable. */
export async function listLoanEvents() {
  const { rows } = await db.query<DbLoanEvent>(
    "select * from loan_events order by timestamp desc, id asc"
  )
  return rows.map(mapLoanEvent)
}

export async function getBookById(id: string) {
  const { rows } = await db.query<DbBook>("select * from books where id = $1", [id])
  return rows[0] ? mapBook(rows[0]) : null
}

/**
 * Update book metadata (steward edit). Does not change id, checkout_url, availability, or holder.
 */
export async function updateBook(
  bookId: string,
  input: {
    title?: string
    author?: string | null
    edition?: string | null
    isbn?: string | null
    cover_image_url?: string | null
    node_id?: string
    lending_terms?: Book["lending_terms"]
  }
): Promise<Book | null> {
  const client = await db.connect()
  try {
    const { rows: existing } = await client.query<DbBook>(
      "select * from books where id = $1",
      [bookId]
    )
    if (!existing[0]) return null

    let nodeName: string | null = null
    let locationText: string | null = null
    if (input.node_id != null) {
      const { rows: nodeRows } = await client.query<DbNode>(
        "select * from nodes where id = $1",
        [input.node_id]
      )
      const node = nodeRows[0]
      if (node) {
        nodeName = node.name
        locationText = node.location_address ?? node.name
      }
    }

    const title =
      input.title !== undefined
        ? (input.title?.trim() || existing[0].title)
        : existing[0].title
    const author =
      input.author !== undefined ? input.author : existing[0].author
    const edition =
      input.edition !== undefined ? input.edition : existing[0].edition
    const isbn = input.isbn !== undefined ? input.isbn : existing[0].isbn
    const cover_image_url =
      input.cover_image_url !== undefined
        ? input.cover_image_url
        : existing[0].cover_image_url
    const current_node_id =
      input.node_id !== undefined ? input.node_id : existing[0].current_node_id
    const current_node_name =
      nodeName !== null ? nodeName : existing[0].current_node_name
    const current_location_text =
      locationText !== null ? locationText : existing[0].current_location_text
    const lending_terms =
      input.lending_terms != null
        ? JSON.stringify(input.lending_terms)
        : (typeof existing[0].lending_terms === "object"
            ? JSON.stringify(existing[0].lending_terms)
            : existing[0].lending_terms)

    await client.query(
      `update books set
        title = $2,
        author = $3,
        edition = $4,
        isbn = $5,
        cover_image_url = $6,
        current_node_id = $7,
        current_node_name = $8,
        current_location_text = $9,
        lending_terms = $10::jsonb
       where id = $1`,
      [
        bookId,
        title,
        author ?? null,
        edition ?? null,
        isbn ?? null,
        cover_image_url?.trim() || null,
        current_node_id ?? null,
        current_node_name ?? null,
        current_location_text ?? null,
        lending_terms,
      ]
    )

    const { rows: updated } = await client.query<DbBook>(
      "select * from books where id = $1",
      [bookId]
    )
    return updated[0] ? mapBook(updated[0]) : null
  } catch (error) {
    console.error("Failed to update book:", error)
    throw error
  } finally {
    client.release()
  }
}

export async function getUserById(id: string) {
  const { rows } = await db.query<DbUser>("select * from public.users where id = $1", [id])
  return rows[0] ? mapUser(rows[0]) : null
}

export async function updateUserDisplayName(
  userId: string,
  displayName: string
): Promise<boolean> {
  const trimmed = displayName.trim()
  if (!trimmed.length) return false
  try {
    await db.query(
      "update users set display_name = $1 where id = $2",
      [trimmed, userId]
    )
    return true
  } catch (error) {
    console.error("Failed to update user display name:", error)
    return false
  }
}

/** Optional profile updates; only provided fields are updated. */
export type UserProfileUpdate = {
  display_name?: string
  contact_opt_in?: boolean
  contact_email?: string | null
  phone?: string | null
  twitter_url?: string | null
  linkedin_url?: string | null
  website_url?: string | null
}

/** Result of updateUserProfile: success or a specific failure reason for correct HTTP handling. */
export type UpdateUserProfileResult =
  | { ok: true }
  | { ok: false; reason: "display_name_taken" }
  | { ok: false; reason: "validation" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "schema_out_of_date" }
  | { ok: false; reason: "error" }

function getPgErrorCode(err: unknown): string {
  return err && typeof err === "object" && "code" in err ? (err as { code: string }).code : ""
}

function isUniqueViolation(err: unknown): boolean {
  return getPgErrorCode(err) === "23505"
}

/** Postgres 42703 = undefined_column — e.g. contact columns missing if DB wasn't migrated. */
function isUndefinedColumn(err: unknown): boolean {
  return getPgErrorCode(err) === "42703"
}

export async function updateUserProfile(
  userId: string,
  updates: UserProfileUpdate
): Promise<UpdateUserProfileResult> {
  const setParts: string[] = []
  const values: unknown[] = []
  let idx = 0

  if (updates.display_name !== undefined) {
    const trimmed = String(updates.display_name).trim()
    if (!trimmed.length) return { ok: false, reason: "validation" }
    idx += 1
    setParts.push(`display_name = $${idx}`)
    values.push(trimmed)
  }
  if (updates.contact_opt_in !== undefined) {
    idx += 1
    setParts.push(`contact_opt_in = $${idx}`)
    values.push(updates.contact_opt_in)
  }
  if (updates.contact_email !== undefined) {
    idx += 1
    setParts.push(`contact_email = $${idx}`)
    values.push(updates.contact_email && updates.contact_email.trim() ? updates.contact_email.trim() : null)
  }
  if (updates.phone !== undefined) {
    idx += 1
    setParts.push(`phone = $${idx}`)
    values.push(updates.phone && updates.phone.trim() ? updates.phone.trim() : null)
  }
  if (updates.twitter_url !== undefined) {
    idx += 1
    setParts.push(`twitter_url = $${idx}`)
    values.push(updates.twitter_url && updates.twitter_url.trim() ? updates.twitter_url.trim() : null)
  }
  if (updates.linkedin_url !== undefined) {
    idx += 1
    setParts.push(`linkedin_url = $${idx}`)
    values.push(updates.linkedin_url && updates.linkedin_url.trim() ? updates.linkedin_url.trim() : null)
  }
  if (updates.website_url !== undefined) {
    idx += 1
    setParts.push(`website_url = $${idx}`)
    values.push(updates.website_url && updates.website_url.trim() ? updates.website_url.trim() : null)
  }

  if (setParts.length === 0) return { ok: true }
  idx += 1
  values.push(userId)
  const sql = `update users set ${setParts.join(", ")} where id = $${idx}`
  try {
    const result = await db.query(sql, values)
    const rowCount = typeof result.rowCount === "number" ? result.rowCount : 0
    if (rowCount === 0) return { ok: false, reason: "not_found" }
    return { ok: true }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "display_name_taken" }
    }
    if (isUndefinedColumn(error)) {
      console.error("User profile update failed: missing column (run db:ensure-schema?)", error)
      return { ok: false, reason: "schema_out_of_date" }
    }
    console.error("Failed to update user profile:", error)
    return { ok: false, reason: "error" }
  }
}

export async function getBookEvents(bookId: string) {
  const { rows } = await db.query<DbLoanEvent>(
    "select * from loan_events where book_id = $1 order by timestamp desc",
    [bookId]
  )
  return rows.map(mapLoanEvent)
}

export async function getUserEvents(userId: string) {
  const { rows } = await db.query<DbLoanEvent>(
    "select * from loan_events where user_id = $1 order by timestamp desc",
    [userId]
  )
  return rows.map(mapLoanEvent)
}

export async function searchBooks(params: {
  query?: string
  availability?: string
  lendingTerms?: string[]
  nodeId?: string
}) {
  const clauses: string[] = []
  const values: unknown[] = []

  if (params.query) {
    values.push(`%${params.query.toLowerCase()}%`)
    const idx = values.length
    clauses.push(
      `(lower(title) like $${idx} or lower(coalesce(author, '')) like $${idx} or coalesce(isbn, '') like $${idx})`
    )
  }

  if (params.availability === "available") {
    values.push("available")
    clauses.push(`availability_status = $${values.length}`)
  }

  if (params.nodeId && params.nodeId !== "all") {
    values.push(params.nodeId)
    clauses.push(`current_node_id = $${values.length}`)
  }

  if (params.lendingTerms && params.lendingTerms.length > 0) {
    values.push(params.lendingTerms)
    clauses.push(`(lending_terms ->> 'type') = any($${values.length})`)
  }

  const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : ""
  const sql = `select * from books ${where} order by created_at desc, id asc`
  const { rows } = await db.query<DbBook>(sql, values)
  return rows.map(mapBook)
}

export async function checkoutBook(params: { bookId: string; userId: string }) {
  const client = await db.connect()
  try {
    await client.query("begin")
    const { rows: books } = await client.query<DbBook>(
      "select * from books where id = $1 for update",
      [params.bookId]
    )
    const book = books[0]
    if (!book) {
      throw new Error("Book not found")
    }
    if (book.availability_status !== "available") {
      throw new Error("Book is not available")
    }

    const expectedReturn = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()
    await client.query(
      `update books
         set current_holder_id = $2,
             availability_status = 'checked_out',
             expected_return_date = $3
       where id = $1`,
      [params.bookId, params.userId, expectedReturn]
    )

    const { rows: userRows } = await client.query<DbUser>(
      "select display_name from users where id = $1",
      [params.userId]
    )

    await client.query(
      `insert into loan_events
        (id, event_type, book_id, book_title, user_id, user_display_name, timestamp, location_text)
       values
        ($1, 'checkout', $2, $3, $4, $5, now(), $6)`,
      [
        crypto.randomUUID(),
        params.bookId,
        book.title,
        params.userId,
        userRows[0]?.display_name ?? null,
        book.current_location_text ?? null,
      ]
    )

    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

export async function returnBook(params: {
  bookId: string
  userId: string
  returnNodeId?: string
  notes?: string
}) {
  const client = await db.connect()
  try {
    await client.query("begin")
    const { rows: books } = await client.query<DbBook>(
      "select * from books where id = $1 for update",
      [params.bookId]
    )
    const book = books[0]
    if (!book) {
      throw new Error("Book not found")
    }
    if (book.current_holder_id && book.current_holder_id !== params.userId) {
      throw new Error("Only the current holder can return this book")
    }

    let nodeName = book.current_node_name ?? null
    let locationText = book.current_location_text ?? null

    if (params.returnNodeId) {
      const { rows: nodes } = await client.query<DbNode>(
        "select * from nodes where id = $1",
        [params.returnNodeId]
      )
      const node = nodes[0]
      if (node) {
        nodeName = node.name
        locationText = node.location_address ?? node.name
      }
    }

    await client.query(
      `update books
          set current_holder_id = null,
              current_holder_name = null,
              availability_status = 'available',
              expected_return_date = null,
              current_node_id = coalesce($2, current_node_id),
              current_node_name = coalesce($3, current_node_name),
              current_location_text = coalesce($4, current_location_text)
        where id = $1`,
      [params.bookId, params.returnNodeId ?? null, nodeName, locationText]
    )

    const { rows: userRows } = await client.query<DbUser>(
      "select display_name from users where id = $1",
      [params.userId]
    )

    await client.query(
      `insert into loan_events
        (id, event_type, book_id, book_title, user_id, user_display_name, timestamp, location_text, notes)
       values
        ($1, 'return', $2, $3, $4, $5, now(), $6, $7)`,
      [
        crypto.randomUUID(),
        params.bookId,
        book.title,
        params.userId,
        userRows[0]?.display_name ?? null,
        locationText,
        params.notes ?? null,
      ]
    )

    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

export async function createBook(input: {
  isbn?: string
  title: string
  author?: string
  edition?: string
  /** For node-based books, the node ID. For Pocket Library books, this should be undefined/null. */
  nodeId?: string
  lendingTerms: Book["lending_terms"]
  coverImageUrl?: string | null
  /** User id and display name for "who added this book" attribution. */
  addedByUserId?: string
  addedByDisplayName?: string
  /** For Pocket Library (floating) books, the current location text (captured when adding). */
  currentLocationText?: string
  /** For Pocket Library books, the owner's contact email for arranging pickup/return. */
  ownerContactEmail?: string
  /** Whether this is a Pocket Library (floating) book not tied to a specific node. */
  isPocketLibrary?: boolean
}) {
  const id = crypto.randomUUID()
  const qrTagId = `qr-${Date.now()}`
  const checkoutToken = Buffer.from(`${id}-${Date.now()}`, "utf8").toString("base64url")
  const checkoutUrl = `/book/${id}/checkout?token=${checkoutToken}`

  const client = await db.connect()
  try {
    await client.query("begin")

    let nodeId = input.nodeId
    let nodeName: string | null = null
    let locationText: string | null = input.currentLocationText ?? null
    let addedByUserId = input.addedByUserId ?? null

    // For node-based books, fetch node details
    if (nodeId) {
      const { rows: nodes } = await client.query<DbNode>(
        "select * from nodes where id = $1",
        [nodeId]
      )
      const node = nodes[0]
      if (!node) throw new Error("Node not found")
      nodeName = node.name
      locationText = node.location_address ?? node.name
      // If no user specified, attribute to node steward
      if (!addedByUserId) addedByUserId = node.steward_id
    } else if (!input.isPocketLibrary) {
      // If no node and not explicitly marked as pocket library, this is an error
      throw new Error("Either nodeId must be provided or isPocketLibrary must be true")
    }

    // For Pocket Library books, require owner contact email
    if (input.isPocketLibrary && !input.ownerContactEmail) {
      throw new Error("Pocket Library books require an owner contact email")
    }

    await client.query(
      `insert into books
        (id, isbn, title, author, edition, qr_tag_id, checkout_url, cover_image_url, 
         current_node_id, current_node_name, current_location_text, 
         availability_status, lending_terms, added_by_user_id, added_by_display_name, 
         owner_contact_email, is_pocket_library, created_at)
       values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'available', $12::jsonb, $13, $14, $15, $16, now())`,
      [
        id,
        input.isbn ?? null,
        input.title,
        input.author ?? null,
        input.edition ?? null,
        qrTagId,
        checkoutUrl,
        input.coverImageUrl?.trim() || null,
        nodeId ?? null,
        nodeName ?? null,
        locationText ?? null,
        JSON.stringify(input.lendingTerms),
        addedByUserId ?? null,
        input.addedByDisplayName ?? null,
        input.ownerContactEmail ?? null,
        input.isPocketLibrary ?? false,
      ]
    )

    // Ledger: record "added" so every new book appears in the sharing history
    const { rows: userRows } = await client.query<DbUser>(
      "select display_name from users where id = $1",
      [addedByUserId]
    )
    const addedByDisplayName =
      input.addedByDisplayName ?? userRows[0]?.display_name ?? "—"

    await client.query(
      `insert into loan_events
        (id, event_type, book_id, book_title, user_id, user_display_name, timestamp, location_text)
       values
        ($1, 'added', $2, $3, $4, $5, now(), $6)`,
      [
        crypto.randomUUID(),
        id,
        input.title,
        addedByUserId,
        addedByDisplayName,
        locationText ?? (input.isPocketLibrary ? "Pocket Library" : "Unknown"),
      ]
    )

    await client.query("commit")
    return {
      id,
      qr_tag_id: qrTagId,
      checkout_url: checkoutUrl,
    }
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

// --- Library cards (create user + card; login by card + PIN) ---

export function hashPin(pin: string): string {
  const { createHash } = require("crypto")
  return createHash("sha256").update(pin, "utf8").digest("hex")
}

export async function createUserForLibraryCard(pseudonym: string): Promise<User> {
  const id = crypto.randomUUID()
  await db.query(
    `insert into public.users (id, display_name, auth_provider, trust_score, community_memberships, created_at)
     values ($1, $2, 'library_card', 50, '{}', now())`,
    [id, pseudonym]
  )
  return {
    id,
    display_name: pseudonym,
    auth_provider: "library_card",
    trust_score: 50,
    community_memberships: [],
    created_at: new Date().toISOString(),
  }
}

export async function createLibraryCard(params: {
  cardNumber: string
  pinHash: string
  userId: string
  pseudonym: string
}): Promise<{ id: string }> {
  const id = crypto.randomUUID()
  await db.query(
    `insert into public.library_cards (id, card_number, pin_hash, user_id, pseudonym, created_at)
     values ($1, $2, $3, $4, $5, now())`,
    [
      id,
      params.cardNumber,
      params.pinHash,
      params.userId,
      params.pseudonym,
    ]
  )
  return { id }
}

/** Normalize PIN to 4 digits (digits only, leading zeros) so "123" and "0123" match. Used for both create and login. */
export function normalizePinForAuth(pin: string): string {
  const digits = (pin ?? "").replace(/\D/g, "")
  return digits.slice(-4).padStart(4, "0")
}

export async function getLibraryCardByNumberAndPin(
  cardNumber: string,
  pin: string
): Promise<{ id: string; card_number: string; pseudonym: string; user_id: string; created_at: string } | null> {
  const normalizedCard = (cardNumber ?? "").replace(/\s/g, "").trim()
  if (!normalizedCard) return null
  const normalizedPin = normalizePinForAuth(pin)
  const pinHash = hashPin(normalizedPin)
  const { rows } = await db.query<{
    id: string
    card_number: string
    pseudonym: string
    user_id: string
    created_at: string
  }>(
    "select id, card_number, pseudonym, user_id, created_at from public.library_cards where replace(card_number, ' ', '') = $1 and pin_hash = $2",
    [normalizedCard, pinHash]
  )
  const row = rows[0]
  if (!row) return null
  return {
    ...row,
    created_at: new Date(row.created_at).toISOString(),
  }
}
