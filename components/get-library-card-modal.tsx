"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Copy, Check, BookOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LibraryCard } from "@/components/library-card"
import { AddLibraryCardToWallet } from "@/components/add-library-card-to-wallet"
import { EmailMyCardForm } from "@/components/email-my-card-form"
import { useLibraryCard } from "@/hooks/use-library-card"
import type { LibraryCard as LibraryCardType } from "@/lib/types"

/** "view" = show current card; "generate" = show get-new-card flow even if a card exists. */
export type GetLibraryCardModalMode = "view" | "generate"

interface GetLibraryCardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When "view", show the current card. When "generate", show the create-new flow. */
  mode?: GetLibraryCardModalMode
}

/**
 * Library card modal — three quiet steps.
 *
 *   1. Empty   → a single button to ask for a card
 *   2. Preview → the card as an object, with credentials and optional wallet save
 *   3. Saved   → the same object, now persisted to this device, plus one "find a book" CTA
 *
 * A card starts with an email the person can open. The number and PIN
 * arrive in that inbox, and can be asked for again from the login page.
 */
export function GetLibraryCardModal({ open, onOpenChange, mode }: GetLibraryCardModalProps) {
  const { card, saveCard } = useLibraryCard()

  const [newCard, setNewCard] = useState<LibraryCardType | null>(null)
  const [savedCard, setSavedCard] = useState<LibraryCardType | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open && mode === "generate") {
      setNewCard(null)
      setSavedCard(null)
    }
  }, [open, mode])

  const handleSave = () => {
    if (!newCard) return
    saveCard(newCard)
    setSavedCard(newCard)
    setNewCard(null)
  }

  const copyCredentials = async (card: LibraryCardType) => {
    await navigator.clipboard.writeText(`${card.card_number} · PIN ${card.pin}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isViewMode = mode !== "generate"
  const visibleCard = newCard ?? (isViewMode ? card : null)

  /* Titles & descriptions — kept short, plain, and matter-of-fact. */
  const title = savedCard
    ? "Saved to this device"
    : mode === "generate" && !newCard
      ? "Get a library card"
      : "Your library card"

  const description = savedCard
    ? "Keep the number and PIN somewhere safe — that's how you sign in on another device."
    : visibleCard
      ? "Write these down or save a screenshot. They sign you in if you switch devices."
      : mode === "generate" && card
        ? "Creating a new card replaces the one on this device."
        : "A card needs an email you can open. We’ll send the number and PIN there."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-lot text-xl font-normal tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Saved — final state. Single primary action, nothing else trying to retain you. */}
        {savedCard ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <LibraryCard card={savedCard} />
            </div>

            <Credentials
              card={savedCard}
              copied={copied}
              onCopy={() => copyCredentials(savedCard)}
            />

            <AddLibraryCardToWallet card={savedCard} />

            <div className="flex flex-col gap-2 pt-1">
              <Link href="/explore" onClick={() => onOpenChange(false)}>
                <Button variant="default" className="w-full gap-2">
                  <BookOpen className="h-4 w-4" />
                  Find a book
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

        /* Preview — fresh or existing card. */
        ) : visibleCard ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <LibraryCard card={visibleCard} />
            </div>

            <Credentials
              card={visibleCard}
              copied={copied}
              onCopy={() => copyCredentials(visibleCard)}
            />

            <AddLibraryCardToWallet card={visibleCard} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              If this device forgets the card, use Log in and ask for it by email. That sends a new PIN to the address on the card.
            </p>

            {newCard && (
              <Button className="w-full" onClick={handleSave}>
                Save to this device
              </Button>
            )}
          </div>

        /* Empty — the card is born in the inbox, not on this screen. */
        ) : (
          <div className="space-y-3">
            {mode === "generate" && card && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                An email that already has a card sends that card and a new PIN. A new email starts a new card.
              </p>
            )}
            <EmailMyCardForm
              showName
              submitLabel="Email me a confirmation"
              intro="Use an email you can open. We’ll send a link to confirm it, then the card number and PIN. Borrowing a book needs that address."
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ───────────────────────────────────────────────────────────────────────────
 * Credentials — the card number and PIN as a quiet typographic block.
 *
 * A single copy action covers both fields so the user doesn't have to think
 * about which to grab. No "save these credentials" framing, no shield icon,
 * no celebratory chrome — just the values, legible and copyable.
 * ─────────────────────────────────────────────────────────────────────── */
function Credentials({
  card,
  copied,
  onCopy,
}: {
  card: LibraryCardType
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Card number &amp; PIN
        </p>
        <p className="mt-0.5 truncate font-mono text-sm tabular-nums text-foreground">
          {card.card_number}
          <span className="px-1.5 text-muted-foreground/60">·</span>
          {card.pin}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onCopy}
        aria-label={copied ? "Copied" : "Copy card number and PIN"}
      >
        {copied ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
