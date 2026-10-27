import "server-only"

/**
 * Morning mail for books that are due, a week late, or a month late.
 *
 * One letter per person. A book that is already months late gets the month
 * letter once, not a pile of the earlier ones. Placeholder addresses
 * (example.com and the like) are skipped — there is nobody there to read them.
 */

import { isValidEmail, normalizeEmail } from "@/lib/email"
import { renderReturnReminderEmail, type ReminderBookLine } from "@/lib/return-reminder-email"
import {
  daysPastDue,
  formatDueDate,
  laterStage,
  lateLabel,
  stageForDays,
  stagesThrough,
  type ReminderStage,
} from "@/lib/return-reminders"
import { resilientConnect, resilientQuery } from "@/lib/server/db"
import { guestPassReplyTo, sendMail } from "@/lib/server/mail"

const BLOCKED_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "localhost",
  "invalid",
])

type LoanRow = {
  id: string
  title: string
  author: string | null
  expected_return_date: Date | string
  is_pocket_library: boolean | null
  node_name: string | null
  display_name: string | null
  email: string | null
  contact_email: string | null
}

export type ReminderSend = {
  name: string
  stage: ReminderStage
  titles: string[]
}

export type ReminderSkip = {
  name: string
  title: string
  reason: "no_email" | "undeliverable"
}

export type ReminderRun = {
  sent: ReminderSend[]
  skipped: ReminderSkip[]
}

function deliverable(email: string): boolean {
  if (!isValidEmail(email)) return false
  const domain = email.split("@")[1] ?? ""
  return !BLOCKED_DOMAINS.has(domain)
}

function holderEmail(row: LoanRow): string {
  return normalizeEmail(row.email) || normalizeEmail(row.contact_email)
}

export async function sendReturnReminders(now = new Date()): Promise<ReminderRun> {
  const { rows } = await resilientQuery<LoanRow>(
    `select b.id, b.title, b.author, b.expected_return_date,
            b.is_pocket_library, n.name as node_name,
            u.display_name, u.email, u.contact_email
       from books b
       left join nodes n on n.id = b.current_node_id
       left join users u on u.id = b.current_holder_id
      where b.availability_status = 'checked_out'
        and coalesce(b.item_type, 'book') = 'book'
        and b.expected_return_date is not null`
  )

  const { rows: already } = await resilientQuery<{ book_id: string; stage: ReminderStage }>(
    `select book_id, stage from return_reminders`
  )
  const sentKeys = new Set(already.map((row) => `${row.book_id}:${row.stage}`))

  const skipped: ReminderSkip[] = []
  type Pending = {
    id: string
    email: string
    name: string
    stage: ReminderStage
    line: ReminderBookLine
  }
  const pending: Pending[] = []

  for (const row of rows) {
    const due = new Date(row.expected_return_date)
    if (Number.isNaN(due.getTime())) continue
    const days = daysPastDue(due, now)
    const stage = stageForDays(days)
    if (!stage) continue
    if (sentKeys.has(`${row.id}:${stage}`)) continue

    const name = row.display_name?.trim() || "there"
    const email = holderEmail(row)
    if (!email) {
      skipped.push({ name, title: row.title, reason: "no_email" })
      continue
    }
    if (!deliverable(email)) {
      skipped.push({ name, title: row.title, reason: "undeliverable" })
      continue
    }

    pending.push({
      id: row.id,
      email,
      name,
      stage,
      line: {
        title: row.title,
        author: row.author,
        nodeName: row.node_name,
        pocket: Boolean(row.is_pocket_library),
        dueLabel: formatDueDate(due),
        lateLabel: lateLabel(days),
      },
    })
  }

  const byEmail = new Map<string, Pending[]>()
  for (const item of pending) {
    const list = byEmail.get(item.email) ?? []
    list.push(item)
    byEmail.set(item.email, list)
  }

  const sent: ReminderSend[] = []
  for (const [email, items] of byEmail) {
    const tone = items.reduce<ReminderStage>((max, item) => laterStage(max, item.stage), "due")
    const claimed = await claimReminders(items, email)
    if (!claimed.length) continue

    const letter = renderReturnReminderEmail({
      displayName: claimed[0].name,
      stage: tone,
      books: claimed.map((item) => item.line),
      supportEmail: guestPassReplyTo(),
    })
    const result = await sendMail({
      to: email,
      replyTo: guestPassReplyTo(),
      subject: letter.subject,
      text: letter.text,
      html: letter.html,
      idempotencyKey: `return-reminder/${tone}/${claimed.map((item) => item.id).sort().join(",")}`,
    })
    if (!result.sent) {
      await releaseReminders(claimed)
      console.error("[return-reminders] mail was not accepted for", claimed.map((item) => item.line.title).join(", "))
      continue
    }
    sent.push({
      name: claimed[0].name,
      stage: tone,
      titles: claimed.map((item) => item.line.title),
    })
  }

  return { sent, skipped }
}

/**
 * Record every stage up through the one this book has reached.
 * The book is included only when its latest stage was newly recorded,
 * so a second run the same morning does not send the letter again.
 */
type ClaimedBook = {
  id: string
  name: string
  stage: ReminderStage
  line: ReminderBookLine
  /** Stages this run inserted. A failed send removes only these, not an earlier letter. */
  inserted: ReminderStage[]
}

async function claimReminders(
  items: Array<{ id: string; name: string; stage: ReminderStage; line: ReminderBookLine }>,
  email: string,
): Promise<ClaimedBook[]> {
  const client = await resilientConnect()
  const claimed: ClaimedBook[] = []
  try {
    await client.query("begin")
    for (const item of items) {
      const inserted: ReminderStage[] = []
      for (const stage of stagesThrough(item.stage)) {
        const result = await client.query(
          `insert into return_reminders (id, book_id, stage, sent_to)
           values ($1, $2, $3, $4)
           on conflict (book_id, stage) do nothing
           returning stage`,
          [crypto.randomUUID(), item.id, stage, email]
        )
        if ((result.rowCount ?? 0) > 0) inserted.push(stage)
      }
      if (inserted.includes(item.stage)) claimed.push({ ...item, inserted })
    }
    await client.query("commit")
    return claimed
  } catch (error) {
    await client.query("rollback").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function releaseReminders(items: ClaimedBook[]): Promise<void> {
  for (const item of items) {
    await resilientQuery(
      `delete from return_reminders where book_id = $1 and stage = any($2::text[])`,
      [item.id, item.inserted]
    )
  }
}
