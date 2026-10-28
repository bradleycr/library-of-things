/**
 * Morning-of return note for a temporary keycard, plus the steward copies.
 */

const PAPER = "#f4faf8"
const INK = "#1c1f24"
const INK_SOFT = "#3c4644"
const SAGE_DEEP = "#1a5c52"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export const KEYCARD_REPORT_EMAIL = "bradley@foresight.org"

export function renderKeycardDueEmail(input: {
  guestName: string
  cardLabel: string
  nodeName: string
  untilLabel: string
}): { subject: string; text: string; html: string } {
  const name = input.guestName.trim() || "there"
  const subject = `Today is the day to return ${input.cardLabel}`
  const steps = [
    "Scan the QR code on the card and select Return in the app.",
    `Confirm you will send ${KEYCARD_REPORT_EMAIL} a short report on your time at the node. There is a checkbox for that.`,
    "Leave the physical card with reception at CIC Berlin. After reception hours, put it in the return locker in the node office (bottom right of the lockers).",
    "Optional: take a photo of the card in the locker so a steward can see it was left.",
  ]
  const text = [
    `Hi ${name},`,
    "",
    `Today (${input.untilLabel}) is the day you planned to return ${input.cardLabel} at ${input.nodeName}.`,
    "",
    "How to return it:",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Thank you,",
    "Library of Things",
  ].join("\n")

  const items = steps
    .map((step) => `<li style="margin:0 0 8px 0;">${escapeHtml(step)}</li>`)
    .join("")
  const html = `<!doctype html><html><body style="margin:0;background:${PAPER};">
    <div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:Georgia,serif;color:${INK};">
      <p style="margin:0 0 12px 0;font-size:18px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;color:${INK_SOFT};">Today (${escapeHtml(input.untilLabel)}) is the day you planned to return <strong style="color:${INK};">${escapeHtml(input.cardLabel)}</strong> at ${escapeHtml(input.nodeName)}.</p>
      <p style="margin:0 0 8px 0;font-size:15px;color:${SAGE_DEEP};">How to return it</p>
      <ol style="margin:0 0 16px 20px;padding:0;font-size:16px;line-height:1.5;color:${INK_SOFT};">${items}</ol>
      <p style="margin:0;font-size:15px;">Thank you,<br/>Library of Things</p>
    </div>
  </body></html>`
  return { subject, text, html }
}

export function renderKeycardDueStewardEmail(input: {
  guestName: string
  guestEmail: string
  cardLabel: string
  nodeName: string
  untilLabel: string
}): { subject: string; text: string; html: string } {
  const subject = `${input.cardLabel} is due back today — ${input.guestName}`
  const text = [
    `${input.guestName} (${input.guestEmail}) planned to return ${input.cardLabel} today (${input.untilLabel}) at ${input.nodeName}.`,
    "",
    "They also get a reminder this morning with the return steps. You can check in if you want.",
  ].join("\n")
  const html = `<!doctype html><html><body style="margin:0;background:${PAPER};">
    <div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:Georgia,serif;color:${INK};">
      <p style="margin:0 0 12px 0;font-size:18px;">${escapeHtml(input.cardLabel)} is due back today</p>
      <p style="margin:0;font-size:16px;line-height:1.5;color:${INK_SOFT};"><strong style="color:${INK};">${escapeHtml(input.guestName)}</strong> (${escapeHtml(input.guestEmail)}) planned to return it on ${escapeHtml(input.untilLabel)} at ${escapeHtml(input.nodeName)}. They get the same morning reminder. You can check in if you want.</p>
    </div>
  </body></html>`
  return { subject, text, html }
}

export function renderKeycardReturnedStewardEmail(input: {
  guestName: string
  guestEmail: string | null
  cardLabel: string
  nodeName: string | null
  reportPromised: boolean
  bySteward: boolean
}): { subject: string; text: string; html: string } {
  const who = input.guestEmail ? `${input.guestName} (${input.guestEmail})` : input.guestName
  const subject = `${input.cardLabel} was returned — ${input.guestName}`
  const how = input.bySteward
    ? "A steward marked it returned."
    : input.reportPromised
      ? `They checked the box that they will email ${KEYCARD_REPORT_EMAIL} a short report on their time at the node.`
      : "They returned it from the card."
  const where = input.nodeName ? ` Node: ${input.nodeName}.` : ""
  const text = `${who} returned ${input.cardLabel}.${where} ${how}`
  const html = `<!doctype html><html><body style="margin:0;background:${PAPER};">
    <div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:Georgia,serif;color:${INK};">
      <p style="margin:0 0 12px 0;font-size:18px;">${escapeHtml(input.cardLabel)} was returned</p>
      <p style="margin:0;font-size:16px;line-height:1.5;color:${INK_SOFT};"><strong style="color:${INK};">${escapeHtml(who)}</strong> returned it.${escapeHtml(where)} ${escapeHtml(how)}</p>
    </div>
  </body></html>`
  return { subject, text, html }
}
