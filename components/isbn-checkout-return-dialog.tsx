"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  const router = useRouter()
  const { data } = useBootstrapData()
  const books = data?.books ?? []

  const [phase, setPhase] = useState<"scanner" | "no-book" | "picker">("scanner")
  const [booksForPicker, setBooksForPicker] = useState<Book[]>([])
  const [lastScannedIsbn, setLastScannedIsbn] = useState<string | null>(null)

  const redirectToCheckout = useCallback(
    (book: Book) => {
      const path = book.checkout_url.startsWith("/") ? book.checkout_url : `/${book.checkout_url}`
      // Navigate first so the transition is scheduled before we close the dialog
      router.push(path)
      setTimeout(() => {
        onOpenChange(false)
        setPhase("scanner")
        setBooksForPicker([])
      }, 0)
    },
    [onOpenChange, router],
  )

  const handleScan = useCallback(
    (normalizedIsbn: string) => {
      const matches = findBooksByIsbn(books, normalizedIsbn)
      if (matches.length === 0) {
        setLastScannedIsbn(normalizedIsbn)
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
    [books, redirectToCheckout],
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
    }
  }, [open])

  return (
    <>
      {phase === "no-book" && (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent>
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
            if (!next) handleClose()
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
      />
    </>
  )
}
