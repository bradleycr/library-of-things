"use client"

import { useState } from "react"
import { Wallet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import { useToast } from "@/hooks/use-toast"
import type { LibraryCard as LibraryCardType } from "@/lib/types"

/**
 * Optional Apple Wallet save.
 *
 * Only renders when the deployment has Apple Pass signing configured
 * (`APPLE_WALLET_*` env). Designed to feel like a quiet, take-it-or-leave-it
 * affordance — a small outline button with one line of context. This is a
 * way to keep your card around between devices, not a promotional CTA.
 *
 * Google Wallet is not generated here (see docs/WALLET.md for the reasoning).
 */
export function AddLibraryCardToWallet({ card }: { card: LibraryCardType }) {
  const { data } = useBootstrapData()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  if (!data?.config.apple_wallet_available) return null
  if (typeof card.pin !== "string" || card.pin.length === 0) return null

  const handleClick = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/wallet/apple-library-pass", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: card.card_number,
          pin: card.pin,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        toast({
          title: "Could not build the pass",
          description: body.error ?? `Request failed (${res.status}).`,
          variant: "destructive",
        })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      try {
        window.location.assign(url)
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 120_000)
      }
    } catch {
      toast({
        title: "Network error",
        description: "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-full justify-center gap-2 border-border/70 bg-transparent font-normal text-foreground/80 hover:bg-muted/50"
        onClick={handleClick}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        ) : (
          <Wallet className="h-3.5 w-3.5 shrink-0 opacity-70" />
        )}
        Also save to Apple Wallet
      </Button>
      <p className="text-center text-[11px] leading-snug text-muted-foreground/80">
        Optional. Keeps your number and PIN with you between devices.
      </p>
    </div>
  )
}
