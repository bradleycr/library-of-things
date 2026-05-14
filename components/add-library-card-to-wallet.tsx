"use client"

import { useState } from "react"
import { Wallet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import { useToast } from "@/hooks/use-toast"
import type { LibraryCard as LibraryCardType } from "@/lib/types"

/**
 * When the deployment has Apple Pass signing configured (`APPLE_WALLET_*` env),
 * offers a signed .pkpass so members can keep card number + PIN in Wallet.
 * Google Wallet is not generated here — see docs/WALLET.md.
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
          title: "Could not build wallet pass",
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
    <div className="space-y-1">
      <Button
        type="button"
        variant="secondary"
        className="w-full gap-2"
        onClick={handleClick}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4 shrink-0" />
        )}
        Add to Apple Wallet
      </Button>
      <p className="text-center text-[11px] leading-snug text-muted-foreground">
        Keeps your card number and PIN on the pass (like a backup). The QR opens the site&apos;s
        log-in page; you still enter your PIN in the browser.
      </p>
    </div>
  )
}
