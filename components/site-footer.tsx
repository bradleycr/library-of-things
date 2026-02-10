import Link from "next/link"
import { BookOpen } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/50">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold text-foreground">Flybrary</span>
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A decentralized, trust-based physical book lending system.
              Discover, borrow, and share books across communities.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">Discover</h3>
            <Link href="/explore" className="text-sm text-muted-foreground hover:text-foreground">
              Browse Books
            </Link>
            <Link href="/ledger" className="text-sm text-muted-foreground hover:text-foreground">
              Public Ledger
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">Contribute</h3>
            <Link href="/steward/add-book" className="text-sm text-muted-foreground hover:text-foreground">
              Add a Book
            </Link>
            <Link href="/steward/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              Steward Dashboard
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">Account</h3>
            <Link href="/my-books" className="text-sm text-muted-foreground hover:text-foreground">
              My Books
            </Link>
            <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
              Settings
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 md:flex-row">
          <p className="text-xs text-muted-foreground">
            Built with trust, transparency, and community in mind.
          </p>
          <p className="text-xs text-muted-foreground">
            Pseudonymous by default. Your data, your choice.
          </p>
        </div>
      </div>
    </footer>
  )
}
