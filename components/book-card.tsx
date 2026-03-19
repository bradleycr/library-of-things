"use client"

import Link from "next/link"
import { MapPin, Package, Building2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookCover } from "@/components/book-cover"
import { getBookCoverSrcs } from "@/lib/book-cover-generator"
import { formatLocationForDisplay } from "@/lib/format-location"
import type { Book } from "@/lib/types"

const statusConfig = {
  available: { label: "Available", variant: "default" as const, className: "bg-accent text-accent-foreground" },
  checked_out: { label: "Checked Out", variant: "secondary" as const, className: "bg-secondary text-secondary-foreground" },
  in_transit: { label: "Unavailable", variant: "outline" as const, className: "" },
  retired: { label: "Missing", variant: "secondary" as const, className: "bg-destructive/10 text-destructive" },
}

export function BookCard({ book }: { book: Book }) {
  const status = statusConfig[book.availability_status]

  return (
    <Link href={`/book/${book.id}`} className="group min-w-0">
      <Card className="h-full overflow-hidden border-border transition-shadow hover:shadow-md">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          <BookCover
            {...getBookCoverSrcs(book)}
            title={book.title}
            className="transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute right-2 top-2 flex flex-col gap-1.5">
            <Badge className={status.className} variant={status.variant}>
              {status.label}
            </Badge>
            {book.is_pocket_library && (
              <Badge className="bg-primary/90 text-primary-foreground text-xs">
                <Package className="mr-1 h-2.5 w-2.5" />
                Pocket
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-3">
          <h3 className="line-clamp-1 text-sm font-semibold text-card-foreground group-hover:text-primary">
            {book.title}
          </h3>
          {book.author && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{book.author}</p>
          )}
          {(book.current_node_name || book.current_location_text) && (
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              {book.is_pocket_library ? (
                <Package className="h-3 w-3 shrink-0" />
              ) : (
                <Building2 className="h-3 w-3 shrink-0" />
              )}
              <span className="line-clamp-1">
                {book.current_node_name ?? formatLocationForDisplay(book.current_location_text)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
