"use client"

import { useState, useCallback } from "react"
import { Shield, ChevronDown, Loader2, BookOpen, RotateCcw, PlusCircle } from "lucide-react"
import type { TrustEvent } from "@/lib/types"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/** Human-readable label and icon for each trust reason. */
function getTrustReasonDisplay(reason: TrustEvent["reason"]) {
  switch (reason) {
    case "return_on_time":
      return {
        label: "Returned on time",
        sub: "Within suggested return window",
        icon: RotateCcw,
      }
    case "return_late":
      return {
        label: "Returned late",
        sub: "After suggested date (before 2 months)",
        icon: RotateCcw,
      }
    case "return_very_late":
      return {
        label: "Returned very late",
        sub: "2+ months after checkout",
        icon: RotateCcw,
      }
    case "add_book":
      return {
        label: "Added a book",
        sub: "Contributed to the library",
        icon: PlusCircle,
      }
    default:
      return { label: reason, sub: null, icon: BookOpen }
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

type TrustScoreWithBreakdownProps = {
  userId: string
  trustScore: number
  /** Compact: score + icon only. Default: show "Trust Score" label and /100. */
  variant?: "default" | "compact"
  className?: string
}

/**
 * Displays trust score and, on click/hover, a popover with the event history
 * so users can see where their score came from (returns on time, late, books added).
 */
export function TrustScoreWithBreakdown({
  userId,
  trustScore,
  variant = "default",
  className,
}: TrustScoreWithBreakdownProps) {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<TrustEvent[] | null>(null)
  const [loading, setLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    if (events !== null) return
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${userId}/trust-history`)
      const data = await res.json()
      if (res.ok && Array.isArray(data.events)) setEvents(data.events)
      else setEvents([])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [userId, events])

  const handleOpen = useCallback(() => {
    setOpen(true)
    loadHistory()
  }, [loadHistory])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={handleOpen}
        onFocus={handleOpen}
        className={cn(
          "cursor-pointer outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md inline-flex items-center justify-center",
          className
        )}
      >
        {variant === "compact" ? (
          <span className="flex items-center gap-1.5 font-bold text-foreground">
            <Shield className="h-4 w-4 text-accent" />
            {trustScore}
            <span className="text-muted-foreground font-normal text-sm">/100</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        ) : (
          <div className="flex flex-col items-center">
            <Shield className="h-5 w-5 text-accent" />
            <span className="mt-2 text-2xl font-bold text-foreground">
              {trustScore}
            </span>
            <span className="text-xs text-muted-foreground">
              Trust Score
              <span className="ml-0.5 opacity-70">/100 · click for details</span>
            </span>
          </div>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={variant === "compact" ? "end" : "center"}
        side="bottom"
        className="w-80 max-h-[min(70vh,400px)] overflow-hidden flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-xs font-medium text-muted-foreground mb-2">
          How your trust score is calculated
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Returning on time and adding books raise it; late returns lower it.
        </p>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : events && events.length > 0 ? (
            events.map((ev) => {
              const { label, sub, icon: Icon } = getTrustReasonDisplay(ev.reason)
              const deltaStr = ev.delta >= 0 ? `+${ev.delta}` : `${ev.delta}`
              return (
                <div
                  key={ev.id}
                  className="flex gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-left"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    {ev.book_title && (
                      <p className="text-xs text-muted-foreground truncate" title={ev.book_title}>
                        “{ev.book_title}”
                      </p>
                    )}
                    {sub && !ev.book_title && (
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    )}
                    <p className="text-xs mt-0.5">
                      <span
                        className={
                          ev.delta >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                        }
                      >
                        {deltaStr}
                      </span>
                      {" · "}
                      {formatDate(ev.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              No trust history yet. Return books on time and add books to build your score.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
