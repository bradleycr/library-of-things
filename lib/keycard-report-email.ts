/**
 * Two weeks after a guest leaves the Berlin node: ask for the short stay report.
 */

import { KEYCARD_REPORT_EMAIL } from "@/lib/keycard-return-email"

const PAPER = "#f4faf8"
const INK = "#1c1f24"
const INK_SOFT = "#3c4644"
const SAGE = "#d7efe6"
const SAGE_DEEP = "#1a5c52"
const WHITE = "#ffffff"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const REPORT_ASKS = [
  "A page or two about your time at the node.",
  "What you found most valuable.",
  "What you feel could be improved, or what you’d like to see more of.",
  "Any relevant photos (and a quick OK from anyone else who appears in them).",
  "Whether we may share excerpts.",
  "Whether we may mention your name.",
  "Whether we may use the write-up on socials, or only internally (for example impact reporting).",
] as const

/**
 * Soft thank-you + report brief, two weeks after the stay ends.
 * Reply goes to the node manager.
 */
export function renderKeycardReportReminderEmail(input: {
  guestName: string
  nodeName: string
  cardLabel: string
  reportEmail?: string
}): { subject: string; text: string; html: string } {
  const name = input.guestName.trim() || "there"
  const reportTo = (input.reportEmail || KEYCARD_REPORT_EMAIL).trim()
  const node = input.nodeName.trim() || "the Berlin Node"
  const subject = `A short report from your time at ${node}`
  const thanks = `Thank you for joining us at the Berlin Node. We hope the stay was useful.`
  const ask = `If you have not already, please send a short report to ${reportTo}. A page or two is plenty — and it helps us keep the node working for the next people who come through.`
  const leadIn = "In the write-up, it helps to cover:"

  const text = [
    `Hi ${name},`,
    "",
    thanks,
    "",
    ask,
    "",
    leadIn,
    ...REPORT_ASKS.map((line, index) => `${index + 1}. ${line}`),
    "",
    `You had ${input.cardLabel}. Reply to this email or write ${reportTo} directly.`,
    "",
    "Thank you again,",
    "Bradley Clark Royes",
    "Node Manager, The Foresight Institute",
  ].join("\n")

  const items = REPORT_ASKS.map(
    (line) =>
      `<li style="margin:0 0 10px 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${INK_SOFT};">${escapeHtml(line)}</li>`
  ).join("")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">A short report from your stay would mean a lot.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${WHITE};border-radius:18px;overflow:hidden;">
          <tr>
            <td style="height:8px;line-height:8px;background:${SAGE};font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${SAGE_DEEP};">Library of Things</p>
              <h1 style="margin:10px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;font-weight:normal;color:${INK};">Thank you for joining us</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${INK_SOFT};">Hi ${escapeHtml(name)},</p>
              <p style="margin:12px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(thanks)}</p>
              <p style="margin:12px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(ask)}</p>
              <p style="margin:18px 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.3;color:${INK};">${escapeHtml(leadIn)}</p>
              <ol style="margin:0;padding:0 0 0 20px;">${items}</ol>
              <p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${INK_SOFT};">You had ${escapeHtml(input.cardLabel)}. Reply to this email or write <a href="mailto:${escapeHtml(reportTo)}" style="color:${SAGE_DEEP};">${escapeHtml(reportTo)}</a> directly.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 28px 32px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.4;color:${INK};">Thank you again,</p>
              <p style="margin:8px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45;color:${INK};">Bradley Clark Royes</p>
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:${INK_SOFT};">Node Manager, The Foresight Institute</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}
