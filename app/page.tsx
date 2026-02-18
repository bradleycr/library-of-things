import Link from "next/link"
import { BookOpen, ArrowRight, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BookCard } from "@/components/book-card"
import type { Book, LoanEvent, Node } from "@/lib/types"
import { listBooks, listLoanEvents, listNodes } from "@/lib/server/repositories"

/**
 * ISR: rebuild at most once per 60 seconds.
 * With 1 100 users the homepage is served from CDN cache most of the time;
 * the DB is only queried ~once per minute instead of once per visitor.
 */
export const revalidate = 60

/** Safely load homepage data; returns sensible defaults when the DB is cold. */
async function loadHomeData() {
  try {
    const [books, loanEvents, nodes] = await Promise.all([
      listBooks(),
      listLoanEvents(),
      listNodes(),
    ]) as [Book[], LoanEvent[], Node[]]
    return { books, loanEvents, nodes, ok: true as const }
  } catch (err) {
    console.error("[home] SSR data fetch failed, rendering with empty state:", (err as Error).message)
    return {
      books: [] as Book[],
      loanEvents: [] as LoanEvent[],
      nodes: [] as Node[],
      ok: false as const,
    }
  }
}

export default async function HomePage() {
  const { books, loanEvents, nodes, ok } = await loadHomeData()
  const availableBooks = books.filter((b) => b.availability_status === "available")
  const featuredBooks = availableBooks.slice(0, 4)
  const totalBooks = books.length
  const totalLoans = loanEvents.length
  const totalNodes = nodes.length

  // Actual count of books linked to each node (for display on node cards).
  const booksPerNodeId = books.reduce<Record<string, number>>((acc, book) => {
    if (book.current_node_id) {
      acc[book.current_node_id] = (acc[book.current_node_id] ?? 0) + 1
    }
    return acc
  }, {})

  return (
    <div className="bg-background">
      {/* Hero — simple, internal-facing */}
      <section className="border-b border-border/60 py-12 sm:py-16 md:py-20 lg:py-24">
        <div className="page-container">
          <div className="max-w-3xl">
            <h1 className="font-serif text-3xl font-semibold text-foreground sm:text-4xl md:text-[2.5rem]">
            Decentralized. Sharing.
          </h1>
            <p className="mt-4 text-muted-foreground sm:text-lg">
            Tag books with NFC/QR codes, check them out, return when you're done.
            Trust-based and pseudonymous — no late fees, just the sharing history.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
            <Link href="/explore">
              <Button size="default" className="gap-2 min-h-11 min-w-[44px] sm:min-w-0">
                Find a book
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/add-book">
              <Button variant="outline" size="default" className="gap-2 min-h-11 min-w-[44px] sm:min-w-0">
                <BookOpen className="h-4 w-4" />
                Add a book
              </Button>
            </Link>
          </div>

          {/* Stats — only show when data loaded successfully */}
          {ok && (
            <div className="mt-8 flex flex-wrap gap-4 gap-y-1 text-sm text-muted-foreground sm:mt-10 sm:gap-6">
              <span>{totalBooks} in catalog</span>
              <span>{totalLoans} sharing events</span>
              <span>{totalNodes} library nodes</span>
            </div>
          )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 md:py-16">
        <div className="page-container">
          <div className="max-w-3xl">
          <h2 className="text-lg font-semibold text-foreground">
            How it works
          </h2>
          <p className="mt-2 text-muted-foreground">
            Physical books with QR/NFC tags. Tap to check out, return when
            you're ready. Fully trust-based — we keep a public ledger so anyone
            can see what's where. Pseudonymous by default.
          </p>
          </div>
        </div>
      </section>

      {/* Books */}
      <section className="border-t border-border/60 py-12 md:py-16">
        <div className="page-container">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Available now
            </h2>
            <Link
              href="/explore"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View all →
            </Link>
          </div>

          {featuredBooks.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {featuredBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              {ok
                ? "No books available right now — check back soon!"
                : "Loading catalog…"}
            </p>
          )}
        </div>
      </section>

      {/* Nodes */}
      {nodes.length > 0 && (
        <section className="border-t border-border/60 py-12 md:py-16">
          <div className="page-container">
            <h2 className="text-lg font-semibold text-foreground">Library nodes</h2>
            <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-2">
              {nodes.map((node) => (
                <Card key={node.id} className="border-border bg-card">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium text-card-foreground">
                          {node.name}
                        </h3>
                        <span className="mt-0.5 inline-block text-xs capitalize text-muted-foreground">
                          {node.type.replace("_", " ")}
                        </span>
                      </div>
                      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                    {node.location_address && (
                      <a
                        href={
                          node.location_lat != null && node.location_lng != null
                            ? `https://www.google.com/maps/search/?api=1&query=${node.location_lat},${node.location_lng}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(node.location_address)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block truncate text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      >
                        {node.location_address}
                      </a>
                    )}
                    {node.operating_hours && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {node.operating_hours}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {booksPerNodeId[node.id] ?? 0} books at this node
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom — links only */}
      <section className="border-t border-border/60 py-10 sm:py-12">
        <div className="page-container flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
          <Link
            href="/add-book"
            className="text-muted-foreground hover:text-foreground"
          >
            Add a book
          </Link>
          <Link
            href="/ledger"
            className="text-muted-foreground hover:text-foreground"
          >
            View ledger
          </Link>
        </div>
      </section>
    </div>
  )
}
