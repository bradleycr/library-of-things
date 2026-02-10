"use client"

import Link from "next/link"
import { useState } from "react"
import {
  BookOpen,
  Menu,
  X,
  Search,
  User,
  Settings,
  LayoutDashboard,
  ScrollText,
  PlusCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const navLinks = [
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/ledger", label: "Ledger", icon: ScrollText },
  { href: "/my-books", label: "My Books", icon: BookOpen },
]

const moreLinks = [
  { href: "/steward/add-book", label: "Add a Book", icon: PlusCircle },
  { href: "/steward/dashboard", label: "Steward Dashboard", icon: LayoutDashboard },
  { href: "/profile/u1", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight text-foreground">
            Flybrary
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button variant="ghost" size="sm" className="gap-2 text-foreground">
                <link.icon className="h-4 w-4" />
                {link.label}
              </Button>
            </Link>
          ))}
          {moreLinks.slice(0, 2).map((link) => (
            <Link key={link.href} href={link.href}>
              <Button variant="ghost" size="sm" className="gap-2 text-foreground">
                <link.icon className="h-4 w-4" />
                {link.label}
              </Button>
            </Link>
          ))}
          <Link href="/profile/u1">
            <Button variant="ghost" size="icon" className="text-foreground">
              <User className="h-5 w-5" />
              <span className="sr-only">Profile</span>
            </Button>
          </Link>
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className="text-foreground md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {mobileOpen && (
        <nav className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {[...navLinks, ...moreLinks].map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground">
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Button>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
