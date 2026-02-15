"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Lock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function StewardLoginForm() {
  const searchParams = useSearchParams()
  const from = searchParams.get("from") ?? "/steward/dashboard"
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/steward/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Invalid password")
        return
      }
      window.location.href = from
    } catch {
      setError("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="font-serif text-xl">Steward access</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the steward password to continue
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="steward-password">Password</Label>
              <Input
                id="steward-password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="border-border"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? "Checking…" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-4 text-center">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function StewardLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center">Loading…</div>}>
      <StewardLoginForm />
    </Suspense>
  )
}
