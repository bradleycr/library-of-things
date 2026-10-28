import "server-only"

import crypto from "crypto"
import { formatStayDate } from "@/lib/guest-pass-email"
import { guestPassCardLabel } from "@/lib/guest-pass"
import { berlinDayKey } from "@/lib/keycard-stay"
import { renderKeycardReportReminderEmail } from "@/lib/keycard-report-email"
import {
  renderKeycardDueEmail,
  renderKeycardDueStewardEmail,
  renderKeycardReturnedStewardEmail,
} from "@/lib/keycard-return-email"
import { isValidEmail, normalizeEmail } from "@/lib/email"
import { resilientQuery } from "@/lib/server/db"
import { guestPassReplyTo, sendMail, stewardMailCc } from "@/lib/server/mail"

type DueRow = {
  id: string
  title: string
  asset_number: number | null
  expected_return_date: Date | string
  borrower_email: string | null
  borrower_name: string | null
  node_name: string | null
}

/**
 * Morning of the planned end date: remind the guest how to return the card,
 * and send the steward a separate note so they can check in.
 */
export async function sendKeycardDueReminders(now = new Date()): Promise<{ sent: string[] }> {
  const today = berlinDayKey(now)
  const { rows } = await resilientQuery<DueRow>(
    `select b.id, b.title, b.asset_number, b.expected_return_date, gl.borrower_email,
            (
              select le.metadata->>'borrower_name'
                from loan_events le
               where le.book_id = b.id and le.event_type = 'checkout'
               order by le.timestamp desc
               limit 1
            ) as borrower_name,
            n.name as node_name
       from books b
       join guest_loans gl on gl.book_id = b.id and gl.returned_at is null
       left join nodes n on n.id = coalesce(b.home_node_id, b.current_node_id)
      where coalesce(b.item_type, 'book') = 'keycard'
        and b.availability_status = 'checked_out'
        and b.expected_return_date is not null`
  )

  const sent: string[] = []
  const steward = stewardMailCc()

  for (const row of rows) {
    const due = new Date(row.expected_return_date)
    if (Number.isNaN(due.getTime()) || berlinDayKey(due) !== today) continue

    const email = normalizeEmail(row.borrower_email)
    if (!isValidEmail(email)) continue

    const claimed = await resilientQuery(
      `insert into return_reminders (id, book_id, stage, sent_to)
       values ($1, $2, 'due', $3)
       on conflict (book_id, stage) do nothing
       returning book_id`,
      [crypto.randomUUID(), row.id, email]
    )
    if ((claimed.rowCount ?? 0) === 0) continue

    const cardLabel = guestPassCardLabel(row)
    const guestName = row.borrower_name?.trim() || "there"
    const nodeName = row.node_name?.trim() || "the node"
    const untilLabel = formatStayDate(due)
    const guestLetter = renderKeycardDueEmail({ guestName, cardLabel, nodeName, untilLabel })
    const guestResult = await sendMail({
      to: email,
      replyTo: guestPassReplyTo(),
      subject: guestLetter.subject,
      text: guestLetter.text,
      html: guestLetter.html,
      idempotencyKey: `keycard-due/${row.id}/${today}`,
    })
    if (!guestResult.sent) {
      await resilientQuery(`delete from return_reminders where book_id = $1 and stage = 'due'`, [row.id])
      continue
    }

    if (steward && normalizeEmail(steward) !== email) {
      const note = renderKeycardDueStewardEmail({
        guestName,
        guestEmail: email,
        cardLabel,
        nodeName,
        untilLabel,
      })
      await sendMail({
        to: steward,
        replyTo: email,
        subject: note.subject,
        text: note.text,
        html: note.html,
        idempotencyKey: `keycard-due-steward/${row.id}/${today}`,
      })
    }
    sent.push(row.title)
  }

  return { sent }
}

type ReportFollowupRow = {
  id: string
  borrower_email: string
  borrower_name: string
  card_label: string
  node_name: string
}

/**
 * Two Berlin weeks after the guest left (or planned to leave): ask for the stay report.
 * Missed mornings still send once — report_due_on <= today and report_sent_at is null.
 */
export async function sendKeycardReportReminders(now = new Date()): Promise<{ sent: string[] }> {
  const today = berlinDayKey(now)
  const { rows } = await resilientQuery<ReportFollowupRow>(
    `select id, borrower_email, borrower_name, card_label, node_name
       from guest_stay_followups
      where report_sent_at is null
        and report_due_on <= $1::date
      order by report_due_on asc
      limit 80`,
    [today]
  )

  const sent: string[] = []
  const replyTo = guestPassReplyTo()

  for (const row of rows) {
    const email = normalizeEmail(row.borrower_email)
    if (!isValidEmail(email)) {
      await resilientQuery(
        `update guest_stay_followups set report_sent_at = now() where id = $1 and report_sent_at is null`,
        [row.id]
      )
      continue
    }

    const claimed = await resilientQuery(
      `update guest_stay_followups
          set report_sent_at = now()
        where id = $1 and report_sent_at is null
        returning id`,
      [row.id]
    )
    if ((claimed.rowCount ?? 0) === 0) continue

    const letter = renderKeycardReportReminderEmail({
      guestName: row.borrower_name,
      nodeName: row.node_name,
      cardLabel: row.card_label,
      reportEmail: replyTo,
    })
    const result = await sendMail({
      to: email,
      replyTo,
      subject: letter.subject,
      text: letter.text,
      html: letter.html,
      idempotencyKey: `keycard-report/${row.id}`,
    })
    if (!result.sent) {
      await resilientQuery(`update guest_stay_followups set report_sent_at = null where id = $1`, [row.id])
      continue
    }
    sent.push(row.card_label)
  }

  return { sent }
}

export async function notifyKeycardReturned(input: {
  guestName: string | null
  guestEmail: string | null
  cardTitle: string
  assetNumber?: number | null
  nodeName: string | null
  reportPromised: boolean
  bySteward: boolean
}): Promise<void> {
  const to = stewardMailCc()
  if (!to) return
  const letter = renderKeycardReturnedStewardEmail({
    guestName: input.guestName?.trim() || "A guest",
    guestEmail: input.guestEmail,
    cardLabel: guestPassCardLabel({ title: input.cardTitle, asset_number: input.assetNumber }),
    nodeName: input.nodeName,
    reportPromised: input.reportPromised,
    bySteward: input.bySteward,
  })
  const result = await sendMail({
    to,
    replyTo: input.guestEmail || undefined,
    subject: letter.subject,
    text: letter.text,
    html: letter.html,
  })
  if (!result.sent) {
    console.error("[keycard] return notice was not sent for", input.cardTitle)
  }
}
