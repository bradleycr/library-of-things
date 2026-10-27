"use client"

/**
 * Steward “Hunt down” — books and guest keycards that have been out a long time.
 * Sorted longest-out first so follow-ups are obvious.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { Crosshair, Mail, RotateCcw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildLoanStartedAtByBookId,
  daysOut,
  formatCheckoutDateTime,
  formatOutFor,
  isPastExpectedReturn,
} from "@/lib/steward-loan-age"
import type { Book, LoanEvent, User } from "@/lib/types"

type HuntFilter = "all" | "overdue" | "30" | "60"

type HuntRow = {
  item: Book
  kind: "book" | "keycard"
  checkedOutAt: Date | null
  holderLabel: string
  email: string | null
  overdue: boolean
  days: number
}

function holderOutreachEmail(user: User | undefined | null): string | null {
  const raw = user?.contact_email?.trim() || user?.email?.trim()
  return raw || null
}

function looksLikeEmail(value: string): boolean {
  return value.includes("@")
}

interface HuntDownPanelProps {
  books: Book[]
  loanEvents: LoanEvent[]
  users: User[]
  onKeycardReturned?: () => Promise<unknown> | unknown
}

export function HuntDownPanel({
  books,
  loanEvents,
  users,
  onKeycardReturned,
}: HuntDownPanelProps) {
  const [filter, setFilter] = useState<HuntFilter>("all")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const rows = useMemo(() => {
    const started = buildLoanStartedAtByBookId(loanEvents)
    const now = new Date()
    const out: HuntRow[] = []

    for (const item of books) {
      if (item.availability_status !== "checked_out") continue
      const kind = item.item_type === "keycard" ? "keycard" : "book"
      if (kind === "book" && (item.item_type ?? "book") !== "book") continue

      const checkedOutAt = started.get(item.id) ?? null
      const holderUser = item.current_holder_id
        ? users.find((u) => u.id === item.current_holder_id)
        : null
      const holderLabel =
        holderUser?.display_name ||
        item.current_holder_name ||
        (kind === "keycard" ? "Guest" : "Unknown")
      const emailFromUser = holderOutreachEmail(holderUser)
      const emailFromName =
        !emailFromUser && item.current_holder_name && looksLikeEmail(item.current_holder_name)
          ? item.current_holder_name.trim()
          : null

      out.push({
        item,
        kind,
        checkedOutAt,
        holderLabel,
        email: emailFromUser || emailFromName,
        overdue: isPastExpectedReturn(item.expected_return_date, now),
        days: checkedOutAt ? daysOut(checkedOutAt, now) : 0,
      })
    }

    return out.sort((a, b) => {
      if (!a.checkedOutAt && !b.checkedOutAt) return 0
      if (!a.checkedOutAt) return 1
      if (!b.checkedOutAt) return -1
      return a.checkedOutAt.getTime() - b.checkedOutAt.getTime()
    })
  }, [books, loanEvents, users])

  const visible = useMemo(() => {
    if (filter === "overdue") return rows.filter((r) => r.overdue)
    if (filter === "30") return rows.filter((r) => r.days >= 30 || (!r.checkedOutAt && r.overdue))
    if (filter === "60") return rows.filter((r) => r.days >= 60 || (!r.checkedOutAt && r.overdue))
    return rows
  }, [rows, filter])

  const huntEmails = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const row of visible) {
      if (!row.email) continue
      const key = row.email.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      list.push(row.email)
    }
    return list
  }, [visible])

  const stewardReturn = async (item: Book) => {
    setBusyId(item.id)
    setError(null)
    try {
      const response = await fetch(`/api/steward/items/${item.id}/return`, { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not return keycard")
      await onKeycardReturned?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not return keycard")
    } finally {
      setBusyId(null)
    }
  }

  const copyEmails = async () => {
    if (huntEmails.length === 0) return
    await navigator.clipboard.writeText(huntEmails.join(", "))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const filterBtn = (id: HuntFilter, label: string) => (
    <Button
      key={id}
      type="button"
      size="sm"
      variant={filter === id ? "default" : "outline"}
      onClick={() => setFilter(id)}
    >
      {label}
    </Button>
  )

  return (
    <Card className="mb-8 border-border border-amber-500/30">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Crosshair className="h-5 w-5 text-amber-600" />
            Hunt down ({visible.length}
            {filter !== "all" ? ` of ${rows.length}` : ""})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Books and guest cards still out — longest first. Use this to chase returns.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={huntEmails.length === 0}
            onClick={() => void copyEmails()}
          >
            <Mail className="h-4 w-4" />
            {copied ? "Copied" : "Copy emails"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {filterBtn("all", "All out")}
          {filterBtn("overdue", "Overdue")}
          {filterBtn("30", "30+ days")}
          {filterBtn("60", "60+ days")}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? "Nothing is checked out right now."
              : "Nothing matches this filter."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>What</TableHead>
                  <TableHead>Holder</TableHead>
                  <TableHead>Out for</TableHead>
                  <TableHead className="hidden sm:table-cell">Since</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => {
                  const title =
                    row.kind === "keycard" && row.item.asset_number != null
                      ? `Keycard #${row.item.asset_number}`
                      : row.item.title
                  const longOut = row.days >= 60
                  return (
                    <TableRow key={row.item.id}>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {row.kind === "keycard" ? "Card" : "Book"}
                            </Badge>
                            {row.overdue && (
                              <Badge variant="destructive" className="text-xs">
                                Overdue
                              </Badge>
                            )}
                            {!row.overdue && longOut && (
                              <Badge className="bg-amber-500/15 text-amber-800 text-xs hover:bg-amber-500/15">
                                Long out
                              </Badge>
                            )}
                          </div>
                          {row.kind === "book" ? (
                            <Link
                              href={`/book/${row.item.id}`}
                              className="font-medium text-foreground hover:underline"
                            >
                              {title}
                            </Link>
                          ) : (
                            <span className="font-medium text-foreground">{title}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {row.item.current_holder_id ? (
                          <Link
                            href={`/profile/${row.item.current_holder_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.holderLabel}
                          </Link>
                        ) : (
                          <span className="text-foreground">{row.holderLabel}</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top whitespace-nowrap">
                        {row.checkedOutAt ? (
                          <span
                            className={
                              row.overdue || longOut
                                ? "font-semibold text-destructive"
                                : "font-medium text-foreground"
                            }
                          >
                            {formatOutFor(row.checkedOutAt)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {row.checkedOutAt ? formatCheckoutDateTime(row.checkedOutAt) : "—"}
                      </TableCell>
                      <TableCell className="align-top hidden md:table-cell">
                        {row.email ? (
                          <a
                            href={`mailto:${row.email}?subject=${encodeURIComponent(
                              `Library return: ${title}`,
                            )}`}
                            className="text-sm text-primary hover:underline break-all"
                          >
                            {row.email}
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">None</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {row.kind === "keycard" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyId === row.item.id}
                            onClick={() => void stewardReturn(row.item)}
                          >
                            {busyId === row.item.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="mr-2 h-4 w-4" />
                            )}
                            Return
                          </Button>
                        ) : row.email ? (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <a
                              href={`mailto:${row.email}?subject=${encodeURIComponent(
                                `Library return: ${title}`,
                              )}`}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              Email
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
