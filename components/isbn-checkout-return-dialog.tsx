"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
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

  const redirectToCheckout = useCallback(
    (book: Book) => {
      const path = book.checkout_url.startsWith("/") ? book.checkout_url : `/${book.checkout_url}`
      onOpenChange(false)
      setPhase("scanner")
      setBooksForPicker([])
      router.push(path)
    },
    [onOpenChange, router],
  )

  const handleScan = useCallback(
    (normalizedIsbn: string) => {
      const matches = findBooksByIsbn(books, normalizedIsbn)
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
    [books, redirectToCheckout],
  )

  const handleClose = useCallback(() => {
    setPhase("scanner")
    setBooksForPicker([])
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
    }
  }, [open])

  return (
    <>
      {phase === "no-book" && (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Book not found</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              No book with this ISBN is in the library.
            </p>
            <Button variant="outline" onClick={handleClose} className="mt-4">
              Close
            </Button>
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
