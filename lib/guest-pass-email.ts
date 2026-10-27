/**
 * The Foresight Berlin guest-pass letter.
 *
 * This is the note a visitor receives before a temporary keycard is actually
 * checked out. The button is the confirmation — a reply cannot be verified
 * by the app — and Reply-To still lands with the node manager.
 *
 * Dates are written in Europe/Berlin because that is where the pass is used.
 * Forks with a different house letter should edit this module.
 */

export const GUEST_PASS_TIME_ZONE = "Europe/Berlin"

export const GUEST_CONFIRM_TTL_DAYS = 7

export const GUEST_PASS_SIGNATORY = {
  name: "Bradley Clark Royes",
  role: "Node Manager",
  organization: "The Foresight Institute",
  lines: ["50 California Street, Suite 1500", "San Francisco, 94111"],
} as const

export interface GuestPassFactsInput {
  guestName: string
  nodeName: string
  cardLabel: string
  validFromLabel: string
  validUntilLabel: string
}

export interface GuestPassFacts {
  subject: string
  preheader: string
  greeting: string
  welcome: string
  passLine: string
  validLine: string
  askIntro: string
  asks: Array<{ title: string; body: string }>
  returningTitle: string
  returning: string[]
  guide: string
  confirmPrompt: string
  closing: string
}

/** "Thursday, 22 October" → "Thursday 22 October", in Berlin. */
export function formatStayDate(value: Date): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: GUEST_PASS_TIME_ZONE,
  }).format(value)
  return formatted.replace(",", "")
}

export function stayWindow(from: Date, days: number): {
  from: Date
  until: Date
  fromLabel: string
  untilLabel: string
} {
  const until = new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
  return {
    from,
    until,
    fromLabel: formatStayDate(from),
    untilLabel: formatStayDate(until),
  }
}

export function guestPassFacts(input: GuestPassFactsInput): GuestPassFacts {
  const subjectCard = input.cardLabel.replace(/^Keycard/, "Card")
  const subject = /#\d+/.test(input.cardLabel)
    ? `Your guest pass for the ${input.nodeName} (${subjectCard})`
    : `Your guest pass for the ${input.nodeName}`

  return {
    subject,
    preheader: `Confirm your email to check out ${input.cardLabel}.`,
    greeting: `Hi ${input.guestName},`,
    welcome: `Welcome to the ${input.nodeName}! Here's everything you need for your stay.`,
    passLine: `Your pass: ${input.cardLabel}`,
    validLine: `Valid: ${input.validFromLabel} to ${input.validUntilLabel}`,
    askIntro: "Two things we ask in return",
    asks: [
      {
        title: "Use it.",
        body: "We only have a handful of passes, so we ask that you're at the Node at least half of the working days of your stay (roughly every other working day). Thursdays are Residents Day, the best day to meet the rest of the community, so please join us then. If your plans change and you can't make it in, let me know. If you finish early, return the card so someone else can use it.",
      },
      {
        title: "Write a short report.",
        body: "Within a week of your last day, send me a short write-up of your time here. A page or two is plenty, the format is up to you, and a couple of photos are welcome. Things worth covering: what you worked on, a few highlights, who you met and any connections that came out of it, and what was most useful about the Node and what could be better. We may share excerpts, with credit, in Foresight posts or reports, so just say if you'd rather we didn't. If your photos include other people, please check they're OK with it.",
      },
    ],
    returningTitle: "Returning the card",
    returning: [
      "Scan the QR code on the card and tap Return in the app.",
      "Hand the card in at CIC reception, give it to me directly, or after hours drop it in the card return locker inside the Node.",
      "If the card gets lost, tell me the same day so we can deactivate it. A replacement costs €15.",
    ],
    guide: "House rules and practical info are in our Community Guide.",
    confirmPrompt:
      "Tap the button to confirm your email and check out the card. That confirms you're good with the above. If your plans change, reply to this email.",
    closing: "Looking forward to having you here,",
  }
}

export interface RenderedGuestPass {
  subject: string
  text: string
  html: string
}

const PAPER = "#f4faf8"
const INK = "#1c1f24"
const INK_SOFT = "#3c4644"
const SAGE = "#d7efe6"
const SAGE_DEEP = "#1a5c52"
const RULE = "#d5e4de"
const WHITE = "#ffffff"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Stationery for the letter: sage bar, serif greeting, the pass set apart,
 * then the two asks and one confirm button. Email clients get tables, not
 * our web fonts — Georgia stands in for the library's serif.
 */
export function renderGuestPassEmail(input: GuestPassFactsInput & {
  confirmUrl: string
  logoUrl: string
  privacyUrl: string
}): RenderedGuestPass {
  const facts = guestPassFacts(input)
  const sign = GUEST_PASS_SIGNATORY
  const href = escapeHtml(input.confirmUrl)

  const text = [
    facts.greeting,
    "",
    facts.welcome,
    "",
    facts.passLine,
    facts.validLine,
    "",
    facts.askIntro,
    "",
    ...facts.asks.flatMap((ask, index) => [`${index + 1}. ${ask.title} ${ask.body}`, ""]),
    facts.returningTitle,
    ...facts.returning.map((line) => `- ${line}`),
    "",
    facts.guide,
    "",
    facts.confirmPrompt,
    input.confirmUrl,
    "",
    `This link works for ${GUEST_CONFIRM_TTL_DAYS} days. If you did not ask for this card, ignore the email and the card stays available.`,
    "",
    facts.closing,
    "",
    sign.name,
    sign.role,
    sign.organization,
    ...sign.lines,
    "",
    `Privacy: ${input.privacyUrl}`,
  ].join("\n")

  const asksHtml = facts.asks
    .map(
      (ask, index) => `<p style="margin:16px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.45;color:${INK};"><strong>${index + 1}. ${escapeHtml(ask.title)}</strong> <span style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(ask.body)}</span></p>`
    )
    .join("")

  const returningHtml = facts.returning
    .map(
      (line) => `<p style="margin:8px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${INK_SOFT};">${escapeHtml(line)}</p>`
    )
    .join("")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(facts.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(facts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${WHITE};border-radius:18px;overflow:hidden;">
          <tr>
            <td style="height:8px;line-height:8px;background:${SAGE};font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <img src="${escapeHtml(input.logoUrl)}" alt="Foresight Institute" width="132" style="display:block;width:132px;height:auto;border:0;" />
              <p style="margin:18px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${SAGE_DEEP};">Library of Things</p>
              <h1 style="margin:10px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;font-weight:normal;color:${INK};">${escapeHtml(facts.greeting)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(facts.welcome)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.3;color:${INK};">${escapeHtml(facts.passLine)}</p>
                    <p style="margin:6px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45;color:${SAGE_DEEP};">${escapeHtml(facts.validLine)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 0 32px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;color:${INK};">${escapeHtml(facts.askIntro)}</p>
              ${asksHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 0 32px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;color:${INK};">${escapeHtml(facts.returningTitle)}</p>
              ${returningHtml}
              <p style="margin:14px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${INK_SOFT};">${escapeHtml(facts.guide)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(facts.confirmPrompt)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${SAGE};border-radius:999px;">
                    <a href="${href}" style="display:inline-block;padding:14px 22px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;color:${INK};">Confirm checkout</a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${INK_SOFT};">This link works for ${GUEST_CONFIRM_TTL_DAYS} days. If you did not ask for this card, ignore the email and the card stays available.</p>
              <p style="margin:8px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;word-break:break-all;">
                <a href="${href}" style="color:${SAGE_DEEP};">${href}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 28px 32px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.45;color:${INK};">${escapeHtml(facts.closing)}</p>
              <p style="margin:14px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45;color:${INK};">${escapeHtml(sign.name)}</p>
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:${INK_SOFT};">${escapeHtml(sign.role)}</p>
              <p style="margin:10px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:${INK_SOFT};">${escapeHtml(sign.organization)}<br />${sign.lines.map(escapeHtml).join("<br />")}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid ${RULE};background:${PAPER};">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${INK_SOFT};">
                Library of Things · <a href="${escapeHtml(input.privacyUrl)}" style="color:${SAGE_DEEP};">Privacy notice</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject: facts.subject, text, html }
}
