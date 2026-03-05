"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Download, Filter, X, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatLocationForDisplay } from "@/lib/format-location"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"

const eventTypeStyles: Record<string, string> = {
  added: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  checkout: "bg-primary/10 text-primary",
  return: "bg-accent/10 text-accent",
  transfer: "bg-secondary text-secondary-foreground",
  report_lost: "bg-destructive/10 text-destructive",
  report_damaged: "bg-destructive/10 text-destructive",
  removed: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
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

export default function LedgerPage() {
  const { data, loading } = useBootstrapData()
  const loanEvents = data?.loanEvents ?? []
  const [eventFilter, setEventFilter] = useState("all")
  const [showFilters, setShowFilters] = useState(false)

  const sortedEvents = useMemo(() => {
    const filtered =
      eventFilter === "all"
        ? loanEvents
        : loanEvents.filter((e) => e.event_type === eventFilter)
    return [...filtered].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }, [eventFilter, loanEvents])

  const exportData = (format: "csv" | "json") => {
    const data = sortedEvents.map((e) => ({
      timestamp: e.timestamp,
      event_type: e.event_type,
      book: e.book_title,
      user: e.user_display_name,
      location: e.location_text,
      notes: e.notes || "",
    }))

    let content: string
    let mimeType: string
    let filename: string

    if (format === "json") {
      content = JSON.stringify(data, null, 2)
      mimeType = "application/json"
      filename = "library-of-things-ledger.json"
    } else {
      const headers = Object.keys(data[0] || {}).join(",")
      const rows = data.map((row) =>
        Object.values(row)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
      content = [headers, ...rows].join("\n")
      mimeType = "text/csv"
      filename = "library-of-things-ledger.csv"
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = {
    total: loanEvents.length,
    checkouts: loanEvents.filter((e) => e.event_type === "checkout").length,
    returns: loanEvents.filter((e) => e.event_type === "return").length,
  }

  return (
    <div className="py-6 sm:py-8">
      <div className="page-container">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
              Sharing history
            </h1>
            <p className="mt-2 text-muted-foreground">
              A transparent, append-only sharing history—when books are
              added, checked out, returned, or transferred. Total events, checkouts,
              and returns help you see if books are circulating or may have gone
              missing (trust-based).
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-foreground bg-transparent"
              asChild
            >
              <Link href="/members">
                <Users className="h-4 w-4" />
                Members
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-foreground bg-transparent"
              onClick={() => exportData("csv")}
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-foreground bg-transparent"
              onClick={() => exportData("json")}
            >
              <Download className="h-4 w-4" />
              JSON
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          {[
            { label: "Total Events", value: stats.total },
            { label: "Checkouts", value: stats.checkouts },
            { label: "Returns", value: stats.returns },
          ].map((stat) => (
            <Card key={stat.label} className="border-border">
              <CardContent className="flex flex-col items-center p-4">
                {loading ? (
                  <Skeleton className="h-8 w-12 rounded" aria-hidden />
                ) : (
                  <span className="text-2xl font-bold text-primary">
                    {stat.value}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {stat.label}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-foreground bg-transparent"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          {eventFilter !== "all" && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1 capitalize"
              onClick={() => setEventFilter("all")}
            >
              {eventFilter.replace("_", " ")}
              <X className="h-3 w-3" />
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${sortedEvents.length} event${sortedEvents.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {showFilters && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Event Type
                </label>
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All events</SelectItem>
                    <SelectItem value="added">Added</SelectItem>
                    <SelectItem value="checkout">Checkouts</SelectItem>
                    <SelectItem value="return">Returns</SelectItem>
                    <SelectItem value="transfer">Transfers</SelectItem>
                    <SelectItem value="report_lost">Lost Reports</SelectItem>
                    <SelectItem value="report_damaged">
                      Damage Reports
                    </SelectItem>
                    <SelectItem value="removed">Removed from library</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Book</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    /* Skeleton rows so we don't show "0 events" or empty table while bootstrap loads */
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    sortedEvents.map((event) => (
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
                        {event.book_id ? (
                          <Link
                            href={`/book/${event.book_id}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {event.book_title}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-muted-foreground">
                            {event.book_title || "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {event.user_id ? (
                          <Link
                            href={`/profile/${event.user_id}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {event.user_display_name || "Unknown"}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-muted-foreground">
                            {event.user_display_name || "Unknown"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {event.location_text
                          ? formatLocationForDisplay(event.location_text)
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {event.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          This sharing history is append-only. Events cannot be modified or deleted.
          Future versions will anchor hashes to IPFS for permanent
          verifiability.
        </p>
      </div>
    </div>
  )
}
