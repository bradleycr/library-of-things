"use client"

import type { Book } from "@/lib/types"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatBookCopyLabel } from "@/lib/isbn-checkout"
import { BookOpen, MapPin, Package, Plus } from "lucide-react"

export interface IsbnCopyPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  books: Book[]
  onSelect: (book: Book) => void
  /** When set, show "Add another copy" linking to add-book with this ISBN. */
  scannedIsbn?: string | null
  onAddAnotherCopy?: () => void
}

/**
 * Shown when multiple copies of the same ISBN exist. User picks which copy
 * they are checking out or returning (trust-based; clear location labels).
 */
export function IsbnCopyPickerDialog({
  open,
  onOpenChange,
  books,
  onSelect,
  scannedIsbn,
  onAddAnotherCopy,
}: IsbnCopyPickerDialogProps) {
  if (!books.length) return null

  const title = books[0].title

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[calc(100vw-2rem)] overflow-y-auto" aria-describedby="isbn-copy-picker-desc">
        <DialogHeader>
          <DialogTitle>Multiple copies</DialogTitle>
          <DialogDescription id="isbn-copy-picker-desc">
            More than one copy of this book is in the library. Which one are you checking out or returning?
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2 py-2">
          {books.map((book) => {
            const label = formatBookCopyLabel(book)
            const isPocket = !!book.is_pocket_library
            return (
              <li key={book.id}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 py-3 text-left font-normal"
                  onClick={() => onSelect(book)}
                >
                  {isPocket ? (
                    <Package className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span className="flex-1">
                    <span className="font-medium text-foreground">{title}</span>
                    <span className="ml-2 text-muted-foreground">— {label}</span>
                  </span>
                  <BookOpen className="h-4 w-4 shrink-0 opacity-60" />
                </Button>
              </li>
            )
          })}
        </ul>
        {scannedIsbn && (
          <div className="mt-3 border-t border-border pt-3">
            <Link
              href={`/add-book?isbn=${encodeURIComponent(scannedIsbn)}`}
              onClick={onAddAnotherCopy}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Add another copy of this book
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
