"use client"

import { useState, useMemo } from "react"
import { Search, SlidersHorizontal, X, Grid3X3, List } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BookCard } from "@/components/book-card"
import { BookCover } from "@/components/book-cover"
import { mockBooks, mockNodes } from "@/lib/mock-data"

export default function ExplorePage() {
  const [query, setQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [selectedNode, setSelectedNode] = useState("all")
  const [distance, setDistance] = useState([50])
  const [lendingType, setLendingType] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const filteredBooks = useMemo(() => {
    return mockBooks.filter((book) => {
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
        lendingType.includes(book.lending_terms.type)

      return matchesQuery && matchesAvailability && matchesNode && matchesLending
    })
  }, [query, availableOnly, selectedNode, lendingType, distance])

  const activeFilterCount = [
    availableOnly,
    selectedNode !== "all",
    lendingType.length > 0,
    distance[0] < 50,
  ].filter(Boolean).length

  const toggleLendingType = (type: string) => {
    setLendingType((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const clearFilters = () => {
    setAvailableOnly(false)
    setSelectedNode("all")
    setDistance([50])
    setLendingType([])
  }

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
            Explore Books
          </h1>
          <p className="mt-2 text-muted-foreground">
            Search and browse {mockBooks.length} books across{" "}
            {mockNodes.length} community nodes
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
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
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
                className="h-8 w-8 rounded-r-none"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-l-none"
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
            <div className="mt-4 grid gap-6 md:grid-cols-4">
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
                <Select value={selectedNode} onValueChange={setSelectedNode}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All nodes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All nodes</SelectItem>
                    {mockNodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Distance */}
              <div>
                <Label className="mb-3 block text-xs font-medium text-muted-foreground">
                  Distance: {distance[0]} km
                </Label>
                <Slider
                  value={distance}
                  onValueChange={setDistance}
                  min={1}
                  max={50}
                  step={1}
                  className="mt-2"
                />
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
          {filteredBooks.length} book{filteredBooks.length !== 1 ? "s" : ""} found
        </div>

        {filteredBooks.length === 0 ? (
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
                  {book.cover_image_url ? (
                    <img
                      src={book.cover_image_url || "/placeholder.svg"}
                      alt={`Cover of ${book.title}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-[8px] text-muted-foreground">
                        {book.title}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-card-foreground">{book.title}</h3>
                  {book.author && (
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                  )}
                  {book.current_location_text && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {book.current_location_text}
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
                      : ""
                  }
                >
                  {book.availability_status === "available"
                    ? "Available"
                    : "Checked Out"}
                </Badge>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
