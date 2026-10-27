import "server-only"

/**
 * Outbound mail via Resend's HTTP API, the same path Foresight Matchmaker uses.
 * No SMTP dependency. When the key is missing in local development, callers
 * may show the confirm link on screen. Production never does that.
 */

const RESEND_API = "https://api.resend.com/emails"
const SEND_TIMEOUT_MS = 8_000

/**
 * Matchmaker's domain is already verified in Resend (eu-west-1).
 * noreply@foresight.org becomes the from-address once that domain's DNS verifies.
 */
const DEFAULT_FROM = "Library of Things <noreply@foresightmatchmaker.app>"

export const DEFAULT_GUEST_PASS_REPLY_TO = "bradley@foresight.org"

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

export function mailFrom(): string {
  return process.env.SMTP_FROM?.trim() || DEFAULT_FROM
}

export function guestPassReplyTo(): string {
  return process.env.GUEST_PASS_REPLY_TO?.trim() || DEFAULT_GUEST_PASS_REPLY_TO
}

export type MailResult = { sent: true } | { sent: false; reason: "no_smtp" | "smtp_error" | "quota" }

function asList(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value : [value]
}

export async function sendMail(opts: {
  to: string
  replyTo?: string
  subject: string
  text: string
  html: string
  idempotencyKey?: string
}): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return { sent: false, reason: "no_smtp" }

  const payload = JSON.stringify({
    from: mailFrom(),
    to: asList(opts.to),
    reply_to: opts.replyTo,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  })

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "User-Agent": "library-of-things/mail",
        ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
      },
      body: payload,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    if (res.ok) return { sent: true }
    const detail = await res.text().catch(() => "")
    console.error("[mail] Resend rejected:", res.status, detail.slice(0, 300))
    if (res.status === 429) return { sent: false, reason: "quota" }
    return { sent: false, reason: "smtp_error" }
  } catch (error) {
    console.error("[mail] Resend send failed:", error)
    return { sent: false, reason: "smtp_error" }
  }
}
