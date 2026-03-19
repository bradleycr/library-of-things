"use client"

import { use, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Bell,
  BookOpen,
  Package,
  Users,
  UserPlus,
  MessageSquare,
  Mail,
  Building2,
  Loader2,
  Camera,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BookCover } from "@/components/book-cover"
import { getBookCoverSrcs } from "@/lib/book-cover-generator"
import { formatLocationForDisplay } from "@/lib/format-location"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import { useLibraryCard } from "@/hooks/use-library-card"
import { useToast } from "@/hooks/use-toast"
import { IsbnScannerDialog } from "@/components/isbn-scanner-dialog"
import { normalizeIsbn } from "@/lib/isbn-utils"
import { ISBN_CHECKOUT_RETURN_ENABLED } from "@/lib/feature-flags"
import { DEFAULT_LOAN_PERIOD_DAYS, resolveLoanPeriodDays } from "@/lib/loan-period"

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const eventTypeStyles: Record<string, string> = {
  checkout: "bg-primary/10 text-primary",
  return: "bg-accent/10 text-accent",
  transfer: "bg-secondary text-secondary-foreground",
  report_lost: "bg-destructive/10 text-destructive",
  report_damaged: "bg-destructive/10 text-destructive",
}

export default function BookDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { data, loading } = useBootstrapData()
  const { card } = useLibraryCard()
  const books = data?.books ?? []
  const nodes = data?.nodes ?? []
  const loanEvents = data?.loanEvents ?? []
  const { uuid } = use(params)
  const book = books.find((b) => b.id === uuid)
  const node = book?.current_node_id ? nodes.find((n) => n.id === book.current_node_id) : null
  const defaultLoanPeriodDays = data?.config?.default_loan_period_days ?? DEFAULT_LOAN_PERIOD_DAYS
  const suggestedLoanPeriodDays = book
    ? resolveLoanPeriodDays(book.lending_terms?.loan_period_days, defaultLoanPeriodDays)
    : defaultLoanPeriodDays
  const [isbnScannerOpen, setIsbnScannerOpen] = useState(false)
  const isHolder = !!(book && card?.user_id && book.current_holder_id === card.user_id)

  const handleIsbnScanForThisBook = useCallback(
    (scannedIsbn: string) => {
      if (!book?.checkout_url) return
      const bookNorm = book.isbn ? normalizeIsbn(book.isbn) : null
      if (bookNorm !== null && bookNorm !== scannedIsbn) {
        toast({
          variant: "destructive",
          title: "Wrong book",
          description: "This barcode doesn’t match the book on this page.",
        })
        return
      }
      setIsbnScannerOpen(false)
      const path = book.checkout_url.startsWith("/") ? book.checkout_url : `/${book.checkout_url}`
      router.push(path)
    },
    [book, router, toast],
  )
  // Directions: node books → node address/coords (correct place); pocket → owner's entered location.
  const directionsHref =
    node != null
      ? node.location_lat != null && node.location_lng != null
        ? `https://www.google.com/maps/search/?api=1&query=${node.location_lat},${node.location_lng}`
        : node.location_address
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(node.location_address)}`
          : null
      : book?.current_location_text
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatLocationForDisplay(book.current_location_text))}`
        : null
  const bookEvents = loanEvents
    .filter((e) => e.book_id === uuid)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-20">
        <div className="page-container flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="mt-3 text-sm text-muted-foreground">Loading…</span>
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-20">
        <div className="page-container flex flex-col items-center justify-center text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          Book not found
        </h1>
        <p className="mt-2 text-muted-foreground">
          This book may have been removed or the link is incorrect.
        </p>
        <Link href="/explore">
          <Button className="mt-6 gap-2 min-h-11">
            <ArrowLeft className="h-4 w-4" />
            Browse Books
          </Button>
        </Link>
        </div>
      </div>
    )
  }

  const isAvailable = book.availability_status === "available"
  const statusLabel =
    book.availability_status === "available"
      ? "Available"
      : book.availability_status === "checked_out"
        ? "Checked Out"
        : book.availability_status === "in_transit"
          ? "Unavailable"
          : "Missing"

  return (
    <div className="py-6 sm:py-8">
      <div className="page-container">
      <div className="mx-auto max-w-5xl">
        {/* Back */}
        <Link href="/explore">
          <Button variant="ghost" size="sm" className="mb-6 gap-2 text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Explore
          </Button>
        </Link>

        {/* Book Info */}
        <div className="grid gap-8 md:grid-cols-[280px_1fr]">
          {/* Cover */}
          <div className="aspect-[2/3] overflow-hidden rounded-lg bg-muted shadow-md">
            <BookCover {...getBookCoverSrcs(book)} title={book.title} />
          </div>

          {/* Details */}
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge
                className={
                  isAvailable
                    ? "bg-accent text-accent-foreground"
                    : book.availability_status === "retired"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-secondary text-secondary-foreground"
                }
              >
                {statusLabel}
              </Badge>
              {book.is_pocket_library && (
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Package className="mr-1 h-3 w-3" />
                  Pocket Library
                </Badge>
              )}
            </div>

            <h1 className="mt-3 font-serif text-3xl font-bold text-foreground md:text-4xl">
              {book.title}
            </h1>
            {book.author && (
              <p className="mt-2 text-lg text-muted-foreground">{book.author}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {book.edition && <span>Edition: {book.edition}</span>}
              {book.isbn && <span>ISBN: {book.isbn}</span>}
            </div>

            {/* Description (e.g. from Open Library); only when present */}
            {book.description?.trim() && (
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                {book.description.trim()}
              </p>
            )}

            {/* Added by — link to profile only when not anonymous; never expose identity for anonymous adds */}
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <UserPlus className="h-4 w-4 text-primary" />
              <span>
                Added by{" "}
                {book.added_by_display_name === "Anonymous" ? (
                  <span className="italic">Anonymous</span>
                ) : book.added_by_user_id ? (
                  <Link
                    href={`/profile/${book.added_by_user_id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {book.added_by_display_name || "a community member"}
                  </Link>
                ) : book.added_by_display_name ? (
                  book.added_by_display_name
                ) : (
                  <span className="italic">Anonymous</span>
                )}
              </span>
            </div>

            {/* Location: node name for node books, address/text for Pocket Library */}
            {(book.current_node_name || book.current_location_text) && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                {book.is_pocket_library ? (
                  <Package className="h-4 w-4 text-primary" />
                ) : (
                  <Building2 className="h-4 w-4 text-primary" />
                )}
                <span>{book.current_node_name ?? formatLocationForDisplay(book.current_location_text)}</span>
              </div>
            )}

            {/* Owner Contact for Pocket Library Books */}
            {book.is_pocket_library && book.owner_contact_email && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-primary" />
                <a
                  href={`mailto:${book.owner_contact_email}`}
                  className="text-primary hover:underline"
                >
                  {book.owner_contact_email}
                </a>
              </div>
            )}

            {/* How to Get This Book */}
            {isAvailable ? (
              <Card className="mt-6 border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    {book.is_pocket_library ? (
                      <Mail className="h-5 w-5 text-primary" />
                    ) : (
                      <MapPin className="h-5 w-5 text-primary" />
                    )}
                    How to Borrow This Book
                  </h3>
                  {book.is_pocket_library ? (
                    <>
                      <p className="mt-3 text-sm text-foreground/80">
                        This is a Pocket Library book kept by a community member. Contact the owner
                        using the email above to arrange pickup. When you meet, scan the NFC or QR
                        code on the book to check it out.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {book.owner_contact_email && (
                          <Button variant="outline" className="gap-2" asChild>
                            <a href={`mailto:${book.owner_contact_email}?subject=Borrowing "${book.title}" from Pocket Library`}>
                              <Mail className="h-4 w-4" />
                              Contact Owner
                            </a>
                          </Button>
                        )}
                        {directionsHref && (
                          <Button variant="outline" className="gap-2" asChild>
                            <a href={directionsHref} target="_blank" rel="noopener noreferrer">
                              <MapPin className="h-4 w-4" />
                              Get Directions
                            </a>
                          </Button>
                        )}
                        {ISBN_CHECKOUT_RETURN_ENABLED && (
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => setIsbnScannerOpen(true)}
                          >
                            <Camera className="h-4 w-4" />
                            Check out via ISBN scanner
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-3 text-sm text-foreground/80">
                        Visit the library node above and scan the NFC or QR code on the physical
                        book to check it out. This is a trust-based system - no web checkout
                        required!
                      </p>
                      {directionsHref && (
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button variant="outline" className="gap-2" asChild>
                            <a href={directionsHref} target="_blank" rel="noopener noreferrer">
                              <MapPin className="h-4 w-4" />
                              Get Directions
                            </a>
                          </Button>
                          {ISBN_CHECKOUT_RETURN_ENABLED && (
                            <Button
                              variant="outline"
                              className="gap-2"
                              onClick={() => setIsbnScannerOpen(true)}
                            >
                              <Camera className="h-4 w-4" />
                              Check out via ISBN scanner
                            </Button>
                          )}
                        </div>
                      )}
                      {ISBN_CHECKOUT_RETURN_ENABLED && !directionsHref && (
                        <div className="mt-4">
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => setIsbnScannerOpen(true)}
                          >
                            <Camera className="h-4 w-4" />
                            Check out via ISBN scanner
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ) : book.availability_status === "checked_out" ? (
              <div className="mt-6 flex flex-col gap-3">
                {book.expected_return_date && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Expected return: {formatDate(book.expected_return_date)}
                    </span>
                  </div>
                )}
                {book.current_holder_name && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      Current holder:{" "}
                      <Link
                        href={`/profile/${book.current_holder_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {book.current_holder_name}
                      </Link>
                    </span>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-fit gap-2 text-foreground bg-transparent"
                  disabled
                  title="Email reminders are not set up yet"
                  aria-describedby="notify-caption"
                >
                  <Bell className="h-4 w-4" />
                  Notify when available (coming soon)
                </Button>
                <p id="notify-caption" className="sr-only">
                  Email notifications for when this book is back will be available in a future update.
                </p>
                {ISBN_CHECKOUT_RETURN_ENABLED && isHolder && (
                  <Button
                    variant="outline"
                    className="w-fit gap-2 text-foreground"
                    onClick={() => setIsbnScannerOpen(true)}
                  >
                    <Camera className="h-4 w-4" />
                    Return via ISBN scanner
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  {book.availability_status === "in_transit"
                    ? "This book is temporarily unavailable while it is being moved or processed."
                    : "This book is currently marked as missing."}
                </p>
              </div>
            )}

            {/* Lending Terms */}
            <Card className="mt-6 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-card-foreground">
                  Lending Terms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-card-foreground">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {suggestedLoanPeriodDays} day borrow period (suggested)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-card-foreground">
                    {book.is_pocket_library ? (
                      <>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>Contact owner to arrange pickup</span>
                      </>
                    ) : (
                      <>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>Pick up at library node</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-card-foreground">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {book.lending_terms?.contact_opt_in
                        ? "Contact allowed"
                        : "No contact"}
                    </span>
                  </div>
                  {book.lending_terms?.contact_required && (
                    <div className="flex items-center gap-2 text-card-foreground">
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                      <span>Contact info required to borrow</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sharing History */}
        <Card className="mt-10 border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Sharing History</CardTitle>
          </CardHeader>
          <CardContent>
            {bookEvents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No sharing history yet for this book.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(event.timestamp)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${eventTypeStyles[event.event_type] || ""}`}
                          >
                            {event.event_type.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          {event.user_id ? (
                            <Link
                              href={`/profile/${event.user_id}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {event.user_display_name || "Unknown"}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium text-muted-foreground">
                              {event.user_display_name || "Unknown"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {event.location_text
                            ? formatLocationForDisplay(event.location_text)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {event.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>

      {ISBN_CHECKOUT_RETURN_ENABLED && book && (
        <IsbnScannerDialog
          open={isbnScannerOpen}
          onOpenChange={setIsbnScannerOpen}
          onScan={handleIsbnScanForThisBook}
        />
      )}
    </div>
  )
}
