import Link from "next/link"
import { MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Book } from "@/lib/types"

const statusConfig = {
  available: { label: "Available", variant: "default" as const, className: "bg-accent text-accent-foreground" },
  checked_out: { label: "Checked Out", variant: "secondary" as const, className: "bg-secondary text-secondary-foreground" },
  in_transit: { label: "In Transit", variant: "outline" as const, className: "" },
  retired: { label: "Retired", variant: "secondary" as const, className: "opacity-60" },
}

export function BookCard({ book }: { book: Book }) {
  const status = statusConfig[book.availability_status]

  return (
    <Link href={`/book/${book.id}`} className="group">
      <Card className="h-full overflow-hidden border-border transition-shadow hover:shadow-md">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          {book.cover_image_url ? (
            <img
              src={book.cover_image_url || "/placeholder.svg"}
              alt={`Cover of ${book.title}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4">
              <span className="text-center text-sm font-medium text-muted-foreground">
                {book.title}
              </span>
            </div>
          )}
          <Badge className={`absolute right-2 top-2 ${status.className}`} variant={status.variant}>
            {status.label}
          </Badge>
        </div>
        <CardContent className="p-3">
          <h3 className="line-clamp-1 text-sm font-semibold text-card-foreground group-hover:text-primary">
            {book.title}
          </h3>
          {book.author && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{book.author}</p>
          )}
          {book.current_location_text && (
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{book.current_location_text}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
