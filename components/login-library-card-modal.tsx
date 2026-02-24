"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLibraryCard } from "@/hooks/use-library-card"
import type { LibraryCard as LibraryCardType } from "@/lib/types"

interface LoginLibraryCardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, card number is pre-filled and read-only; user only enters PIN to link. */
  initialCardNumber?: string
  /** Called after a successful login so the parent can refetch data, redirect, etc. */
  onSuccess?: () => void
}

export function LoginLibraryCardModal({ open, onOpenChange, initialCardNumber, onSuccess }: LoginLibraryCardModalProps) {
  const { saveCard } = useLibraryCard()
  const [cardNumber, setCardNumber] = useState("")
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveCardNumber = (initialCardNumber ?? cardNumber).trim()
  const isPinOnlyMode = !!initialCardNumber?.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const numberToSend = effectiveCardNumber || cardNumber.trim()
    try {
      const res = await fetch("/api/library-card/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ card_number: numberToSend, pin: String(pin).trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Login failed")
        return
      }
      if (data.success && data.card) {
        const cardToSave: LibraryCardType = {
          ...data.card,
          pin,
          access_count: 0,
          status: "active",
        }
        saveCard(cardToSave)
        if (!isPinOnlyMode) setCardNumber("")
        setPin("")
        onOpenChange(false)
        onSuccess?.()
      }
    } catch {
      setError("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isPinOnlyMode ? "Enter PIN to link your card" : "Log in with library card"}</DialogTitle>
          <DialogDescription>
            {isPinOnlyMode
              ? "Your card is on this device. Enter your PIN to link it and access checkout and profile."
              : "Enter your card number and PIN to access your account on this device."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-card-number">Card number</Label>
            <Input
              id="login-card-number"
              placeholder="XXXX XXXX XXXX XXXX"
              value={isPinOnlyMode ? (initialCardNumber ?? "") : cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              className="font-mono"
              readOnly={isPinOnlyMode}
              disabled={isPinOnlyMode}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-pin">PIN</Label>
            <Input
              id="login-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="font-mono"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading || !effectiveCardNumber || pin.length < 1}>
            {loading ? "Linking…" : isPinOnlyMode ? "Link card" : "Log in"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
