/**
 * The letter that asks for a book back.
 *
 * Three moments share this stationery: the day it is due, a week later,
 * and a month after that. The coworking line is part of every one of them.
 */

import { RETURN_COWORKING, type ReminderStage } from "@/lib/return-reminders"

const PAPER = "#f4faf8"
const INK = "#1c1f24"
const INK_SOFT = "#3c4644"
const SAGE = "#d7efe6"
const SAGE_DEEP = "#1a5c52"
const WHITE = "#ffffff"

export interface ReminderBookLine {
  title: string
  author?: string | null
  /** Where it goes back. A node name, or empty for a Pocket Library copy. */
  nodeName?: string | null
  pocket: boolean
  dueLabel: string
  lateLabel: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function intro(stage: ReminderStage, count: number): string {
  const books = count === 1 ? "a book" : `${count} books`
  if (stage === "due") {
    return count === 1
      ? "A book you borrowed is due back today."
      : `${count} books you borrowed are due back today.`
  }
  if (stage === "week") {
    return count === 1
      ? "A book you borrowed was due a week ago. Please bring it back when you can."
      : `${count} books you borrowed were due a week ago. Please bring them back when you can.`
  }
  return `This is a reminder about ${books} still out past the month we hope for. Please bring ${count === 1 ? "it" : "them"} back.`
}

function subject(stage: ReminderStage, titles: string[]): string {
  const one = titles.length === 1 ? titles[0] : null
  if (stage === "due") return one ? `${one} is due back today` : "Library books are due back today"
  if (stage === "week") return one ? `${one} is a week overdue` : "A few library books are a week overdue"
  return one ? `Please bring back ${one}` : "Please bring back your library books"
}

function coworkingProse(stage: ReminderStage): string {
  const moment =
    stage === "due"
      ? "It is a good time to bring a book back."
      : "It is a perfect time to return an overdue book."
  return `We cohost an open coworking ${RETURN_COWORKING.when} with ${RETURN_COWORKING.partner}. You can register at the link below. ${moment}`
}

function whereLine(book: ReminderBookLine): string {
  if (book.pocket) return "Pocket Library — back to the person you borrowed it from"
  return book.nodeName?.trim() || "the node where you picked it up"
}

export function renderReturnReminderEmail(input: {
  displayName: string
  stage: ReminderStage
  books: ReminderBookLine[]
  supportEmail: string
}): { subject: string; text: string; html: string } {
  const books = input.books
  const lead = intro(input.stage, books.length)
  const coworking = coworkingProse(input.stage)
  const support = `If you need a hand with how to bring ${books.length === 1 ? "it" : "them"} back, or when to come to the node, email ${input.supportEmail}.`
  const title = subject(input.stage, books.map((book) => book.title))

  const lines = books.map((book) => {
    const author = book.author?.trim() ? ` — ${book.author.trim()}` : ""
    return `${book.title}${author}\nDue ${book.dueLabel} · ${book.lateLabel}\nBring it to ${whereLine(book)}`
  })

  const text = [
    `Hello ${input.displayName},`,
    "",
    lead,
    "",
    ...lines.flatMap((line) => [line, ""]),
    support,
    "",
    coworking,
    RETURN_COWORKING.url,
    "",
    "Thank you,",
    "Library of Things",
  ].join("\n")

  const bookHtml = books
    .map((book) => {
      const author = book.author?.trim()
        ? `<p style="margin:4px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45;color:${INK_SOFT};">${escapeHtml(book.author.trim())}</p>`
        : ""
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border-radius:14px;margin-top:12px;">
        <tr>
          <td style="padding:16px 18px;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.3;color:${INK};">${escapeHtml(book.title)}</p>
            ${author}
            <p style="margin:8px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45;color:${SAGE_DEEP};">Due ${escapeHtml(book.dueLabel)} · ${escapeHtml(book.lateLabel)}</p>
            <p style="margin:4px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45;color:${INK_SOFT};">Bring it to ${escapeHtml(whereLine(book))}.</p>
          </td>
        </tr>
      </table>`
    })
    .join("")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(lead)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${WHITE};border-radius:18px;overflow:hidden;">
          <tr><td style="height:8px;line-height:8px;background:${SAGE};font-size:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${SAGE_DEEP};">Library of Things</p>
              <h1 style="margin:10px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;font-weight:normal;color:${INK};">Please bring ${books.length === 1 ? "this book" : "these books"} back</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${INK_SOFT};">Hello ${escapeHtml(input.displayName)},</p>
              <p style="margin:12px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(lead)}</p>
              ${bookHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(support)}</p>
              <p style="margin:14px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(coworking)}</p>
              <p style="margin:8px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;"><a href="${escapeHtml(RETURN_COWORKING.url)}" style="color:${SAGE_DEEP};">${escapeHtml(RETURN_COWORKING.url)}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 28px 32px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.4;color:${INK};">Thank you,</p>
              <p style="margin:4px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45;color:${INK_SOFT};">Library of Things</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject: title, text, html }
}
