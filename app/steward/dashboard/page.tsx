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
import type { Book } from "@/lib/types"

export default function StewardDashboardPage() {
  const { data, refetch } = useBootstrapData()
  const books = data?.books ?? []
  const loanEvents = data?.loanEvents ?? []
  const nodes = data?.nodes ?? []
  const stewardNode = nodes[0]
  
  // Bulk URL generator state
  const [selectedNodeId, setSelectedNodeId] = useState<string>("all")
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
    contact_required: false,
    loan_period_days: 21,
  })

  useEffect(() => {
    if (editingBook) {
      setEditForm({
        title: editingBook.title,
        author: editingBook.author ?? "",
        edition: editingBook.edition ?? "",
        cover_image_url: editingBook.cover_image_url ?? "",
        node_id: editingBook.current_node_id ?? "",
        contact_required: editingBook.lending_terms?.contact_required ?? false,
        loan_period_days: editingBook.lending_terms?.loan_period_days ?? 21,
      })
      setEditError(null)
    }
  }, [editingBook])
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
  const activityByMonth = loanEvents.reduce(
    (acc, e) => {
      const month = new Date(e.timestamp).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      })
      acc[month] = (acc[month] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
  const activityData = Object.entries(activityByMonth)
    .map(([month, events]) => ({ month, events }))
    .reverse()

  const filteredBooks = selectedNodeId === "all" 
    ? books 
    : books.filter((b) => b.current_node_id === selectedNodeId)
  
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

  const handleSaveBook = async () => {
    if (!editingBook) return
    const trimmedTitle = editForm.title.trim()
    if (!trimmedTitle) {
      setEditError("Title is required")
      return
    }
    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/books/${editingBook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          author: editForm.author.trim() || null,
          edition: editForm.edition.trim() || null,
          cover_image_url: editForm.cover_image_url.trim() || null,
          node_id: editForm.node_id || undefined,
          lending_terms: {
            ...editingBook.lending_terms,
            contact_required: editForm.contact_required,
            loan_period_days: Math.max(1, Math.min(365, Number(editForm.loan_period_days) || 21)),
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

  if (!stewardNode) {
    return (
      <div className="py-6 sm:py-8">
        <div className="page-container text-sm text-muted-foreground">No node data found.</div>
      </div>
    )
  }

  return (
    <div className="py-6 sm:py-8">
      <div className="page-container">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">
              Steward Dashboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              Managing: {stewardNode.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/steward/add-book">
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
            <CardHeader>
              <CardTitle className="text-card-foreground">
                Sharing activity over time
              </CardTitle>
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
            <div className="max-h-96 overflow-y-auto border border-border rounded-lg">
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
                    filteredBooks.map((book) => (
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
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Copied text is one URL per line—paste directly into your NFC app (e.g. NFC Tools → Write → Add record → URL) to write each tag.
            </p>
          </CardContent>
        </Card>

        {/* Book Management Table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">
              Book Management
            </CardTitle>
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
                  {books.slice(0, 15).map((book) => (
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
                              : ""
                          }
                        >
                          {book.availability_status === "available"
                            ? "Available"
                            : "Checked Out"}
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
          </CardContent>
        </Card>
      </div>

      {/* Edit Book Dialog */}
      <Dialog open={!!editingBook} onOpenChange={(open) => !open && setEditingBook(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit book</DialogTitle>
            <DialogDescription>
              Update metadata and location. Changes are saved to the database.
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
                <Label htmlFor="edit-cover">Cover image URL</Label>
                <Input
                  id="edit-cover"
                  value={editForm.cover_image_url}
                  onChange={(e) => setEditForm((f) => ({ ...f, cover_image_url: e.target.value }))}
                  placeholder="https://..."
                />
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
                  onChange={(e) => setEditForm((f) => ({ ...f, loan_period_days: Number(e.target.value) || 21 }))}
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
    </div>
  )
}
