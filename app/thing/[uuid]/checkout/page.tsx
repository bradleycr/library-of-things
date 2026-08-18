"use client"

import { Suspense, use, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Check, CheckCircle2, CreditCard, Loader2, Mail, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DEFAULT_RETURN_RADIUS_M,
  getCurrentPositionResult,
  locationSampleFromResult,
  type GeolocationResult,
} from "@/lib/geofence"
import { geolocationStatusMessage, previewReturnLocation } from "@/lib/return-location"
import { cn } from "@/lib/utils"
import type { Book, Node } from "@/lib/types"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type TapPayload = {
  book: Book
  nodes: Node[]
  guest_session_active: boolean
  return_geofence_radius_m?: number
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
  const [emailPromised, setEmailPromised] = useState(false)
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [complete, setComplete] = useState<"checkout" | "return" | null>(null)
  const [location, setLocation] = useState<GeolocationResult | null>(null)
  const [manualConfirm, setManualConfirm] = useState(false)

  const load = async () => {
    if (!token) {
      setError("Open this page by tapping the physical item's NFC tag.")
      return
    }
    const response = await fetch(`/api/books/${uuid}/tap?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error ?? "Item not found")
    setPayload(body)
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
  const geofenceRadiusM = payload?.return_geofence_radius_m ?? DEFAULT_RETURN_RADIUS_M

  const locationPreview = useMemo(
    () => (location && homeNode ? previewReturnLocation(location, homeNode, geofenceRadiusM) : null),
    [location, homeNode, geofenceRadiusM]
  )

  const normalizedEmail = email.trim().toLowerCase()
  const emailLooksValid = EMAIL_PATTERN.test(normalizedEmail)
  const canCheckout = emailLooksValid && emailPromised && !busy

  const checkout = async () => {
    if (!canCheckout) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/things/guest-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: uuid,
          email: normalizedEmail,
          token,
          email_confirmed: true,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Checkout failed")
      setComplete("checkout")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout failed")
    } finally {
      setBusy(false)
    }
  }

  const readLocation = async (): Promise<GeolocationResult> => {
    setLocating(true)
    setError(null)
    try {
      const result = await getCurrentPositionResult({ maximumAge: 0 })
      setLocation(result)
      return result
    } finally {
      setLocating(false)
    }
  }

  const returnItem = async () => {
    setBusy(true)
    setError(null)
    try {
      let locationBody: ReturnType<typeof locationSampleFromResult>

      if (manualConfirm) {
        if (location?.status === "success") {
          locationBody = locationSampleFromResult(location)
        }
      } else {
        setLocating(true)
        const geo = await getCurrentPositionResult({ maximumAge: 0 })
        setLocation(geo)
        setLocating(false)
        if (geo.status !== "success") {
          throw new Error(
            `${geolocationStatusMessage(geo.status)} Check the manual confirmation box to continue without GPS.`
          )
        }
        locationBody = locationSampleFromResult(geo)
      }

      const response = await fetch("/api/things/guest-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: uuid,
          token,
          location: locationBody,
          manual_confirm: manualConfirm,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        if (body.code === "NOT_NEAR_HOME_NODE" && !manualConfirm) {
          throw new Error(
            `${body.error as string} Check the manual confirmation box if you are physically at ${homeNode?.name ?? "the home node"}.`
          )
        }
        throw new Error((body.error as string) ?? "Return failed")
      }
      setComplete("return")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Return failed")
    } finally {
      setLocating(false)
      setBusy(false)
    }
  }

  if (error && !payload) return <Message title="This link could not be opened" text={error} />
  if (!payload || !item) return <Message title="Opening item…" loading />

  const isAvailable = item.availability_status === "available"
  const isMissing =
    item.availability_status === "missing" || item.availability_status === "retired"
  const locationBusy = busy || locating

  return (
    <main className="page-container flex min-h-[70vh] items-center justify-center py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            {complete ? <CheckCircle2 className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
          </div>
          <CardTitle className="font-lot text-2xl font-normal">{item.title}</CardTitle>
          {homeNode && (
            <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {homeNode.name}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {complete === "checkout" ? (
            <CheckoutSuccess email={normalizedEmail} homeName={homeNode?.name} />
          ) : complete === "return" ? (
            <ReturnSuccess homeName={homeNode?.name} />
          ) : isMissing ? (
            <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              This temporary keycard is marked missing. Please contact a steward.
            </p>
          ) : isAvailable ? (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Signing out connects this temporary keycard to your email so a steward can reach you
                if it isn’t returned.
              </p>
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
                  <p className="text-xs text-destructive">Enter a full email, like name@example.com.</p>
                )}
              </div>
              <EmailPromiseButton
                pressed={emailPromised}
                disabled={!emailLooksValid}
                onToggle={() => setEmailPromised((current) => !current)}
              />
              <Button className="w-full min-h-11" disabled={!canCheckout} onClick={checkout}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign out temporary keycard
              </Button>
            </>
          ) : payload.guest_session_active ? (
            <>
              <p className="text-sm text-muted-foreground">
                Return this temporary keycard to {homeNode?.name ?? "its home node"}. We check your
                location once when you confirm — not continuously, and coordinates are not published.
              </p>

              <Button
                variant="outline"
                className="w-full"
                disabled={locationBusy}
                onClick={() => void readLocation()}
              >
                {locating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Check location
              </Button>

              {location?.status === "success" && locationPreview && (
                <p
                  className={`rounded-lg p-3 text-sm ${
                    locationPreview.withinRange
                      ? "border border-primary/30 bg-primary/10 text-foreground"
                      : "border border-amber-500/30 bg-amber-500/10 text-foreground"
                  }`}
                  role="status"
                >
                  {locationPreview.message}
                </p>
              )}

              {location && location.status !== "success" && (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground" role="status">
                  {geolocationStatusMessage(location.status)}
                </p>
              )}

              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="manual-return"
                    checked={manualConfirm}
                    onCheckedChange={(checked) => setManualConfirm(checked === true)}
                  />
                  <Label htmlFor="manual-return" className="text-sm leading-snug">
                    I have physically returned this temporary keycard to{" "}
                    {homeNode?.name ?? "its home node"}.
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use this if location is blocked, slow, or shows the wrong place — common on iPhone
                  indoors.
                </p>
              </div>

              <Button className="w-full min-h-11" disabled={locationBusy} onClick={returnItem}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm return
              </Button>
            </>
          ) : (
            <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              This temporary keycard is signed out. Return must be completed from the browser that
              signed it out, or by a steward.
            </p>
          )}
          {error && complete == null && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </main>
  )
}

function EmailPromiseButton({
  pressed,
  disabled,
  onToggle,
}: {
  pressed: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex w-full min-h-11 items-start gap-3 rounded-lg border px-3 py-3 text-left text-sm leading-snug transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
        pressed
          ? "border-primary/40 bg-primary/15 text-foreground"
          : "border-border bg-muted/40 text-foreground hover:bg-muted/70"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          pressed ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
        )}
        aria-hidden="true"
      >
        {pressed && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span>
        <span className="font-medium">I promise this is a valid email I can be reached at.</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Tap to confirm. The sign-out button unlocks after this.
        </span>
      </span>
    </button>
  )
}

function CheckoutSuccess({ email, homeName }: { email: string; homeName?: string }) {
  return (
    <div className="space-y-4 text-center" role="status">
      <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-5">
        <p className="font-lot text-xl text-foreground">Checked out</p>
        <p className="mt-1 text-sm text-muted-foreground">This temporary keycard is now signed out.</p>
        <div className="mt-4 flex items-start gap-3 rounded-lg bg-background/80 px-3 py-3 text-left">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Connected to your email
            </p>
            <p className="mt-0.5 break-all text-sm font-medium text-foreground">{email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Private. Used only if we need to reach you about this card.
            </p>
          </div>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Keep this phone. When you bring the card back to {homeName ?? "its home node"}, tap the same
        NFC tag in this browser to return it.
      </p>
    </div>
  )
}

function ReturnSuccess({ homeName }: { homeName?: string }) {
  return (
    <div className="space-y-4 text-center" role="status">
      <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-5">
        <p className="font-lot text-xl text-foreground">Returned</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Thank you for bringing this temporary keycard home
          {homeName ? ` to ${homeName}` : ""}.
        </p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The email connected to this loan has been erased. The card is available for the next person.
      </p>
    </div>
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
