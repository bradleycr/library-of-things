"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  BookOpen,
  AlertTriangle,
  TrendingUp,
  PlusCircle,
  Edit,
  Trash2,
  LogOut,
  Copy,
  Check,
  Link2,
  Loader2,
  ListOrdered,
  Building2,
  Upload,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import { compressBookCoverPhoto } from "@/lib/image-utils"
import { DEFAULT_LOAN_PERIOD_DAYS, clampLoanPeriodDays } from "@/lib/loan-period"
import type { Book, Node as NodeType, User } from "@/lib/types"

type StewardBookStatus = "available" | "checked_out" | "unavailable" | "missing"

function toStewardStatus(status: Book["availability_status"]): StewardBookStatus {
  if (status === "retired") return "missing"
  if (status === "in_transit") return "unavailable"
  return status
}

function fromStewardStatus(status: StewardBookStatus): Book["availability_status"] | "missing" {
  if (status === "missing") return "missing"
  if (status === "unavailable") return "in_transit"
  return status
}

export default function StewardDashboardPage() {
  const { data, refetch } = useBootstrapData()
  const books = data?.books ?? []
  const loanEvents = data?.loanEvents ?? []
  const nodes = data?.nodes ?? []
  const users = data?.users ?? []
  const defaultLoanPeriodDays = data?.config?.default_loan_period_days ?? DEFAULT_LOAN_PERIOD_DAYS
  // Node context for header and filters (Bulk NFC, etc.); "all" or a node id.
  const [selectedNodeId, setSelectedNodeId] = useState<string>("all")

  // Sharing activity chart: scope by timeframe for trends.
  type ActivityTimeframe = "week" | "month" | "year" | "all"
  const [activityTimeframe, setActivityTimeframe] = useState<ActivityTimeframe>("month")
  
  // Bulk URL generator state
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set())
  const [urlsCopied, setUrlsCopied] = useState(false)
  
  // Edit book state
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    title: "",
    author: "",
    edition: "",
    cover_image_url: "",
    node_id: "",
    availability_status: "available" as StewardBookStatus,
    current_holder_id: "",
    note: "",
    contact_required: false,
    loan_period_days: DEFAULT_LOAN_PERIOD_DAYS,
  })

  // Library settings (app-wide default loan period) — synced from bootstrap, editable here.
  const [configForm, setConfigForm] = useState({ default_loan_period_days: DEFAULT_LOAN_PERIOD_DAYS })
  const [configSaving, setConfigSaving] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  // Member management state
  const [editingMember, setEditingMember] = useState<User | null>(null)
  const [memberSaving, setMemberSaving] = useState(false)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [memberForm, setMemberForm] = useState({
    display_name: "",
    contact_opt_in: false,
    contact_email: "",
    phone: "",
  })
  const [deletingMember, setDeletingMember] = useState<User | null>(null)
  const [memberDeleting, setMemberDeleting] = useState(false)
  const [memberDeleteError, setMemberDeleteError] = useState<string | null>(null)

  // Delete book state
  const [deletingBook, setDeletingBook] = useState<Book | null>(null)
  const [bookDeleting, setBookDeleting] = useState(false)
  const [bookDeleteError, setBookDeleteError] = useState<string | null>(null)
  const [bookDeleteNote, setBookDeleteNote] = useState("")

  // Bulk add by ISBN
  const [bulkIsbns, setBulkIsbns] = useState("")
  const [bulkNodeId, setBulkNodeId] = useState("")
  const [bulkAdding, setBulkAdding] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null)
  const [bulkResult, setBulkResult] = useState<{ added: number; failed: string[] } | null>(null)

  // Pagination: progressive disclosure for each section
  const PAGE_SIZE = 10
  const [booksShown, setBooksShown] = useState(PAGE_SIZE)
  const [nfcBooksShown, setNfcBooksShown] = useState(PAGE_SIZE)
  const [membersShown, setMembersShown] = useState(PAGE_SIZE)

  // Cover image upload state
  const [coverUploading, setCoverUploading] = useState(false)

  // Add node form
  const [addNodeOpen, setAddNodeOpen] = useState(false)
  const [addNodeSaving, setAddNodeSaving] = useState(false)
  const [addNodeError, setAddNodeError] = useState<string | null>(null)
  const [addNodeForm, setAddNodeForm] = useState({
    name: "",
    type: "coworking" as NodeType["type"],
    steward_id: "",
    location_address: "",
    location_lat: "",
    location_lng: "",
    operating_hours: "",
    capacity: "",
    public: true,
  })

  useEffect(() => {
    if (editingBook) {
      setEditForm({
        title: editingBook.title,
        author: editingBook.author ?? "",
        edition: editingBook.edition ?? "",
        cover_image_url: editingBook.cover_image_url ?? "",
        node_id: editingBook.current_node_id ?? "",
        availability_status: toStewardStatus(editingBook.availability_status),
        current_holder_id: editingBook.current_holder_id ?? "",
        note: "",
        contact_required: editingBook.lending_terms?.contact_required ?? false,
        loan_period_days: editingBook.lending_terms?.loan_period_days ?? defaultLoanPeriodDays,
      })
      setEditError(null)
    }
  }, [editingBook, defaultLoanPeriodDays])

  useEffect(() => {
    if (!editingMember) return
    setMemberForm({
      display_name: editingMember.display_name,
      contact_opt_in: editingMember.contact_opt_in ?? false,
      contact_email: editingMember.contact_email ?? "",
      phone: editingMember.phone ?? "",
    })
    setMemberError(null)
  }, [editingMember])

  useEffect(() => {
    if (nodes.length > 0 && !bulkNodeId) setBulkNodeId(nodes[0].id)
  }, [nodes, bulkNodeId])

  useEffect(() => {
    if (users.length > 0) {
      setAddNodeForm((f) =>
        !f.steward_id || !users.some((u) => u.id === f.steward_id)
          ? { ...f, steward_id: users[0].id }
          : f
      )
    }
  }, [users])

  useEffect(() => {
    if (data?.config) {
      setConfigForm({ default_loan_period_days: data.config.default_loan_period_days })
    }
  }, [data?.config])

  const managingLabel =
    selectedNodeId === "all"
      ? "All nodes"
      : nodes.find((n) => n.id === selectedNodeId)?.name ?? "All nodes"
  const checkedOut = books.filter(
    (b) => b.availability_status === "checked_out"
  ).length
  const overdueBooks = books.filter((b) => {
    if (!b.expected_return_date) return false
    return new Date(b.expected_return_date) < new Date()
  }).length
  const bookEventCounts = loanEvents.reduce(
    (acc, e) => {
      if (e.event_type === "checkout") {
        acc[e.book_title || ""] = (acc[e.book_title || ""] || 0) + 1
      }
      return acc
    },
    {} as Record<string, number>
  )
  const mostBorrowedData = Object.entries(bookEventCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, count]) => ({
      name: name.length > 18 ? `${name.slice(0, 18)}...` : name,
      checkouts: count,
    }))
  // Sharing activity: filter by timeframe, then bucket and fill so the chart is continuous.
  const now = new Date()
  const cutoff =
    activityTimeframe === "week"
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : activityTimeframe === "month"
        ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        : activityTimeframe === "year"
          ? new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          : null
  const filteredActivityEvents =
    cutoff == null
      ? loanEvents
      : loanEvents.filter((e) => new Date(e.timestamp) >= cutoff)

  const activityData = (() => {
    if (activityTimeframe === "week" || activityTimeframe === "month") {
      const days = activityTimeframe === "week" ? 7 : 30
      const buckets: { key: string; label: string; events: number }[] = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        d.setHours(0, 0, 0, 0)
        const key = d.toISOString().slice(0, 10)
        const label =
          activityTimeframe === "week"
            ? d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" })
            : d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })
        buckets.push({ key, label, events: 0 })
      }
      for (const e of filteredActivityEvents) {
        const d = new Date(e.timestamp)
        d.setHours(0, 0, 0, 0)
        const key = d.toISOString().slice(0, 10)
        const b = buckets.find((x) => x.key === key)
        if (b) b.events += 1
      }
      return buckets.map(({ label, events }) => ({ month: label, events }))
    }
    if (activityTimeframe === "year") {
      const buckets: { key: string; label: string; events: number }[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
        buckets.push({ key, label, events: 0 })
      }
      for (const e of filteredActivityEvents) {
        const d = new Date(e.timestamp)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const b = buckets.find((x) => x.key === key)
        if (b) b.events += 1
      }
      return buckets.map(({ label, events }) => ({ month: label, events }))
    }
    // All time: bucket by month (only months that have data), sorted chronological.
    const byMonth = filteredActivityEvents.reduce(
      (acc, e) => {
        const d = new Date(e.timestamp)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
        if (!acc[key]) acc[key] = { label, events: 0 }
        acc[key].events += 1
        return acc
      },
      {} as Record<string, { label: string; events: number }>
    )
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ month: v.label, events: v.events }))
  })()

  const filteredBooks = selectedNodeId === "all" 
    ? books 
    : books.filter((b) => b.current_node_id === selectedNodeId)

  // Reset NFC pagination when the node filter changes
  useEffect(() => { setNfcBooksShown(PAGE_SIZE) }, [selectedNodeId])
  
  const handleToggleBook = (bookId: string) => {
    const newSet = new Set(selectedBookIds)
    if (newSet.has(bookId)) {
      newSet.delete(bookId)
    } else {
      newSet.add(bookId)
    }
    setSelectedBookIds(newSet)
  }
  
  const handleSelectAll = () => {
    if (selectedBookIds.size === filteredBooks.length) {
      setSelectedBookIds(new Set())
    } else {
      setSelectedBookIds(new Set(filteredBooks.map((b) => b.id)))
    }
  }
  
  const handleCopyUrls = () => {
    const selectedBooks = books.filter((b) => selectedBookIds.has(b.id))
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const urls = selectedBooks
      .map((b) => `${origin}${b.checkout_url}`)
      .join("\n")
    void navigator.clipboard.writeText(urls).then(() => {
      setUrlsCopied(true)
      setTimeout(() => setUrlsCopied(false), 2000)
    })
  }

  const handleBulkAdd = async () => {
    const isbns = bulkIsbns
      .split(/\n|,/)
      .map((s) => s.trim().replace(/-/g, ""))
      .filter((s) => s.length >= 10)
    if (isbns.length === 0) {
      setBulkResult({ added: 0, failed: ["No valid ISBNs (one per line or comma-separated)."] })
      return
    }
    if (!bulkNodeId) {
      setBulkResult({ added: 0, failed: ["Select a node first."] })
      return
    }
    setBulkAdding(true)
    setBulkResult(null)
    const failed: string[] = []
    let added = 0
    const total = isbns.length
    const defaultTerms = {
      type: "borrow" as const,
      shipping_allowed: false,
      local_only: true,
      contact_required: false,
      contact_opt_in: true,
    }
    for (let i = 0; i < isbns.length; i++) {
      const isbn = isbns[i]
      setBulkProgress({ current: i + 1, total })
      try {
        const editionRes = await fetch(
          `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`
        )
        if (!editionRes.ok) {
          failed.push(isbn)
          continue
        }
        const edition = (await editionRes.json()) as {
          title?: string
          by_statement?: string
          edition_name?: string
          publish_date?: string
          authors?: { key: string }[]
          works?: { key: string }[]
        }
        let author: string | undefined = edition.by_statement
        if (!author && edition.authors?.[0]?.key) {
          try {
            const authorRes = await fetch(
              `https://openlibrary.org${edition.authors[0].key}.json`
            )
            if (authorRes.ok) {
              const authorData = (await authorRes.json()) as { name?: string }
              author = authorData.name
            }
          } catch {
            // keep author undefined
          }
        }
        let description: string | undefined
        const workKey = edition.works?.[0]?.key
        if (workKey) {
          try {
            const workRes = await fetch(`https://openlibrary.org${workKey}.json`)
            if (workRes.ok) {
              const work = (await workRes.json()) as {
                description?: string | { type?: string; value?: string }
              }
              const raw =
                typeof work.description === "string"
                  ? work.description
                  : work.description?.value
              if (raw && typeof raw === "string") description = raw.trim().slice(0, 3000)
            }
          } catch {
            // ignore
          }
        }
        const coverImageUrl = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg`
        const editionText = edition.edition_name ?? edition.publish_date ?? undefined
        const createRes = await fetch("/api/books/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            isbn,
            title: edition.title ?? "Unknown",
            author: author ?? undefined,
            edition: editionText,
            description: description ?? undefined,
            node_id: bulkNodeId,
            cover_image_url: coverImageUrl,
            lending_terms: defaultTerms,
          }),
        })
        if (!createRes.ok) {
          failed.push(isbn)
        } else {
          added++
        }
      } catch {
        failed.push(isbn)
      }
    }
    setBulkProgress(null)
    setBulkAdding(false)
    setBulkResult({ added, failed })
    if (added > 0) await refetch()
  }

  const handleAddNode = async () => {
    const name = addNodeForm.name.trim()
    if (!name) {
      setAddNodeError("Name is required")
      return
    }
    if (!addNodeForm.steward_id) {
      setAddNodeError("Steward is required")
      return
    }
    setAddNodeSaving(true)
    setAddNodeError(null)
    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          type: addNodeForm.type,
          steward_id: addNodeForm.steward_id,
          location_address: addNodeForm.location_address.trim() || undefined,
          location_lat:
            addNodeForm.location_lat !== ""
              ? Number.parseFloat(addNodeForm.location_lat)
              : undefined,
          location_lng:
            addNodeForm.location_lng !== ""
              ? Number.parseFloat(addNodeForm.location_lng)
              : undefined,
          operating_hours: addNodeForm.operating_hours.trim() || undefined,
          capacity:
            addNodeForm.capacity !== ""
              ? Math.max(0, Math.min(9999, Number.parseInt(addNodeForm.capacity, 10)))
              : undefined,
          public: addNodeForm.public,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? "Failed to create node")
      }
      await refetch()
      setAddNodeOpen(false)
      setAddNodeForm({
        name: "",
        type: "coworking",
        steward_id: users[0]?.id ?? "",
        location_address: "",
        location_lat: "",
        location_lng: "",
        operating_hours: "",
        capacity: "",
        public: true,
      })
    } catch (e) {
      setAddNodeError(e instanceof Error ? e.message : "Failed to create node")
    } finally {
      setAddNodeSaving(false)
    }
  }

  const handleSaveBook = async () => {
    if (!editingBook) return
    const trimmedTitle = editForm.title.trim()
    if (!trimmedTitle) {
      setEditError("Title is required")
      return
    }
    if (editForm.availability_status === "checked_out" && !editForm.current_holder_id) {
      setEditError("Choose a member when status is checked out")
      return
    }
    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/books/${editingBook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: trimmedTitle,
          author: editForm.author.trim() || null,
          edition: editForm.edition.trim() || null,
          cover_image_url: editForm.cover_image_url.trim() || null,
          node_id: editForm.node_id || undefined,
          availability_status: fromStewardStatus(editForm.availability_status),
          current_holder_id: editForm.current_holder_id || null,
          note: editForm.note.trim() || null,
          lending_terms: {
            ...editingBook.lending_terms,
            contact_required: editForm.contact_required,
            loan_period_days: clampLoanPeriodDays(Number(editForm.loan_period_days) || defaultLoanPeriodDays),
          },
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? "Update failed")
      }
      await refetch()
      setEditingBook(null)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Update failed")
    } finally {
      setEditSaving(false)
    }
  }

  const handleSaveMember = async () => {
    if (!editingMember) return
    const displayName = memberForm.display_name.trim()
    if (!displayName) {
      setMemberError("Display name is required")
      return
    }
    setMemberSaving(true)
    setMemberError(null)
    try {
      const res = await fetch(`/api/steward/members/${editingMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          display_name: displayName,
          contact_opt_in: memberForm.contact_opt_in,
          contact_email: memberForm.contact_email.trim() || null,
          phone: memberForm.phone.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? "Update failed")
      }
      await refetch()
      setEditingMember(null)
    } catch (e) {
      setMemberError(e instanceof Error ? e.message : "Update failed")
    } finally {
      setMemberSaving(false)
    }
  }

  const handleDeleteMember = async () => {
    if (!deletingMember) return
    setMemberDeleting(true)
    setMemberDeleteError(null)
    try {
      const res = await fetch(`/api/steward/members/${deletingMember.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? "Delete failed")
      }
      await refetch()
      setDeletingMember(null)
    } catch (e) {
      setMemberDeleteError(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setMemberDeleting(false)
    }
  }

  const handleDeleteBook = async () => {
    if (!deletingBook) return
    setBookDeleting(true)
    setBookDeleteError(null)
    try {
      const res = await fetch(`/api/books/${deletingBook.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note: bookDeleteNote.trim() || undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? "Delete failed")
      }
      await refetch()
      setDeletingBook(null)
      setBookDeleteNote("")
    } catch (e) {
      setBookDeleteError(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setBookDeleting(false)
    }
  }

  return (
    <div className="py-6 sm:py-8">
      <div className="page-container">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div>
              <h1 className="font-serif text-3xl font-bold text-foreground">
                Steward Dashboard
              </h1>
              <p className="mt-1 text-muted-foreground">
                Managing: {managingLabel}
              </p>
            </div>
            {nodes.length > 0 && (
              <Select value={selectedNodeId} onValueChange={setSelectedNodeId}>
                <SelectTrigger className="w-[220px] mt-1 sm:mt-0">
                  <SelectValue placeholder="View node" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All nodes</SelectItem>
                  {nodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                setAddNodeError(null)
                setAddNodeOpen(true)
              }}
            >
              <Building2 className="h-4 w-4" />
              Add node
            </Button>
            <Link href="/add-book">
              <Button className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Add New Book
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={async () => {
                await fetch("/api/steward/auth", {
                  method: "DELETE",
                  credentials: "include",
                })
                window.location.href = "/steward/login"
              }}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>

        {/* Add node dialog */}
        <Dialog open={addNodeOpen} onOpenChange={setAddNodeOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add node</DialogTitle>
              <DialogDescription>
                New nodes appear on the homepage and in add-book/return flows. Steward must be an existing user.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="node-name">Name</Label>
                <Input
                  id="node-name"
                  value={addNodeForm.name}
                  onChange={(e) => setAddNodeForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Foresight Berlin Node"
                />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={addNodeForm.type}
                  onValueChange={(v) => setAddNodeForm((f) => ({ ...f, type: v as NodeType["type"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["coworking", "library", "cafe", "bookstore", "little_free_library", "home"] as const).map(
                      (t) => (
                        <SelectItem key={t} value={t}>
                          {t.replace("_", " ")}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Steward (user)</Label>
                <Select
                  value={addNodeForm.steward_id}
                  onValueChange={(v) => setAddNodeForm((f) => ({ ...f, steward_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="node-address">Address</Label>
                <Input
                  id="node-address"
                  value={addNodeForm.location_address}
                  onChange={(e) => setAddNodeForm((f) => ({ ...f, location_address: e.target.value }))}
                  placeholder="Street, city, country"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="node-lat">Latitude</Label>
                  <Input
                    id="node-lat"
                    type="number"
                    step="any"
                    value={addNodeForm.location_lat}
                    onChange={(e) => setAddNodeForm((f) => ({ ...f, location_lat: e.target.value }))}
                    placeholder="52.49"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="node-lng">Longitude</Label>
                  <Input
                    id="node-lng"
                    type="number"
                    step="any"
                    value={addNodeForm.location_lng}
                    onChange={(e) => setAddNodeForm((f) => ({ ...f, location_lng: e.target.value }))}
                    placeholder="13.44"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="node-hours">Operating hours</Label>
                <Input
                  id="node-hours"
                  value={addNodeForm.operating_hours}
                  onChange={(e) => setAddNodeForm((f) => ({ ...f, operating_hours: e.target.value }))}
                  placeholder="e.g. Mon–Fri 9–18"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="node-capacity">Capacity (optional)</Label>
                <Input
                  id="node-capacity"
                  type="number"
                  min={0}
                  value={addNodeForm.capacity}
                  onChange={(e) => setAddNodeForm((f) => ({ ...f, capacity: e.target.value }))}
                  placeholder="e.g. 80"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="node-public"
                  checked={addNodeForm.public}
                  onCheckedChange={(c) => setAddNodeForm((f) => ({ ...f, public: c === true }))}
                />
                <Label htmlFor="node-public">Public (visible to everyone)</Label>
              </div>
              {addNodeError && (
                <p className="text-sm text-destructive">{addNodeError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddNodeOpen(false)} disabled={addNodeSaving}>
                Cancel
              </Button>
              <Button onClick={handleAddNode} disabled={addNodeSaving}>
                {addNodeSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  "Add node"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="border-border">
            <CardContent className="flex flex-col items-center p-4">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="mt-2 text-2xl font-bold text-foreground">
                {books.length}
              </span>
              <span className="text-xs text-muted-foreground">Total Books</span>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex flex-col items-center p-4">
              <TrendingUp className="h-5 w-5 text-accent" />
              <span className="mt-2 text-2xl font-bold text-foreground">
                {checkedOut}
              </span>
              <span className="text-xs text-muted-foreground">Checked Out</span>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex flex-col items-center p-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="mt-2 text-2xl font-bold text-foreground">
                {overdueBooks}
              </span>
              <span className="text-xs text-muted-foreground">Overdue</span>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex flex-col items-center p-4">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <span className="mt-2 text-2xl font-bold text-foreground">
                {books.length - checkedOut}
              </span>
              <span className="text-xs text-muted-foreground">Available</span>
            </CardContent>
          </Card>
        </div>

        {/* Library settings — app-wide default loan period */}
        <Card className="mb-8 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Settings className="h-5 w-5" />
              Library settings
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Default suggested loan period for new books and when a book has no custom period. Used app-wide (checkout, add book, book detail).
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid gap-2 max-w-[140px]">
              <Label htmlFor="config-default-loan-days">Default loan period (days)</Label>
              <Input
                id="config-default-loan-days"
                type="number"
                min={1}
                max={365}
                value={configForm.default_loan_period_days}
                onChange={(e) =>
                  setConfigForm((f) => ({
                    ...f,
                    default_loan_period_days: Math.max(1, Math.min(365, Number(e.target.value) || DEFAULT_LOAN_PERIOD_DAYS)),
                  }))
                }
              />
            </div>
            <Button
              type="button"
              disabled={configSaving || configForm.default_loan_period_days === (data?.config?.default_loan_period_days ?? DEFAULT_LOAN_PERIOD_DAYS)}
              onClick={async () => {
                setConfigSaving(true)
                setConfigError(null)
                try {
                  const res = await fetch("/api/steward/config", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ default_loan_period_days: configForm.default_loan_period_days }),
                  })
                  const j = await res.json().catch(() => ({}))
                  if (!res.ok) throw new Error(j?.error ?? "Failed to save")
                  await refetch()
                } catch (e) {
                  setConfigError(e instanceof Error ? e.message : "Failed to save")
                } finally {
                  setConfigSaving(false)
                }
              }}
            >
              {configSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
            {configError && (
              <p className="text-sm text-destructive">{configError}</p>
            )}
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          {/* Most Borrowed */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">
                Most Borrowed Books
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={mostBorrowedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Bar
                    dataKey="checkouts"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sharing activity */}
          <Card className="border-border">
            <CardHeader className="space-y-3">
              <CardTitle className="text-card-foreground">
                Sharing activity over time
              </CardTitle>
              <ToggleGroup
                type="single"
                value={activityTimeframe}
                onValueChange={(v) => v && setActivityTimeframe(v as ActivityTimeframe)}
                className="flex flex-wrap gap-1 justify-start"
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="week" aria-label="Last week">
                  Last week
                </ToggleGroupItem>
                <ToggleGroupItem value="month" aria-label="Last month">
                  Last month
                </ToggleGroupItem>
                <ToggleGroupItem value="year" aria-label="Last year">
                  Last year
                </ToggleGroupItem>
                <ToggleGroupItem value="all" aria-label="All time">
                  All time
                </ToggleGroupItem>
              </ToggleGroup>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="events"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--accent))", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Bulk NFC Tag URL Generator */}
        <Card className="border-border mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Link2 className="h-5 w-5" />
              Bulk NFC Tag URLs
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Select books and copy their checkout URLs for NFC tags or QR codes. Each URL opens the minimal checkout/return page.
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <Select value={selectedNodeId} onValueChange={setSelectedNodeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by node" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All nodes</SelectItem>
                    {nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="gap-2"
              >
                {selectedBookIds.size === filteredBooks.length && filteredBooks.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </Button>
              <Button
                size="sm"
                onClick={handleCopyUrls}
                disabled={selectedBookIds.size === 0}
                className="gap-2"
              >
                {urlsCopied ? (
                  <>
                    <Check className="h-4 w-4 text-accent-foreground" />
                    Copied {selectedBookIds.size}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy {selectedBookIds.size > 0 ? `${selectedBookIds.size} ` : ""}URLs
                  </>
                )}
              </Button>
            </div>
            <div className="border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedBookIds.size === filteredBooks.length && filteredBooks.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead className="text-right">URL Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBooks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No books found for this node
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBooks.slice(0, nfcBooksShown).map((book) => (
                      <TableRow key={book.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedBookIds.has(book.id)}
                            onCheckedChange={() => handleToggleBook(book.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {book.title}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {book.author || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {book.current_node_name || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <code className="text-xs text-muted-foreground">
                            {book.checkout_url.slice(0, 30)}...
                          </code>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {nfcBooksShown < filteredBooks.length && (
                <div className="flex justify-center border-t border-border p-4">
                  <Button
                    variant="outline"
                    onClick={() => setNfcBooksShown((n) => Math.min(n + PAGE_SIZE, filteredBooks.length))}
                    className="gap-2"
                  >
                    Show more ({Math.min(PAGE_SIZE, filteredBooks.length - nfcBooksShown)} of {filteredBooks.length - nfcBooksShown} remaining)
                  </Button>
                </div>
              )}
              {nfcBooksShown >= filteredBooks.length && filteredBooks.length > PAGE_SIZE && (
                <div className="flex justify-center border-t border-border p-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNfcBooksShown(PAGE_SIZE)}
                    className="text-muted-foreground"
                  >
                    Collapse
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Copied text is one URL per line—paste directly into your NFC app (e.g. NFC Tools → Write → Add record → URL) to write each tag.
            </p>
          </CardContent>
        </Card>

        {/* Bulk add by ISBN */}
        <Card className="mb-8 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <ListOrdered className="h-5 w-5" />
              Bulk add by ISBN
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Paste one ISBN per line (or comma-separated). Metadata and cover are fetched from Open Library; books are added to the selected node.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Node</Label>
                <Select value={bulkNodeId} onValueChange={setBulkNodeId} disabled={bulkAdding}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select node" />
                  </SelectTrigger>
                  <SelectContent>
                    {nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">ISBNs (one per line or comma-separated)</Label>
                <Textarea
                  className="mt-1 min-h-[100px]"
                  placeholder="9780316484923&#10;9780199678112&#10;..."
                  value={bulkIsbns}
                  onChange={(e) => setBulkIsbns(e.target.value)}
                  disabled={bulkAdding}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleBulkAdd}
                disabled={bulkAdding || !bulkIsbns.trim() || !bulkNodeId}
                className="gap-2"
              >
                {bulkAdding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {bulkProgress ? `Adding ${bulkProgress.current}/${bulkProgress.total}…` : "Adding…"}
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4" />
                    Add books
                  </>
                )}
              </Button>
              {bulkResult && (
                <span className="text-sm text-muted-foreground">
                  Added {bulkResult.added}
                  {bulkResult.failed.length > 0 && `; ${bulkResult.failed.length} failed`}
                  {bulkResult.failed.length > 0 && bulkResult.failed.length <= 5 && (
                    <>: {bulkResult.failed.join(", ")}</>
                  )}
                  {bulkResult.failed.length > 5 && (
                    <>: {bulkResult.failed.slice(0, 3).join(", ")} and {bulkResult.failed.length - 3} more</>
                  )}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Book Management Table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">
              Book Management
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {books.length} book{books.length !== 1 ? "s" : ""} total
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {books.slice(0, booksShown).map((book) => (
                    <TableRow key={book.id}>
                      <TableCell>
                        <Link
                          href={`/book/${book.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {book.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {book.author || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            book.availability_status === "available"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            book.availability_status === "available"
                              ? "bg-accent text-accent-foreground"
                              : book.availability_status === "retired"
                                ? "bg-destructive/10 text-destructive"
                                : ""
                          }
                        >
                          {book.availability_status === "available"
                            ? "Available"
                            : book.availability_status === "checked_out"
                              ? "Checked out"
                              : book.availability_status === "in_transit"
                                ? "Unavailable"
                                : "Missing"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {book.current_node_name || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-foreground"
                            onClick={() => setEditingBook(book)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              setBookDeleteError(null)
                              setBookDeleteNote("")
                              setDeletingBook(book)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {booksShown < books.length && (
              <div className="flex justify-center border-t border-border p-4">
                <Button
                  variant="outline"
                  onClick={() => setBooksShown((n) => Math.min(n + PAGE_SIZE, books.length))}
                  className="gap-2"
                >
                  Show more ({Math.min(PAGE_SIZE, books.length - booksShown)} of {books.length - booksShown} remaining)
                </Button>
              </div>
            )}
            {booksShown >= books.length && books.length > PAGE_SIZE && (
              <div className="flex justify-center border-t border-border p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBooksShown(PAGE_SIZE)}
                  className="text-muted-foreground"
                >
                  Collapse
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Member Management */}
        <Card className="mt-8 border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">
              Member Management
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {users.length} member{users.length !== 1 ? "s" : ""} — edit profile details or remove members.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.slice(0, membersShown).map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium text-sm">
                        <Link
                          href={`/profile/${member.id}`}
                          className="text-primary hover:underline"
                        >
                          {member.display_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.contact_email || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.phone || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-foreground"
                            onClick={() => setEditingMember(member)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit member</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              setMemberDeleteError(null)
                              setDeletingMember(member)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete member</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {membersShown < users.length && (
              <div className="flex justify-center border-t border-border p-4">
                <Button
                  variant="outline"
                  onClick={() => setMembersShown((n) => Math.min(n + PAGE_SIZE, users.length))}
                  className="gap-2"
                >
                  Show more ({Math.min(PAGE_SIZE, users.length - membersShown)} of {users.length - membersShown} remaining)
                </Button>
              </div>
            )}
            {membersShown >= users.length && users.length > PAGE_SIZE && (
              <div className="flex justify-center border-t border-border p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMembersShown(PAGE_SIZE)}
                  className="text-muted-foreground"
                >
                  Collapse
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Book Dialog */}
      <Dialog open={!!editingBook} onOpenChange={(open) => !open && setEditingBook(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit book</DialogTitle>
            <DialogDescription>
              Update metadata, circulation state, and location. Operational changes are written to sharing history.
            </DialogDescription>
          </DialogHeader>
          {editingBook && (
            <div className="grid gap-4 py-4">
              {editError && (
                <p className="text-sm text-destructive">{editError}</p>
              )}
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Book title"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-author">Author</Label>
                <Input
                  id="edit-author"
                  value={editForm.author}
                  onChange={(e) => setEditForm((f) => ({ ...f, author: e.target.value }))}
                  placeholder="Author name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-edition">Edition</Label>
                <Input
                  id="edit-edition"
                  value={editForm.edition}
                  onChange={(e) => setEditForm((f) => ({ ...f, edition: e.target.value }))}
                  placeholder="e.g. 2nd edition"
                />
              </div>
              <div className="grid gap-2">
                <Label>Cover image</Label>
                {/* Live preview of current / new cover */}
                {editForm.cover_image_url && (
                  <div className="relative mx-auto w-28 h-40 rounded-md overflow-hidden border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editForm.cover_image_url}
                      alt="Cover preview"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none"
                      }}
                    />
                  </div>
                )}
                {editForm.cover_image_url.startsWith("data:") ? (
                  <p className="text-sm text-muted-foreground italic px-3 py-2 border border-border rounded-md bg-muted/50">
                    Uploaded photo — remove to enter a URL instead
                  </p>
                ) : (
                  <Input
                    id="edit-cover"
                    value={editForm.cover_image_url}
                    onChange={(e) => setEditForm((f) => ({ ...f, cover_image_url: e.target.value }))}
                    placeholder="https://covers.openlibrary.org/..."
                    disabled={coverUploading}
                  />
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={coverUploading}
                    onClick={() => {
                      const input = document.createElement("input")
                      input.type = "file"
                      input.accept = "image/*"
                      input.onchange = async () => {
                        const file = input.files?.[0]
                        if (!file) return
                        setCoverUploading(true)
                        try {
                          const dataUri = await compressBookCoverPhoto(file)
                          setEditForm((f) => ({ ...f, cover_image_url: dataUri }))
                        } catch {
                          setEditError("Failed to process image — try a different file.")
                        } finally {
                          setCoverUploading(false)
                        }
                      }
                      input.click()
                    }}
                  >
                    {coverUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {coverUploading ? "Processing…" : "Upload photo"}
                  </Button>
                  {editForm.cover_image_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setEditForm((f) => ({ ...f, cover_image_url: "" }))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste a URL or upload a photo. Uploaded images are compressed to ~30 KB for fast loading.
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Availability status</Label>
                <Select
                  value={editForm.availability_status}
                  onValueChange={(v) =>
                    setEditForm((f) => ({
                      ...f,
                      availability_status: v as StewardBookStatus,
                      current_holder_id:
                        v === "checked_out" ? f.current_holder_id : "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="checked_out">Checked out</SelectItem>
                    <SelectItem value="unavailable">Unavailable</SelectItem>
                    <SelectItem value="missing">Missing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Current holder</Label>
                <Select
                  value={editForm.current_holder_id || "none"}
                  onValueChange={(v) =>
                    setEditForm((f) => ({
                      ...f,
                      current_holder_id: v === "none" ? "" : v,
                    }))
                  }
                  disabled={editForm.availability_status !== "checked_out"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No holder —</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Node / location</Label>
                <Select
                  value={editForm.node_id || "none"}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, node_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select node" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Keep current —</SelectItem>
                    {nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-days">Loan period (days)</Label>
                <Input
                  id="edit-days"
                  type="number"
                  min={1}
                  max={365}
                  value={editForm.loan_period_days}
                  onChange={(e) => setEditForm((f) => ({ ...f, loan_period_days: Number(e.target.value) || defaultLoanPeriodDays }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-note">Ledger note (optional)</Label>
                <Textarea
                  id="edit-note"
                  value={editForm.note}
                  onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Why this change was made"
                  className="min-h-[88px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-contact"
                  checked={editForm.contact_required}
                  onCheckedChange={(c) => setEditForm((f) => ({ ...f, contact_required: c === true }))}
                />
                <Label htmlFor="edit-contact" className="text-sm font-normal">
                  Require contact info to borrow
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBook(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveBook} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Book Dialog */}
      <Dialog open={!!deletingBook} onOpenChange={(open) => !open && setDeletingBook(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete book from library</DialogTitle>
            <DialogDescription>
              This permanently removes the book from the catalog. A "removed" entry will be added to the sharing history (ledger). This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingBook && (
            <p className="text-sm text-muted-foreground">
              <strong>{deletingBook.title}</strong>
              {deletingBook.author ? ` — ${deletingBook.author}` : ""}
            </p>
          )}
          <div className="grid gap-2 py-2">
            <Label htmlFor="book-delete-note">Ledger note (optional)</Label>
            <Textarea
              id="book-delete-note"
              value={bookDeleteNote}
              onChange={(e) => setBookDeleteNote(e.target.value)}
              placeholder="Why this book was removed"
              className="min-h-[80px]"
            />
          </div>
          {bookDeleteError && (
            <p className="text-sm text-destructive">{bookDeleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingBook(null)} disabled={bookDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteBook} disabled={bookDeleting}>
              {bookDeleting ? "Deleting…" : "Delete from library"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit member</DialogTitle>
            <DialogDescription>
              Update a member's basic profile and contact settings.
            </DialogDescription>
          </DialogHeader>
          {editingMember && (
            <div className="grid gap-4 py-4">
              {memberError && (
                <p className="text-sm text-destructive">{memberError}</p>
              )}
              <div className="grid gap-2">
                <Label htmlFor="member-display-name">Display name</Label>
                <Input
                  id="member-display-name"
                  value={memberForm.display_name}
                  onChange={(e) =>
                    setMemberForm((f) => ({ ...f, display_name: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="member-email">Contact email</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={memberForm.contact_email}
                  onChange={(e) =>
                    setMemberForm((f) => ({ ...f, contact_email: e.target.value }))
                  }
                  placeholder="member@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="member-phone">Phone</Label>
                <Input
                  id="member-phone"
                  value={memberForm.phone}
                  onChange={(e) =>
                    setMemberForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+49 ..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="member-contact-opt-in"
                  checked={memberForm.contact_opt_in}
                  onCheckedChange={(c) =>
                    setMemberForm((f) => ({ ...f, contact_opt_in: c === true }))
                  }
                />
                <Label htmlFor="member-contact-opt-in" className="text-sm font-normal">
                  Show contact information publicly
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)} disabled={memberSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveMember} disabled={memberSaving}>
              {memberSaving ? "Saving…" : "Save member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Member Dialog */}
      <Dialog open={!!deletingMember} onOpenChange={(open) => !open && setDeletingMember(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete member</DialogTitle>
            <DialogDescription>
              This permanently deletes the member account and anonymizes their historical ledger entries.
            </DialogDescription>
          </DialogHeader>
          {memberDeleteError && (
            <p className="text-sm text-destructive">{memberDeleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingMember(null)} disabled={memberDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteMember} disabled={memberDeleting}>
              {memberDeleting ? "Deleting…" : "Delete member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
