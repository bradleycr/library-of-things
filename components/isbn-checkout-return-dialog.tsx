"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { IsbnScannerDialog } from "@/components/isbn-scanner-dialog"
import { IsbnCopyPickerDialog } from "@/components/isbn-copy-picker-dialog"
import type { BooksByIsbnResponse } from "@/lib/isbn-lookup"
import type { Book } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface IsbnCheckoutReturnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Global "Scan to checkout or return" flow: scan ISBN → lookup books →
 * redirect to single copy or show copy picker. Only mounted when feature is on.
 */
export function IsbnCheckoutReturnDialog({
  open,
  onOpenChange,
}: IsbnCheckoutReturnDialogProps) {
  const [phase, setPhase] = useState<"scanner" | "looking-up" | "no-book" | "picker" | "lookup-error">("scanner")
  const [booksForPicker, setBooksForPicker] = useState<Book[]>([])
  const [lastScannedIsbn, setLastScannedIsbn] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  /** When true, scanner closed due to a scan (not cancel); don't close parent or we'd lose no-book/picker. */
  const handlingScanRef = useRef(false)

  const redirectToCheckout = useCallback(
    (book: Book) => {
      const path = book.checkout_url.startsWith("/") ? book.checkout_url : `/${book.checkout_url}`
      handlingScanRef.current = true
      // Full navigation so the checkout/return page reliably opens (dialog closing can interfere with router.push)
      window.location.href = path
      setTimeout(() => {
        handlingScanRef.current = false
        onOpenChange(false)
        setPhase("scanner")
        setBooksForPicker([])
      }, 100)
    },
    [onOpenChange],
  )

  const handleScan = useCallback(
    async (normalizedIsbn: string) => {
      handlingScanRef.current = true
      setLastScannedIsbn(normalizedIsbn)
      setLookupError(null)
      setPhase("looking-up")

      let matches: Book[] = []
      try {
        const response = await fetch(`/api/books/by-isbn?isbn=${encodeURIComponent(normalizedIsbn)}`, {
          cache: "no-store",
        })
        if (!response.ok) {
          const errorBody = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(errorBody.error || "Could not look up this ISBN right now.")
        }
        const payload = (await response.json()) as BooksByIsbnResponse
        matches = payload.books
      } catch (error) {
        setLookupError(
          error instanceof Error ? error.message : "Could not look up this ISBN right now.",
        )
        setPhase("lookup-error")
        return
      }

      if (matches.length === 0) {
        setPhase("no-book")
        return
      }
      if (matches.length === 1) {
        redirectToCheckout(matches[0])
        return
      }
      setBooksForPicker(matches)
      setPhase("picker")
    },
    [redirectToCheckout],
  )

  const handleClose = useCallback(() => {
    setPhase("scanner")
    setBooksForPicker([])
    setLastScannedIsbn(null)
    setLookupError(null)
    onOpenChange(false)
  }, [onOpenChange])

  const handlePickerSelect = useCallback(
    (book: Book) => {
      redirectToCheckout(book)
    },
    [redirectToCheckout],
  )

  useEffect(() => {
    if (!open) {
      setPhase("scanner")
      setBooksForPicker([])
      setLastScannedIsbn(null)
      setLookupError(null)
      handlingScanRef.current = false
    }
  }, [open])

  return (
    <>
      {phase === "looking-up" && (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="max-w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle>Looking up this book</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Checking the library catalog for this ISBN…
            </p>
          </DialogContent>
        </Dialog>
      )}

      {phase === "lookup-error" && (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="max-w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle>Lookup failed</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              {lookupError ?? "Could not look up this ISBN right now."}
            </p>
            <Button className="mt-4" onClick={() => setPhase("scanner")}>
              Back to scanner
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {phase === "no-book" && (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="max-w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle>This book is not yet in the library</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              No book with this ISBN is in the library. Would you like to add it?
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {lastScannedIsbn != null && (
                <Link
                  href={`/add-book?isbn=${encodeURIComponent(lastScannedIsbn)}`}
                  onClick={() => onOpenChange(false)}
                >
                  <Button>Yes, add it</Button>
                </Link>
              )}
              <Button variant="outline" onClick={handleClose}>
                No, close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {phase === "scanner" && (
        <IsbnScannerDialog
          open={open}
          onOpenChange={(next) => {
            if (!next) {
              if (!handlingScanRef.current) handleClose()
              else handlingScanRef.current = false
            }
          }}
          onScan={handleScan}
        />
      )}

      <IsbnCopyPickerDialog
        open={phase === "picker" && booksForPicker.length > 0}
        onOpenChange={(next) => {
          if (!next) handleClose()
        }}
        books={booksForPicker}
        onSelect={handlePickerSelect}
        scannedIsbn={lastScannedIsbn}
        onAddAnotherCopy={() => onOpenChange(false)}
      />
    </>
  )
}
