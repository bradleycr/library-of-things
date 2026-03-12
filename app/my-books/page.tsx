"use client"

import { useState, Suspense, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  RotateCcw,
  Clock,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Library,
  Plus,
  Loader2,
  Camera,
  QrCode,
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
import { Checkbox } from "@/components/ui/checkbox"
import { BookCover } from "@/components/book-cover"
import { TrustScoreWithBreakdown } from "@/components/trust-score-breakdown"
import { getBookCoverUrl } from "@/lib/book-cover-generator"
import { formatLocationForDisplay } from "@/lib/format-location"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import { useLibraryCard } from "@/hooks/use-library-card"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getAvatarUrl, getInitials, getAvatarSeed } from "@/lib/avatar"
import { IsbnScannerDialog } from "@/components/isbn-scanner-dialog"
import { normalizeIsbn } from "@/lib/isbn-utils"
import { ISBN_CHECKOUT_RETURN_ENABLED } from "@/lib/feature-flags"
import type { Book, User } from "@/lib/types"

function daysRemaining(dateStr?: string) {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function MyBooksContent() {
  const searchParams = useSearchParams()
  const viewUserId = searchParams.get("user")
  const { data, loading, error, refetch } = useBootstrapData()
  const { card } = useLibraryCard()
  const { toast } = useToast()
  const books = data?.books ?? []
  const loanEvents = data?.loanEvents ?? []
  const users = data?.users ?? []
  const nodes = data?.nodes ?? []
  const viewingOtherUser = viewUserId != null && viewUserId !== ""
  const subjectUser: User | null = viewingOtherUser
    ? (users.find((u) => u.id === viewUserId) ?? null)
    : (card?.user_id ? users.find((u) => u.id === card.user_id) ?? null : null)
  const isOwnView = !viewingOtherUser && !!card?.user_id && card.user_id === subjectUser?.id
  const currentUser = subjectUser

  /* Return: gate (prove you have the book) then form */
  const [returnGateOpen, setReturnGateOpen] = useState(false)
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [returnBook, setReturnBook] = useState<Book | null>(null)
  const [isbnScannerOpenForReturn, setIsbnScannerOpenForReturn] = useState(false)
  const [returnNodeId, setReturnNodeId] = useState("")
  const [returnNotes, setReturnNotes] = useState("")
  const [returning, setReturning] = useState(false)
  const [returnAtLocationAcknowledged, setReturnAtLocationAcknowledged] = useState(false)

  const router = useRouter()

  const openReturnGate = (book: Book) => {
    setReturnBook(book)
    setReturnGateOpen(true)
  }

  const closeReturnGate = () => {
    setReturnGateOpen(false)
    setReturnBook(null)
    setIsbnScannerOpenForReturn(false)
  }

  const openReturnDialog = (book: Book) => {
    setReturnBook(book)
    setReturnNodeId(book.current_node_id ?? "")
    setReturnNotes("")
    setReturnAtLocationAcknowledged(false)
    setReturnDialogOpen(true)
  }

  const closeReturnDialog = () => {
    setReturnDialogOpen(false)
    setReturnBook(null)
    setReturnNodeId("")
    setReturnNotes("")
    setReturnAtLocationAcknowledged(false)
  }

  const handleIsbnScannedForReturn = useCallback(
    (scannedIsbn: string) => {
      if (!returnBook) return
      const bookNorm = returnBook.isbn ? normalizeIsbn(returnBook.isbn) : null
      if (bookNorm !== null && bookNorm !== scannedIsbn) {
        toast({
          variant: "destructive",
          title: "Wrong book",
          description: "This barcode doesn’t match the book you’re returning.",
        })
        return
      }
      // Capture book before any state updates; close gate/scanner first
      const bookToReturn = returnBook
      setIsbnScannerOpenForReturn(false)
      setReturnGateOpen(false)
      // Defer opening return form so scanner dialog can close and focus/stacking is correct
      requestAnimationFrame(() => {
        openReturnDialog(bookToReturn)
      })
    },
    [returnBook, toast],
  )

  const handleOpenReturnPage = () => {
    if (!returnBook?.checkout_url) return
    const path = returnBook.checkout_url.startsWith("/") ? returnBook.checkout_url : `/${returnBook.checkout_url}`
    closeReturnGate()
    router.push(path)
  }

  const handleConfirmReturn = async () => {
    if (!returnBook || !currentUser) return
    setReturning(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20_000)
    try {
      const res = await fetch("/api/books/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          book_id: returnBook.id,
          user_id: currentUser.id,
          return_node_id: returnNodeId || undefined,
          notes: returnNotes.trim() || undefined,
        }),
      })
      clearTimeout(timeoutId)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Return failed")
      await refetch()
      closeReturnDialog()
      toast({
        title: "Book returned",
        description: `${returnBook.title} has been returned.`,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      const isTimeout = (err instanceof Error && err.name === "AbortError") ||
        (err instanceof Error && /timeout|abort/i.test(err.message))
      toast({
        variant: "destructive",
        title: "Could not return book",
        description: isTimeout
          ? "Request timed out. Please try again, or open the return page by scanning the book’s QR or NFC tag."
          : err instanceof Error ? err.message : "Something went wrong. Please try again.",
      })
    } finally {
      setReturning(false)
    }
  }

  if (!card && !viewingOtherUser) {
    return (
      <div className="py-6 sm:py-8">
        <div className="page-container">
          <p className="text-muted-foreground">Get a library card or log in with your card to see your books.</p>
        </div>
      </div>
    )
  }
  if (card && !card.user_id && !viewingOtherUser) {
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

  if (viewingOtherUser) {
    if (loading) {
      return (
        <div className="py-6 sm:py-8">
          <div className="page-container">
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          </div>
        </div>
      )
    }
    if (error) {
      return (
        <div className="py-6 sm:py-8">
          <div className="page-container">
            <p className="text-muted-foreground">Could not load data. {error}</p>
            <Button className="mt-4 gap-2" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        </div>
      )
    }
    if (!subjectUser) {
      return (
        <div className="py-6 sm:py-8">
          <div className="page-container">
            <p className="text-muted-foreground">User not found.</p>
            <Link href="/explore">
              <Button className="mt-4 gap-2" variant="outline">
                <ArrowRight className="h-4 w-4" />
                Explore
              </Button>
            </Link>
          </div>
        </div>
      )
    }
  }

  /* Have linked card but need bootstrap to resolve currentUser — avoid showing "User not found" while loading */
  if (!viewingOtherUser && card?.user_id && loading) {
    return (
      <div className="py-6 sm:py-8">
        <div className="page-container">
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Loading your books…</p>
          </div>
        </div>
      </div>
    )
  }

  if (!viewingOtherUser && card?.user_id && error) {
    return (
      <div className="py-6 sm:py-8">
        <div className="page-container">
          <p className="text-muted-foreground">Could not load data. {error}</p>
          <Button className="mt-4 gap-2" variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
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
        {viewingOtherUser && subjectUser && (
          <Link href={`/profile/${subjectUser.id}`}>
            <Button variant="ghost" size="sm" className="mb-4 gap-2 text-foreground">
              <ArrowLeft className="h-4 w-4" />
              View profile
            </Button>
          </Link>
        )}
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {currentUser && (
              <>
                <Avatar className="h-12 w-12 border border-border shrink-0">
                  <AvatarImage src={getAvatarUrl(getAvatarSeed(currentUser))} alt={currentUser.display_name} />
                  <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                    {getInitials(currentUser.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="font-serif text-3xl font-bold text-foreground">
                    {isOwnView ? "My Books" : `${currentUser.display_name}'s Books`}
                  </h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {isOwnView ? "Borrowed books, titles you've added, and lending history" : "Borrowed, added & sharing history"}
                  </p>
                  {isOwnView && (
                    <span className="inline-block mt-1 text-xs text-muted-foreground">You</span>
                  )}
                </div>
              </>
            )}
          </div>

          {currentUser && (
            <Card className="border-border md:w-56 shrink-0">
              <CardContent className="flex flex-col items-center p-4">
                <TrustScoreWithBreakdown
                  userId={currentUser.id}
                  trustScore={currentUser.trust_score}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="borrowed" className="w-full">
          <TabsList className="mb-6 flex h-auto w-full flex-wrap gap-2 p-1 md:w-auto">
            <TabsTrigger value="borrowed" className="gap-2 px-3 py-2 md:flex-none">
              <BookOpen className="h-4 w-4" />
              Currently Borrowed
              {borrowedBooks.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {borrowedBooks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="added" className="gap-2 px-3 py-2 md:flex-none">
              <Library className="h-4 w-4" />
              {isOwnView ? "Books I've Added" : "Books They've Added"}
              {addedByMeBooks.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {addedByMeBooks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 px-3 py-2 md:flex-none">
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
                          {isOwnView && (
                          <div className="mt-auto flex flex-wrap gap-2 pt-3">
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1.5"
                              onClick={() => openReturnGate(book)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Return
                            </Button>
                          </div>
                          )}
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
                  {isOwnView
                    ? "Add a book from your shelf to share with the community"
                    : "This member hasn't added any books yet."}
                </p>
                {isOwnView ? (
                  <Link href="/add-book">
                    <Button className="mt-4 gap-2">
                      <Plus className="h-4 w-4" />
                      Add a Book
                    </Button>
                  </Link>
                ) : subjectUser ? (
                  <Link href={`/profile/${subjectUser.id}`}>
                    <Button className="mt-4 gap-2" variant="outline">
                      <ArrowLeft className="h-4 w-4" />
                      View profile
                    </Button>
                  </Link>
                ) : null}
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
                  {isOwnView ? "Your lending activity will appear here" : "This member has no sharing history yet."}
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
                            {event.book_id ? (
                              <Link
                                href={`/book/${event.book_id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {event.book_title}
                              </Link>
                            ) : (
                              <span>{event.book_title}</span>
                            )}
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
                          {event.notes && (
                            <p className="mt-1.5 line-clamp-2 break-words text-xs text-muted-foreground" title={event.notes}>
                              {event.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Return gate: prove you have the book (scan ISBN or open return page via QR/NFC) */}
        <Dialog open={returnGateOpen} onOpenChange={(open) => !open && closeReturnGate()}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Return: {returnBook?.title ?? ""}</DialogTitle>
              <DialogDescription>
                To return this book we need to verify you have it. Use the ISBN scanner to scan the barcode on the book, or open the return page by scanning the QR or NFC tag on the physical book.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex flex-col gap-3">
              {ISBN_CHECKOUT_RETURN_ENABLED && (
                <Button
                  className="w-full gap-2"
                  variant="default"
                  onClick={() => setIsbnScannerOpenForReturn(true)}
                >
                  <Camera className="h-4 w-4" />
                  Use ISBN scanner
                </Button>
              )}
              <Button
                className="w-full gap-2"
                variant="outline"
                onClick={handleOpenReturnPage}
              >
                <QrCode className="h-4 w-4" />
                Open return page (scan QR or NFC on book)
              </Button>
              <Button variant="ghost" size="sm" onClick={closeReturnGate}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {returnBook && (
          <IsbnScannerDialog
            open={isbnScannerOpenForReturn}
            onOpenChange={(open) => {
              if (!open) setIsbnScannerOpenForReturn(false)
            }}
            onScan={handleIsbnScannedForReturn}
          />
        )}

        {/* Return form (after gate: node, notes, location ack, confirm) */}
        <Dialog open={returnDialogOpen} onOpenChange={(open) => !open && closeReturnDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Return: {returnBook?.title ?? ""}
              </DialogTitle>
              <DialogDescription>
                Select a return location. You can leave a short note about the condition of the book, how you enjoyed it, or anything else — it will appear in the sharing history.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <Label>Return Location</Label>
                <Select value={returnNodeId} onValueChange={setReturnNodeId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select node" />
                  </SelectTrigger>
                  <SelectContent>
                    {nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  Note <span className="text-muted-foreground">(optional, up to 200 characters)</span>
                </Label>
                <Textarea
                  className="mt-1 min-h-[88px] resize-y"
                  placeholder="e.g. Condition, how you enjoyed it, or anything you'd like to share…"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value.slice(0, 200))}
                  maxLength={200}
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {returnNotes.length}/200
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="my-books-return-ack"
                  checked={returnAtLocationAcknowledged}
                  onCheckedChange={(c) => setReturnAtLocationAcknowledged(c === true)}
                />
                <label htmlFor="my-books-return-ack" className="cursor-pointer text-sm text-muted-foreground">
                  {returnBook?.is_pocket_library
                    ? "I will only mark as returned when I have physically returned the book."
                    : (() => {
                        const selectedNode = returnNodeId ? nodes.find((n) => n.id === returnNodeId) : null
                        const locationPhrase = selectedNode
                          ? `I am at ${selectedNode.name} (or will return the book there)`
                          : "I am at the selected return location (or will return the book there)"
                        return `${locationPhrase} and will only mark as returned when I have physically returned the book.`
                      })()}
                </label>
              </div>
              <Button
                className="gap-2"
                onClick={handleConfirmReturn}
                disabled={!returnAtLocationAcknowledged || returning}
              >
                {returning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {returning ? "Returning…" : "Confirm Return"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </div>
  )
}

export default function MyBooksPage() {
  return (
    <Suspense
      fallback={
        <div className="py-6 sm:py-8">
          <div className="page-container">
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          </div>
        </div>
      }
    >
      <MyBooksContent />
    </Suspense>
  )
}
