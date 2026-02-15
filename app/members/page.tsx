"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, Users, BookOpen, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import type { User, LoanEvent } from "@/lib/types"

function getInitials(displayName: string): string {
  return displayName
    .split(/(?=[A-Z0-9])/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
}

export default function MembersPage() {
  const { data } = useBootstrapData()
  const users = data?.users ?? []
  const books = data?.books ?? []
  const loanEvents = data?.loanEvents ?? []

  /** Per-user: current books out and event count. */
  const memberStats = useMemo(() => {
    const stats = new Map<
      string,
      { user: User; currentCount: number; eventCount: number; recentEvents: LoanEvent[] }
    >()
    for (const u of users) {
      const currentCount = books.filter(
        (b) => b.current_holder_id === u.id && b.availability_status === "checked_out"
      ).length
      const userEvents = loanEvents.filter((e) => e.user_id === u.id)
      const recentEvents = [...userEvents]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5)
      stats.set(u.id, {
        user: u,
        currentCount,
        eventCount: userEvents.length,
        recentEvents,
      })
    }
    return stats
  }, [users, books, loanEvents])

  const sortedMembers = useMemo(() => {
    return [...memberStats.entries()]
      .map(([_, v]) => v)
      .sort((a, b) => b.eventCount - a.eventCount)
  }, [memberStats])

  return (
    <div className="py-6 sm:py-8">
      <div className="page-container max-w-5xl">
        <Link href="/ledger" className="inline-block">
          <Button variant="ghost" size="sm" className="mb-6 gap-2 text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Ledger
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
            Members
          </h1>
          <p className="mt-2 text-muted-foreground">
            Everyone in the Library of Things network — see who has books out and their activity.
          </p>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Users className="h-5 w-5" />
              All members ({sortedMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-center">Books out</TableHead>
                    <TableHead className="text-center">Total events</TableHead>
                    <TableHead>Recent activity</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMembers.map(({ user, currentCount, eventCount, recentEvents }) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Link
                          href={`/profile/${user.id}`}
                          className="flex items-center gap-3 hover:opacity-90"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                              {getInitials(user.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">
                            {user.display_name}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          {currentCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {eventCount}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {recentEvents.length === 0 ? (
                          <span className="text-sm text-muted-foreground">No activity yet</span>
                        ) : (
                          <ul className="space-y-0.5 text-sm text-muted-foreground">
                            {recentEvents.slice(0, 3).map((e) => (
                              <li key={e.id} className="truncate">
                                <Link
                                  href={`/book/${e.book_id}`}
                                  className="text-primary hover:underline"
                                >
                                  {e.book_title}
                                </Link>
                                <span className="ml-1 capitalize">
                                  — {e.event_type.replace("_", " ")}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="gap-1" asChild>
                          <Link href={`/profile/${user.id}`}>
                            Profile
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Member list is derived from the public ledger. Click a member to see their full profile
          and contact options (if they’ve shared any).
        </p>
      </div>
    </div>
  )
}
