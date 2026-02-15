"use client"

import { useState, useEffect } from "react"
import { Copy, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LibraryCard } from "@/components/library-card"
import { useLibraryCard } from "@/hooks/use-library-card"
import type { LibraryCard as LibraryCardType } from "@/lib/types"

/** "view" = show current card only; "generate" = show get-new-card flow even if user has a card */
export type GetLibraryCardModalMode = "view" | "generate"

interface GetLibraryCardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When "view", always show current card. When "generate", show create-new flow (e.g. from Settings). */
  mode?: GetLibraryCardModalMode
}

export function GetLibraryCardModal({ open, onOpenChange, mode }: GetLibraryCardModalProps) {
  const { card, saveCard } = useLibraryCard()
  const [loading, setLoading] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [newCard, setNewCard] = useState<LibraryCardType | null>(null)
  const [copied, setCopied] = useState<"number" | "pin" | null>(null)

  const handleGetCard = async () => {
    setGenerateError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/library-card/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success && data.card) {
        setNewCard(data.card)
      } else {
        setGenerateError(data?.error ?? "Could not generate card. Please try again.")
      }
    } catch {
      setGenerateError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (newCard) {
      saveCard(newCard)
      setNewCard(null)
      onOpenChange(false)
    }
  }

  const copyToClipboard = async (text: string, type: "number" | "pin") => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  // When opening in generate mode, start with a clean form (no leftover newCard from a previous open)
  useEffect(() => {
    if (open && mode === "generate") {
      setNewCard(null)
      setGenerateError(null)
    }
  }, [open, mode])

  // After generating, show the new card (with Save); in "view" mode show current card; in "generate" with no newCard show form
  const showExistingCard = newCard ?? (mode !== "generate" ? card : null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "generate" && !newCard ? "Get a library card" : "Your Library Card"}
          </DialogTitle>
          <DialogDescription>
            {showExistingCard
              ? "Save or screenshot this card and your PIN. You can use them to log in on another device. This device will remember your card until you clear it."
              : mode === "generate" && card
                ? "Creating a new card will replace your current card on this device. Use this if you want a new pseudonym."
                : "Get a pseudonymous library card to browse and borrow. No email or identity required."}
          </DialogDescription>
        </DialogHeader>

        {showExistingCard ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <LibraryCard card={showExistingCard} />
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">
                Save or screenshot — you’ll need card number + PIN to log in on another device:
              </p>
              <div className="flex items-center justify-between gap-2">
                <code className="flex-1 truncate font-mono text-xs">
                  {showExistingCard.card_number} · PIN: {showExistingCard.pin}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() =>
                    copyToClipboard(
                      `${showExistingCard.card_number} PIN: ${showExistingCard.pin}`,
                      "number"
                    )
                  }
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {newCard && (
              <Button className="w-full" onClick={handleSave}>
                Save to this device
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {mode === "generate" && card && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                You already have a card on this device. Creating a new one will replace it.
              </p>
            )}
            {generateError && (
              <p className="text-sm text-destructive">{generateError}</p>
            )}
            <Button
              className="w-full"
              onClick={handleGetCard}
              disabled={loading}
            >
              {loading ? "Generating…" : "Get Your Card"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
