"use client"

import { Suspense, useState, useMemo, useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, SlidersHorizontal, X, Grid3X3, List, Loader2, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BookCard } from "@/components/book-card"
import { BookCover } from "@/components/book-cover"
import { getBookCoverSrcs } from "@/lib/book-cover-generator"
import { formatLocationForDisplay } from "@/lib/format-location"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import type { Book } from "@/lib/types"

function ExplorePageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data, loading, error } = useBootstrapData()
  const books = data?.books ?? []
  const nodes = data?.nodes ?? []
  const users = data?.users ?? []
  const [query, setQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [selectedNode, setSelectedNode] = useState("all")
  const [lendingType, setLendingType] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // Sync selected node from URL (e.g. View Collection from homepage).
  // When bootstrap is still loading (nodes empty), keep the URL and set selection so
  // once nodes load the filter is correct. Only clear ?node= when we've loaded nodes
  // and the requested id is not in the list.
  useEffect(() => {
    const requestedNodeId = searchParams.get("node")
    if (!requestedNodeId) {
      setSelectedNode((prev) => (prev === "all" ? prev : "all"))
      return
    }

    const nodeExists = nodes.some((node) => node.id === requestedNodeId)
    if (nodeExists) {
      setSelectedNode((prev) => (prev === requestedNodeId ? prev : requestedNodeId))
      return
    }

    // Nodes not loaded yet: preserve URL and set selection so next effect run applies it
    if (nodes.length === 0) {
      setSelectedNode((prev) => (prev === requestedNodeId ? prev : requestedNodeId))
      return
    }

    // Nodes loaded and this node id is invalid — clear URL and reset to all
    setSelectedNode((prev) => (prev === "all" ? prev : "all"))
    const params = new URLSearchParams(searchParams.toString())
    params.delete("node")
    const nextQuery = params.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }, [nodes, pathname, router, searchParams])

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const q = query.toLowerCase()
      const matchesQuery =
        !query ||
        book.title.toLowerCase().includes(q) ||
        (book.author && book.author.toLowerCase().includes(q)) ||
        (book.isbn && book.isbn.includes(q))

      const matchesAvailability =
        !availableOnly || book.availability_status === "available"

      const matchesNode =
        selectedNode === "all" || book.current_node_id === selectedNode

      const matchesLending =
        lendingType.length === 0 ||
        lendingType.includes(book.lending_terms?.type ?? "borrow")

      return matchesQuery && matchesAvailability && matchesNode && matchesLending
    })
  }, [books, query, availableOnly, selectedNode, lendingType])

  const activeFilterCount = [
    availableOnly,
    selectedNode !== "all",
    lendingType.length > 0,
  ].filter(Boolean).length

  const toggleLendingType = (type: string) => {
    setLendingType((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const setNodeFilter = (nextNodeId: string) => {
    setSelectedNode(nextNodeId)

    const params = new URLSearchParams(searchParams.toString())
    if (nextNodeId === "all") {
      params.delete("node")
    } else {
      params.set("node", nextNodeId)
    }

    const nextQuery = params.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }

  const clearFilters = () => {
    setAvailableOnly(false)
    setNodeFilter("all")
    setLendingType([])
  }

  return (
    <div className="py-6 sm:py-8">
      <div className="page-container">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
            Explore Books
          </h1>
          <p className="mt-2 text-muted-foreground">
            {loading
              ? "Loading…"
              : `Search and browse ${books.length} books across ${nodes.length} community nodes`}
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, author, or ISBN..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-foreground bg-transparent"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            <div className="flex rounded-md border border-border">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                className="h-11 min-h-11 w-11 min-w-11 rounded-r-none touch-manipulation"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                className="h-11 min-h-11 w-11 min-w-11 rounded-l-none touch-manipulation"
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-card-foreground">Filters</h3>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-foreground">
                  Clear all
                </Button>
              )}
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-3">
              {/* Availability */}
              <div>
                <Label className="mb-3 block text-xs font-medium text-muted-foreground">
                  Availability
                </Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="available-only"
                    checked={availableOnly}
                    onCheckedChange={(checked) =>
                      setAvailableOnly(checked === true)
                    }
                  />
                  <Label
                    htmlFor="available-only"
                    className="text-sm text-card-foreground"
                  >
                    Available now
                  </Label>
                </div>
              </div>

              {/* Node */}
              <div>
                <Label className="mb-3 block text-xs font-medium text-muted-foreground">
                  Community Node
                </Label>
                <Select value={selectedNode} onValueChange={setNodeFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All nodes" />
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

              {/* Lending Type */}
              <div>
                <Label className="mb-3 block text-xs font-medium text-muted-foreground">
                  Lending Terms
                </Label>
                <div className="flex flex-col gap-2">
                  {["borrow", "trade", "gift"].map((type) => (
                    <div key={type} className="flex items-center gap-2">
                      <Checkbox
                        id={`lending-${type}`}
                        checked={lendingType.includes(type)}
                        onCheckedChange={() => toggleLendingType(type)}
                      />
                      <Label
                        htmlFor={`lending-${type}`}
                        className="text-sm capitalize text-card-foreground"
                      >
                        {type}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="mb-4 text-sm text-muted-foreground">
          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : loading
            ? "Loading…"
            : `${filteredBooks.length} book${filteredBooks.length !== 1 ? "s" : ""} found`}
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
            <AlertCircle className="h-10 w-10 text-destructive/60" />
            <h3 className="mt-4 font-semibold text-card-foreground">Couldn’t load books</h3>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center rounded-lg border border-border bg-card py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="sr-only">Loading books</span>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
            <Search className="h-10 w-10 text-muted-foreground/40" />
            <h3 className="mt-4 font-semibold text-card-foreground">No books found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search or filters
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-foreground bg-transparent"
              onClick={() => {
                setQuery("")
                clearFilters()
              }}
            >
              Clear all filters
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredBooks.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredBooks.map((book) => (
              <a
                key={book.id}
                href={`/book/${book.id}`}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-muted">
                  <BookCover
                    {...getBookCoverSrcs(book)}
                    title={book.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-card-foreground">{book.title}</h3>
                  {book.author && (
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                  )}
                  {(book.current_node_name || book.current_location_text) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {book.current_node_name ?? formatLocationForDisplay(book.current_location_text)}
                    </p>
                  )}
                </div>
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
                      ? "Checked Out"
                      : book.availability_status === "in_transit"
                        ? "Unavailable"
                        : "Missing"}
                </Badge>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="py-6 sm:py-8"><div className="page-container text-sm text-muted-foreground">Loading…</div></div>}>
      <ExplorePageContent />
    </Suspense>
  )
}
