"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Save, Loader2, CreditCard, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { GetLibraryCardModal } from "@/components/get-library-card-modal"
import { LoginLibraryCardModal } from "@/components/login-library-card-modal"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import { useLibraryCard } from "@/hooks/use-library-card"
import { useToast } from "@/hooks/use-toast"
import { getAvatarUrl, getInitials } from "@/lib/avatar"

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data, refetch, loading } = useBootstrapData()
  const { card, updatePseudonym, clearCard } = useLibraryCard()

  const users = data?.users ?? []
  const currentUser = card?.user_id ? users.find((u) => u.id === card.user_id) ?? null : null
  const refetchOnMissingUser = useRef(false)

  /* ── Modal toggles ── */
  const [getCardModalOpen, setGetCardModalOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)

  /* ── Profile fields ── */
  const [displayName, setDisplayName] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)

  /* ── Contact fields ── */
  const [contactOptIn, setContactOptIn] = useState(true)
  const [contactEmail, setContactEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [twitterUrl, setTwitterUrl] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [savingContact, setSavingContact] = useState(false)

  /* ── Notification preferences (UI-only for now) ── */
  const [emailReminders, setEmailReminders] = useState(true)
  const [emailAvailability, setEmailAvailability] = useState(true)
  const [emailNewsletter, setEmailNewsletter] = useState(false)

  /* ── Privacy (UI-only for now) ── */
  const [publicProfile, setPublicProfile] = useState(true)

  /* ── Delete account ── */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  /* ── Populate fields from current user ── */
  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.display_name)
      setContactOptIn(currentUser.contact_opt_in ?? true)
      setContactEmail(currentUser.contact_email ?? "")
      setPhone(currentUser.phone ?? "")
      setTwitterUrl(currentUser.twitter_url ?? "")
      setLinkedinUrl(currentUser.linkedin_url ?? "")
      setWebsiteUrl(currentUser.website_url ?? "")
    }
  }, [currentUser])

  /* ── If card exists but user isn't in bootstrap yet, refetch once ── */
  useEffect(() => {
    if (!card?.user_id) {
      refetchOnMissingUser.current = false
      return
    }
    if (currentUser) return
    if (refetchOnMissingUser.current) return
    refetchOnMissingUser.current = true
    refetch()
  }, [card?.user_id, currentUser, refetch])

  /* ════════════════════
   *  Save handlers
   * ════════════════════ */

  const handleSaveProfile = async () => {
    if (!currentUser) return
    setSavingProfile(true)
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          display_name: displayName.trim(),
          contact_opt_in: contactOptIn,
          contact_email: contactEmail.trim() || null,
          phone: phone.trim() || null,
          twitter_url: twitterUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          website_url: websiteUrl.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to save")
      updatePseudonym(displayName.trim())
      await refetch()
      toast({ title: "Profile updated", description: "Your display name has been saved." })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not save profile",
        description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveContact = async () => {
    if (!currentUser) return
    setSavingContact(true)
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          contact_opt_in: contactOptIn,
          contact_email: contactEmail.trim() || null,
          phone: phone.trim() || null,
          twitter_url: twitterUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          website_url: websiteUrl.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to save contact info")
      await refetch()
      toast({ title: "Contact info saved", description: "Your contact information has been updated." })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not save contact info",
        description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      })
    } finally {
      setSavingContact(false)
    }
  }

  /* ════════════════════
   *  Delete account
   * ════════════════════ */

  const handleDeleteAccount = async () => {
    if (!currentUser) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, { method: "DELETE", credentials: "include" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to delete account")

      clearCard()
      setDeleteDialogOpen(false)
      toast({ title: "Account deleted", description: "Your account and personal data have been removed." })
      router.push("/")
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not delete account",
        description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      })
    } finally {
      setDeleting(false)
    }
  }

  /* ════════════════════
   *  Gate: no card at all
   * ════════════════════ */
  if (!card) {
    return (
      <div className="py-6 sm:py-8"><div className="page-container">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-foreground">
            Sign in to manage settings
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Get a new library card or log in with your card number and PIN to access your profile and settings.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="default"
              className="gap-2"
              onClick={() => setLoginModalOpen(true)}
            >
              <LogIn className="h-4 w-4" />
              Log in with card
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setGetCardModalOpen(true)}
            >
              <CreditCard className="h-4 w-4" />
              Get library card
            </Button>
          </div>
        </div>
        <GetLibraryCardModal
          open={getCardModalOpen}
          onOpenChange={setGetCardModalOpen}
          mode="generate"
        />
        <LoginLibraryCardModal
          open={loginModalOpen}
          onOpenChange={setLoginModalOpen}
          onSuccess={refetch}
        />
        </div>
      </div>
    )
  }

  /* ════════════════════
   *  Gate: card but user not in bootstrap yet
   * ════════════════════ */
  if (card.user_id && !currentUser) {
    return (
      <div className="py-6 sm:py-8"><div className="page-container">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading your profile…</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">User not found. If you just created your card, try refreshing the page.</p>
        )}
        </div>
      </div>
    )
  }

  /* ════════════════════
   *  Gate: card on device but not linked
   * ════════════════════ */
  if (card && !card.user_id) {
    return (
      <div className="py-6 sm:py-8"><div className="page-container">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <h2 className="font-medium text-foreground">Your card is on this device</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You're signed in as <strong>{card.pseudonym}</strong>. Enter your PIN below to link your card and unlock profile settings, checkout, and adding books.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                className="gap-2"
                onClick={() => setLoginModalOpen(true)}
              >
                <LogIn className="h-4 w-4" />
                Enter PIN to link card
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Card number on file: <code className="font-mono text-xs">{card.card_number}</code>
          </p>
        </div>
        <LoginLibraryCardModal
          open={loginModalOpen}
          onOpenChange={setLoginModalOpen}
          initialCardNumber={card.card_number}
          onSuccess={refetch}
        />
        </div>
      </div>
    )
  }

  /* ════════════════════
   *  Main settings view
   * ════════════════════ */
  return (
    <div className="py-6 sm:py-8"><div className="page-container">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your profile, notifications, and privacy
          </p>
        </div>

        <div className="flex flex-col gap-6">

          {/* ─── Profile ─── */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Profile</CardTitle>
              <CardDescription>
                Your public identity on Library of Things
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage 
                    src={getAvatarUrl(currentUser?.id || "default")} 
                    alt={displayName}
                  />
                  <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">Your pixel art avatar</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Unique design generated from your profile.
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground italic">
                    We may introduce ways to customise your profile image soon — hang tight.
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  This is your pseudonym visible in the public ledger.
                </p>
              </div>

              <Button
                className="w-fit gap-2"
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Profile
              </Button>
            </CardContent>
          </Card>

          {/* ─── Contact ─── */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Contact</CardTitle>
              <CardDescription>
                Optionally share how others can reach you. Shown on your profile only if you allow it.
                Some books require borrowers to have contact info on file; adding at least one method here lets you borrow those titles (still trust-based).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">Allow contact</p>
                  <p className="text-xs text-muted-foreground">
                    Show contact options on your profile when you add at least one method below
                  </p>
                </div>
                <Switch
                  checked={contactOptIn}
                  onCheckedChange={setContactOptIn}
                />
              </div>
              <Separator />
              <div>
                <Label htmlFor="contact-email">Contact email (optional)</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="you@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Public contact email; can differ from your sign-in email
                </p>
              </div>
              <div>
                <Label htmlFor="contact-phone">Phone (optional)</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contact-twitter">Twitter / X (optional)</Label>
                <Input
                  id="contact-twitter"
                  type="url"
                  placeholder="https://twitter.com/username"
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contact-linkedin">LinkedIn (optional)</Label>
                <Input
                  id="contact-linkedin"
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contact-website">Website (optional)</Label>
                <Input
                  id="contact-website"
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                className="w-fit gap-2"
                onClick={handleSaveContact}
                disabled={savingContact}
              >
                {savingContact ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save contact info
              </Button>
            </CardContent>
          </Card>

          {/* ─── Notifications ─── */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">
                Notifications
              </CardTitle>
              <CardDescription>
                Choose what emails you receive
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    Return Reminders
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Gentle reminder when a book is due back
                  </p>
                </div>
                <Switch
                  checked={emailReminders}
                  onCheckedChange={setEmailReminders}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    Book Availability
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Notified when a requested book becomes available
                  </p>
                </div>
                <Switch
                  checked={emailAvailability}
                  onCheckedChange={setEmailAvailability}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    Community Updates
                  </p>
                  <p className="text-xs text-muted-foreground">
                    News and updates from the Library of Things network
                  </p>
                </div>
                <Switch
                  checked={emailNewsletter}
                  onCheckedChange={setEmailNewsletter}
                />
              </div>
            </CardContent>
          </Card>

          {/* ─── Privacy ─── */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Privacy</CardTitle>
              <CardDescription>
                Control your visibility and data
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    Public Profile
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Allow others to view your profile page
                  </p>
                </div>
                <Switch
                  checked={publicProfile}
                  onCheckedChange={setPublicProfile}
                />
              </div>
            </CardContent>
          </Card>

          {/* ─── Danger Zone ─── */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions for your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-foreground">
                      Delete your account?
                    </DialogTitle>
                    <DialogDescription>
                      This will permanently delete your profile and remove your
                      personal data. Your pseudonymous sharing history will remain
                      in the public ledger for transparency purposes, but will
                      no longer be linked to your account.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 flex justify-end gap-3">
                    <Button
                      variant="outline"
                      className="text-foreground bg-transparent"
                      onClick={() => setDeleteDialogOpen(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {deleting ? "Deleting…" : "Delete Account"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  )
}
