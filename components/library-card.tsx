"use client"

import type { LibraryCard as LibraryCardType } from "@/lib/types"
import { cn } from "@/lib/utils"

interface LibraryCardProps {
  card: LibraryCardType
  className?: string
}

/**
 * The library card as an object, not a form.
 *
 * Design intent — it should feel like a small printed thing you'd keep in a
 * wallet, not a billing dashboard widget. A warm pastel gradient (Foresight
 * sage → sky), generous whitespace, a quiet serif wordmark, and a card number
 * set in mono with wide letter-spacing so it reads as a number-as-artifact.
 * Partner logos live in the bottom-right at low opacity: attribution present,
 * never the focal point.
 */
export function LibraryCard({ card, className }: LibraryCardProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl",
        "w-full max-w-[340px] aspect-[1.586/1]",
        "bg-[radial-gradient(120%_120%_at_0%_0%,hsl(60_40%_98%),hsl(165_38%_92%)_55%,hsl(200_45%_92%))]",
        "shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.18)]",
        "ring-1 ring-inset ring-foreground/5",
        "transition-shadow duration-200 hover:shadow-[0_2px_4px_rgba(15,23,42,0.08),0_14px_32px_-12px_rgba(15,23,42,0.22)]",
        className,
      )}
    >
      <span className="absolute left-5 top-5 font-lot text-sm font-normal tracking-tight text-foreground/75">
        Library of Things
      </span>

      <div
        className="absolute inset-x-5 top-1/2 -translate-y-1/2 font-mono text-[1.05rem] tracking-[0.32em] text-foreground/90 tabular-nums sm:text-[1.15rem]"
        aria-label={`Card number ${card.card_number}`}
      >
        {card.card_number}
      </div>

      <div className="absolute bottom-4 left-5">
        <span className="block text-[10px] uppercase tracking-[0.22em] text-foreground/45">
          Cardholder
        </span>
        <span className="mt-0.5 block text-sm font-medium text-foreground/85">
          {card.pseudonym}
        </span>
      </div>

      <div className="absolute bottom-4 right-5 flex items-center gap-2 opacity-60">
        <img
          src="/foresight-logo.png"
          alt="Foresight Institute"
          className="h-4 w-auto"
        />
        <img
          src="/internet-archive-logo-sf.png"
          alt="Internet Archive"
          className="h-3.5 w-auto"
        />
      </div>
    </div>
  )
}
