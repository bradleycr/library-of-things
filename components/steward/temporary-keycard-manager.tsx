"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Copy, CreditCard, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Book, Node } from "@/lib/types"

interface TemporaryKeycardManagerProps {
  items: Book[]
  nodes: Node[]
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
  defaultLoanDays,
  onChanged,
}: TemporaryKeycardManagerProps) {
  const keycards = useMemo(
    () => items.filter((item) => item.item_type === "keycard").sort((a, b) => (a.asset_number ?? 0) - (b.asset_number ?? 0)),
    [items]
  )
  // Bootstrap loads after first paint — seed from nodes[0] only once they arrive.
  const [nodeId, setNodeId] = useState("")
  const [count, setCount] = useState(10)
  const [startNumber, setStartNumber] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (nodes.length > 0 && !nodeId) setNodeId(nodes[0].id)
  }, [nodes, nodeId])

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
          Create numbered cards, copy their NFC URLs, and recover returns when a borrower loses their browser session.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
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
        <Button onClick={create} disabled={busy || !nodeId}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create numbered temporary keycards
        </Button>
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
            {keycards.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.current_node_name} · {keycardStatusLabel(item.availability_status)}
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
