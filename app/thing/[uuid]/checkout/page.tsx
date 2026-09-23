"use client"

import { Suspense, use, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CreditCard, Loader2, Mail, MapPin } from "lucide-react"
import { BookCover } from "@/components/book-cover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getBookCoverSrcs } from "@/lib/book-cover-generator"
import { cn } from "@/lib/utils"
import type { Book, Node } from "@/lib/types"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type TapPayload = {
  book: Book
  nodes: Node[]
  holder_email: string | null
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
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, uuid])

  const item = payload?.book
  const homeNode = payload?.nodes.find(
    (node) => node.id === (item?.home_node_id ?? item?.current_node_id)
  )
  const normalizedEmail = email.trim().toLowerCase()
  const emailLooksValid = EMAIL_PATTERN.test(normalizedEmail)
  const holderEmail =
    payload?.holder_email?.trim() ||
    (item?.availability_status === "checked_out" ? item.current_holder_name : null)

  const checkout = async () => {
    if (!emailLooksValid || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/things/guest-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ item_id: uuid, email: normalizedEmail, token }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error((body as { error?: string }).error ?? "Checkout failed")
      setPayload((current) =>
        current
          ? {
              ...current,
              holder_email: normalizedEmail,
              book: {
                ...current.book,
                availability_status: "checked_out",
                current_holder_name: normalizedEmail,
              },
            }
          : current
      )
      setEmail("")
      setFlash("Checked out")
      await load().catch(() => undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout failed")
    } finally {
      setBusy(false)
    }
  }

  const returnItem = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/things/guest-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ item_id: uuid, token }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error((body as { error?: string }).error ?? "Return failed")
      setPayload((current) =>
        current
          ? {
              ...current,
              holder_email: null,
              book: { ...current.book, availability_status: "available", current_holder_name: undefined },
            }
          : current
      )
      setFlash("Returned")
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
  const isBlocked =
    item.availability_status === "missing" ||
    item.availability_status === "retired" ||
    item.availability_status === "unavailable"
  const covers = getBookCoverSrcs(item)

  return (
    <main className="page-container flex min-h-[70vh] items-center justify-center py-8 sm:py-12">
      <div className="w-full max-w-sm space-y-6">
        <KeycardFace
          title={item.title}
          src={covers.src}
          fallbackSrc={covers.fallbackSrc}
          status={isAvailable ? "available" : isCheckedOut ? "out" : "blocked"}
          holderEmail={isCheckedOut ? holderEmail : null}
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
        ) : isAvailable ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              void checkout()
            }}
          >
            <Input
              id="guest-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="you@example.com"
              aria-label="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 text-base"
            />
            <Button type="submit" className="btn-pastel h-12 w-full text-base" disabled={!emailLooksValid || busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check out
            </Button>
          </form>
        ) : (
          <Button type="button" className="btn-pastel h-12 w-full text-base" disabled={busy} onClick={returnItem}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Return
          </Button>
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
  holderEmail,
  homeName,
}: {
  title: string
  src: string
  fallbackSrc?: string
  status: "available" | "out" | "blocked"
  holderEmail?: string | null
  homeName?: string
}) {
  return (
    <div className="space-y-3">
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

      {status === "out" && holderEmail && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 dark:text-amber-200" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Checked out to
            </p>
            <p className="mt-0.5 break-all text-sm font-medium text-foreground">{holderEmail}</p>
          </div>
        </div>
      )}
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
