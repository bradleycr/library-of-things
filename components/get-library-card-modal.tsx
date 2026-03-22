"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Copy, Check, PlusCircle, UserCog, ShieldCheck, BookOpen } from "lucide-react"
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

/** "view" = show current card; "generate" = show get-new-card flow even if user has a card */
export type GetLibraryCardModalMode = "view" | "generate"

interface GetLibraryCardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When "view", show the current card. When "generate", show the create-new flow. */
  mode?: GetLibraryCardModalMode
}

/**
 * Multi-step library card modal:
 *   1. Generate  → "Get Your Card" button
 *   2. Preview   → card + PIN shown, "Save to this device" button
 *   3. Saved     → confirmation with next-step navigation
 *   (or) View    → show existing card (no generation flow)
 */
export function GetLibraryCardModal({ open, onOpenChange, mode }: GetLibraryCardModalProps) {
  const { card, saveCard } = useLibraryCard()

  const [loading, setLoading] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [newCard, setNewCard] = useState<LibraryCardType | null>(null)
  const [savedCard, setSavedCard] = useState<LibraryCardType | null>(null)
  const [copied, setCopied] = useState<"number" | "pin" | null>(null)

  /* ── Reset state each time the modal opens in generate mode ── */
  useEffect(() => {
    if (open && mode === "generate") {
      setNewCard(null)
      setSavedCard(null)
      setGenerateError(null)
    }
  }, [open, mode])

  /* ── Step 1 → 2: Generate a card ── */
  const handleGetCard = async () => {
    setGenerateError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/library-card/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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

  /* ── Step 2 → 3: Persist to device, show success screen ── */
  const handleSave = () => {
    if (!newCard) return
    saveCard(newCard)
    setSavedCard(newCard)
    setNewCard(null)
  }

  const copyToClipboard = async (text: string, type: "number" | "pin") => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  /* ── Determine which view to render ── */
  const isViewMode = mode !== "generate"
  const showExistingCard = newCard ?? (isViewMode ? card : null)

  /* ── Derived title / description ── */
  const title = savedCard
    ? "You're all set!"
    : mode === "generate" && !newCard
      ? "Get a library card"
      : "Your Library Card"

  const description = savedCard
    ? "Your library card is saved to this device. Write down or screenshot your credentials — they're your only way back in."
    : showExistingCard
      ? "Save or screenshot this card and your PIN. You can use them to log in on another device. This device will remember your card until you clear it."
      : mode === "generate" && card
        ? "Creating a new card will replace your current card on this device. Use this if you want a new pseudonym."
        : "Get a pseudonymous library card to browse and borrow. No email or identity required."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* ───── Step 3: Card saved — confirmation + next steps ───── */}
        {savedCard ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
              <p className="text-sm font-medium text-foreground">
                Card saved to this device
              </p>
            </div>

            <div className="flex justify-center">
              <LibraryCard card={savedCard} />
            </div>

            <CredentialStrip
              card={savedCard}
              copied={copied}
              onCopy={copyToClipboard}
            />

            {/* Next-step navigation */}
            <div className="flex flex-col gap-2 pt-1">
              <Link href="/explore" onClick={() => onOpenChange(false)}>
                <Button variant="default" className="w-full gap-2">
                  <BookOpen className="h-4 w-4" />
                  Find a book
                </Button>
              </Link>
              <Link href="/add-book" onClick={() => onOpenChange(false)}>
                <Button variant="outline" className="w-full gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Add a book
                </Button>
              </Link>
              <Link href="/settings" onClick={() => onOpenChange(false)}>
                <Button variant="outline" className="w-full gap-2">
                  <UserCog className="h-4 w-4" />
                  Set up your profile
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </div>
          </div>

        /* ───── Step 2 / View: Show existing or just-generated card ───── */
        ) : showExistingCard ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <LibraryCard card={showExistingCard} />
            </div>

            <CredentialStrip
              card={showExistingCard}
              copied={copied}
              onCopy={copyToClipboard}
            />

            {/* Only show "Save to this device" for freshly generated cards */}
            {newCard && (
              <Button className="w-full" onClick={handleSave}>
                Save to this device
              </Button>
            )}
          </div>

        /* ───── Step 1: Generate form ───── */
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

/* ─────────────────────────────────────────────
 * Credential strip — card number + PIN display
 * with a single copy-all button.
 * ───────────────────────────────────────────── */

function CredentialStrip({
  card,
  copied,
  onCopy,
}: {
  card: LibraryCardType
  copied: "number" | "pin" | null
  onCopy: (text: string, type: "number" | "pin") => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <p className="text-xs font-medium text-muted-foreground">
        Save these credentials — you'll need them to log in on another device:
      </p>
      <div className="flex items-center justify-between gap-2">
        <code className="flex-1 truncate font-mono text-xs">
          {card.card_number} · PIN: {card.pin}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onCopy(`${card.card_number} PIN: ${card.pin}`, "number")}
        >
          {copied ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
