"use client"

/**
 * Ask the inbox on a library card to send the card.
 * The server answers the same way whether or not the address is on file,
 * so this form never says "we found you."
 */

import { useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isValidEmail } from "@/lib/email"

interface EmailMyCardFormProps {
  /** Signup asks for a name. Recovery only needs the address already on the card. */
  showName?: boolean
  submitLabel: string
  intro: string
}

export function EmailMyCardForm({ showName = false, submitLabel, intro }: EmailMyCardFormProps) {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isValidEmail(email) || loading) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/library-card/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          display_name: showName ? name.trim() : undefined,
        }),
      })
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(body.error ?? "We couldn’t send that email. Please try again.")
        return
      }
      setSent(true)
    } catch {
      setError("We couldn’t send that email. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-3">
        <p className="font-lot text-base text-foreground">Check your inbox</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          If this address can receive mail, the message is there. A new address gets a confirmation link. An address that already has a card gets the card number and a new PIN. Don’t share that email.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">{intro}</p>
      {showName && (
        <div className="space-y-2">
          <Label htmlFor="card-email-name">Name on the card</Label>
          <Input
            id="card-email-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Optional"
            autoComplete="name"
            maxLength={80}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="card-email-address">Email</Label>
        <Input
          id="card-email-address"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading || !isValidEmail(email)}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  )
}
