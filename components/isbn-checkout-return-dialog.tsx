"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { IsbnScannerDialog } from "@/components/isbn-scanner-dialog"
import { IsbnCopyPickerDialog } from "@/components/isbn-copy-picker-dialog"
import { findBooksByIsbn } from "@/lib/isbn-checkout"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
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
  const { data, loading } = useBootstrapData()
  const books = data?.books ?? []

  const [phase, setPhase] = useState<"scanner" | "no-book" | "picker" | "catalog-loading">("scanner")
  const [booksForPicker, setBooksForPicker] = useState<Book[]>([])
  const [lastScannedIsbn, setLastScannedIsbn] = useState<string | null>(null)
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
    (normalizedIsbn: string) => {
      handlingScanRef.current = true
      setLastScannedIsbn(normalizedIsbn)
      const matches = findBooksByIsbn(books, normalizedIsbn)
      if (matches.length === 0) {
        if (loading) {
          setPhase("catalog-loading")
          return
        }
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
    [books, loading, redirectToCheckout],
  )

  const handleClose = useCallback(() => {
    setPhase("scanner")
    setBooksForPicker([])
    setLastScannedIsbn(null)
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
      handlingScanRef.current = false
    }
  }, [open])

  return (
    <>
      {phase === "catalog-loading" && (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="max-w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle>Loading library catalog</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              The catalog is still loading. Please wait a moment and try scanning again.
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
