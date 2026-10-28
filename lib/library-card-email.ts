/**
 * Letters for a library card.
 *
 * One asks the person to confirm an address before a card exists.
 * The other carries the card number and PIN (the only copy we show),
 * and only to the inbox they proved they can open.
 */

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

function shell(input: { subject: string; preheader: string; logoUrl: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${WHITE};border-radius:18px;overflow:hidden;">
          <tr>
            <td style="height:8px;line-height:8px;background:${SAGE};font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <img src="${escapeHtml(input.logoUrl)}" alt="Foresight Institute" width="132" style="display:block;width:132px;height:auto;border:0;" />
              <p style="margin:18px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${SAGE_DEEP};">Library of Things</p>
            </td>
          </tr>
          ${input.body}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function button(href: string, label: string): string {
  const safe = escapeHtml(href)
  return `<table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:${SAGE};border-radius:999px;">
        <a href="${safe}" style="display:inline-block;padding:14px 22px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;color:${INK};">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>
  <p style="margin:14px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;word-break:break-all;">
    <a href="${safe}" style="color:${SAGE_DEEP};">${safe}</a>
  </p>`
}

export function renderConfirmAddressEmail(input: {
  confirmUrl: string
  logoUrl: string
  privacyUrl: string
  /** signup creates the card; verify attaches the address to one that already exists. */
  kind: "signup" | "verify"
}): { subject: string; text: string; html: string } {
  const subject =
    input.kind === "signup"
      ? "Confirm your email for a library card"
      : "Confirm the email on your library card"
  const lead =
    input.kind === "signup"
      ? "Open this link to create your library card. We’ll then email the card number and PIN to this address."
      : "Open this link to confirm this address belongs to your library card. Borrowing a book needs an email you can open."
  const text = [
    lead,
    "",
    "This link works for 24 hours. If you didn’t ask for it, you can ignore this email.",
    "",
    input.confirmUrl,
    "",
    `Privacy: ${input.privacyUrl}`,
  ].join("\n")

  const html = shell({
    subject,
    preheader: "This link confirms the address. It does not contain your PIN.",
    logoUrl: input.logoUrl,
    body: `<tr>
      <td style="padding:8px 32px 0 32px;">
        <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;font-weight:normal;color:${INK};">Confirm this email</h1>
        <p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(lead)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 32px 28px 32px;">
        ${button(input.confirmUrl, input.kind === "signup" ? "Create my library card" : "Confirm this email")}
        <p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${INK_SOFT};">The link works for 24 hours. If you didn’t ask for a card, ignore this email.</p>
        <p style="margin:10px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;"><a href="${escapeHtml(input.privacyUrl)}" style="color:${SAGE_DEEP};">Privacy notice</a></p>
      </td>
    </tr>`,
  })

  return { subject, text, html }
}

export function renderLibraryCardEmail(input: {
  cardNumber: string
  pin: string
  loginUrl: string
  saveUrl: string
  logoUrl: string
  privacyUrl: string
}): { subject: string; text: string; html: string } {
  const subject = "Your Library of Things card"
  const text = [
    "Don’t share this email. It has your library card number and PIN. Anyone with both can log in as you.",
    "",
    `Card number: ${input.cardNumber}`,
    `PIN: ${input.pin}`,
    "",
    "This PIN replaces any earlier one. Use it to log in:",
    input.loginUrl,
    "",
    "On the device where you asked, you can save the card without typing:",
    input.saveUrl,
    "",
    "That save link works for 24 hours. The card number and PIN above keep working after that.",
    "If you didn’t ask for this, the PIN has already changed. Log in with the one in this email, and don’t forward it.",
    "",
    `Privacy: ${input.privacyUrl}`,
  ].join("\n")

  const html = shell({
    subject,
    preheader: "Your card number and a new PIN. Don’t share this email.",
    logoUrl: input.logoUrl,
    body: `<tr>
      <td style="padding:8px 32px 0 32px;">
        <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;font-weight:normal;color:${INK};">Your library card</h1>
        <p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${INK_SOFT};">Don’t share this email. It has your card number and PIN. Anyone with both can log in as you.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border-radius:14px;">
          <tr>
            <td style="padding:16px 18px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${SAGE_DEEP};">Card number</p>
              <p style="margin:6px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:0.04em;color:${INK};">${escapeHtml(input.cardNumber)}</p>
              <p style="margin:14px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${SAGE_DEEP};">PIN</p>
              <p style="margin:6px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:0.18em;color:${INK};">${escapeHtml(input.pin)}</p>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:${INK_SOFT};">This PIN replaces any earlier one. Use it to log in.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 32px 28px 32px;">
        ${button(input.loginUrl, "Log in")}
        <p style="margin:18px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:${INK_SOFT};">On the device where you asked, you can save the card without typing. That link works for 24 hours.</p>
        <p style="margin:8px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;word-break:break-all;"><a href="${escapeHtml(input.saveUrl)}" style="color:${SAGE_DEEP};">${escapeHtml(input.saveUrl)}</a></p>
        <p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${INK_SOFT};">If you didn’t ask for this, the PIN has already changed. Log in with the one above, and don’t forward this email.</p>
        <p style="margin:10px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;"><a href="${escapeHtml(input.privacyUrl)}" style="color:${SAGE_DEEP};">Privacy notice</a></p>
      </td>
    </tr>`,
  })

  return { subject, text, html }
}
