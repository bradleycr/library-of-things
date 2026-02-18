"use client"

import Link from "next/link"
import { useState } from "react"
import {
  Menu,
  X,
  Search,
  User,
  Settings,
  LayoutDashboard,
  ScrollText,
  PlusCircle,
  CreditCard,
  ChevronDown,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GetLibraryCardModal, type GetLibraryCardModalMode } from "@/components/get-library-card-modal"
import { LoginLibraryCardModal } from "@/components/login-library-card-modal"
import { useLibraryCard } from "@/hooks/use-library-card"

/** Main nav: Explore, Add a Book, Sharing history. Members linked from footer + ledger. */
const navLinks = [
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/add-book", label: "Add a Book", icon: PlusCircle },
  { href: "/ledger", label: "Sharing history", icon: ScrollText },
]

/** Admin: steward dashboard only; add-book is reached from inside the dashboard. */
const adminLinks = [
  { href: "/steward/dashboard", label: "Steward Dashboard", icon: LayoutDashboard },
]

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [libraryCardModalOpen, setLibraryCardModalOpen] = useState(false)
  const [libraryCardModalMode, setLibraryCardModalMode] = useState<GetLibraryCardModalMode>("view")
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [removeCardConfirmOpen, setRemoveCardConfirmOpen] = useState(false)
  const { card, clearCard } = useLibraryCard()

  const handleRemoveCardClick = () => {
    setRemoveCardConfirmOpen(true)
    setMobileOpen(false)
  }

  const handleRemoveCardConfirm = () => {
    clearCard()
    setRemoveCardConfirmOpen(false)
  }

  const openLibraryCardModal = (mode: GetLibraryCardModalMode) => {
    setLibraryCardModalMode(mode)
    setLibraryCardModalOpen(true)
  }
  const profileHref = card?.user_id ? `/profile/${card.user_id}` : "/settings"

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="page-container flex h-14 min-h-14 items-center justify-between sm:h-16 sm:min-h-16 md:h-20 md:min-h-20">
        <Link href="/" className="flex items-center gap-3">
          {/* Partner logos: Foresight Institute + Internet Archive Library */}
          <img
            src="/foresight-logo.svg"
            alt="Foresight Institute"
            className="h-8 w-auto"
          />
          <img
            src="/internet-archive-logo-sf.png"
            alt="Internet Archive"
            className="h-7 w-auto opacity-90"
          />
          <span className="font-lot text-xl font-normal tracking-tight text-foreground">
            Library of Things
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-foreground">
                <LayoutDashboard className="h-4 w-4" />
                Admin
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {adminLinks.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href} className="flex items-center gap-2">
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Account section: Only show for brand new users without a library card.
              Once a card is connected, the Profile button provides all necessary access. */}
          {!card && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-foreground">
                  <CreditCard className="h-4 w-4" />
                  Account
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => openLibraryCardModal("generate")}>
                  <CreditCard className="h-4 w-4" />
                  Get library card
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLoginModalOpen(true)}>
                  Log in with card
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground">
                <User className="h-5 w-5" />
                <span className="sr-only">Profile & settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={profileHref} className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              {card && (
                <>
                  <DropdownMenuItem onClick={() => openLibraryCardModal("view")}>
                    <CreditCard className="h-4 w-4" />
                    View library card
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRemoveCardClick}
                    className="text-muted-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                    Remove card from this device
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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

      <GetLibraryCardModal
        open={libraryCardModalOpen}
        onOpenChange={setLibraryCardModalOpen}
        mode={libraryCardModalMode}
      />
      <LoginLibraryCardModal
        open={loginModalOpen}
        onOpenChange={setLoginModalOpen}
      />

      <AlertDialog open={removeCardConfirmOpen} onOpenChange={setRemoveCardConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove card from this device?</AlertDialogTitle>
            <AlertDialogDescription>
              Make sure you save your card number and PIN. Otherwise, you won&apos;t have access to this account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveCardConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {mobileOpen && (
        <nav className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {/* Account section: Only show for brand new users without a library card.
                Once a card is connected, the Profile section provides all necessary access. */}
            {!card && (
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-foreground"
                  onClick={() => {
                    openLibraryCardModal("generate")
                    setMobileOpen(false)
                  }}
                >
                  <CreditCard className="h-5 w-5" />
                  Get library card
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-foreground"
                  onClick={() => {
                    setLoginModalOpen(true)
                    setMobileOpen(false)
                  }}
                >
                  Log in with card
                </Button>
              </>
            )}
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground">
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Button>
              </Link>
            ))}
            <div className="my-1 border-t border-border pt-1">
              <span className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Admin
              </span>
              {adminLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-3 text-foreground pl-2">
                    <link.icon className="h-5 w-5" />
                    {link.label}
                  </Button>
                </Link>
              ))}
            </div>
            <div className="border-t border-border pt-1">
              <Link href={profileHref} onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground">
                  <User className="h-5 w-5" />
                  Profile
                </Button>
              </Link>
              <Link href="/settings" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground">
                  <Settings className="h-5 w-5" />
                  Settings
                </Button>
              </Link>
              {card && (
                <>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-foreground"
                    onClick={() => {
                      openLibraryCardModal("view")
                      setMobileOpen(false)
                    }}
                  >
                    <CreditCard className="h-5 w-5" />
                    View library card
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-muted-foreground"
                    onClick={handleRemoveCardClick}
                  >
                    <LogOut className="h-5 w-5" />
                    Remove card from this device
                  </Button>
                </>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
