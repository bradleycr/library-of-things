"use client"

/**
 * The second half of a guest-pass checkout. The email brought them here.
 * Nothing is checked out until they press the button — opening the page is not enough.
 */

import { Suspense, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { guestPassFacts } from "@/lib/guest-pass-email"

type Preview = {
  status: "pending" | "confirmed" | "expired" | "unavailable"
  guest_name: string
  masked_email: string
  node_name: string
  card_label: string
  valid_from_label: string
  valid_until_label: string
}

export default function ConfirmGuestPassPage() {
  return (
    <Suspense fallback={<Shell title="Opening your pass…" loading />}>
      <ConfirmGuestPass />
    </Suspense>
  )
}

function ConfirmGuestPass() {
  const token = useSearchParams().get("token") ?? ""
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setError("This confirmation link is not valid.")
      setLoading(false)
      return
    }
    const controller = new AbortController()
    void fetch(`/api/things/guest-checkout/confirm?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as Preview & { error?: string }
        if (!response.ok) throw new Error(body.error ?? "This confirmation link is not valid.")
        setPreview(body)
        if (body.status === "confirmed") setDone(true)
      })
      .catch((reason) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : "Could not open this link.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [token])

  const confirm = async () => {
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/things/guest-checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      })
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? "Could not confirm the checkout.")
      setDone(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not confirm the checkout.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Shell title="Opening your pass…" loading />
  if (!preview) return <Shell title="This link could not be opened" text={error ?? undefined} />

  const facts = guestPassFacts({
    guestName: preview.guest_name,
    nodeName: preview.node_name,
    cardLabel: preview.card_label,
    validFromLabel: preview.valid_from_label,
    validUntilLabel: preview.valid_until_label,
  })

  if (done || preview.status === "confirmed") {
    return (
      <Shell>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Library of Things</p>
        <h1 className="mt-2 font-lot text-3xl text-foreground">You&apos;re checked out</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {facts.passLine}. {facts.validLine}.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          When you leave, scan the QR code on the card and tap Return. Then hand it in at reception,
          to the node manager, or the return locker inside the Node.
        </p>
      </Shell>
    )
  }

  if (preview.status === "expired") {
    return (
      <Shell title="This link has expired" text="Tap the card again and request a new confirmation email." />
    )
  }

  if (preview.status === "unavailable") {
    return (
      <Shell
        title="This card is no longer available"
        text="Someone else confirmed it first. Ask a steward if you still need a pass."
      />
    )
  }

  return (
    <Shell>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Library of Things</p>
      <h1 className="mt-2 font-lot text-3xl text-foreground">{facts.greeting}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{facts.welcome}</p>

      <div className="mt-5 rounded-2xl bg-muted/60 px-4 py-4">
        <p className="font-lot text-xl text-foreground">{facts.passLine}</p>
        <p className="mt-1 text-sm text-muted-foreground">{facts.validLine}</p>
        <p className="mt-2 text-xs text-muted-foreground">Sent to {preview.masked_email}</p>
      </div>

      <h2 className="mt-6 font-lot text-xl text-foreground">{facts.askIntro}</h2>
      <ol className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {facts.asks.map((ask) => (
          <li key={ask.title}>
            <span className="font-medium text-foreground">{ask.title}</span> {ask.body}
          </li>
        ))}
      </ol>

      <h2 className="mt-6 font-lot text-xl text-foreground">{facts.returningTitle}</h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {facts.returning.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">{facts.guide}</p>

      <Button type="button" className="btn-pastel mt-6 h-12 w-full text-base" disabled={busy} onClick={confirm}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Confirm checkout
      </Button>
      {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy notice
        </Link>
      </p>
    </Shell>
  )
}

function Shell({
  title,
  text,
  loading,
  children,
}: {
  title?: string
  text?: string
  loading?: boolean
  children?: ReactNode
}) {
  return (
    <main className="page-container flex min-h-[70vh] justify-center py-8 sm:py-12">
      <div className="w-full max-w-lg">
        {loading && <Loader2 className="mb-3 h-6 w-6 animate-spin" />}
        {title && <h1 className="font-lot text-3xl text-foreground">{title}</h1>}
        {text && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p>}
        {children}
      </div>
    </main>
  )
}
