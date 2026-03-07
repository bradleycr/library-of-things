"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import {
  BookOpen,
  Search,
  Check,
  CreditCard,
  ArrowRight,
  MapPin,
  Mail,
  Building2,
  Package,
  Info,
  Camera,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import { useLibraryCard } from "@/hooks/use-library-card"
import { useToast } from "@/hooks/use-toast"
import { GetLibraryCardModal } from "@/components/get-library-card-modal"
import { CoverPhotoCapture } from "@/components/cover-photo-capture"
import { AddBookSuccessCard } from "@/components/add-book-success-card"
import { generateBookCoverSvg } from "@/lib/book-cover-generator"
import { DEFAULT_LOAN_PERIOD_DAYS, formatDefaultLoanPeriod } from "@/lib/loan-period"

export default function AddBookPage() {
  const { data } = useBootstrapData()
  const { card, mounted } = useLibraryCard()
  const { toast } = useToast()
  const [libraryCardModalOpen, setLibraryCardModalOpen] = useState(false)
  const nodes = data?.nodes ?? []
  const currentUser = card?.user_id
    ? (data?.users ?? []).find((u) => u.id === card.user_id) ?? null
    : null

  // Book details
  const [isbn, setIsbn] = useState("")
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [edition, setEdition] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const [description, setDescription] = useState("")
  const [isbnLookedUp, setIsbnLookedUp] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupInProgress, setLookupInProgress] = useState(false)
  const lookupAbortRef = useRef<AbortController | null>(null)

  // Cover source: "url" for standard URL/ISBN flow, "camera" for photo capture
  const [coverMode, setCoverMode] = useState<"url" | "camera">("url")

  // Location: node or pocket library
  const [locationType, setLocationType] = useState<"node" | "pocket">("node")
  const [nodeId, setNodeId] = useState("")
  const [currentLocation, setCurrentLocation] = useState("")
  const [ownerContactEmail, setOwnerContactEmail] = useState("")

  // Lending terms
  const [contactRequired, setContactRequired] = useState(false)
  const [contactOptIn, setContactOptIn] = useState(true)
  const [addAnonymously, setAddAnonymously] = useState(false)

  // Submission state
  const [bookCreated, setBookCreated] = useState(false)
  const [createdBookId, setCreatedBookId] = useState<string | null>(null)
  const [createdCheckoutUrl, setCreatedCheckoutUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Node recommendation dialog for Pocket Library books
  const [showNodeRecommendation, setShowNodeRecommendation] = useState(false)

  // Auto-detect geolocation for Pocket Library books (with cleanup on unmount)
  useEffect(() => {
    if (locationType !== "pocket" || currentLocation) return
    if (!("geolocation" in navigator)) return

    let cancelled = false
    const id = navigator.geolocation.watchPosition(
      (position) => {
        if (cancelled) return
        const { latitude, longitude } = position.coords
        setCurrentLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
      },
      () => {
        if (!cancelled) console.log("Geolocation not available")
      },
      { timeout: 10_000, maximumAge: 60_000 }
    )
    return () => {
      cancelled = true
      navigator.geolocation.clearWatch(id)
    }
  }, [locationType, currentLocation])

  const lookupIsbn = useCallback(async (isbnToLookUp?: string) => {
    const value = (isbnToLookUp ?? isbn).trim().replace(/[\s-]/g, "")
    if (!value) return
    const is10 = value.length === 10
    const is13 = value.length === 13
    if (!is10 && !is13) return

    // Cancel any in-flight lookup
    lookupAbortRef.current?.abort()
    lookupAbortRef.current = new AbortController()
    const signal = lookupAbortRef.current.signal

    setLookupError(null)
    setLookupInProgress(true)
    try {
      const response = await fetch(
        `https://openlibrary.org/isbn/${encodeURIComponent(value)}.json`,
        { signal }
      )
      if (!response.ok) {
        throw new Error("No book metadata found for this ISBN")
      }
      const payload = (await response.json()) as {
        title?: string
        by_statement?: string
        edition_name?: string
        publish_date?: string
        authors?: { key: string }[]
        works?: { key: string }[]
      }
      setTitle(payload.title ?? title)
      if (payload.by_statement) {
        setAuthor(payload.by_statement)
      } else if (payload.authors?.[0]?.key) {
        try {
          const authorRes = await fetch(
            `https://openlibrary.org${payload.authors[0].key}.json`,
            { signal }
          )
          if (authorRes.ok) {
            const authorData = (await authorRes.json()) as { name?: string }
            if (authorData.name) setAuthor(authorData.name)
          }
        } catch {
          // keep existing author if fetch fails
        }
      }
      if (payload.edition_name) {
        setEdition(payload.edition_name)
      } else if (payload.publish_date) {
        setEdition(payload.publish_date)
      }
      setCoverImageUrl(
        `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(value)}-L.jpg`
      )
      const workKey = payload.works?.[0]?.key
      if (workKey) {
        try {
          const workRes = await fetch(`https://openlibrary.org${workKey}.json`, { signal })
          if (workRes.ok) {
            const work = (await workRes.json()) as {
              description?: string | { type?: string; value?: string }
            }
            const raw =
              typeof work.description === "string"
                ? work.description
                : work.description?.value
            if (raw && typeof raw === "string") {
              setDescription(raw.trim().slice(0, 3000))
            }
          }
        } catch {
          // ignore
        }
      }
      setIsbnLookedUp(true)
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      setLookupError(
        error instanceof Error ? error.message : "ISBN lookup failed"
      )
      setIsbnLookedUp(false)
    } finally {
      if (!signal.aborted) setLookupInProgress(false)
    }
  }, [isbn, title])

  // Debounced auto-lookup when ISBN looks complete (10 or 13 digits). Only depends on isbn so we don't re-trigger after title/author update from a previous lookup.
  useEffect(() => {
    const normalized = isbn.trim().replace(/[\s-]/g, "")
    const validLength = normalized.length === 10 || normalized.length === 13
    if (!validLength) return

    const timer = setTimeout(() => {
      lookupIsbn(normalized)
    }, 700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run only when isbn string changes
  }, [isbn])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/books/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isbn: isbn || undefined,
          title,
          author: author || undefined,
          edition: edition || undefined,
          description: description.trim() || undefined,
          node_id: locationType === "node" ? nodeId : undefined,
          cover_image_url: coverImageUrl.trim() || undefined,
          lending_terms: {
            type: "borrow",
            shipping_allowed: false,
            local_only: true,
            contact_required: contactRequired,
            contact_opt_in: contactOptIn,
          },
          is_pocket_library: locationType === "pocket",
          owner_contact_email: locationType === "pocket" ? ownerContactEmail : undefined,
          current_location_text: locationType === "pocket" ? currentLocation : undefined,
          // Attribution: linked user (authoritative name from DB), or "Anonymous"
          ...(card?.user_id && !addAnonymously
            ? { added_by_user_id: card.user_id, added_by_display_name: currentUser?.display_name ?? card.pseudonym ?? undefined }
            : addAnonymously
              ? { added_by_display_name: "Anonymous" }
              : {}),
        }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Could not create book")
      }
      const result = (await response.json()) as {
        id?: string
        checkout_url?: string
      }
      setBookCreated(true)
      if (result?.id) setCreatedBookId(result.id)
      if (result?.checkout_url) setCreatedCheckoutUrl(result.checkout_url)
      
      // Show node recommendation dialog for Pocket Library books
      if (locationType === "pocket") {
        setShowNodeRecommendation(true)
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not add book",
        description: error instanceof Error ? error.message : "Failed to add book. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (mounted && !card) {
    return (
      <div className="py-6 sm:py-8">
        <div className="page-container">
          <div className="mx-auto max-w-2xl">
            <Card className="border-border">
              <CardContent className="flex flex-col items-center gap-6 p-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-semibold text-foreground">
                    Get your library card first
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    You need a Library of Things library card before adding books to the network.
                    It&apos;s free and pseudonymous—no email required.
                  </p>
                </div>
                <Button onClick={() => setLibraryCardModalOpen(true)} className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Get Your Card
                </Button>
              </CardContent>
            </Card>
          </div>
          <GetLibraryCardModal
            open={libraryCardModalOpen}
            onOpenChange={setLibraryCardModalOpen}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="py-6 sm:py-8">
      <div className="page-container">
        <div className="mx-auto max-w-2xl">
          {/* When book was just added: show only success state — no form, so nothing looks editable */}
          {bookCreated ? (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="font-serif text-3xl font-bold text-foreground">
                  Book added
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Your book is in the catalog. Use the options below to add the checkout link to your book (QR or NFC), or go to the book page.
                </p>
              </div>

              {createdCheckoutUrl ? (
                <AddBookSuccessCard
                  checkoutUrl={createdCheckoutUrl}
                  bookId={createdBookId}
                  locationType={locationType}
                />
              ) : createdBookId ? (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-7 w-7 text-primary" />
                    </div>
                    <p className="font-medium text-foreground">Book added.</p>
                    <Link href={`/book/${createdBookId}`}>
                      <Button variant="outline" className="gap-2">
                        View book page
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setBookCreated(false)
                    setCreatedBookId(null)
                    setCreatedCheckoutUrl(null)
                    setTitle("")
                    setAuthor("")
                    setEdition("")
                    setIsbn("")
                    setCoverImageUrl("")
                    setDescription("")
                    setIsbnLookedUp(false)
                    setLookupError(null)
                    setNodeId("")
                    setOwnerContactEmail("")
                    setCurrentLocation("")
                  }}
                  className="gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Add another book
                </Button>
                <Link href="/explore">
                  <Button variant="ghost" className="gap-2">
                    Browse catalog
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="font-serif text-3xl font-bold text-foreground">
                  Add a Book to the Network
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Share your books with the community. Add them to a library node or keep them in your
                  Pocket Library.
                </p>
              </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* ISBN Lookup */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                  <Search className="h-4 w-4 text-primary" />
                  ISBN Lookup (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-sm text-muted-foreground">
                  Enter an ISBN (10 or 13 digits; ISBN-10 can end with X). We&apos;ll look up title, author, and cover automatically.
                </p>
                <Input
                  placeholder="e.g. 9780199678112"
                  value={isbn}
                  onChange={(e) => {
                    setIsbn(e.target.value)
                    setIsbnLookedUp(false)
                    setCoverImageUrl("")
                  }}
                  className="max-w-sm"
                />
                {lookupInProgress && (
                  <p className="mt-2 text-sm text-muted-foreground">Looking up…</p>
                )}
                {isbnLookedUp && !lookupInProgress && (
                  <p className="mt-2 flex items-center gap-1 text-sm text-accent">
                    <Check className="h-4 w-4" />
                    Found! Fields auto-populated.
                  </p>
                )}
                {lookupError && (
                  <p className="mt-2 text-xs text-destructive">{lookupError}</p>
                )}
              </CardContent>
            </Card>

            {/* Book Details */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Book Details
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Book title"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="author">Author</Label>
                  <Input
                    id="author"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Author name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edition">Edition</Label>
                  <Input
                    id="edition"
                    value={edition}
                    onChange={(e) => setEdition(e.target.value)}
                    placeholder="e.g., 2nd Edition"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Cover Image</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    From ISBN lookup, paste a URL, snap a photo, or leave empty for a generated cover.
                  </p>

                  {coverMode === "url" ? (
                    /* ── URL mode (primary) ────────────────────── */
                    coverImageUrl ? (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="h-32 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                          <img
                            src={coverImageUrl}
                            alt="Cover preview"
                            className="h-full w-full object-cover"
                            onError={() => setCoverImageUrl("")}
                          />
                        </div>
                        <div className="flex flex-1 flex-col gap-2">
                          {!coverImageUrl.startsWith("data:") && (
                            <Input
                              placeholder="Cover image URL"
                              value={coverImageUrl}
                              onChange={(e) => setCoverImageUrl(e.target.value)}
                              className="text-sm"
                            />
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCoverImageUrl("")}
                            >
                              Use generated cover instead
                            </Button>
                            {coverImageUrl.startsWith("data:") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => {
                                  setCoverImageUrl("")
                                  setCoverMode("camera")
                                }}
                              >
                                <Camera className="h-3.5 w-3.5" />
                                Retake
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-col gap-2">
                        {/* When no URL/photo: show generated cover preview so user sees what will actually be used (and after cancel from photo flow). */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                          <div className="h-32 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                            <img
                              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                                generateBookCoverSvg({
                                  seed: "add-book-preview",
                                  title: title || "Title",
                                  author: author || undefined,
                                })
                              )}`}
                              alt="Generated cover preview"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex flex-1 flex-col gap-2">
                            <p className="text-xs text-muted-foreground">
                              This is the generated cover that will be used. Paste a URL or take a photo to use a different cover.
                            </p>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Paste cover image URL (optional)"
                                value={coverImageUrl}
                                onChange={(e) => setCoverImageUrl(e.target.value)}
                                className="text-sm"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0 gap-1.5"
                                onClick={() => setCoverMode("camera")}
                                title="Take a photo of the cover"
                              >
                                <Camera className="h-4 w-4" />
                                <span className="hidden sm:inline">Photo</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  ) : (
                    /* ── Camera mode (secondary) ───────────────── */
                    <div className="mt-2">
                      <CoverPhotoCapture
                        onCapture={(dataUri) => {
                          setCoverImageUrl(dataUri)
                          setCoverMode("url")
                        }}
                        onCancel={() => setCoverMode("url")}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Location Type Selection */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base text-card-foreground">
                  Where will this book be kept?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={locationType} onValueChange={(v) => setLocationType(v as "node" | "pocket")}>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="node" id="location-node" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="location-node" className="flex items-center gap-2 cursor-pointer">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span className="font-medium">At a Library Node</span>
                        </Label>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Add this book to one of the existing library locations where anyone can access it.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="pocket" id="location-pocket" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="location-pocket" className="flex items-center gap-2 cursor-pointer">
                          <Package className="h-4 w-4 text-accent" />
                          <span className="font-medium">Pocket Library (Keep with me)</span>
                        </Label>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Keep this book in your personal collection. Others can request to borrow it by contacting you.
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>

                {locationType === "node" && (
                  <div className="mt-4">
                    <Label>
                      Select Library Node <span className="text-destructive">*</span>
                    </Label>
                    <Select value={nodeId} onValueChange={setNodeId} required>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select a library location" />
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
                )}

                {locationType === "pocket" && (
                  <div className="mt-4 flex flex-col gap-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Pocket Library books stay with you. Share your contact email so borrowers can arrange pickup.
                      </AlertDescription>
                    </Alert>
                    
                    <div>
                      <Label htmlFor="owner-email">
                        <Mail className="mr-1 inline h-3.5 w-3.5" />
                        Your Contact Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="owner-email"
                        type="email"
                        value={ownerContactEmail}
                        onChange={(e) => setOwnerContactEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        required={locationType === "pocket"}
                        className="mt-1"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        This will be shown to people who want to borrow this book.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="current-location">
                        <MapPin className="mr-1 inline h-3.5 w-3.5" />
                        Current Location (Optional)
                      </Label>
                      <Input
                        id="current-location"
                        value={currentLocation}
                        onChange={(e) => setCurrentLocation(e.target.value)}
                        placeholder="City, neighborhood, or coordinates"
                        className="mt-1"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Helps borrowers know if the book is nearby. Auto-detected if location permissions are enabled.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lending Terms */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base text-card-foreground">
                  Lending Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Suggested return period is {formatDefaultLoanPeriod(data?.config?.default_loan_period_days ?? DEFAULT_LOAN_PERIOD_DAYS)}. Borrowers see this as a guideline, not a strict due date.
                </p>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="contact-required"
                      checked={contactRequired}
                      onCheckedChange={(c) => setContactRequired(c === true)}
                    />
                    <Label htmlFor="contact-required" className="text-sm text-card-foreground">
                      Require contact info to borrow
                    </Label>
                  </div>
                  <p className="ml-6 text-xs text-muted-foreground">
                    Only borrowers who have added email, phone, or a social link to their profile can check out this book.
                  </p>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="contact"
                      checked={contactOptIn}
                      onCheckedChange={(c) => setContactOptIn(c === true)}
                    />
                    <Label htmlFor="contact" className="text-sm text-card-foreground">
                      Allow others to contact me about this book
                    </Label>
                  </div>

                  <div className="flex flex-col gap-2 pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="add-anonymously"
                        checked={addAnonymously}
                        onCheckedChange={(c) => setAddAnonymously(c === true)}
                      />
                      <Label htmlFor="add-anonymously" className="text-sm text-card-foreground">
                        Add this book anonymously
                      </Label>
                    </div>
                    <p className="ml-6 text-xs text-muted-foreground">
                      Don&apos;t show my name; the book will list &quot;Added by Anonymous&quot; on its page.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                size="lg"
                className="gap-2"
                disabled={
                  !title || 
                  (locationType === "node" && !nodeId) || 
                  (locationType === "pocket" && !ownerContactEmail) || 
                  isSubmitting
                }
              >
                <BookOpen className="h-5 w-5" />
                {isSubmitting ? "Adding..." : "Add Book to Library of Things"}
              </Button>
            </div>

          </form>
            </>
          )}
        </div>
      </div>

      {/* Node Recommendation Dialog */}
      <Dialog open={showNodeRecommendation} onOpenChange={setShowNodeRecommendation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Consider bringing your book to a node
            </DialogTitle>
            <DialogDescription className="pt-2">
              Pocket Library books are great for personal sharing, but bringing your book to one of our library nodes makes it accessible to more people in the community!
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Available Nodes:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  {nodes.slice(0, 3).map((node) => (
                    <li key={node.id}>• {node.name}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              You can always move your book to a node later by editing it on the book's detail page.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNodeRecommendation(false)}>
                Keep as Pocket Library
              </Button>
              <Button onClick={() => {
                setShowNodeRecommendation(false)
                window.scrollTo({ top: 0, behavior: "smooth" })
              }}>
                <Building2 className="mr-2 h-4 w-4" />
                View Library Nodes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
