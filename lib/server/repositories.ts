import "server-only"

import type { Book, LoanEvent, Node, TrustEvent, User } from "@/lib/types"
import { resilientQuery, resilientConnect } from "@/lib/server/db"
import {
  applyTrustChange,
  classifyReturn,
  getDeltaForReason,
} from "@/lib/server/trust"

/* ─── Row ↔ domain mappers ───
 * Postgres returns Date objects; the rest of the app expects ISO strings.
 */

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

type DbTrustEvent = Omit<TrustEvent, "created_at"> & {
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

function mapTrustEvent(row: DbTrustEvent): TrustEvent {
  return {
    ...row,
    created_at: asIso(row.created_at)!,
  }
}

/* ═══════════════════════════════════════════
 *  Read queries — all use resilientQuery for
 *  automatic retry on transient failures.
 * ═══════════════════════════════════════════ */

/** Lists all books; throws if DB is unavailable (so we don't show "0 in catalog" when env is wrong). */
export async function listBooks() {
  const { rows } = await resilientQuery<DbBook>(
    "select * from books order by created_at desc, id asc"
  )
  return rows.map(mapBook)
}

/** Lists all nodes; throws if DB is unavailable. */
export async function listNodes() {
  const { rows } = await resilientQuery<DbNode>("select * from nodes order by name asc")
  return rows.map(mapNode)
}

/** Create a new node; used by steward dashboard. steward_id must reference an existing user. */
export async function createNode(input: {
  name: string
  type: Node["type"]
  steward_id: string
  location_address?: string | null
  location_lat?: number | null
  location_lng?: number | null
  public?: boolean
  capacity?: number | null
  operating_hours?: string | null
}): Promise<Node> {
  const id = crypto.randomUUID()
  const client = await resilientConnect()
  try {
    await client.query(
      `insert into nodes (id, name, type, steward_id, location_address, location_lat, location_lng, public, capacity, operating_hours, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
      [
        id,
        input.name.trim(),
        input.type,
        input.steward_id,
        input.location_address?.trim() || null,
        input.location_lat ?? null,
        input.location_lng ?? null,
        input.public ?? true,
        input.capacity ?? null,
        input.operating_hours?.trim() || null,
      ]
    )
    const { rows } = await client.query<DbNode>("select * from nodes where id = $1", [id])
    if (!rows[0]) throw new Error("Node not created")
    return mapNode(rows[0])
  } finally {
    client.release()
  }
}

/** Lists all users; throws if DB is unavailable. */
export async function listUsers() {
  const { rows } = await resilientQuery<DbUser>(
    "select * from public.users order by created_at asc, id asc"
  )
  return rows.map(mapUser)
}

/** Lists all loan events; throws if DB is unavailable. */
export async function listLoanEvents() {
  const { rows } = await resilientQuery<DbLoanEvent>(
    "select * from loan_events order by timestamp desc, id asc"
  )
  return rows.map(mapLoanEvent)
}

/** Trust score history for a user (breakdown for hover/click). Most recent first. */
export async function listTrustEventsByUserId(userId: string): Promise<TrustEvent[]> {
  const { rows } = await resilientQuery<DbTrustEvent>(
    "select * from trust_events where user_id = $1 order by created_at desc, id asc",
    [userId]
  )
  return rows.map(mapTrustEvent)
}

export async function getBookById(id: string) {
  const { rows } = await resilientQuery<DbBook>("select * from books where id = $1", [id])
  return rows[0] ? mapBook(rows[0]) : null
}

/**
 * Steward book edit:
 * - metadata (title/author/edition/isbn/description/cover/terms)
 * - location transfer (node)
 * - operational circulation state (available / checked out / unavailable / missing)
 *   with ledger events emitted for status / holder / location changes.
 */
export async function updateBook(
  bookId: string,
  input: {
    title?: string
    author?: string | null
    edition?: string | null
    isbn?: string | null
    description?: string | null
    cover_image_url?: string | null
    node_id?: string
    lending_terms?: Book["lending_terms"]
    availability_status?: Book["availability_status"]
    current_holder_id?: string | null
    ledger_note?: string | null
    actor_user_id?: string | null
    actor_display_name?: string | null
  }
): Promise<Book | null> {
  const client = await resilientConnect()
  try {
    const { rows: existing } = await client.query<DbBook>(
      "select * from books where id = $1",
      [bookId]
    )
    const current = existing[0]
    if (!current) return null
    const noteText = input.ledger_note?.trim() || null

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
        ? (input.title?.trim() || current.title)
        : current.title
    const author =
      input.author !== undefined ? input.author : current.author
    const edition =
      input.edition !== undefined ? input.edition : current.edition
    const isbn = input.isbn !== undefined ? input.isbn : current.isbn
    const description =
      input.description !== undefined ? input.description : current.description
    const cover_image_url =
      input.cover_image_url !== undefined
        ? input.cover_image_url
        : current.cover_image_url
    const current_node_id =
      input.node_id !== undefined ? input.node_id : current.current_node_id
    const current_node_name =
      nodeName !== null ? nodeName : current.current_node_name
    const current_location_text =
      locationText !== null ? locationText : current.current_location_text
    const lending_terms_obj =
      input.lending_terms != null
        ? input.lending_terms
        : ((current.lending_terms as Book["lending_terms"]) ?? {})
    const lending_terms = JSON.stringify(lending_terms_obj)

    const availability_status =
      input.availability_status !== undefined
        ? input.availability_status
        : current.availability_status
    const loanPeriodDays = Math.max(
      1,
      Number(lending_terms_obj?.loan_period_days) || 21
    )
    const expected_return_date =
      availability_status === "checked_out"
        ? new Date(Date.now() + loanPeriodDays * 24 * 60 * 60 * 1000).toISOString()
        : null

    const requestedHolderId =
      input.current_holder_id !== undefined
        ? input.current_holder_id
        : (current.current_holder_id ?? null)
    const current_holder_id =
      availability_status === "checked_out" ? requestedHolderId : null
    if (availability_status === "checked_out" && !current_holder_id) {
      throw new Error("Checked out books must have a current holder")
    }

    let current_holder_name: string | null = null
    if (current_holder_id) {
      const { rows: holderRows } = await client.query<{ display_name: string }>(
        "select display_name from users where id = $1",
        [current_holder_id]
      )
      if (!holderRows[0]) throw new Error("Selected holder not found")
      current_holder_name = holderRows[0].display_name
    }

    const actor_user_id = input.actor_user_id ?? null
    let actor_display_name = input.actor_display_name?.trim() || "Steward"
    if (actor_user_id) {
      const { rows: actorRows } = await client.query<{ display_name: string }>(
        "select display_name from users where id = $1",
        [actor_user_id]
      )
      if (actorRows[0]?.display_name) actor_display_name = actorRows[0].display_name
    }

    const oldStatus = current.availability_status
    const oldHolderId = current.current_holder_id ?? null
    const oldNodeId = current.current_node_id ?? null

    const insertLoanEvent = async (params: {
      eventType: "checkout" | "return" | "transfer" | "report_lost"
      userId?: string | null
      userDisplayName?: string | null
      notes?: string | null
      previousHolderId?: string | null
      newHolderId?: string | null
    }) => {
      await client.query(
        `insert into loan_events
          (id, event_type, book_id, book_title, user_id, user_display_name, timestamp, location_text, notes, previous_holder_id, new_holder_id)
         values
          ($1, $2, $3, $4, $5, $6, now(), $7, $8, $9, $10)`,
        [
          crypto.randomUUID(),
          params.eventType,
          bookId,
          title,
          params.userId ?? null,
          params.userDisplayName ?? null,
          current_location_text ?? null,
          params.notes ?? null,
          params.previousHolderId ?? null,
          params.newHolderId ?? null,
        ]
      )
    }

    // Ledger policy: operational circulation/location changes are append-only events.
    if (availability_status === "retired" && oldStatus !== "retired") {
      await insertLoanEvent({
        eventType: "report_lost",
        userId: actor_user_id,
        userDisplayName: actor_display_name,
        notes: noteText,
      })
    } else if (oldStatus === "checked_out" && availability_status === "available") {
      let returnUserId = oldHolderId
      let returnDisplayName = current.current_holder_name ?? null
      if (returnUserId && !returnDisplayName) {
        const { rows: returnRows } = await client.query<{ display_name: string }>(
          "select display_name from users where id = $1",
          [returnUserId]
        )
        returnDisplayName = returnRows[0]?.display_name ?? null
      }
      if (!returnUserId) {
        returnUserId = actor_user_id
        returnDisplayName = actor_display_name
      }
      await insertLoanEvent({
        eventType: "return",
        userId: returnUserId,
        userDisplayName: returnDisplayName,
        notes: noteText,
      })
    } else if (availability_status === "checked_out" && current_holder_id) {
      if (oldStatus === "checked_out" && oldHolderId && oldHolderId !== current_holder_id) {
        await insertLoanEvent({
          eventType: "transfer",
          userId: actor_user_id,
          userDisplayName: actor_display_name,
          notes: noteText,
          previousHolderId: oldHolderId,
          newHolderId: current_holder_id,
        })
      } else if (oldStatus !== "checked_out" || oldHolderId !== current_holder_id) {
        await insertLoanEvent({
          eventType: "checkout",
          userId: current_holder_id,
          userDisplayName: current_holder_name,
          notes: noteText,
        })
      }
    } else if (
      oldNodeId !== (current_node_id ?? null) ||
      (oldStatus !== "in_transit" && availability_status === "in_transit") ||
      (oldStatus === "in_transit" && availability_status === "available")
    ) {
      await insertLoanEvent({
        eventType: "transfer",
        userId: actor_user_id,
        userDisplayName: actor_display_name,
        notes: noteText,
      })
    }

    await client.query(
      `update books set
        title = $2,
        author = $3,
        edition = $4,
        isbn = $5,
        description = $6,
        cover_image_url = $7,
        current_node_id = $8,
        current_node_name = $9,
        current_location_text = $10,
        lending_terms = $11::jsonb,
        availability_status = $12,
        current_holder_id = $13,
        current_holder_name = $14,
        expected_return_date = $15
       where id = $1`,
      [
        bookId,
        title,
        author ?? null,
        edition ?? null,
        isbn ?? null,
        description?.trim() || null,
        cover_image_url?.trim() || null,
        current_node_id ?? null,
        current_node_name ?? null,
        current_location_text ?? null,
        lending_terms,
        availability_status,
        current_holder_id ?? null,
        current_holder_name ?? null,
        expected_return_date,
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
  const { rows } = await resilientQuery<DbUser>("select * from public.users where id = $1", [id])
  return rows[0] ? mapUser(rows[0]) : null
}

export async function updateUserDisplayName(
  userId: string,
  displayName: string
): Promise<boolean> {
  const trimmed = displayName.trim()
  if (!trimmed.length) return false
  try {
    await resilientQuery(
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
    const result = await resilientQuery(sql, values)
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
  const { rows } = await resilientQuery<DbLoanEvent>(
    "select * from loan_events where book_id = $1 order by timestamp desc",
    [bookId]
  )
  return rows.map(mapLoanEvent)
}

export async function getUserEvents(userId: string) {
  const { rows } = await resilientQuery<DbLoanEvent>(
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
  const { rows } = await resilientQuery<DbBook>(sql, values)
  return rows.map(mapBook)
}

/* ═══════════════════════════════════════════
 *  Write operations — transactions use
 *  resilientConnect for the initial handshake,
 *  then raw client queries inside the txn.
 * ═══════════════════════════════════════════ */

export async function checkoutBook(params: { bookId: string; userId: string }) {
  const client = await resilientConnect()
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
  const client = await resilientConnect()
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

    // Trust: return on time +2, late (after suggested) -3, very late (60+ days) -12
    const reason = classifyReturn(book.expected_return_date)
    const delta = getDeltaForReason(reason)
    await applyTrustChange(client, {
      userId: params.userId,
      reason,
      delta,
      bookId: params.bookId,
      bookTitle: book.title,
    })

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
  /** Optional short description (e.g. from Open Library). */
  description?: string | null
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

  const client = await resilientConnect()
  try {
    await client.query("begin")

    let nodeId = input.nodeId
    let nodeName: string | null = null
    let locationText: string | null = input.currentLocationText ?? null
    let addedByUserId = input.addedByUserId ?? null

    if (nodeId) {
      const { rows: nodes } = await client.query<DbNode>(
        "select * from nodes where id = $1",
        [nodeId]
      )
      const node = nodes[0]
      if (!node) throw new Error("Node not found")
      nodeName = node.name
      locationText = node.location_address ?? node.name
      if (!addedByUserId) addedByUserId = node.steward_id
    } else if (!input.isPocketLibrary) {
      throw new Error("Either nodeId must be provided or isPocketLibrary must be true")
    }

    if (input.isPocketLibrary && !input.ownerContactEmail) {
      throw new Error("Pocket Library books require an owner contact email")
    }

    await client.query(
      `insert into books
        (id, isbn, title, author, edition, description, qr_tag_id, checkout_url, cover_image_url, 
         current_node_id, current_node_name, current_location_text, 
         availability_status, lending_terms, added_by_user_id, added_by_display_name, 
         owner_contact_email, is_pocket_library, created_at)
       values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'available', $13::jsonb, $14, $15, $16, $17, now())`,
      [
        id,
        input.isbn ?? null,
        input.title,
        input.author ?? null,
        input.edition ?? null,
        input.description?.trim() || null,
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

    if (addedByUserId) {
      await applyTrustChange(client, {
        userId: addedByUserId,
        reason: "add_book",
        delta: getDeltaForReason("add_book"),
        bookId: id,
        bookTitle: input.title,
      })
    }

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

/* ═══════════════════════════════════════════
 *  Library cards (create user + card; login)
 * ═══════════════════════════════════════════ */

export function hashPin(pin: string): string {
  const { createHash } = require("crypto")
  return createHash("sha256").update(pin, "utf8").digest("hex")
}

export async function createUserForLibraryCard(pseudonym: string): Promise<User> {
  const id = crypto.randomUUID()
  await resilientQuery(
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
  await resilientQuery(
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

/* ═══════════════════════════════════════════
 *  Account deletion — anonymise ledger entries,
 *  return held books, then remove the user.
 *  Cascade deletes library_cards & trust_events;
 *  nullifies book references automatically.
 * ═══════════════════════════════════════════ */

export type DeleteUserResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "steward" | "has_checked_out_books" | "error" }

export async function deleteUserAccount(userId: string): Promise<DeleteUserResult> {
  const client = await resilientConnect()
  try {
    await client.query("begin")

    /* Guard: node stewards must reassign before deleting */
    const { rows: stewardNodes } = await client.query<{ id: string }>(
      "SELECT id FROM nodes WHERE steward_id = $1 LIMIT 1",
      [userId]
    )
    if (stewardNodes.length > 0) {
      await client.query("rollback")
      return { ok: false, reason: "steward" }
    }

    /* Return any books the user is currently holding */
    await client.query(
      `UPDATE books
         SET current_holder_id   = NULL,
             current_holder_name = NULL,
             availability_status = 'available',
             expected_return_date = NULL
       WHERE current_holder_id = $1`,
      [userId]
    )

    /* Anonymise the user's ledger history (preserves transparency) */
    await client.query(
      `UPDATE loan_events
         SET user_display_name = '[Deleted]',
             user_id = NULL
       WHERE user_id = $1`,
      [userId]
    )

    /* Delete user — cascades: library_cards, trust_events; nullifies: books.added_by */
    const result = await client.query("DELETE FROM users WHERE id = $1", [userId])
    await client.query("commit")

    const rowCount = typeof result.rowCount === "number" ? result.rowCount : 0
    if (rowCount === 0) return { ok: false, reason: "not_found" }
    return { ok: true }
  } catch (error) {
    await client.query("rollback")
    console.error("Failed to delete user account:", error)
    return { ok: false, reason: "error" }
  } finally {
    client.release()
  }
}

export async function getLibraryCardByNumberAndPin(
  cardNumber: string,
  pin: string
): Promise<{ id: string; card_number: string; pseudonym: string; user_id: string; created_at: string } | null> {
  const normalizedCard = (cardNumber ?? "").replace(/\s/g, "").trim()
  if (!normalizedCard) return null
  const normalizedPin = normalizePinForAuth(pin)
  const pinHash = hashPin(normalizedPin)
  const { rows } = await resilientQuery<{
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
