"use client"

/**
 * The second step of a library-card email.
 * Opening the page does nothing. The button creates the card, confirms the
 * address, or saves the number and PIN onto this device.
 */

import { Suspense, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { LibraryCard } from "@/components/library-card"
import { Button } from "@/components/ui/button"
import { useLibraryCard } from "@/hooks/use-library-card"
import type { LibraryCard as LibraryCardType } from "@/lib/types"

type Purpose = "signup" | "verify" | "deliver"

type Preview = {
  purpose: Purpose
  masked_email: string
  status: "pending" | "used" | "expired"
}

const COPY: Record<Purpose, { title: string; body: string; action: string }> = {
  signup: {
    title: "Create your library card",
    body: "We’ll make the card and email the number and PIN to this address. Don’t share that email.",
    action: "Create my library card",
  },
  verify: {
    title: "Confirm this email",
    body: "This connects the address to your library card. We’ll email the number and a new PIN. The new PIN replaces the old one.",
    action: "Confirm this email",
  },
  deliver: {
    title: "Save your library card",
    body: "This puts the card number and PIN on this device and signs you in. Don’t share the email that brought you here.",
    action: "Save on this device",
  },
}

export default function OpenLibraryCardPage() {
  return (
    <Suspense fallback={<Shell title="Opening your card…" loading />}>
      <OpenLibraryCard />
    </Suspense>
  )
}

function OpenLibraryCard() {
  const token = useSearchParams().get("token") ?? ""
  const { saveCard } = useLibraryCard()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [card, setCard] = useState<LibraryCardType | null>(null)

  useEffect(() => {
    if (!token) {
      setError("This link is not valid.")
      setLoading(false)
      return
    }
    const controller = new AbortController()
    void fetch(`/api/library-card/email/confirm?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as Preview & { error?: string }
        if (!response.ok) throw new Error(body.error ?? "This link is not valid.")
        setPreview(body)
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

  const open = async () => {
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/library-card/email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
        card?: LibraryCardType
      }
      if (!response.ok || !body.card?.pin) {
        throw new Error(body.error ?? "Could not open this link.")
      }
      const next: LibraryCardType = {
        ...body.card,
        access_count: body.card.access_count ?? 0,
        status: body.card.status ?? "active",
      }
      saveCard(next)
      setCard(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open this link.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Shell title="Opening your card…" loading />
  if (card) {
    return (
      <Shell title="Saved on this device">
        <div className="flex justify-center">
          <LibraryCard card={card} />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The same number and PIN are in your email. Keep that email private. It is how you sign in on another device.
        </p>
        <Link href="/explore">
          <Button className="w-full">Find a book</Button>
        </Link>
      </Shell>
    )
  }

  if (!preview || preview.status !== "pending") {
    return (
      <Shell title="This link can’t be used">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {error ??
            (preview?.status === "used"
              ? "This link has already been used. The card number and PIN are in the email we sent."
              : "This link has expired. Request a new one from the login page.")}
        </p>
        <Link href="/settings?mode=login">
          <Button className="w-full">Go to login</Button>
        </Link>
      </Shell>
    )
  }

  const copy = COPY[preview.purpose] ?? COPY.signup
  return (
    <Shell title={copy.title}>
      <p className="text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
      <p className="text-sm text-foreground">Sent to {preview.masked_email}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" onClick={open} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Working…
          </>
        ) : (
          copy.action
        )}
      </Button>
    </Shell>
  )
}

function Shell({
  title,
  loading = false,
  children,
}: {
  title: string
  loading?: boolean
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/70 bg-card px-5 py-6 shadow-sm sm:px-7">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Library of Things</p>
        <h1 className="font-lot text-2xl font-normal tracking-tight text-foreground">{title}</h1>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          children
        )}
      </div>
    </div>
  )
}
