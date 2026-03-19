"use client"

import Link from "next/link"
import { ArrowRight, BookOpen, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLibraryCard } from "@/hooks/use-library-card"

/**
 * Hero CTAs on the home page. Library card lives in localStorage, so this must be
 * a client component: we only show “Get library card” when the device has no card yet.
 */
export function HomeHeroActions() {
  const { card, mounted } = useLibraryCard()
  const showGetCard = mounted && !card

  return (
    <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
      <Link href="/explore">
        <Button size="default" className="gap-2 min-h-11 min-w-[44px] sm:min-w-0">
          Find a book
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
      {showGetCard && (
        <Link href="/settings?mode=generate">
          <Button
            variant="secondary"
            size="default"
            className="gap-2 min-h-11 min-w-[44px] sm:min-w-0"
          >
            <CreditCard className="h-4 w-4" />
            Get library card
          </Button>
        </Link>
      )}
      <Link href="/add-book">
        <Button variant="outline" size="default" className="gap-2 min-h-11 min-w-[44px] sm:min-w-0">
          <BookOpen className="h-4 w-4" />
          Add a book
        </Button>
      </Link>
    </div>
  )
}
