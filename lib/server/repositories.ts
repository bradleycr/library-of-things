import "server-only"

import { MAX_BOOKS_CHECKED_OUT } from "@/lib/constants"
import { DEFAULT_LOAN_PERIOD_DAYS } from "@/lib/loan-period"
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

/** App-wide config (steward-editable). Falls back to defaults when DB has no row. */
export type AppConfig = {
  default_loan_period_days: number
}

export async function getAppConfig(): Promise<AppConfig> {
  try {
    const { rows } = await resilientQuery<{ key: string; value: unknown }>(
      "select key, value from app_config where key = 'default_loan_period_days'"
    )
    const row = rows[0]
    if (row && typeof row.value === "number" && row.value >= 1 && row.value <= 365) {
      return { default_loan_period_days: Math.round(row.value) }
    }
    if (row && typeof row.value === "string") {
      const n = parseInt(row.value, 10)
      if (!Number.isNaN(n) && n >= 1 && n <= 365) return { default_loan_period_days: n }
    }
  } catch {
    // Table may not exist yet (e.g. before ensure-schema); use defaults.
  }
  return { default_loan_period_days: DEFAULT_LOAN_PERIOD_DAYS }
}

/** Update app config (steward-only). */
export async function setAppConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
  const client = await resilientConnect()
  try {
    if (typeof updates.default_loan_period_days === "number") {
      const days = Math.max(1, Math.min(365, Math.round(updates.default_loan_period_days)))
      await client.query(
        `insert into app_config (key, value, updated_at) values ('default_loan_period_days', $1::jsonb, now())
         on conflict (key) do update set value = $1::jsonb, updated_at = now()`,
        [JSON.stringify(days)]
      )
    }
    return getAppConfig()
  } finally {
    client.release()
  }
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
  const config = await getAppConfig()
  const client = await resilientConnect()
  try {
    await client.query("begin")
    const { rows: existing } = await client.query<DbBook>(
      "select * from books where id = $1 for update",
      [bookId]
    )
    const current = existing[0]
    if (!current) { await client.query("rollback"); return null }
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
      Number(lending_terms_obj?.loan_period_days) || config.default_loan_period_days
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
    await client.query("commit")
    return updated[0] ? mapBook(updated[0]) : null
  } catch (error) {
    await client.query("rollback")
    console.error("Failed to update book:", error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Delete a book from the library (steward only). Records a "removed" ledger event
 * first so the deletion appears in sharing history; then deletes the book.
 * Depends on loan_events.book_id FK being ON DELETE SET NULL so the new event row survives.
 */
export async function deleteBook(
  bookId: string,
  options?: { note?: string | null; actor_display_name?: string }
): Promise<boolean> {
  const book = await getBookById(bookId)
  if (!book) return false

  const client = await resilientConnect()
  try {
    await client.query("begin")

    await client.query(
      `insert into loan_events
        (id, event_type, book_id, book_title, user_id, user_display_name, timestamp, notes)
       values ($1, 'removed', $2, $3, null, $4, now(), $5)`,
      [
        crypto.randomUUID(),
        bookId,
        book.title,
        options?.actor_display_name ?? "Steward",
        options?.note?.trim() || null,
      ]
    )

    await client.query("delete from books where id = $1", [bookId])
    await client.query("commit")
    return true
  } catch (error) {
    await client.query("rollback")
    console.error("Failed to delete book:", error)
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
  profile_public?: boolean
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
  if (updates.profile_public !== undefined) {
    idx += 1
    setParts.push(`profile_public = $${idx}`)
    values.push(updates.profile_public)
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

  const newDisplayName = updates.display_name !== undefined
    ? String(updates.display_name).trim()
    : null

  try {
    const result = await resilientQuery(sql, values)
    const rowCount = typeof result.rowCount === "number" ? result.rowCount : 0
    if (rowCount === 0) return { ok: false, reason: "not_found" }

    const newProfilePublic = updates.profile_public

    if (newProfilePublic === false) {
      await anonymizeUserDisplay(userId)
    }

    if (newDisplayName) {
      await Promise.all([
        resilientQuery(
          "update books set added_by_display_name = $1 where added_by_user_id = $2",
          [newDisplayName, userId],
        ),
        resilientQuery(
          "update books set current_holder_name = $1 where current_holder_id = $2",
          [newDisplayName, userId],
        ),
        resilientQuery(
          "update loan_events set user_display_name = $1 where user_id = $2",
          [newDisplayName, userId],
        ),
        resilientQuery(
          "update library_cards set pseudonym = $1 where user_id = $2",
          [newDisplayName, userId],
        ),
      ])
    } else if (newProfilePublic === true) {
      const { rows: u } = await resilientQuery<{ display_name: string }>(
        "select display_name from users where id = $1",
        [userId],
      )
      const name = u[0]?.display_name
      if (name) {
        await Promise.all([
          resilientQuery(
            "update books set added_by_display_name = $1 where added_by_user_id = $2",
            [name, userId],
          ),
          resilientQuery(
            "update books set current_holder_name = $1 where current_holder_id = $2",
            [name, userId],
          ),
          resilientQuery(
            "update loan_events set user_display_name = $1 where user_id = $2",
            [name, userId],
          ),
          resilientQuery(
            "update library_cards set pseudonym = $1 where user_id = $2",
            [name, userId],
          ),
        ])
      }
    }

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
    const escaped = params.query.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`)
    values.push(`%${escaped}%`)
    const idx = values.length
    clauses.push(
      `(lower(title) like $${idx} escape '\\' or lower(coalesce(author, '')) like $${idx} escape '\\' or coalesce(isbn, '') like $${idx} escape '\\')`
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

/** Returns the display name to show publicly for this user (Anonymous if profile is private). */
export async function getPublicDisplayName(userId: string): Promise<string> {
  const { rows } = await resilientQuery<{ display_name: string; profile_public: boolean }>(
    "select display_name, coalesce(profile_public, true) as profile_public from users where id = $1",
    [userId],
  )
  const row = rows[0]
  if (!row) return "Unknown"
  return row.profile_public ? row.display_name : "Anonymous"
}

/**
 * Same as getPublicDisplayName but uses the given client (for use inside a transaction
 * to avoid grabbing a second connection when pool max is 1).
 */
function getPublicDisplayNameWithClient(
  client: import("pg").PoolClient,
  userId: string
): Promise<string> {
  return client
    .query<{ display_name: string; profile_public: boolean }>(
      "select display_name, coalesce(profile_public, true) as profile_public from users where id = $1",
      [userId]
    )
    .then(({ rows }) => {
      const row = rows[0]
      if (!row) return "Unknown"
      return row.profile_public ? row.display_name : "Anonymous"
    })
}

export async function checkoutBook(params: { bookId: string; userId: string }) {
  const config = await getAppConfig()
  const client = await resilientConnect()
  try {
    await client.query("begin")

    // Enforce max books per user (e.g. 2 at a time)
    const { rows: countRows } = await client.query<{ count: string }>(
      `select count(*) as count from books
       where current_holder_id = $1 and availability_status = 'checked_out'`,
      [params.userId]
    )
    const checkedOutCount = parseInt(countRows[0]?.count ?? "0", 10)
    if (checkedOutCount >= MAX_BOOKS_CHECKED_OUT) {
      throw new Error(
        `You can have at most ${MAX_BOOKS_CHECKED_OUT} books checked out at once. Return one to check out another.`
      )
    }

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

    const displayNameForPublic = await getPublicDisplayNameWithClient(client, params.userId)

    const loanDays = Number(book.lending_terms?.loan_period_days) || config.default_loan_period_days
    const expectedReturn = new Date(Date.now() + loanDays * 24 * 60 * 60 * 1000).toISOString()
    await client.query(
      `update books
         set current_holder_id = $2,
             current_holder_name = $3,
             availability_status = 'checked_out',
             expected_return_date = $4
       where id = $1`,
      [params.bookId, params.userId, displayNameForPublic, expectedReturn]
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
        displayNameForPublic,
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

    // Use the transaction client so the return and trust update commit atomically.
    const returnDisplayName = await getPublicDisplayNameWithClient(client, params.userId)

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
        returnDisplayName,
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

    const addedByDisplayNameValue = addedByUserId
      ? await getPublicDisplayNameWithClient(client, addedByUserId)
      : (input.addedByDisplayName ?? null)

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
        addedByDisplayNameValue ?? null,
        input.ownerContactEmail ?? null,
        input.isPocketLibrary ?? false,
      ]
    )

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
        addedByDisplayNameValue ?? "—",
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

const PIN_SALT = "lot-pin-v1"

/** Hash a PIN with a static salt to prevent rainbow-table lookups on the 10k-entry space. */
export function hashPin(pin: string): string {
  const { createHash } = require("crypto")
  return createHash("sha256").update(PIN_SALT + pin, "utf8").digest("hex")
}

/** Legacy unsalted hash — only used for backward-compatible login. */
export function hashPinLegacy(pin: string): string {
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

/**
 * Create user and library card in a single transaction so we never leave
 * an orphan user if card creation fails (2026 best practice: atomic writes).
 */
export async function createUserAndLibraryCard(params: {
  pseudonym: string
  cardNumber: string
  pinHash: string
}): Promise<{ user: User; cardId: string }> {
  const client = await resilientConnect()
  try {
    await client.query("begin")
    const userId = crypto.randomUUID()
    await client.query(
      `insert into public.users (id, display_name, auth_provider, trust_score, community_memberships, created_at)
       values ($1, $2, 'library_card', 50, '{}', now())`,
      [userId, params.pseudonym]
    )
    const cardId = crypto.randomUUID()
    await client.query(
      `insert into public.library_cards (id, card_number, pin_hash, user_id, pseudonym, created_at)
       values ($1, $2, $3, $4, $5, now())`,
      [
        cardId,
        params.cardNumber,
        params.pinHash,
        userId,
        params.pseudonym,
      ]
    )
    await client.query("commit")
    return {
      user: {
        id: userId,
        display_name: params.pseudonym,
        auth_provider: "library_card",
        trust_score: 50,
        community_memberships: [],
        created_at: new Date().toISOString(),
      },
      cardId,
    }
  } catch (err) {
    await client.query("rollback").catch(() => {})
    throw err
  } finally {
    client.release()
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

/** Sets this user's denormalised display name to "Anonymous" everywhere (books added by, current holder, loan_events). Used when profile is set to private. */
export async function anonymizeUserDisplay(userId: string): Promise<void> {
  await Promise.all([
    resilientQuery(
      "update books set added_by_display_name = 'Anonymous' where added_by_user_id = $1",
      [userId],
    ),
    resilientQuery(
      "update books set current_holder_name = 'Anonymous' where current_holder_id = $1",
      [userId],
    ),
    resilientQuery(
      "update loan_events set user_display_name = 'Anonymous' where user_id = $1",
      [userId],
    ),
  ])
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

    /* Set "Added by" to "Deleted account" and clear user id before we delete the user */
    await client.query(
      `UPDATE books
         SET added_by_display_name = 'Deleted account',
             added_by_user_id = NULL
       WHERE added_by_user_id = $1`,
      [userId]
    )

    /* Anonymise the user's ledger history (preserves transparency) */
    await client.query(
      `UPDATE loan_events
         SET user_display_name = 'Deleted account',
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

  type CardRow = { id: string; card_number: string; pseudonym: string; user_id: string; created_at: string; pin_hash: string }

  const { rows } = await resilientQuery<CardRow>(
    "select id, card_number, pseudonym, user_id, created_at, pin_hash from public.library_cards where replace(card_number, ' ', '') = $1",
    [normalizedCard]
  )
  if (rows.length === 0) return null

  const saltedHash = hashPin(normalizedPin)
  const legacyHash = hashPinLegacy(normalizedPin)
  const row = rows.find((r) => r.pin_hash === saltedHash || r.pin_hash === legacyHash)
  if (!row) return null

  // Migrate legacy hash to salted hash on successful login
  if (row.pin_hash === legacyHash && row.pin_hash !== saltedHash) {
    await resilientQuery(
      "update public.library_cards set pin_hash = $1 where id = $2",
      [saltedHash, row.id]
    ).catch((err) => console.warn("[auth] pin hash migration failed:", err.message))
  }

  // Prefer the authoritative display_name from users table over the
  // card's pseudonym, which may be stale if the user renamed themselves.
  const { rows: userRows } = await resilientQuery<{ display_name: string }>(
    "select display_name from users where id = $1",
    [row.user_id]
  )
  const currentName = userRows[0]?.display_name ?? row.pseudonym

  return {
    id: row.id,
    card_number: row.card_number,
    pseudonym: currentName,
    user_id: row.user_id,
    created_at: new Date(row.created_at).toISOString(),
  }
}
