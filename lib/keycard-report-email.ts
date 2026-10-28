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

const REPORT_POINTS = [
  "A page or two about your time at the node (what you worked on, who you met, highlights).",
  "What you found most valuable.",
  "What could be better, or what you’d like to see more of.",
  "Any photos you’re happy to share (check with people who appear in them).",
] as const

/**
 * Soft thank-you + report brief, two weeks after the stay ends.
 * Full write-ups stay internal; we only ask about quotes and naming.
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
  const subject = `Thanks for hanging out at the Berlin Node`
  const thanks = `Hey ${name}, thanks for hanging out with us at the Berlin Node. Hope it was a good one.`
  const ask = `If you haven’t already, could you send a short write-up to ${reportTo}? A page or two is perfect. It helps us keep the place humming for the next folks who come through.`
  const cover = "A few things worth covering:"
  const privacy = [
    "We never publish your full report. The whole thing stays for our internal reporting (impact notes, how the node is doing, that kind of thing).",
    "Quick ask: if we spot a line we love, may we share a short quote? And is it okay to mention your name with it, or would you rather stay anonymous?",
  ].join(" ")

  const text = [
    thanks,
    "",
    ask,
    "",
    cover,
    ...REPORT_POINTS.map((line, index) => `${index + 1}. ${line}`),
    "",
    privacy,
    "",
    `You had ${input.cardLabel}. Just reply to this email, or write ${reportTo}.`,
    "",
    "Thanks again,",
    "Bradley",
    "Node Manager, Berlin",
  ].join("\n")

  const items = REPORT_POINTS.map(
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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Thanks for hanging out at the Berlin Node.</div>
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
              <h1 style="margin:10px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;font-weight:normal;color:${INK};">Thanks for hanging out</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(thanks)}</p>
              <p style="margin:12px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(ask)}</p>
              <p style="margin:18px 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.3;color:${INK};">${escapeHtml(cover)}</p>
              <ol style="margin:0;padding:0 0 0 20px;">${items}</ol>
              <p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(privacy)}</p>
              <p style="margin:14px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${INK_SOFT};">You had ${escapeHtml(input.cardLabel)}. Just reply to this email, or write <a href="mailto:${escapeHtml(reportTo)}" style="color:${SAGE_DEEP};">${escapeHtml(reportTo)}</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 28px 32px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.4;color:${INK};">Thanks again,</p>
              <p style="margin:8px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45;color:${INK};">Bradley</p>
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:${INK_SOFT};">Node Manager, Berlin · ${escapeHtml(node)}</p>
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
