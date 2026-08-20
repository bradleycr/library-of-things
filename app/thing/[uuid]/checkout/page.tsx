"use client"

import { Suspense, use, useEffect, useState, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CreditCard,
  Home,
  Loader2,
  Mail,
  MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { Book, Node } from "@/lib/types"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type TapPayload = {
  book: Book
  nodes: Node[]
  guest_session_active: boolean
}

/** Suspense boundary required by Next for `useSearchParams` on this route. */
export default function ThingCheckoutPage({ params }: { params: Promise<{ uuid: string }> }) {
  return (
    <Suspense fallback={<Message title="Opening item…" loading />}>
      <ThingCheckoutInner params={params} />
    </Suspense>
  )
}

function ThingCheckoutInner({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params)
  const token = useSearchParams().get("token")
  const [payload, setPayload] = useState<TapPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [borrowerLabel, setBorrowerLabel] = useState("")
  const [emailPromised, setEmailPromised] = useState(false)
  const [atNodePromised, setAtNodePromised] = useState(false)
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState<"checkout" | "return" | null>(null)

  const load = async () => {
    if (!token) {
      setError("Open this page by tapping the physical item's NFC tag.")
      return
    }
    const response = await fetch(`/api/books/${uuid}/tap?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      credentials: "include",
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error((body as { error?: string }).error ?? "Item not found")
    setPayload(body as TapPayload)
  }

  useEffect(() => {
    load().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load item"))
    // `token` and `uuid` identify the physical tag URL; load intentionally runs once per tag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, uuid])

  const item = payload?.book
  const homeNode = payload?.nodes.find(
    (node) => node.id === (item?.home_node_id ?? item?.current_node_id)
  )

  const normalizedEmail = email.trim().toLowerCase()
  const emailLooksValid = EMAIL_PATTERN.test(normalizedEmail)
  const trimmedLabel = borrowerLabel.trim()
  const canCheckout = emailLooksValid && emailPromised && !busy

  const checkout = async () => {
    if (!canCheckout) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/things/guest-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          item_id: uuid,
          email: normalizedEmail,
          token,
          email_confirmed: true,
          borrower_label: trimmedLabel || undefined,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error((body as { error?: string }).error ?? "Checkout failed")
      setPayload((current) =>
        current
          ? {
              ...current,
              guest_session_active: true,
              book: {
                ...current.book,
                availability_status: "checked_out",
                current_holder_name: trimmedLabel || "Guest",
              },
            }
          : current
      )
      setComplete("checkout")
      await load().catch(() => {
        /* Success screen is enough; a stale catalog fetch must not undo checkout. */
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout failed")
    } finally {
      setBusy(false)
    }
  }

  const returnItem = async () => {
    if (!atNodePromised || !emailLooksValid || !emailPromised) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/things/guest-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          item_id: uuid,
          token,
          physical_confirm: true,
          email: normalizedEmail,
          email_confirmed: true,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(((body as { error?: string }).error as string) ?? "Return failed")
      }
      setPayload((current) =>
        current
          ? {
              ...current,
              guest_session_active: false,
              book: { ...current.book, availability_status: "available" },
            }
          : current
      )
      setComplete("return")
      await load().catch(() => {
        /* Keep the returned confirmation even if the follow-up fetch fails. */
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Return failed")
    } finally {
      setBusy(false)
    }
  }

  if (error && !payload) return <Message title="This link could not be opened" text={error} />
  if (!payload || !item) return <Message title="Opening item…" loading />

  const isAvailable = item.availability_status === "available"
  const isCheckedOut = item.availability_status === "checked_out"
  const isMissing =
    item.availability_status === "missing" || item.availability_status === "retired"
  const canReturn = atNodePromised && emailLooksValid && emailPromised && !busy

  return (
    <main className="page-container flex min-h-[70vh] items-center justify-center py-8 sm:py-12">
      <div className="w-full max-w-md space-y-5">
        {complete === "checkout" ? (
          <CheckoutSuccess
            title={item.title}
            email={normalizedEmail}
            publicLabel={trimmedLabel || "Guest"}
            homeName={homeNode?.name}
            onReturn={() => {
              setError(null)
              setAtNodePromised(false)
              setComplete(null)
            }}
          />
        ) : complete === "return" ? (
          <ReturnSuccess title={item.title} homeName={homeNode?.name} />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <header className="border-b border-border/80 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent px-5 pb-5 pt-6 text-center">
              <StatusBadge
                tone={isAvailable ? "ready" : isCheckedOut ? "out" : "blocked"}
                label={
                  isAvailable ? "Ready to sign out" : isCheckedOut ? "Signed out" : "Unavailable"
                }
              />
              <h1 className="mt-4 font-lot text-2xl font-normal tracking-tight text-foreground">
                {item.title}
              </h1>
              {homeNode && (
                <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {homeNode.name}
                </p>
              )}
            </header>

            <div className="space-y-5 px-5 py-5">
              <KeycardVisual
                mode={isAvailable ? "available" : isCheckedOut ? "out" : "blocked"}
                holderName={item.current_holder_name}
                homeName={homeNode?.name}
              />

              {isMissing ? (
                <p className="rounded-xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
                  This temporary keycard is marked missing. Please contact a steward.
                </p>
              ) : isAvailable ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="guest-email">Email address</Label>
                    <Input
                      id="guest-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value)
                        if (emailPromised) setEmailPromised(false)
                      }}
                    />
                    {email.trim().length > 0 && !emailLooksValid && (
                      <p className="text-xs text-destructive">
                        Enter a full email, like name@example.com.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Private — erased when you return the card.
                    </p>
                  </div>

                  <PromiseToggle
                    pressed={emailPromised}
                    disabled={!emailLooksValid}
                    title="I promise this is a valid email I can be reached at"
                    onToggle={() => setEmailPromised((current) => !current)}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="borrower-label">Public name (optional)</Label>
                    <Input
                      id="borrower-label"
                      placeholder="Guest"
                      value={borrowerLabel}
                      onChange={(event) => setBorrowerLabel(event.target.value)}
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground">
                      Shown in the library instead of your email.
                    </p>
                  </div>

                  <Button
                    className="btn-pastel w-full min-h-12 text-base"
                    disabled={!canCheckout}
                    onClick={checkout}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUpFromLine className="mr-2 h-4 w-4" />
                    )}
                    Sign out
                  </Button>
                </>
              ) : isCheckedOut ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="return-email">Email used at sign-out</Label>
                    <Input
                      id="return-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value)
                        if (emailPromised) setEmailPromised(false)
                      }}
                    />
                    {email.trim().length > 0 && !emailLooksValid && (
                      <p className="text-xs text-destructive">
                        Enter the same email you used when signing out.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Works on any phone — you don’t need the browser that signed out.
                    </p>
                  </div>
                  <PromiseToggle
                    pressed={emailPromised}
                    disabled={!emailLooksValid}
                    title="I promise this is the email I used at sign-out"
                    onToggle={() => setEmailPromised((current) => !current)}
                  />

                  <PromiseToggle
                    pressed={atNodePromised}
                    title={`I promise I am physically at ${homeNode?.name ?? "the home node"} with this keycard`}
                    hint="Tap to unlock return"
                    onToggle={() => setAtNodePromised((current) => !current)}
                  />

                  <Button
                    className="btn-pastel w-full min-h-12 text-base"
                    disabled={!canReturn}
                    onClick={returnItem}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowDownToLine className="mr-2 h-4 w-4" />
                    )}
                    Return keycard
                  </Button>
                </>
              ) : (
                <p className="rounded-xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
                  This temporary keycard is not available for sign-out right now. Ask a steward if you
                  need help.
                </p>
              )}

              {error && <p className="text-center text-sm text-destructive">{error}</p>}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function StatusBadge({
  tone,
  label,
}: {
  tone: "ready" | "out" | "home" | "blocked"
  label: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        tone === "ready" && "bg-primary/25 text-primary-foreground",
        tone === "out" && "bg-amber-500/20 text-amber-900 dark:text-amber-100",
        tone === "home" && "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100",
        tone === "blocked" && "bg-muted text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "ready" && "bg-emerald-600",
          tone === "out" && "bg-amber-600",
          tone === "home" && "bg-emerald-600",
          tone === "blocked" && "bg-muted-foreground"
        )}
        aria-hidden
      />
      {label}
    </span>
  )
}

/** Mini keycard diagram — status is read at a glance, not from a wall of copy. */
function KeycardVisual({
  mode,
  holderName,
  homeName,
}: {
  mode: "available" | "out" | "home" | "blocked"
  holderName?: string | null
  homeName?: string
}) {
  const headline =
    mode === "available"
      ? "Available"
      : mode === "out"
        ? "Out"
        : mode === "home"
          ? "Home"
          : "Unavailable"

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border px-4 py-5",
        mode === "available" && "border-primary/35 bg-gradient-to-br from-primary/15 to-transparent",
        mode === "out" && "border-amber-500/35 bg-gradient-to-br from-amber-500/15 to-transparent",
        mode === "home" && "border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 to-transparent",
        mode === "blocked" && "border-border bg-muted/50"
      )}
      aria-hidden={false}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "relative flex h-16 w-24 shrink-0 flex-col justify-between rounded-lg border-2 p-2 shadow-sm",
            mode === "available" && "border-primary/50 bg-background/90",
            mode === "out" && "border-amber-500/60 bg-background/90",
            mode === "home" && "border-emerald-500/60 bg-background/90",
            mode === "blocked" && "border-muted-foreground/30 bg-background/80"
          )}
        >
          <div className="flex items-center justify-between">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="h-2 w-3 rounded-[1px] bg-muted-foreground/25" />
          </div>
          <p className="font-lot text-lg leading-none tracking-wide text-foreground">{headline}</p>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          {mode === "available" && (
            <p className="text-sm text-muted-foreground">
              Sign out to borrow this card
              {homeName ? ` from ${homeName}` : ""}.
            </p>
          )}
          {mode === "out" && (
            <>
              <p className="text-sm font-medium text-foreground">
                Signed out{holderName ? ` to ${holderName}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Return it at {homeName ?? "its home node"}.
              </p>
            </>
          )}
          {mode === "home" && (
            <p className="text-sm text-muted-foreground">
              Back at {homeName ?? "its home node"} and ready for the next person.
            </p>
          )}
          {mode === "blocked" && (
            <p className="text-sm text-muted-foreground">This card cannot be borrowed right now.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function PromiseToggle({
  pressed,
  disabled,
  title,
  hint,
  onToggle,
}: {
  pressed: boolean
  disabled?: boolean
  title: string
  hint?: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex w-full min-h-12 items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm leading-snug transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
        pressed
          ? "border-primary/45 bg-primary/20 text-foreground"
          : "border-border bg-muted/40 text-foreground hover:bg-muted/70"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          pressed ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
        )}
        aria-hidden
      >
        {pressed && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span>
        <span className="font-medium">{title}</span>
        {hint && !pressed && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
        )}
      </span>
    </button>
  )
}

function SuccessShell({
  tone,
  badge,
  title,
  children,
  footer,
}: {
  tone: "out" | "home"
  badge: string
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border shadow-sm",
        tone === "out" && "border-amber-500/30 bg-card",
        tone === "home" && "border-emerald-500/30 bg-card"
      )}
      role="status"
    >
      <div
        className={cn(
          "relative px-5 pb-6 pt-8 text-center",
          tone === "out" && "bg-gradient-to-b from-amber-500/20 to-transparent",
          tone === "home" && "bg-gradient-to-b from-emerald-500/20 to-transparent"
        )}
      >
        <StatusBadge tone={tone} label={badge} />

        <div className="relative mx-auto mt-6 flex h-24 w-24 items-center justify-center">
          <span
            className={cn(
              "absolute inset-0 rounded-full opacity-40",
              tone === "out" && "animate-ping bg-amber-400/40",
              tone === "home" && "animate-ping bg-emerald-400/40"
            )}
            style={{ animationIterationCount: 2, animationDuration: "1.1s" }}
            aria-hidden
          />
          <span
            className={cn(
              "relative flex h-20 w-20 items-center justify-center rounded-full border-2 bg-background shadow-sm",
              tone === "out" && "border-amber-500/50 text-amber-700 dark:text-amber-300",
              tone === "home" && "border-emerald-500/50 text-emerald-700 dark:text-emerald-300"
            )}
          >
            {tone === "out" ? (
              <ArrowUpFromLine className="h-9 w-9" strokeWidth={2.25} />
            ) : (
              <Home className="h-9 w-9" strokeWidth={2.25} />
            )}
          </span>
        </div>

        <h1 className="mt-5 font-lot text-3xl font-normal tracking-tight text-foreground">{title}</h1>
      </div>

      <div className="space-y-4 px-5 pb-6">{children}</div>
      {footer && <div className="border-t border-border/70 px-5 py-4">{footer}</div>}
    </section>
  )
}

function CheckoutSuccess({
  title,
  email,
  publicLabel,
  homeName,
  onReturn,
}: {
  title: string
  email: string
  publicLabel: string
  homeName?: string
  onReturn: () => void
}) {
  return (
    <SuccessShell
      tone="out"
      badge="Signed out"
      title="You're all set"
      footer={
        <Button type="button" variant="outline" className="w-full min-h-11" onClick={onReturn}>
          I’m returning it now
        </Button>
      }
    >
      <KeycardVisual mode="out" holderName={publicLabel} homeName={homeName} />

      <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-1 text-sm text-foreground">
          Shown in the library as <span className="font-semibold">{publicLabel}</span>
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Remember this email to return
          </p>
          <p className="mt-0.5 break-all text-sm font-medium text-foreground">{email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Any phone works — tap the NFC tag, enter this email, confirm you’re at the node.
          </p>
        </div>
      </div>
    </SuccessShell>
  )
}

function ReturnSuccess({ title, homeName }: { title: string; homeName?: string }) {
  return (
    <SuccessShell tone="home" badge="Returned" title="Back home">
      <KeycardVisual mode="home" homeName={homeName} />
      <p className="text-center text-sm text-muted-foreground">
        {title} is available again
        {homeName ? ` at ${homeName}` : ""}. Your email for this loan has been erased.
      </p>
    </SuccessShell>
  )
}

function Message({ title, text, loading }: { title: string; text?: string; loading?: boolean }) {
  return (
    <main className="page-container flex min-h-[60vh] items-center justify-center text-center">
      <div className="space-y-3">
        {loading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
        <h1 className="font-lot text-2xl">{title}</h1>
        {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
      </div>
    </main>
  )
}
