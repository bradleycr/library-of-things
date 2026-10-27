import { NextRequest, NextResponse } from "next/server"
import { guestPassCardLabel, isPlausibleGuestName, normalizeGuestName } from "@/lib/guest-pass"
import { GUEST_CONFIRM_TTL_DAYS, renderGuestPassEmail, stayWindow } from "@/lib/guest-pass-email"
import { isValidEmail, normalizeEmail } from "@/lib/email"
import { resolveLoanPeriodDays } from "@/lib/loan-period"
import { appOrigin } from "@/lib/server/app-origin"
import {
  createGuestCheckoutRequest,
  deleteGuestCheckoutRequest,
  getAppConfig,
  getBookById,
  listNodes,
} from "@/lib/server/repositories"
import { itemTokenMatches } from "@/lib/server/item-token"
import { guestPassReplyTo, mailConfigured, sendMail } from "@/lib/server/mail"
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"
import { isUuid, parseJsonBody } from "@/lib/server/validate"

const NO_STORE = { "Cache-Control": "no-store" }

/**
 * Starts a guest-pass checkout. The card stays available until the person
 * opens the email and confirms. A library card is intentionally not required:
 * this is a visitor pass, not a membership.
 */
export async function POST(request: NextRequest) {
  const limited = checkRateLimit(`guest-checkout:${getClientIp(request)}`, 8, 60_000)
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429, headers: NO_STORE })
  }

  const parsed = await parseJsonBody<{
    item_id?: string
    email?: string
    name?: string
    token?: string
  }>(request)
  if (!parsed.ok) return parsed.response

  const itemId = parsed.data.item_id
  const email = normalizeEmail(parsed.data.email)
  const name = normalizeGuestName(parsed.data.name ?? "")
  if (!itemId || !isUuid(itemId) || !isValidEmail(email) || !isPlausibleGuestName(name)) {
    return NextResponse.json(
      { error: "A valid card, name, and email address are required." },
      { status: 400, headers: NO_STORE }
    )
  }

  try {
    const item = await getBookById(itemId)
    if (!item || item.item_type === "book") {
      return NextResponse.json({ error: "Item not found" }, { status: 404, headers: NO_STORE })
    }
    if (!itemTokenMatches(item, parsed.data.token)) {
      return NextResponse.json(
        { error: "Open this page from the item's NFC tag." },
        { status: 403, headers: NO_STORE }
      )
    }
    if (item.availability_status !== "available") {
      return NextResponse.json({ error: "This card is not available." }, { status: 400, headers: NO_STORE })
    }

    const [nodes, config] = await Promise.all([listNodes(), getAppConfig()])
    const home = nodes.find((node) => node.id === (item.home_node_id ?? item.current_node_id))
    const nodeName = home?.name || item.current_node_name || "the Node"
    const cardLabel = guestPassCardLabel(item)
    const loanPeriodDays = resolveLoanPeriodDays(
      item.lending_terms?.loan_period_days,
      config.default_loan_period_days
    )
    const window = stayWindow(new Date(), loanPeriodDays)
    const created = await createGuestCheckoutRequest({
      itemId,
      borrowerEmail: email,
      borrowerName: name,
      nodeName,
      cardLabel,
      validFromLabel: window.fromLabel,
      validUntilLabel: window.untilLabel,
      validUntil: window.until,
      loanPeriodDays,
    })

    const origin = appOrigin(request.headers)
    const confirmUrl = `${origin}/thing/confirm?token=${encodeURIComponent(created.token)}`
    const letter = renderGuestPassEmail({
      guestName: name,
      nodeName,
      cardLabel,
      validFromLabel: window.fromLabel,
      validUntilLabel: window.untilLabel,
      confirmUrl,
      logoUrl: `${origin}/foresight-logo.png`,
      privacyUrl: `${origin}/privacy`,
    })

    if (mailConfigured()) {
      const result = await sendMail({
        to: email,
        replyTo: guestPassReplyTo(),
        subject: letter.subject,
        text: letter.text,
        html: letter.html,
        idempotencyKey: created.id,
      })
      if (!result.sent) {
        await deleteGuestCheckoutRequest(created.id).catch(() => undefined)
        const message =
          result.reason === "quota"
            ? "We couldn't send the email just now. Try again a little later."
            : "We couldn't send the confirmation email. Try again."
        return NextResponse.json({ error: message }, { status: 503, headers: NO_STORE })
      }
      return NextResponse.json(
        { pending: true, sent: true, ttl_days: GUEST_CONFIRM_TTL_DAYS },
        { headers: NO_STORE }
      )
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[mail] guest pass confirmation created for local development")
      return NextResponse.json(
        { pending: true, sent: false, confirm_url: confirmUrl, ttl_days: GUEST_CONFIRM_TTL_DAYS },
        { headers: NO_STORE }
      )
    }

    await deleteGuestCheckoutRequest(created.id).catch(() => undefined)
    return NextResponse.json(
      { error: "Email confirmation is not set up yet. Ask a steward." },
      { status: 503, headers: NO_STORE }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 400, headers: NO_STORE }
    )
  }
}
