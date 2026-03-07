"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  MapPin,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  MapPinned,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { BookCover } from "@/components/book-cover"
import { getBookCoverUrl } from "@/lib/book-cover-generator"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import { useLibraryCard } from "@/hooks/use-library-card"
import { useReturnLocation } from "@/hooks/use-return-location"
import { useToast } from "@/hooks/use-toast"
import { MAX_BOOKS_CHECKED_OUT } from "@/lib/constants"
import { DEFAULT_LOAN_PERIOD_DAYS } from "@/lib/loan-period"
import type { Book, Node } from "@/lib/types"

// ---------------------------------------------------------------------------
// Minimal "tap" experience: one question, one action. Load from tap API when
// opened via QR/NFC so it works without full app bootstrap.
// ---------------------------------------------------------------------------

type TapPayload = { book: Book; nodes: Node[] }

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const { uuid } = use(params)

  const { data, loading: bootstrapLoading, refetch } = useBootstrapData()
  const { card } = useLibraryCard()

  const [tapData, setTapData] = useState<TapPayload | null>(null)
  const [tapLoading, setTapLoading] = useState(!!token)
  const [tapError, setTapError] = useState<string | null>(null)

  // When opened with token, load book + nodes from tap API (no bootstrap needed)
  useEffect(() => {
    if (!token || !uuid) {
      setTapLoading(false)
      return
    }
    const ac = new AbortController()
    fetch(`/api/books/${uuid}/tap?token=${encodeURIComponent(token)}`, { signal: ac.signal })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "Invalid or expired link" : "Book not found")
        return res.json() as Promise<TapPayload>
      })
      .then((payload) => setTapData(payload))
      .catch((err) => {
        if (err?.name === "AbortError") return
        setTapError(err instanceof Error ? err.message : "Something went wrong")
      })
      .finally(() => setTapLoading(false))
    return () => ac.abort()
  }, [uuid, token])

  const book = tapData?.book ?? (data?.books ?? []).find((b) => b.id === uuid)
  const nodes = tapData?.nodes ?? data?.nodes ?? []
  const defaultLoanPeriodDays = data?.config?.default_loan_period_days ?? DEFAULT_LOAN_PERIOD_DAYS

  const [email, setEmail] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [checkoutComplete, setCheckoutComplete] = useState(false)
  const [returnComplete, setReturnComplete] = useState(false)
  const [returningNodeId, setReturningNodeId] = useState<string | null>(null)
  const [returnNotes, setReturnNotes] = useState("")

  const isTapEntry = !!token
  const users = data?.users ?? []
  const currentUser = card?.user_id ? users.find((u) => u.id === card.user_id) : null
  const hasContactInfo = currentUser
    ? !!(
        (currentUser.contact_email ?? "").trim() ||
        (currentUser.phone ?? "").trim() ||
        (currentUser.twitter_url ?? "").trim() ||
        (currentUser.linkedin_url ?? "").trim() ||
        (currentUser.website_url ?? "").trim()
      )
    : false
  const contactRequired = book?.lending_terms?.contact_required ?? false
  // Only treat bootstrap as "loaded" when we have data (so we know the user list and can check contact)
  const bootstrapLoaded = !bootstrapLoading && data !== null
  const blockedByContactRequirement = contactRequired && bootstrapLoaded && !hasContactInfo
  // While bootstrap is loading or we have no data, we can't verify contact — show spinner
  const contactCheckPending = contactRequired && !bootstrapLoaded
  const isAvailable = book?.availability_status === "available"
  const isHolder = !!(book && card?.user_id && book.current_holder_id === card.user_id)

  // Missing token: this page is intended to be opened via the book’s QR/NFC link
  if (!token) {
    return (
      <MinimalScreen
        icon={<AlertCircle className="h-12 w-12 text-destructive" />}
        title="Invalid link"
        message="Use the full link from the book’s QR or NFC tag."
        action={
          <Link href={`/book/${uuid}`}>
            <Button variant="outline">View book</Button>
          </Link>
        }
      />
    )
  }

  // Loading tap data
  if (token && tapLoading && !tapData) {
    return (
      <MinimalScreen
        icon={<Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />}
        title="Loading…"
        message=""
      />
    )
  }

  // Tap error or not found
  if (tapError || (token && !book)) {
    return (
      <MinimalScreen
        icon={<AlertCircle className="h-12 w-12 text-destructive" />}
        title={tapError === "Invalid or expired link" ? "Invalid link" : "Book not found"}
        message={tapError ?? "This book may have been removed or the link is incorrect."}
        action={
          <Link href="/explore">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Browse books
            </Button>
          </Link>
        }
      />
    )
  }

  if (!book) {
    return (
      <MinimalScreen
        icon={<BookOpen className="h-12 w-12 text-muted-foreground/40" />}
        title="Book not found"
        message="This book may have been removed or the link is incorrect."
        action={
          <Link href="/explore">
            <Button className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Browse books
            </Button>
          </Link>
        }
      />
    )
  }

  // Checkout success
  if (checkoutComplete) {
    return (
      <MinimalScreen
        icon={<CheckCircle2 className="h-14 w-14 text-primary" />}
        title="You’ve got it"
        message={
          <>
            You checked out <strong>{book.title}</strong>. Suggested return within{" "}
            {book.lending_terms?.loan_period_days ?? defaultLoanPeriodDays} days.
          </>
        }
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/my-books"><Button>My books</Button></Link>
            <Link href="/explore"><Button variant="outline">Browse more</Button></Link>
          </div>
        }
      />
    )
  }

  // Return success
  if (returnComplete) {
    return (
      <MinimalScreen
        icon={<CheckCircle2 className="h-14 w-14 text-primary" />}
        title="Book returned"
        message="Thanks — it’s back in the library for the next reader."
        action={
          <Link href="/explore">
            <Button>Browse books</Button>
          </Link>
        }
      />
    )
  }

  // Available: need library card
  if (isAvailable && !card?.user_id) {
    return (
      <MinimalScreen
        book={book}
        icon={<AlertCircle className="h-12 w-12 text-muted-foreground/60" />}
        title="Library card required"
        message="Get a free library card or log in to check out this book."
        action={
          <Link href="/settings">
            <Button className="gap-2">Get Library Card or Log In</Button>
          </Link>
        }
      />
    )
  }

  // Available: contact requirement — still verifying (bootstrap loading)
  if (isAvailable && contactCheckPending) {
    return (
      <MinimalScreen
        book={book}
        icon={<Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />}
        title="Checking your profile…"
        message="This book requires contact info. Verifying your account."
      />
    )
  }

  // Available: contact info required
  if (isAvailable && blockedByContactRequirement) {
    return (
      <MinimalScreen
        book={book}
        icon={<AlertCircle className="h-12 w-12 text-amber-500" />}
        title="Contact info required"
        message="This book can only be borrowed by people who have added contact info to their profile. Add yours in Settings, then return here."
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/settings"><Button>Settings</Button></Link>
            <Link href={`/book/${uuid}`}><Button variant="outline">Book details</Button></Link>
          </div>
        }
      />
    )
  }

  // Available: borrowing limit reached (max 2 books at a time)
  const checkedOutCount =
    card?.user_id && data?.books
      ? (data.books as Book[]).filter(
          (b) =>
            b.current_holder_id === card.user_id &&
            b.availability_status === "checked_out"
        ).length
      : 0
  if (isAvailable && card?.user_id && checkedOutCount >= MAX_BOOKS_CHECKED_OUT) {
    return (
      <MinimalScreen
        book={book}
        icon={<AlertCircle className="h-12 w-12 text-amber-500" />}
        title="Borrowing limit reached"
        message={`You can have at most ${MAX_BOOKS_CHECKED_OUT} books checked out at once. Return one to check out another.`}
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/my-books">
              <Button className="gap-2">My books — return one</Button>
            </Link>
            <Link href={`/book/${uuid}`}>
              <Button variant="outline">Book details</Button>
            </Link>
          </div>
        }
      />
    )
  }

  // Checked out: not holder — show status only
  if (!isAvailable && !isHolder) {
    return (
      <MinimalScreen
        book={book}
        icon={<BookOpen className="h-12 w-12 text-muted-foreground/50" />}
        title="This book is checked out"
        message={
          book.expected_return_date ? (
            <>
              Suggested return date:{" "}
              {new Date(book.expected_return_date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </>
          ) : (
            "It’s currently with another reader."
          )
        }
        action={
          <Link href={`/book/${uuid}`}>
            <Button variant="outline">View book details</Button>
          </Link>
        }
      />
    )
  }

  // Checked out: holder — return flow with node list and optional geofencing
  if (!isAvailable && isHolder) {
    return (
      <ReturnFlow
        book={book}
        nodes={nodes}
        userId={card!.user_id!}
        onReturnComplete={() => setReturnComplete(true)}
        returningNodeId={returningNodeId}
        setReturningNodeId={setReturningNodeId}
        returnNotes={returnNotes}
        setReturnNotes={setReturnNotes}
        isTapEntry={isTapEntry}
      />
    )
  }

  // Available: minimal checkout CTA then confirm step
  return (
    <AvailableFlow
      book={book}
      uuid={uuid}
      defaultLoanPeriodDays={defaultLoanPeriodDays}
      cardUserId={card?.user_id}
      email={email}
      setEmail={setEmail}
      agreedToTerms={agreedToTerms}
      setAgreedToTerms={setAgreedToTerms}
      isProcessing={isProcessing}
      setIsProcessing={setIsProcessing}
      setCheckoutComplete={setCheckoutComplete}
      refetchBootstrap={refetch}
      isTapEntry={isTapEntry}
    />
  )
}

// ---------------------------------------------------------------------------
// Shared minimal shell (used for all “one message + one action” states)
// ---------------------------------------------------------------------------

function MinimalScreen({
  book,
  icon,
  title,
  message,
  action,
}: {
  book?: Book
  icon: React.ReactNode
  title: string
  message: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-sm text-center">
        {book && (
          <div className="mx-auto mb-6 w-28 flex-shrink-0 overflow-hidden rounded-lg shadow-md">
            <div className="aspect-[2/3] w-full">
              <BookCover src={getBookCoverUrl(book)} title={book.title} />
            </div>
          </div>
        )}
        <div className="flex justify-center">{icon}</div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {message && (
          <p className="mt-2 text-muted-foreground">
            {message}
          </p>
        )}
        {action && <div className="mt-8 flex flex-wrap justify-center gap-3">{action}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Available: “Would you like to check this book out?” → confirm (terms + submit)
// ---------------------------------------------------------------------------

function AvailableFlow({
  book,
  uuid,
  defaultLoanPeriodDays,
  cardUserId,
  email,
  setEmail,
  agreedToTerms,
  setAgreedToTerms,
  isProcessing,
  setIsProcessing,
  setCheckoutComplete,
  refetchBootstrap,
  isTapEntry,
}: {
  book: Book
  uuid: string
  defaultLoanPeriodDays: number
  cardUserId?: string
  email: string
  setEmail: (s: string) => void
  agreedToTerms: boolean
  setAgreedToTerms: (b: boolean) => void
  isProcessing: boolean
  setIsProcessing: (b: boolean) => void
  setCheckoutComplete: (b: boolean) => void
  refetchBootstrap: () => Promise<void>
  isTapEntry: boolean
}) {
  const { toast } = useToast()
  const [step, setStep] = useState<"ask" | "confirm">("ask")

  const handleCheckout = async () => {
    if (!cardUserId) return
    if (!agreedToTerms) return
    setIsProcessing(true)
    try {
      const res = await fetch("/api/books/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ book_id: uuid, user_id: cardUserId }),
      })
      if (res.ok) {
        // Refresh app data so My Books / profile show the new loan immediately.
        await refetchBootstrap()
        setCheckoutComplete(true)
      } else {
        const j = await res.json().catch(() => ({}))
        const msg = (j?.error as string) ?? "Checkout failed"
        const isContactRequired = res.status === 403 && /contact info/i.test(msg)
        const isBorrowingLimit =
          res.status === 403 &&
          (/at most \d+ books checked out/i.test(msg) || /return one to check out another/i.test(msg))
        toast({
          variant: "destructive",
          title: isBorrowingLimit
            ? "Borrowing limit reached"
            : isContactRequired
              ? "Contact info required"
              : msg === "Unauthorized"
                ? "Session expired"
                : "Checkout failed",
          description: isBorrowingLimit
            ? `You can have at most 2 books checked out at once. Return one from My books, then try again.`
            : isContactRequired
              ? "Add email, phone, or a profile link in Settings, then try again."
              : msg === "Unauthorized"
                ? "Please reload and try again."
                : msg,
        })
      }
    } catch (e) {
      console.error(e)
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: "Please try again.",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (step === "ask") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-sm text-center">
          <div className="mx-auto mb-6 w-28 flex-shrink-0 overflow-hidden rounded-lg shadow-md">
            <div className="aspect-[2/3] w-full">
              <BookCover src={getBookCoverUrl(book)} title={book.title} />
            </div>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {book.title}
          </h1>
          {book.author && (
            <p className="mt-1 text-sm text-muted-foreground">{book.author}</p>
          )}
          <p className="mt-6 text-muted-foreground">
            Would you like to check this book out?
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Button size="lg" className="w-full gap-2" onClick={() => setStep("confirm")}>
              <BookOpen className="h-5 w-5" />
              Check out
            </Button>
            {!isTapEntry && (
              <Link href={`/book/${uuid}`}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to book
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8 sm:py-12">
      <div className="page-container">
        <div className="mx-auto max-w-md">
          <div className="mb-6 flex gap-4">
            <div className="w-20 flex-shrink-0 overflow-hidden rounded-lg">
              <BookCover src={getBookCoverUrl(book)} title={book.title} />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{book.title}</h2>
              {book.author && <p className="text-sm text-muted-foreground">{book.author}</p>}
            </div>
          </div>
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(c) => setAgreedToTerms(c === true)}
                  />
                  <label htmlFor="terms" className="cursor-pointer text-sm text-muted-foreground">
                    I’ll return it within {book.lending_terms?.loan_period_days ?? defaultLoanPeriodDays} days and treat it with care.
                  </label>
                </div>
                <Button
                  size="lg"
                  className="w-full gap-2"
                  disabled={!agreedToTerms || isProcessing}
                  onClick={handleCheckout}
                >
                  {isProcessing ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> Confirming…</>
                  ) : (
                    <>Confirm checkout</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" onClick={() => setStep("ask")}>
              Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Return flow: pick location (geofenced when possible), confirm return
// ---------------------------------------------------------------------------

function ReturnFlow({
  book,
  nodes,
  userId,
  onReturnComplete,
  returningNodeId,
  setReturningNodeId,
  returnNotes,
  setReturnNotes,
  isTapEntry,
}: {
  book: Book
  nodes: Node[]
  userId: string
  onReturnComplete: () => void
  returningNodeId: string | null
  setReturningNodeId: (id: string | null) => void
  returnNotes: string
  setReturnNotes: (s: string) => void
  isTapEntry: boolean
}) {
  const { toast } = useToast()
  const { nearbyNodeIds, hasLocation, refreshLocation, loading: locationLoading } = useReturnLocation(nodes)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleReturn = async (nodeId: string) => {
    setIsSubmitting(true)
    setReturningNodeId(nodeId)
    try {
      const res = await fetch("/api/books/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          book_id: book.id,
          user_id: userId,
          return_node_id: nodeId,
          notes: returnNotes.trim() || undefined,
        }),
      })
      if (res.ok) onReturnComplete()
      else {
        const j = await res.json().catch(() => ({}))
        toast({
          variant: "destructive",
          title: "Return failed",
          description: (j?.error as string) ?? "Please try again.",
        })
      }
    } catch (e) {
      console.error(e)
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: "Please try again.",
      })
    } finally {
      setIsSubmitting(false)
      setReturningNodeId(null)
    }
  }

  const suggestedReturn = book.expected_return_date
    ? new Date(book.expected_return_date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null

  return (
    <div className="flex min-h-[70vh] flex-col px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="w-28 flex-shrink-0 overflow-hidden rounded-lg shadow-md">
            <BookCover src={getBookCoverUrl(book)} title={book.title} />
          </div>
        </div>
        <h1 className="text-center text-xl font-semibold text-foreground">{book.title}</h1>
        <p className="mt-2 text-center text-muted-foreground">
          This book is checked out. Suggested return: {suggestedReturn ?? "—"}
        </p>
        <p className="mt-6 text-center text-sm font-medium text-foreground">
          Return this book at a location
        </p>
        {!hasLocation && nodes.some((n) => n.location_lat != null) && (
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Location access was denied or unavailable; you can still choose where to return it.
          </p>
        )}
        {hasLocation && nodes.some((n) => n.location_lat != null) && (
          <div className="mt-2 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={refreshLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              {locationLoading ? "Getting location…" : "Refresh my location"}
            </Button>
          </div>
        )}
        <div className="mt-4">
          <Label className="text-muted-foreground">Optional note (up to 200 characters)</Label>
          <Textarea
            className="mt-1 min-h-[72px] resize-y"
            placeholder="e.g. Condition, how you enjoyed it…"
            value={returnNotes}
            onChange={(e) => setReturnNotes(e.target.value.slice(0, 200))}
            maxLength={200}
          />
          <p className="mt-0.5 text-right text-xs text-muted-foreground">{returnNotes.length}/200</p>
        </div>
        <div className="mt-4 space-y-2">
          {nodes.map((node) => {
            const hasCoords = node.location_lat != null && node.location_lng != null
            const isNearby = hasCoords && nearbyNodeIds.includes(node.id)
            const disabled = hasLocation && hasCoords && !isNearby

            return (
              <Card
                key={node.id}
                className={`border transition-opacity ${disabled ? "opacity-60" : ""}`}
              >
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-foreground">{node.name}</span>
                      {isNearby && (
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
                          Nearby
                        </span>
                      )}
                    </div>
                    {node.location_address && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {node.location_address}
                      </p>
                    )}
                    {disabled && (
                      <p className="mt-1 text-xs text-amber-600">
                        Return only when you’re at this location (within ~1.5 km).
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={disabled || isSubmitting}
                    onClick={() => handleReturn(node.id)}
                    className="shrink-0 gap-1"
                  >
                    {returningNodeId === node.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MapPinned className="h-4 w-4" />
                    )}
                    Return here
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
        {nodes.length === 0 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No return locations configured. Please contact the library.
          </p>
        )}
        {!isTapEntry && (
          <div className="mt-8 text-center">
            <Link href={`/book/${book.id}`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to book
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
