"use client"

import { use } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Shield,
  BookOpen,
  Clock,
  MessageSquare,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { BookCover } from "@/components/book-cover"
import { mockUsers, mockBooks, mockLoanEvents } from "@/lib/mock-data"

function getTrustBadge(score: number) {
  if (score >= 90) return { label: "Highly Trusted", className: "bg-accent text-accent-foreground" }
  if (score >= 70) return { label: "Trusted", className: "bg-primary/10 text-primary" }
  if (score >= 50) return { label: "Building Trust", className: "bg-secondary text-secondary-foreground" }
  return { label: "New Member", className: "bg-muted text-muted-foreground" }
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ user_id: string }>
}) {
  const { user_id } = use(params)
  const user = mockUsers.find((u) => u.id === user_id)

  if (!user) {
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

  const currentlyBorrowed = mockBooks.filter(
    (b) =>
      b.current_holder_id === user.id &&
      b.availability_status === "checked_out"
  )

  const userEvents = mockLoanEvents.filter((e) => e.user_id === user.id)
  const initials = user.display_name
    .split(/(?=[A-Z0-9])/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase()

  return (
    <div className="px-4 py-8">
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
            <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center md:text-left">
            <h1 className="font-serif text-3xl font-bold text-foreground">
              {user.display_name}
            </h1>
            <div className="mt-2 flex flex-wrap justify-center gap-2 md:justify-start">
              <Badge className={trustBadge.className}>
                <Shield className="mr-1 h-3 w-3" />
                {trustBadge.label}
              </Badge>
              {user.community_memberships.length > 0 && (
                <Badge variant="outline" className="text-foreground">
                  <Users className="mr-1 h-3 w-3" />
                  {user.community_memberships.length} communit
                  {user.community_memberships.length !== 1 ? "ies" : "y"}
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
          <Button variant="outline" className="gap-2 text-foreground bg-transparent">
            <MessageSquare className="h-4 w-4" />
            Contact
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <Card className="border-border">
            <CardContent className="flex flex-col items-center p-4">
              <Shield className="h-5 w-5 text-accent" />
              <span className="mt-2 text-2xl font-bold text-foreground">
                {user.trust_score}
              </span>
              <span className="text-xs text-muted-foreground">
                Trust Score
              </span>
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
                Loan Events
              </span>
            </CardContent>
          </Card>
        </div>

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
                      <BookCover src={book.cover_image_url} title={book.title} />
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
  )
}
