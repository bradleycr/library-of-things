"use client"

import type { LibraryCard as LibraryCardType } from "@/lib/types"
import { cn } from "@/lib/utils"

interface LibraryCardProps {
  card: LibraryCardType
  className?: string
}

export function LibraryCard({ card, className }: LibraryCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-white shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
        "w-full max-w-[340px] aspect-[1.586/1]",
        className
      )}
    >
      {/* Logos – top left */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <img
          src="/foresight-logo.svg"
          alt="Foresight Institute"
          className="h-6 w-auto opacity-90"
        />
        <img
          src="/internet-archive-logo-sf.png"
          alt="Internet Archive"
          className="h-5 w-auto opacity-90"
        />
      </div>

      {/* Brand – top right */}
      <div className="absolute right-4 top-4 text-right">
        <span className="font-lot text-[11px] font-normal tracking-wide text-muted-foreground">
          Library of Things
        </span>
        <span className="block text-[9px] font-medium uppercase tracking-widest text-muted-foreground/80">
          Library Card
        </span>
      </div>

      {/* Card number */}
      <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 font-mono text-lg tracking-[0.25em] text-foreground tabular-nums">
        {card.card_number}
      </div>

      {/* Cardholder */}
      <div className="absolute bottom-4 left-4">
        <span className="block text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
          Cardholder
        </span>
        <span className="text-sm font-semibold text-foreground">
          {card.pseudonym}
        </span>
      </div>
    </div>
  )
}
