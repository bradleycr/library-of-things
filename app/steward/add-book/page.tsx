"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  Search,
  Check,
  CreditCard,
  ArrowRight,
  Copy,
  QrCode,
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
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import { useLibraryCard } from "@/hooks/use-library-card"
import { GetLibraryCardModal } from "@/components/get-library-card-modal"

export default function AddBookPage() {
  const { data } = useBootstrapData()
  const { card, mounted } = useLibraryCard()
  const [libraryCardModalOpen, setLibraryCardModalOpen] = useState(false)
  const nodes = data?.nodes ?? []
  const [isbn, setIsbn] = useState("")
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [edition, setEdition] = useState("")
  const [nodeId, setNodeId] = useState("")
  const [contactRequired, setContactRequired] = useState(false)
  const [contactOptIn, setContactOptIn] = useState(true)
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const [description, setDescription] = useState("")
  const [isbnLookedUp, setIsbnLookedUp] = useState(false)
  const [bookCreated, setBookCreated] = useState(false)
  const [createdBookId, setCreatedBookId] = useState<string | null>(null)
  const [createdCheckoutUrl, setCreatedCheckoutUrl] = useState<string | null>(null)
  const [urlCopied, setUrlCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [addAnonymously, setAddAnonymously] = useState(false)

  const lookupIsbn = async () => {
    if (!isbn) return
    setLookupError(null)
    try {
      const response = await fetch(
        `https://openlibrary.org/isbn/${encodeURIComponent(isbn.trim())}.json`
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
      setTitle(payload.title || title)
      if (payload.by_statement) {
        setAuthor(payload.by_statement)
      } else if (payload.authors?.[0]?.key) {
        try {
          const authorRes = await fetch(
            `https://openlibrary.org${payload.authors[0].key}.json`
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
        `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn.trim())}-L.jpg`
      )
      // Optional: fetch work description from Open Library (best-effort, never fails the lookup)
      const workKey = payload.works?.[0]?.key
      if (workKey) {
        try {
          const workRes = await fetch(`https://openlibrary.org${workKey}.json`)
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
          // ignore; description stays empty
        }
      }
      setIsbnLookedUp(true)
    } catch (error) {
      setLookupError(
        error instanceof Error ? error.message : "ISBN lookup failed"
      )
      setIsbnLookedUp(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/books/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isbn: isbn || undefined,
          title,
          author: author || undefined,
          edition: edition || undefined,
          description: description.trim() || undefined,
          node_id: nodeId,
          cover_image_url: coverImageUrl.trim() || undefined,
          lending_terms: {
            type: "borrow",
            shipping_allowed: false,
            local_only: true,
            contact_required: contactRequired,
            contact_opt_in: contactOptIn,
          },
          // Attach current user so the catalog shows who added this book (unless anonymous)
          ...(card?.user_id && !addAnonymously && {
            added_by_user_id: card.user_id,
            added_by_display_name: card.pseudonym ?? undefined,
          }),
        }),
      })
      if (!response.ok) {
        throw new Error("Could not create book")
      }
      const result = (await response.json()) as {
        id?: string
        checkout_url?: string
      }
      setBookCreated(true)
      if (result?.id) setCreatedBookId(result.id)
      if (result?.checkout_url) setCreatedCheckoutUrl(result.checkout_url)
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
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Add a Book
          </h1>
          <p className="mt-2 text-muted-foreground">
            Add a new book to the Library of Things network. You can attach a physical NFC/QR
            tag to the book later (print from the book page when available).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* ISBN Lookup */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                <Search className="h-4 w-4 text-primary" />
                ISBN Lookup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter ISBN (e.g., 9780199678112)"
                  value={isbn}
                  onChange={(e) => {
                    setIsbn(e.target.value)
                    setIsbnLookedUp(false)
                    setCoverImageUrl("")
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={lookupIsbn}
                  disabled={!isbn}
                  className="shrink-0"
                >
                  Look Up
                </Button>
              </div>
              {isbnLookedUp && (
                <p className="mt-2 flex items-center gap-1 text-sm text-accent">
                  <Check className="h-4 w-4" />
                  Found! Fields auto-populated.
                </p>
              )}
              {lookupError && (
                <p className="mt-2 text-xs text-destructive">{lookupError}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Uses the Open Library API to auto-populate title and author.
              </p>
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
                <Label>Cover</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  From ISBN lookup, paste a URL, or leave empty for a generated pastel cover with the book title.
                </p>
                {coverImageUrl ? (
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
                      <Input
                        placeholder="Cover image URL"
                        value={coverImageUrl}
                        onChange={(e) => setCoverImageUrl(e.target.value)}
                        className="text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCoverImageUrl("")}
                      >
                        Use generated pastel cover instead
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    <Input
                      placeholder="Paste cover image URL (optional)"
                      value={coverImageUrl}
                      onChange={(e) => setCoverImageUrl(e.target.value)}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      A pastel pixel-art cover with the book title will be generated when you add the book.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Node & Location */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base text-card-foreground">
                Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label>
                  Node <span className="text-destructive">*</span>
                </Label>
                <Select value={nodeId} onValueChange={setNodeId} required>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a node" />
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
            </CardContent>
          </Card>

          {/* Lending Terms */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base text-card-foreground">
                Default Lending Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Suggested return period is 3 weeks (21 days). Borrowers see this as a guideline, not a strict due date.
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
                  Only borrowers who have added email, phone, or a social link to their profile can check out this book. Still trust-based.
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
                    Don&apos;t show my name as the person who added this book. The sharing history will still record that it was added (attributed to the node steward).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex flex-col gap-3 md:flex-row">
            <Button
              type="submit"
              size="lg"
              className="gap-2"
              disabled={!title || !nodeId || isSubmitting}
            >
              <BookOpen className="h-5 w-5" />
              {isSubmitting ? "Adding..." : "Add Book to Library of Things"}
            </Button>
          </div>

          {bookCreated && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-7 w-7 text-primary" />
                </div>
                <p className="mt-4 font-medium text-foreground">Book added to the catalog</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use the URL below for a QR code or NFC tag. When someone taps it, they’ll see a simple checkout or return screen.
                </p>
                {createdCheckoutUrl && (
                  <div className="mt-4 w-full max-w-md">
                    <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Book link (QR / NFC)
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                      <code className="flex-1 truncate text-left text-sm text-foreground">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}${createdCheckoutUrl}`
                          : createdCheckoutUrl}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1"
                        onClick={() => {
                          const full = typeof window !== "undefined"
                            ? `${window.location.origin}${createdCheckoutUrl}`
                            : createdCheckoutUrl
                          void navigator.clipboard.writeText(full).then(() => {
                            setUrlCopied(true)
                            setTimeout(() => setUrlCopied(false), 2000)
                          })
                        }}
                      >
                        {urlCopied ? (
                          <Check className="h-4 w-4 text-accent" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {urlCopied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <QrCode className="h-3.5 w-3.5" />
                      Print this as a QR code or write it to an NFC tag to put on the book.
                    </p>
                  </div>
                )}
                {createdBookId && (
                  <Link href={`/book/${createdBookId}`} className="mt-4">
                    <Button variant="outline" className="gap-2">
                      View book page
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </form>
      </div>
      </div>
    </div>
  )
}
