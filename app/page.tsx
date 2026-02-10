import Link from "next/link"
import {
  BookOpen,
  Shield,
  Eye,
  Users,
  ArrowRight,
  MapPin,
  Fingerprint,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BookCard } from "@/components/book-card"
import { mockBooks, mockLoanEvents, mockNodes } from "@/lib/mock-data"

const features = [
  {
    icon: Shield,
    title: "Trust-Based",
    description:
      "No penalties, no late fees. Built on community trust and gentle reminders.",
  },
  {
    icon: Fingerprint,
    title: "Pseudonymous",
    description:
      "Your identity stays private. Participate with auto-generated pseudonyms.",
  },
  {
    icon: Eye,
    title: "Transparent",
    description:
      "Every loan is recorded in a public, append-only ledger anyone can audit.",
  },
  {
    icon: Users,
    title: "Community-Driven",
    description:
      "Books flow between homes, cafes, coworking spaces, and little free libraries.",
  },
]

export default function HomePage() {
  const availableBooks = mockBooks.filter(
    (b) => b.availability_status === "available"
  )
  const featuredBooks = availableBooks.slice(0, 4)
  const totalBooks = mockBooks.length
  const totalLoans = mockLoanEvents.length
  const totalNodes = mockNodes.length

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-foreground px-4 py-20 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="relative z-10 max-w-2xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
              Decentralized Book Lending
            </p>
            <h1 className="font-serif text-4xl font-bold leading-tight text-background md:text-6xl">
              <span className="text-balance">
                Discover, Borrow, Share Physical Books
              </span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-background/60 md:text-xl">
              Tap a QR code on any tagged book to check it out. A transparent,
              trust-based system connecting readers across communities.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/explore">
                <Button size="lg" className="gap-2">
                  Browse Books
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/steward/add-book">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 border-background/20 text-background hover:bg-background/10 hover:text-background bg-transparent"
                >
                  <BookOpen className="h-4 w-4" />
                  Add Your Book
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="h-full w-full bg-[radial-gradient(circle_at_70%_50%,hsl(var(--primary)),transparent_70%)]" />
        </div>
      </section>

      {/* Stats */}
      <section className="-mt-8 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Books Shared", value: totalBooks },
              { label: "Loan Events", value: totalLoans },
              { label: "Active Nodes", value: totalNodes },
            ].map((stat) => (
              <Card key={stat.label} className="border-border bg-card shadow-sm">
                <CardContent className="flex flex-col items-center p-6">
                  <span className="text-3xl font-bold text-primary md:text-4xl">
                    {stat.value}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground md:text-sm">
                    {stat.label}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center font-serif text-3xl font-bold text-foreground">
            <span className="text-balance">How Flybrary Works</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Physical books with QR/NFC tags. Tap to check out. Return when
            ready. Everything is tracked transparently.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="border-border bg-card transition-shadow hover:shadow-md"
              >
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-4 font-semibold text-card-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Books */}
      <section className="bg-muted/50 px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-serif text-3xl font-bold text-foreground">
                Available Now
              </h2>
              <p className="mt-2 text-muted-foreground">
                Ready to be picked up at a node near you
              </p>
            </div>
            <Link href="/explore">
              <Button variant="ghost" className="hidden gap-2 text-foreground md:flex">
                View all
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {featuredBooks.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
          <div className="mt-6 flex justify-center md:hidden">
            <Link href="/explore">
              <Button variant="ghost" className="gap-2 text-foreground">
                View all books
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Nodes */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center font-serif text-3xl font-bold text-foreground">
            <span className="text-balance">Community Nodes</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Physical locations where books live and travel between
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {mockNodes.map((node) => (
              <Card key={node.id} className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-card-foreground">
                        {node.name}
                      </h3>
                      <span className="mt-1 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs capitalize text-secondary-foreground">
                        {node.type.replace("_", " ")}
                      </span>
                    </div>
                    <MapPin className="h-5 w-5 shrink-0 text-primary" />
                  </div>
                  {node.location_address && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {node.location_address}
                    </p>
                  )}
                  {node.operating_hours && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {node.operating_hours}
                    </p>
                  )}
                  {node.capacity && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Capacity: {node.capacity} books
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-3xl font-bold text-primary-foreground">
            <span className="text-balance">
              Have books collecting dust? Share them.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-primary-foreground/80">
            Add your books to the network. Set your own lending terms. Watch
            them travel through the community.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/steward/add-book">
              <Button size="lg" variant="secondary" className="gap-2">
                Add a Book
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/ledger">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground bg-transparent"
              >
                <Eye className="h-4 w-4" />
                View the Ledger
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
