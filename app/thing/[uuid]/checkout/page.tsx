"use client"

/**
 * A temporary keycard, opened from its NFC tag or printed QR.
 *
 * Checking out does not require a library card. A visitor is not joining the
 * library. They give a name and an email, then confirm from that inbox before
 * the card is actually out. Returning still only needs the physical card.
 */

import { Suspense, use, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CreditCard, Loader2, MapPin } from "lucide-react"
import { BookCover } from "@/components/book-cover"
import { ReturnDropoffPhoto } from "@/components/return-dropoff-photo"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BERLIN_DROPOFF } from "@/lib/berlin-dropoff"
import { getBookCoverSrcs } from "@/lib/book-cover-generator"
import { isValidEmail, normalizeEmail } from "@/lib/email"
import { isPlausibleGuestName } from "@/lib/guest-pass"
import { KEYCARD_REPORT_EMAIL } from "@/lib/keycard-return-email"
import { KEYCARD_STAY_MAX_DAYS, addCalendarDays, berlinDayKey, parsePlannedEndDate } from "@/lib/keycard-stay"
import { cn } from "@/lib/utils"
import type { Book, Node } from "@/lib/types"

type TapPayload = {
  book: Book
  nodes: Node[]
}

export default function ThingCheckoutPage({ params }: { params: Promise<{ uuid: string }> }) {
  return (
    <Suspense fallback={<Centered title="Opening card…" loading />}>
      <ThingCheckoutInner params={params} />
    </Suspense>
  )
}

function ThingCheckoutInner({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params)
  const token = useSearchParams().get("token")
  const [payload, setPayload] = useState<TapPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [until, setUntil] = useState("")
  const [reportAck, setReportAck] = useState(false)
  const [dropoffPhoto, setDropoffPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [devConfirmUrl, setDevConfirmUrl] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const load = async () => {
    if (!token) {
      setError("Open this page by tapping the card’s NFC tag or scanning its QR code.")
      return
    }
    const response = await fetch(`/api/books/${uuid}/tap?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      credentials: "include",
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error((body as { error?: string }).error ?? "Item not found")
    setPayload(body as TapPayload)
  }

  useEffect(() => {
    load().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load item"))
    // The tap token is the whole identity of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, uuid])

  const item = payload?.book
  const homeNode = payload?.nodes.find(
    (node) => node.id === (item?.home_node_id ?? item?.current_node_id)
  )
  const normalizedEmail = normalizeEmail(email)
  const nameOk = isPlausibleGuestName(name)
  const emailOk = isValidEmail(normalizedEmail)
  const today = berlinDayKey(new Date())
  const latest = addCalendarDays(today, KEYCARD_STAY_MAX_DAYS)
  const untilOk = parsePlannedEndDate(until) != null

  const requestCheckout = async () => {
    if (!nameOk || !emailOk || !untilOk || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/things/guest-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          item_id: uuid,
          email: normalizedEmail,
          name: name.trim(),
          until,
          token,
        }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
        confirm_url?: string
      }
      if (!response.ok) throw new Error(body.error ?? "Checkout failed")
      setPendingEmail(normalizedEmail)
      setDevConfirmUrl(body.confirm_url ?? null)
      setFlash(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout failed")
    } finally {
      setBusy(false)
    }
  }

  const returnItem = async () => {
    if (busy || !reportAck) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/things/guest-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          item_id: uuid,
          token,
          report_ack: true,
          ...(dropoffPhoto ? { dropoff_photo: dropoffPhoto } : {}),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error((body as { error?: string }).error ?? "Return failed")
      const hadPhoto = Boolean(dropoffPhoto)
      setPayload((current) =>
        current
          ? {
              ...current,
              book: { ...current.book, availability_status: "available", current_holder_name: undefined },
            }
          : current
      )
      setPendingEmail(null)
      setDropoffPhoto(null)
      setReportAck(false)
      setFlash(
        hadPhoto
          ? "Returned in the app. Leave the physical card with CIC reception, or in the locker if reception is closed."
          : "Returned in the app. Now leave the physical card with CIC reception, or after hours in the return locker (bottom right)."
      )
      await load().catch(() => undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Return failed")
    } finally {
      setBusy(false)
    }
  }

  if (error && !payload) return <Centered title="This link could not be opened" text={error} />
  if (!payload || !item) return <Centered title="Opening card…" loading />

  const isAvailable = item.availability_status === "available"
  const isCheckedOut = item.availability_status === "checked_out"
  const isBlocked = !isAvailable && !isCheckedOut
  const covers = getBookCoverSrcs(item, "M")

  return (
    <main className="page-container flex min-h-[70vh] items-center justify-center py-8 sm:py-12">
      <div className="w-full max-w-sm space-y-6">
        <KeycardFace
          title={item.title}
          src={covers.src}
          fallbackSrc={covers.fallbackSrc}
          status={isAvailable ? "available" : isCheckedOut ? "out" : "blocked"}
          homeName={homeNode?.name}
        />

        {flash && (
          <p className="text-center font-lot text-lg text-foreground" role="status">
            {flash}
          </p>
        )}

        {isBlocked ? (
          <p className="text-center text-sm text-muted-foreground">
            This card is unavailable. Ask a steward.
          </p>
        ) : isAvailable && pendingEmail ? (
          <div className="space-y-3 rounded-2xl border border-border bg-muted/40 px-4 py-5 text-center" role="status">
            <p className="font-lot text-2xl text-foreground">Check your email</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We sent a confirmation to <span className="break-all text-foreground">{pendingEmail}</span>.
              Open it and confirm to check out this card. The card stays available until you do.
            </p>
            {devConfirmUrl && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Mail is not configured on this machine.{" "}
                <a className="underline" href={devConfirmUrl}>
                  Open the confirmation
                </a>
              </p>
            )}
            <button
              type="button"
              className="text-sm text-muted-foreground underline underline-offset-2"
              onClick={() => {
                setPendingEmail(null)
                setDevConfirmUrl(null)
              }}
            >
              Use a different email
            </button>
          </div>
        ) : isAvailable ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              void requestCheckout()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="guest-name">Your name</Label>
              <Input
                id="guest-name"
                type="text"
                autoComplete="name"
                autoCapitalize="words"
                placeholder="Richard"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest-email">Email</Label>
              <Input
                id="guest-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest-until">Until when</Label>
              <Input
                id="guest-until"
                type="date"
                required
                min={today}
                max={latest}
                value={until}
                onChange={(event) => setUntil(event.target.value)}
                className="h-12 text-base"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                The morning of this day you’ll get an email reminding you to return the card.
              </p>
            </div>
            <Button type="submit" className="btn-pastel h-12 w-full text-base" disabled={!nameOk || !emailOk || !untilOk || busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Email me a confirmation
            </Button>
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              No library card needed. Your email is not published in sharing history.{" "}
              <Link href="/privacy" className="underline underline-offset-2">
                Privacy notice
              </Link>
            </p>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              This card is out. If you have it in your hand, return it in the app, then leave the physical card at the node.
            </p>
            <div className="space-y-2 rounded-xl border border-border bg-muted/20 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">After you tap Return</p>
              <p>{BERLIN_DROPOFF.reception}</p>
              <p>{BERLIN_DROPOFF.locker}</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-3 py-3">
              <Checkbox
                id="guest-report"
                checked={reportAck}
                onCheckedChange={(checked) => setReportAck(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="guest-report" className="cursor-pointer text-sm leading-relaxed text-foreground">
                I will send {KEYCARD_REPORT_EMAIL} a short report on my time at the node.
              </label>
            </div>
            <ReturnDropoffPhoto value={dropoffPhoto} onChange={setDropoffPhoto} disabled={busy} />
            <Button
              type="button"
              className="btn-pastel h-12 w-full text-base"
              disabled={busy || !reportAck}
              onClick={returnItem}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Return
            </Button>
          </div>
        )}

        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>
    </main>
  )
}

function KeycardFace({
  title,
  src,
  fallbackSrc,
  status,
  homeName,
}: {
  title: string
  src: string
  fallbackSrc?: string
  status: "available" | "out" | "blocked"
  homeName?: string
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl shadow-lg ring-1",
        status === "available" && "ring-primary/40",
        status === "out" && "ring-amber-500/50",
        status === "blocked" && "ring-border"
      )}
    >
      <div className="aspect-[1.586/1] w-full">
        <BookCover src={src} fallbackSrc={fallbackSrc} title={title} className="h-full w-full" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-lot text-xl leading-tight text-white drop-shadow">
            <CreditCard className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="truncate">{title.replace(/^Temporary\s+/i, "")}</span>
          </p>
          {homeName && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-white/80">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              {homeName}
            </p>
          )}
        </div>
        <StatusPill status={status} />
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: "available" | "out" | "blocked" }) {
  const label = status === "available" ? "Available" : status === "out" ? "Out" : "Unavailable"
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide shadow-sm",
        status === "available" && "bg-emerald-500 text-white",
        status === "out" && "bg-amber-500 text-white",
        status === "blocked" && "bg-neutral-600 text-white"
      )}
    >
      {label}
    </span>
  )
}

function Centered({ title, text, loading }: { title: string; text?: string; loading?: boolean }) {
  return (
    <main className="page-container flex min-h-[60vh] items-center justify-center text-center">
      <div className="space-y-3">
        {loading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
        <h1 className="font-lot text-2xl">{title}</h1>
        {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
      </div>
    </main>
  )
}
