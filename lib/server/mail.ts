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

/**
 * Steward archive copy for checkout / return mail (not PIN delivery).
 * Defaults to the same address as guest-pass Reply-To.
 * Override with STEWARD_MAIL_CC; set empty to disable.
 */
export function stewardMailCc(): string | null {
  if (process.env.STEWARD_MAIL_CC !== undefined) {
    const raw = process.env.STEWARD_MAIL_CC.trim()
    return raw || null
  }
  return guestPassReplyTo()
}

export type MailResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: "no_smtp" | "smtp_error" | "quota" }

function asList(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value : [value]
}

function normalizeAddr(value: string): string {
  return value.trim().toLowerCase()
}

/** CC list for a message, skipping the primary recipient so Resend isn’t sent a self-CC. */
function ccList(to: string, cc?: string | string[] | null): string[] | undefined {
  const toKey = normalizeAddr(to)
  const raw = asList(cc ?? undefined) ?? []
  const unique = [...new Set(raw.map((a) => a.trim()).filter(Boolean))]
  const filtered = unique.filter((a) => normalizeAddr(a) !== toKey)
  return filtered.length ? filtered : undefined
}

export async function sendMail(opts: {
  to: string
  cc?: string | string[] | null
  replyTo?: string
  subject: string
  text: string
  html: string
  idempotencyKey?: string
  /** When set, Resend holds the message until this instant (ISO / Date). */
  scheduledAt?: Date | string
}): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return { sent: false, reason: "no_smtp" }

  const cc = ccList(opts.to, opts.cc)
  const scheduledAt =
    opts.scheduledAt instanceof Date
      ? opts.scheduledAt.toISOString()
      : opts.scheduledAt?.trim() || undefined
  const payload = JSON.stringify({
    from: mailFrom(),
    to: asList(opts.to),
    ...(cc ? { cc } : {}),
    reply_to: opts.replyTo,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
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
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { id?: string }
      return { sent: true, id: typeof body.id === "string" ? body.id : null }
    }
    const detail = await res.text().catch(() => "")
    console.error("[mail] Resend rejected:", res.status, detail.slice(0, 300))
    if (res.status === 429) return { sent: false, reason: "quota" }
    return { sent: false, reason: "smtp_error" }
  } catch (error) {
    console.error("[mail] Resend send failed:", error)
    return { sent: false, reason: "smtp_error" }
  }
}

/** Cancel a Resend message that is still scheduled (e.g. unfinished checkout nudge). */
export async function cancelScheduledMail(emailId: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim()
  const id = emailId.trim()
  if (!key || !id) return false
  try {
    const res = await fetch(`${RESEND_API}/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "User-Agent": "library-of-things/mail",
      },
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    if (res.ok) return true
    const detail = await res.text().catch(() => "")
    // Already sent or already cancelled — treat as done so we do not retry forever.
    if (res.status === 404 || res.status === 422) return true
    console.error("[mail] Resend cancel rejected:", res.status, detail.slice(0, 200))
    return false
  } catch (error) {
    console.error("[mail] Resend cancel failed:", error)
    return false
  }
}
