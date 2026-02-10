"use client"

import { use } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Bell,
  BookOpen,
  Package,
  Users,
  MessageSquare,
  DollarSign,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { mockBooks, mockLoanEvents } from "@/lib/mock-data"

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
  const { uuid } = use(params)
  const book = mockBooks.find((b) => b.id === uuid)
  const bookEvents = mockLoanEvents
    .filter((e) => e.book_id === uuid)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <BookOpen className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          Book not found
        </h1>
        <p className="mt-2 text-muted-foreground">
          This book may have been removed or the link is incorrect.
        </p>
        <Link href="/explore">
          <Button className="mt-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Browse Books
          </Button>
        </Link>
      </div>
    )
  }

  const isAvailable = book.availability_status === "available"

  return (
    <div className="px-4 py-8">
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
            {book.cover_image_url ? (
              <img
                src={book.cover_image_url || "/placeholder.svg"}
                alt={`Cover of ${book.title}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <span className="text-center text-lg font-medium text-muted-foreground">
                  {book.title}
                </span>
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <Badge
              className={
                isAvailable
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-secondary-foreground"
              }
            >
              {isAvailable ? "Available" : "Checked Out"}
            </Badge>

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

            {/* Location */}
            {book.current_location_text && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{book.current_location_text}</span>
              </div>
            )}

            {/* Action */}
            {isAvailable ? (
              <div className="mt-6">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="lg" className="gap-2">
                      <BookOpen className="h-5 w-5" />
                      Check Out This Book
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-foreground">
                        Check Out: {book.title}
                      </DialogTitle>
                      <DialogDescription>
                        Enter your email or sign in to check out this book. A
                        pseudonym will be generated for you.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 flex flex-col gap-4">
                      <div>
                        <Label htmlFor="checkout-email">Email</Label>
                        <Input
                          id="checkout-email"
                          type="email"
                          placeholder="your@email.com"
                          className="mt-1"
                        />
                      </div>
                      <Button className="gap-2">
                        <BookOpen className="h-4 w-4" />
                        Confirm Checkout
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        Loan period: {book.lending_terms.loan_period_days} days
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
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
                <Button variant="outline" className="w-fit gap-2 text-foreground bg-transparent">
                  <Bell className="h-4 w-4" />
                  Notify Me When Available
                </Button>
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
                      {book.lending_terms.loan_period_days} day loan period
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-card-foreground">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {book.lending_terms.deposit_required
                        ? `$${book.lending_terms.deposit_amount} deposit`
                        : "No deposit"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-card-foreground">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {book.lending_terms.shipping_allowed
                        ? "Shipping allowed"
                        : "Local pickup only"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-card-foreground">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {book.lending_terms.contact_opt_in
                        ? "Contact allowed"
                        : "No contact"}
                    </span>
                  </div>
                  {book.lending_terms.member_only && (
                    <div className="flex items-center gap-2 text-card-foreground">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Members only</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Loan History */}
        <Card className="mt-10 border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Loan History</CardTitle>
          </CardHeader>
          <CardContent>
            {bookEvents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No loan history yet for this book.
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
                          <Link
                            href={`/profile/${event.user_id}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {event.user_display_name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {event.location_text}
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
  )
}
