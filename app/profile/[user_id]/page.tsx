"use client"

import { use, useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Shield,
  BookOpen,
  Clock,
  MessageSquare,
  Users,
  CreditCard,
  ArrowRight,
  PlusCircle,
  Mail,
  Phone,
  Globe,
  Settings,
} from "lucide-react"
import type { User } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BookCover } from "@/components/book-cover"
import { getBookCoverUrl } from "@/lib/book-cover-generator"
import { LibraryCard } from "@/components/library-card"
import { GetLibraryCardModal } from "@/components/get-library-card-modal"
import { TrustScoreWithBreakdown } from "@/components/trust-score-breakdown"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import { useLibraryCard } from "@/hooks/use-library-card"
import { getAvatarUrl, getInitials } from "@/lib/avatar"

function getTrustBadge(score: number) {
  if (score >= 90) return { label: "Highly Trusted", className: "bg-accent text-accent-foreground" }
  if (score >= 70) return { label: "Trusted", className: "bg-primary/10 text-primary" }
  if (score >= 50) return { label: "Building Trust", className: "bg-secondary text-secondary-foreground" }
  return { label: "New Member", className: "bg-muted text-muted-foreground" }
}

/** Contact method for profile; only includes href when user has opted in and value is set. */
type ContactItem = { label: string; href: string; icon: typeof Mail }

function getContactItems(user: User): ContactItem[] {
  if (!user.contact_opt_in) return []
  const items: ContactItem[] = []
  const contactEmail = (user.contact_email || user.email)?.trim()
  if (contactEmail) {
    items.push({ label: contactEmail, href: `mailto:${contactEmail}`, icon: Mail })
  }
  if (user.phone?.trim()) {
    items.push({ label: user.phone.trim(), href: `tel:${user.phone.trim()}`, icon: Phone })
  }
  if (user.website_url?.trim()) {
    items.push({ label: "Website", href: user.website_url.trim(), icon: Globe })
  }
  if (user.twitter_url?.trim()) {
    items.push({ label: "Twitter / X", href: user.twitter_url.trim(), icon: Globe })
  }
  if (user.linkedin_url?.trim()) {
    items.push({ label: "LinkedIn", href: user.linkedin_url.trim(), icon: Globe })
  }
  return items
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ user_id: string }>
}) {
  const { data, refetch, loading } = useBootstrapData()
  const { card, mounted } = useLibraryCard()
  const [libraryCardModalOpen, setLibraryCardModalOpen] = useState(false)
  const refetchedForOwnProfile = useRef(false)
  const users = data?.users ?? []
  const books = data?.books ?? []
  const loanEvents = data?.loanEvents ?? []
  const { user_id } = use(params)
  const user = users.find((u) => u.id === user_id)
  const isOwnProfileById = card?.user_id === user_id

  // When viewing own profile but user not in bootstrap yet (e.g. just created card), refetch once
  useEffect(() => {
    if (!isOwnProfileById || user) return
    if (refetchedForOwnProfile.current) return
    refetchedForOwnProfile.current = true
    refetch()
  }, [isOwnProfileById, user, refetch])

  if (!user) {
    // Still loading: don't show "User not found" until we've finished loading
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center px-4 py-20">
          <p className="text-muted-foreground">
            {isOwnProfileById ? "Loading your profile…" : "Loading…"}
          </p>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <Users className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          User not found
        </h1>
        <p className="mt-2 text-muted-foreground">
          This profile may not exist or has been removed.
        </p>
        <Link href="/explore">
          <Button className="mt-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Explore
          </Button>
        </Link>
      </div>
    )
  }

  const trustBadge = getTrustBadge(user.trust_score)
  const contactItems = getContactItems(user)

  const currentlyBorrowed = books.filter(
    (b) =>
      b.current_holder_id === user.id &&
      b.availability_status === "checked_out"
  )

  const userEvents = loanEvents.filter((e) => e.user_id === user.id)
  const isOwnProfile = card?.user_id === user_id
  const displayName = isOwnProfile && card ? card.pseudonym : user.display_name

  return (
    <div className="py-6 sm:py-8">
      <div className="page-container">
      <div className="mx-auto max-w-3xl">
        <Link href="/explore">
          <Button variant="ghost" size="sm" className="mb-6 gap-2 text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        {/* Profile Header */}
        <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
          <Avatar className="h-20 w-20">
            <AvatarImage 
              src={getAvatarUrl(user.id)} 
              alt={displayName}
            />
            <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center md:text-left">
            <h1 className="font-serif text-3xl font-bold text-foreground">
              {displayName}
            </h1>
            <div className="mt-2 flex flex-wrap justify-center gap-2 md:justify-start">
              <Badge className={trustBadge.className}>
                <Shield className="mr-1 h-3 w-3" />
                {trustBadge.label}
              </Badge>
              {user.community_memberships.length > 0 && (
                <Badge variant="outline" className="text-foreground">
                  <Users className="mr-1 h-3 w-3" />
                  {user.community_memberships.length}{" "}
                  {user.community_memberships.length === 1 ? "community" : "communities"}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Member since{" "}
              {new Date(user.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
              })}
            </p>
          </div>
          {contactItems.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 text-foreground bg-transparent">
                  <MessageSquare className="h-4 w-4" />
                  Contact
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                {contactItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : contactItems.length === 1 ? (
            <Button variant="outline" className="gap-2 text-foreground bg-transparent" asChild>
              <a href={contactItems[0].href} target="_blank" rel="noopener noreferrer">
                <MessageSquare className="h-4 w-4" />
                Contact
              </a>
            </Button>
          ) : (
            <Button variant="outline" className="gap-2 text-muted-foreground bg-transparent" disabled>
              <MessageSquare className="h-4 w-4" />
              No contact shared
            </Button>
          )}
        </div>

        {/* Quick actions: My Books + Add a Book (when card exists) */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/my-books" className="flex-1">
            <Card className="border-border transition-colors hover:border-primary/40 hover:bg-muted/30 cursor-pointer h-full">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">My Books</p>
                    <p className="text-sm text-muted-foreground">
                      Borrowed books, history & returns
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          {isOwnProfile && mounted && card && (
            <Link href="/steward/add-book" className="flex-1">
              <Card className="border-border transition-colors hover:border-primary/40 hover:bg-muted/30 cursor-pointer h-full">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <PlusCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Add a Book</p>
                      <p className="text-sm text-muted-foreground">
                        Contribute to the Library of Things
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

        {/* Stats Cards */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Card className="border-border">
            <CardContent className="flex flex-col items-center p-4">
              <TrustScoreWithBreakdown
                userId={user.id}
                trustScore={user.trust_score}
              />
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex flex-col items-center p-4">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="mt-2 text-2xl font-bold text-foreground">
                {currentlyBorrowed.length}
              </span>
              <span className="text-xs text-muted-foreground">
                Borrowed Now
              </span>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex flex-col items-center p-4">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="mt-2 text-2xl font-bold text-foreground">
                {userEvents.length}
              </span>
              <span className="text-xs text-muted-foreground">
                Sharing history
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Contact — optional; only when user has opted in and added at least one method */}
        {contactItems.length > 0 && (
          <Card className="mt-8 border-border" id="contact">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <MessageSquare className="h-5 w-5" />
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {contactItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted/50"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Own profile: prompt to add contact for books that require it */}
        {isOwnProfile && (
          <Card className="mt-6 border-border">
            <CardContent className="flex flex-col gap-2 p-4">
              <p className="text-sm text-muted-foreground">
                Some books require borrowers to have contact info (email, phone, or social) on file. Add yours in Settings to borrow those titles.
              </p>
              <Link href="/settings">
                <Button variant="outline" size="sm" className="gap-2 text-foreground bg-transparent">
                  <Settings className="h-4 w-4" />
                  Manage contact info
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Library Card — only on your own profile; never show card details for other members */}
        {isOwnProfile && (
          <Card className="mt-8 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <CreditCard className="h-5 w-5" />
                Your Library Card
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mounted && (
                card ? (
                  <div className="flex flex-col items-center gap-4">
                    <LibraryCard card={card} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLibraryCardModalOpen(true)}
                    >
                      View details
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-4">
                    <p className="text-center text-sm text-muted-foreground">
                      Get a pseudonymous library card to browse and borrow. No email or identity required.
                    </p>
                    <Button onClick={() => setLibraryCardModalOpen(true)}>
                      Get Your Card
                    </Button>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        )}

        <GetLibraryCardModal
          open={libraryCardModalOpen}
          onOpenChange={setLibraryCardModalOpen}
        />

        {/* Currently Borrowed */}
        {currentlyBorrowed.length > 0 && (
          <Card className="mt-8 border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Currently Borrowed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {currentlyBorrowed.map((book) => (
                  <Link
                    key={book.id}
                    href={`/book/${book.id}`}
                    className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
                  >
                    <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
                      <BookCover src={getBookCoverUrl(book)} title={book.title} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {book.title}
                      </p>
                      {book.author && (
                        <p className="text-xs text-muted-foreground">
                          {book.author}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <Card className="mt-6 border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {userEvents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No activity yet.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {userEvents
                  .sort(
                    (a, b) =>
                      new Date(b.timestamp).getTime() -
                      new Date(a.timestamp).getTime()
                  )
                  .slice(0, 10)
                  .map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          event.event_type === "checkout"
                            ? "bg-primary/10 text-primary"
                            : event.event_type === "return"
                              ? "bg-accent/10 text-accent"
                              : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {event.event_type.replace("_", " ")}
                      </span>
                      <Link
                        href={`/book/${event.book_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {event.book_title}
                      </Link>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
