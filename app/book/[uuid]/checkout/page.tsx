"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  MapPin,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { BookCover } from "@/components/book-cover"
import { getBookCoverUrl } from "@/lib/book-cover-generator"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import { useLibraryCard } from "@/hooks/use-library-card"

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const { data } = useBootstrapData()
  const { card } = useLibraryCard()
  const books = data?.books ?? []
  const { uuid } = use(params)
  const book = books.find((b) => b.id === uuid)
  
  const [email, setEmail] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [checkoutComplete, setCheckoutComplete] = useState(false)

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

  // Verify token (basic check - in production, validate against database)
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          Invalid Checkout Link
        </h1>
        <p className="mt-2 max-w-md text-center text-muted-foreground">
          This checkout link is missing authentication. Please scan the NFC or QR code on the
          physical book to get a valid checkout link.
        </p>
        <Link href={`/book/${uuid}`}>
          <Button className="mt-6 gap-2">
            View Book Details
          </Button>
        </Link>
      </div>
    )
  }

  const isAvailable = book.availability_status === "available"
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
  const contactRequired = book.lending_terms.contact_required
  const blockedByContactRequirement = contactRequired && !hasContactInfo

  if (isAvailable && !card?.user_id) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          Library card required
        </h1>
        <p className="mt-2 text-center text-muted-foreground">
          Get a free library card or log in with your card to check out this book.
        </p>
        <Link href="/">
          <Button className="mt-6 gap-2">
            Go to Library of Things
          </Button>
        </Link>
      </div>
    )
  }

  if (isAvailable && blockedByContactRequirement) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          Contact info required
        </h1>
        <p className="mt-2 text-center text-muted-foreground max-w-md">
          This book can only be borrowed by people who have added contact info (email, phone, or a social link) to their profile. Add yours in Settings, then return here to check out.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/settings">
            <Button className="gap-2">
              Add contact info in Settings
            </Button>
          </Link>
          <Link href={`/book/${uuid}`}>
            <Button variant="outline" className="gap-2">
              Back to Book
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!isAvailable) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          Book Currently Unavailable
        </h1>
        <p className="mt-2 text-muted-foreground">
          This book is currently checked out by another reader.
        </p>
        {book.expected_return_date && (
          <p className="mt-1 text-sm text-muted-foreground">
            Expected return: {new Date(book.expected_return_date).toLocaleDateString()}
          </p>
        )}
        <Link href={`/book/${uuid}`}>
          <Button className="mt-6 gap-2">
            View Book Details
          </Button>
        </Link>
      </div>
    )
  }

  if (checkoutComplete) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <CheckCircle2 className="h-16 w-16 text-primary" />
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          Checkout Successful!
        </h1>
        <p className="mt-2 text-center text-muted-foreground">
          You've checked out <strong>{book.title}</strong>
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Suggested return: within {book.lending_terms.loan_period_days} days (3 weeks)
        </p>
        <div className="mt-8 flex gap-4">
          <Link href="/my-books">
            <Button>View My Books</Button>
          </Link>
          <Link href="/explore">
            <Button variant="outline">Browse More</Button>
          </Link>
        </div>
      </div>
    )
  }

  const handleCheckout = async () => {
    if (!card?.user_id) {
      alert("You need a library card to check out. Get one from the Account menu.")
      return
    }
    if (!agreedToTerms) return

    setIsProcessing(true)
    try {
      const response = await fetch("/api/books/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: uuid,
          user_id: card.user_id,
        }),
      })
      
      if (response.ok) {
        setCheckoutComplete(true)
      } else {
        alert("Checkout failed. Please try again.")
      }
    } catch (error) {
      console.error("Checkout error:", error)
      alert("An error occurred. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="py-6 sm:py-8">
      <div className="page-container">
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <Link href={`/book/${uuid}`}>
          <Button variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Book
          </Button>
        </Link>

        {/* Checkout Card */}
        <Card className="border-primary/20">
          <CardContent className="p-8">
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">
                Check Out This Book
              </h1>
            </div>

            {/* Book Info */}
            <div className="flex gap-6 mb-8">
              <div className="w-24 flex-shrink-0">
                <div className="aspect-[2/3] overflow-hidden rounded-lg bg-muted shadow-sm">
                  <BookCover src={getBookCoverUrl(book)} title={book.title} />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">{book.title}</h2>
                {book.author && (
                  <p className="mt-1 text-sm text-muted-foreground">{book.author}</p>
                )}
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{book.current_location_text}</span>
                </div>
              </div>
            </div>

            {/* Lending Info */}
            <div className="mb-6 rounded-lg bg-secondary/30 p-4">
              <h3 className="font-semibold text-foreground text-sm mb-3">
                Lending Terms:
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Suggested return: within {book.lending_terms.loan_period_days} days</span>
                </div>
                {book.lending_terms.sale_price && (
                  <div className="text-sm">
                    Available for purchase: ${book.lending_terms.sale_price}
                  </div>
                )}
                {book.lending_terms.requires_id && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>ID verification required</span>
                  </div>
                )}
              </div>
            </div>

            {/* Checkout Form */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">
                  Email {book.lending_terms.pseudonymous_allowed && "(Optional - or remain pseudonymous)"}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={book.lending_terms.requires_id ? "your@email.com (required)" : "your@email.com (optional)"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  required={book.lending_terms.requires_id}
                />
                {book.lending_terms.pseudonymous_allowed && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    A pseudonym will be generated for you on the public ledger
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                  I agree to return this book within the suggested {book.lending_terms.loan_period_days} days
                  and treat it with care. This is a trust-based system.
                </label>
              </div>

              <Button
                size="lg"
                className="w-full gap-2"
                disabled={
                  (!email && book.lending_terms.requires_id) ||
                  !agreedToTerms ||
                  isProcessing ||
                  blockedByContactRequirement
                }
                onClick={handleCheckout}
              >
                {isProcessing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <BookOpen className="h-5 w-5" />
                    Confirm Checkout
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                This checkout will be recorded on the public ledger
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
