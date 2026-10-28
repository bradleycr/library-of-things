"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, Copy, CreditCard, Loader2, Printer, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  buildLoanStartedAtByBookId,
  formatCheckoutDateTime,
  formatOutFor,
  isPastExpectedReturn,
} from "@/lib/steward-loan-age"
import type { Book, LoanEvent, Node } from "@/lib/types"

type DropoffPhoto = {
  id: string
  book_id: string
  book_title: string | null
  asset_number: number | null
  image_data: string
  created_at: string
  expires_at: string
}

interface TemporaryKeycardManagerProps {
  items: Book[]
  nodes: Node[]
  loanEvents: LoanEvent[]
  defaultLoanDays: number
  onChanged: () => Promise<unknown> | unknown
}

/** Human label for steward list — DB may store `missing` or API-normalized `retired`. */
function keycardStatusLabel(status: Book["availability_status"]) {
  if (status === "checked_out") return "Signed out"
  if (status === "missing" || status === "retired") return "Missing"
  if (status === "in_transit" || status === "unavailable") return "Unavailable"
  return "Available"
}

/** Steward provisioning and recovery for numbered physical temporary keycards. */
export function TemporaryKeycardManager({
  items,
  nodes,
  loanEvents,
  defaultLoanDays,
  onChanged,
}: TemporaryKeycardManagerProps) {
  const keycards = useMemo(
    () => items.filter((item) => item.item_type === "keycard").sort((a, b) => (a.asset_number ?? 0) - (b.asset_number ?? 0)),
    [items]
  )
  const loanStartedAt = useMemo(() => buildLoanStartedAtByBookId(loanEvents), [loanEvents])
  const signedOut = useMemo(() => {
    return keycards
      .filter((item) => item.availability_status === "checked_out")
      .map((item) => ({
        item,
        checkedOutAt: loanStartedAt.get(item.id) ?? null,
      }))
      .sort((a, b) => {
        if (!a.checkedOutAt && !b.checkedOutAt) return 0
        if (!a.checkedOutAt) return 1
        if (!b.checkedOutAt) return -1
        return a.checkedOutAt.getTime() - b.checkedOutAt.getTime()
      })
  }, [keycards, loanStartedAt])
  // Bootstrap loads after first paint — seed from nodes[0] only once they arrive.
  const [nodeId, setNodeId] = useState("")
  const [count, setCount] = useState(10)
  const [startNumber, setStartNumber] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [dropoffPhotos, setDropoffPhotos] = useState<DropoffPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(true)

  useEffect(() => {
    if (nodes.length > 0 && !nodeId) setNodeId(nodes[0].id)
  }, [nodes, nodeId])

  useEffect(() => {
    let cancelled = false
    setPhotosLoading(true)
    fetch("/api/steward/return-photos", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as { photos?: DropoffPhoto[] }
        if (!cancelled) setDropoffPhotos(body.photos ?? [])
      })
      .catch(() => {
        if (!cancelled) setDropoffPhotos([])
      })
      .finally(() => {
        if (!cancelled) setPhotosLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [signedOut.length])

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/steward/items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_type: "keycard",
          node_id: nodeId,
          title_prefix: "Temporary Keycard",
          start_number: startNumber,
          count,
          loan_period_days: defaultLoanDays,
          contact_required: true,
          catalog_visible: false,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not create temporary keycards")
      await onChanged()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create temporary keycards")
    } finally {
      setBusy(false)
    }
  }

  const copyUrl = async (item: Book) => {
    const absolute = new URL(item.checkout_url, window.location.origin).toString()
    await navigator.clipboard.writeText(absolute)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const stewardReturn = async (item: Book) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/steward/items/${item.id}/return`, { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not return temporary keycard")
      await onChanged()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not return temporary keycard")
    } finally {
      setBusy(false)
    }
  }

  const recheckNode = async (node: Node) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/nodes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: node.id }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not verify node coordinates")
      await onChanged()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not verify node coordinates")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-8 border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Temporary keycards
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Signed-out cards are longest-first (same idea as Hunt down). Create cards and print QR labels below.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-sm font-medium text-foreground">
            Signed out now ({signedOut.length})
          </p>
          {signedOut.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No guest cards are out.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {signedOut.map(({ item, checkedOutAt }) => {
                const overdue = isPastExpectedReturn(item.expected_return_date)
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {item.asset_number != null ? `Card ${item.asset_number}` : item.title}
                        {overdue ? (
                          <span className="ml-2 text-xs font-normal text-destructive">Overdue</span>
                        ) : null}
                      </p>
                      <p className="truncate text-sm text-foreground">
                        {item.current_holder_name || "Guest email not recorded"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {checkedOutAt
                          ? `Out ${formatOutFor(checkedOutAt)} · since ${formatCheckoutDateTime(checkedOutAt)}`
                          : "Out — checkout date unknown"}
                        {item.current_node_name ? ` · ${item.current_node_name}` : ""}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => stewardReturn(item)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Steward return
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-sm font-medium text-foreground">
            Drop-off photos ({dropoffPhotos.length})
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Guests can attach a photo when they return a card in the app — usually of the card in the return locker. Kept for two weeks.
          </p>
          {photosLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
          ) : dropoffPhotos.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No drop-off photos yet.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {dropoffPhotos.map((photo) => (
                <li
                  key={photo.id}
                  className="flex gap-3 rounded-md border border-border bg-background p-3"
                >
                  <a
                    href={photo.image_data}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                  >
                    <img
                      src={photo.image_data}
                      alt=""
                      className="h-20 w-20 rounded-md border border-border object-cover"
                    />
                  </a>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {photo.asset_number != null
                        ? `Card ${photo.asset_number}`
                        : photo.book_title || "Keycard"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(photo.created_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Kept until {new Date(photo.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <div className="space-y-2 sm:col-span-2">
            <Label>Home node</Label>
            {nodes.length > 0 && nodeId ? (
              <Select value={nodeId} onValueChange={setNodeId}>
                <SelectTrigger><SelectValue placeholder="Choose a node" /></SelectTrigger>
                <SelectContent>
                  {nodes.map((node) => <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                Loading nodes…
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="keycard-start">Starts at</Label>
            <Input id="keycard-start" type="number" min={1} value={startNumber} onChange={(event) => setStartNumber(Number(event.target.value) || 1)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keycard-count">How many</Label>
            <Input id="keycard-count" type="number" min={1} max={100} value={count} onChange={(event) => setCount(Number(event.target.value) || 1)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={create} disabled={busy || !nodeId}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create numbered temporary keycards
          </Button>
          {keycards.length > 0 && (
            <Button asChild variant="outline">
              <Link href="/steward/print-keycard-qr">
                <Printer className="mr-2 h-4 w-4" />
                Print QR labels
              </Link>
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {nodes.filter((node) => node.location_lat == null || node.location_lng == null).map((node) => (
          <div key={node.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 dark:bg-amber-950/20">
            <p className="text-sm">{node.name} has no verified coordinates, so returns use manual confirmation.</p>
            <Button variant="outline" size="sm" disabled={busy || !node.location_address} onClick={() => recheckNode(node)}>
              Recheck coordinates
            </Button>
          </div>
        ))}

        {keycards.length > 0 && (
          <div className="divide-y rounded-lg border">
            {keycards.map((item) => {
              const checkedOutAt =
                item.availability_status === "checked_out"
                  ? loanStartedAt.get(item.id) ?? null
                  : null
              return (
                <div key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.current_node_name} · {keycardStatusLabel(item.availability_status)}
                      {item.availability_status === "checked_out" && item.current_holder_name
                        ? ` · ${item.current_holder_name}`
                        : ""}
                      {checkedOutAt ? ` · out ${formatOutFor(checkedOutAt)}` : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copyUrl(item)}>
                    {copiedId === item.id ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    NFC URL
                  </Button>
                  {item.availability_status === "checked_out" && (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => stewardReturn(item)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Steward return
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
