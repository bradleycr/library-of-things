import Link from "next/link"
import { Github } from "lucide-react"

const GITHUB_REPO_URL = "https://github.com/bradleycr/library-of-things"

const links = [
  { href: "/explore", label: "Explore" },
  { href: "/ledger", label: "Sharing history" },
  { href: "/add-book", label: "Add a book" },
  { href: "/members", label: "Members" },
  { href: "/my-books", label: "My books" },
]

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border/50 bg-muted/30">
      {/* Subtle top gradient — adds interest without noise */}
      <div
        className="absolute inset-x-0 top-0 h-px opacity-50"
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3), transparent)",
        }}
      />

      <div className="page-container py-10 sm:py-12">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:flex-wrap sm:justify-between sm:gap-6">
          <Link
            href="/"
            className="font-lot text-lg font-normal text-foreground transition-opacity hover:opacity-80"
          >
            Library of Things
          </Link>

          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Single line: trust-based + attribution */}
        <div className="mt-8 flex flex-col items-center gap-4 border-t border-border/40 pt-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Trust-based. Pseudonymous.
            </p>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
              aria-label="GitHub repository"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://foresight.org"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-60 transition-opacity hover:opacity-100"
              aria-label="Foresight Institute"
            >
              <img
                src="/foresight-logo.png"
                alt=""
                className="h-5 w-auto"
              />
            </a>
            <a
              href="https://archive.org"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-60 transition-opacity hover:opacity-100"
              aria-label="Internet Archive"
            >
              <img
                src="/internet-archive-logo-sf.png"
                alt=""
                className="h-6 w-auto"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
