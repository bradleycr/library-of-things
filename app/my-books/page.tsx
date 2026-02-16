"use client"

import Link from "next/link"
import {
  RotateCcw,
  Settings2,
  Clock,
  Shield,
  BookOpen,
  ArrowRight,
  Library,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { BookCover } from "@/components/book-cover"
import { TrustScoreWithBreakdown } from "@/components/trust-score-breakdown"
import { getBookCoverUrl } from "@/lib/book-cover-generator"
import { formatLocationForDisplay } from "@/lib/format-location"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import { useLibraryCard } from "@/hooks/use-library-card"

function daysRemaining(dateStr?: string) {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default function MyBooksPage() {
  const { data } = useBootstrapData()
  const { card } = useLibraryCard()
  const books = data?.books ?? []
  const loanEvents = data?.loanEvents ?? []
  const users = data?.users ?? []
  const nodes = data?.nodes ?? []
  const currentUser = card?.user_id ? users.find((u) => u.id === card.user_id) ?? null : null

  if (!card) {
    return (
      <div className="py-6 sm:py-8">
        <div className="page-container">
          <p className="text-muted-foreground">Get a library card or log in with your card to see your books.</p>
        </div>
      </div>
    )
  }
  if (card && !card.user_id) {
    return (
      <div className="py-6 sm:py-8">
        <div className="page-container">
        <p className="text-muted-foreground">
          Your card ({card.pseudonym}) is on this device. Link it to see your books — go to Settings and enter your PIN to link.
        </p>
        <Link href="/settings">
          <Button className="mt-4">Go to Settings</Button>
        </Link>
        </div>
      </div>
    )
  }
  if (!currentUser) {
    return (
      <div className="py-6 sm:py-8">
        <div className="page-container text-sm text-muted-foreground">User not found.</div>
      </div>
    )
  }

  const borrowedBooks = books.filter(
    (b) =>
      b.current_holder_id === currentUser.id &&
      b.availability_status === "checked_out"
  )

  /** Books this user added to the library; stays in sync with Supabase via bootstrap. */
  const addedByMeBooks = books.filter(
    (b) => b.added_by_user_id === currentUser.id
  )

  const pastEvents = loanEvents
    .filter((e) => e.user_id === currentUser.id)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

  return (
    <div className="py-6 sm:py-8">
      <div className="page-container">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">
              My Books
            </h1>
            <p className="mt-1 text-muted-foreground">
              Borrowed books, titles you’ve added, and lending history
            </p>
          </div>

          {/* Trust Score — click for breakdown */}
          <Card className="border-border md:w-56">
            <CardContent className="flex flex-col items-center p-4">
              <TrustScoreWithBreakdown
                userId={currentUser.id}
                trustScore={currentUser.trust_score}
              />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="borrowed" className="w-full">
          <TabsList className="mb-6 flex w-full flex-wrap gap-1 md:w-auto">
            <TabsTrigger value="borrowed" className="flex-1 gap-2 md:flex-none">
              <BookOpen className="h-4 w-4" />
              Currently Borrowed
              {borrowedBooks.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {borrowedBooks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="added" className="flex-1 gap-2 md:flex-none">
              <Library className="h-4 w-4" />
              Books I’ve Added
              {addedByMeBooks.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {addedByMeBooks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 gap-2 md:flex-none">
              <Clock className="h-4 w-4" />
              Sharing History
            </TabsTrigger>
          </TabsList>

          {/* Currently Borrowed */}
          <TabsContent value="borrowed">
            {borrowedBooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
                <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                <h3 className="mt-4 font-semibold text-card-foreground">
                  No books checked out
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browse the collection and find your next read
                </p>
                <Link href="/explore">
                  <Button className="mt-4 gap-2">
                    Explore Books
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {borrowedBooks.map((book) => {
                  const days = daysRemaining(book.expected_return_date)
                  return (
                    <Card key={book.id} className="border-border">
                      <CardContent className="flex gap-4 p-4">
                        <Link href={`/book/${book.id}`} className="shrink-0">
                          <div className="h-28 w-20 overflow-hidden rounded bg-muted">
                            <BookCover src={getBookCoverUrl(book)} title={book.title} />
                          </div>
                        </Link>
                        <div className="flex flex-1 flex-col">
                          <Link
                            href={`/book/${book.id}`}
                            className="font-semibold text-card-foreground hover:text-primary"
                          >
                            {book.title}
                          </Link>
                          {book.author && (
                            <p className="text-sm text-muted-foreground">
                              {book.author}
                            </p>
                          )}
                          {days !== null && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span
                                className={`text-xs font-medium ${days <= 3 ? "text-destructive" : "text-muted-foreground"}`}
                              >
                                {days === 0
                                  ? "Due today"
                                  : `${days} day${days !== 1 ? "s" : ""} remaining`}
                              </span>
                            </div>
                          )}
                          <div className="mt-auto flex flex-wrap gap-2 pt-3">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="default" className="gap-1.5">
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Return
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle className="text-foreground">
                                    Return: {book.title}
                                  </DialogTitle>
                                  <DialogDescription>
                                    Select a return location and optionally add
                                    notes about the book condition.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="mt-4 flex flex-col gap-4">
                                  <div>
                                    <Label>Return Location</Label>
                                    <Select defaultValue={book.current_node_id || ""}>
                                      <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Select node" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {nodes.map((node) => (
                                          <SelectItem
                                            key={node.id}
                                            value={node.id}
                                          >
                                            {node.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>
                                      Condition Notes{" "}
                                      <span className="text-muted-foreground">
                                        (optional)
                                      </span>
                                    </Label>
                                    <Textarea
                                      className="mt-1"
                                      placeholder="Any notes about the book condition..."
                                    />
                                  </div>
                                  <Button className="gap-2">
                                    <RotateCcw className="h-4 w-4" />
                                    Confirm Return
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-foreground bg-transparent"
                            >
                              <Settings2 className="h-3.5 w-3.5" />
                              Edit Terms
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* Books I've Added */}
          <TabsContent value="added">
            {addedByMeBooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
                <Library className="h-10 w-10 text-muted-foreground/40" />
                <h3 className="mt-4 font-semibold text-card-foreground">
                  No books added yet
                </h3>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                  Add a book from your shelf to share with the community
                </p>
                <Link href="/steward/add-book">
                  <Button className="mt-4 gap-2">
                    <Plus className="h-4 w-4" />
                    Add a Book
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {addedByMeBooks.map((book) => (
                  <Card key={book.id} className="border-border">
                    <CardContent className="flex gap-4 p-4">
                      <Link href={`/book/${book.id}`} className="shrink-0">
                        <div className="h-28 w-20 overflow-hidden rounded bg-muted">
                          <BookCover src={getBookCoverUrl(book)} title={book.title} />
                        </div>
                      </Link>
                      <div className="flex flex-1 flex-col">
                        <Link
                          href={`/book/${book.id}`}
                          className="font-semibold text-card-foreground hover:text-primary"
                        >
                          {book.title}
                        </Link>
                        {book.author && (
                          <p className="text-sm text-muted-foreground">
                            {book.author}
                          </p>
                        )}
                        <div className="mt-2">
                          <Badge
                            variant={
                              book.availability_status === "available"
                                ? "default"
                                : book.availability_status === "checked_out"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-xs"
                          >
                            {book.availability_status.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="mt-auto pt-3">
                          <Link href={`/book/${book.id}`}>
                            <Button size="sm" variant="ghost" className="gap-1.5 text-foreground">
                              View book
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Sharing History */}
          <TabsContent value="history">
            {pastEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
                <Clock className="h-10 w-10 text-muted-foreground/40" />
                <h3 className="mt-4 font-semibold text-card-foreground">
                  No sharing history yet
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your lending activity will appear here
                </p>
              </div>
            ) : (
              <Card className="border-border">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {pastEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-4 px-4 py-3"
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            event.event_type === "checkout"
                              ? "bg-primary/10"
                              : event.event_type === "return"
                                ? "bg-accent/10"
                                : "bg-secondary"
                          }`}
                        >
                          {event.event_type === "checkout" ? (
                            <BookOpen className="h-4 w-4 text-primary" />
                          ) : event.event_type === "return" ? (
                            <RotateCcw className="h-4 w-4 text-accent" />
                          ) : (
                            <ArrowRight className="h-4 w-4 text-secondary-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium capitalize text-foreground">
                              {event.event_type.replace("_", " ")}
                            </span>
                            {" — "}
                            <Link
                              href={`/book/${event.book_id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {event.book_title}
                            </Link>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                            {event.location_text &&
                              ` at ${formatLocationForDisplay(event.location_text)}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </div>
  )
}
