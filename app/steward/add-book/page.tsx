"use client"

import React from "react"

import { useState } from "react"
import {
  BookOpen,
  Search,
  QrCode,
  Upload,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { mockNodes } from "@/lib/mock-data"

export default function AddBookPage() {
  const [isbn, setIsbn] = useState("")
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [edition, setEdition] = useState("")
  const [nodeId, setNodeId] = useState("")
  const [loanDays, setLoanDays] = useState("21")
  const [depositRequired, setDepositRequired] = useState(false)
  const [depositAmount, setDepositAmount] = useState("")
  const [shippingAllowed, setShippingAllowed] = useState(false)
  const [memberOnly, setMemberOnly] = useState(false)
  const [contactOptIn, setContactOptIn] = useState(true)
  const [isbnLookedUp, setIsbnLookedUp] = useState(false)
  const [qrGenerated, setQrGenerated] = useState(false)

  const lookupIsbn = () => {
    // Mock ISBN lookup
    if (isbn) {
      setTitle("Example Book Title")
      setAuthor("Example Author")
      setIsbnLookedUp(true)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setQrGenerated(true)
  }

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Add a Book
          </h1>
          <p className="mt-2 text-muted-foreground">
            Add a new book to the Flybrary network. A QR code will be generated
            for the physical tag.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* ISBN Lookup */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                <Search className="h-4 w-4 text-primary" />
                ISBN Lookup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter ISBN (e.g., 9780199678112)"
                  value={isbn}
                  onChange={(e) => {
                    setIsbn(e.target.value)
                    setIsbnLookedUp(false)
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={lookupIsbn}
                  disabled={!isbn}
                  className="shrink-0"
                >
                  Look Up
                </Button>
              </div>
              {isbnLookedUp && (
                <p className="mt-2 flex items-center gap-1 text-sm text-accent">
                  <Check className="h-4 w-4" />
                  Found! Fields auto-populated.
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Uses the Open Library API to auto-populate title and author.
              </p>
            </CardContent>
          </Card>

          {/* Book Details */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                Book Details
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Book title"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Author name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edition">Edition</Label>
                <Input
                  id="edition"
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                  placeholder="e.g., 2nd Edition"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Cover Image</Label>
                <div className="mt-1 flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary/50">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-6 w-6" />
                    <span className="text-sm">
                      Click or drag to upload cover image
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Node & Location */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base text-card-foreground">
                Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label>
                  Node / Shelf <span className="text-destructive">*</span>
                </Label>
                <Select value={nodeId} onValueChange={setNodeId} required>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a node" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockNodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Lending Terms */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base text-card-foreground">
                Default Lending Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <Label htmlFor="loan-days">Loan Period (days)</Label>
                <Input
                  id="loan-days"
                  type="number"
                  min="1"
                  max="365"
                  value={loanDays}
                  onChange={(e) => setLoanDays(e.target.value)}
                  className="mt-1 w-32"
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="deposit"
                    checked={depositRequired}
                    onCheckedChange={(c) => setDepositRequired(c === true)}
                  />
                  <Label htmlFor="deposit" className="text-sm text-card-foreground">
                    Require deposit
                  </Label>
                </div>
                {depositRequired && (
                  <div className="ml-6">
                    <Label htmlFor="deposit-amount">Deposit amount ($)</Label>
                    <Input
                      id="deposit-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="mt-1 w-32"
                      placeholder="10.00"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="shipping"
                    checked={shippingAllowed}
                    onCheckedChange={(c) => setShippingAllowed(c === true)}
                  />
                  <Label htmlFor="shipping" className="text-sm text-card-foreground">
                    Allow shipping
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="member-only"
                    checked={memberOnly}
                    onCheckedChange={(c) => setMemberOnly(c === true)}
                  />
                  <Label htmlFor="member-only" className="text-sm text-card-foreground">
                    Members only
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="contact"
                    checked={contactOptIn}
                    onCheckedChange={(c) => setContactOptIn(c === true)}
                  />
                  <Label htmlFor="contact" className="text-sm text-card-foreground">
                    Allow others to contact me about this book
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex flex-col gap-3 md:flex-row">
            <Button type="submit" size="lg" className="gap-2" disabled={!title}>
              <BookOpen className="h-5 w-5" />
              Add Book to Flybrary
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="gap-2 text-foreground bg-transparent"
              disabled={!title}
              onClick={() => setQrGenerated(true)}
            >
              <QrCode className="h-5 w-5" />
              Generate QR Code
            </Button>
          </div>

          {qrGenerated && (
            <Card className="border-accent bg-accent/5">
              <CardContent className="flex flex-col items-center p-6">
                <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-card shadow-sm">
                  <QrCode className="h-28 w-28 text-foreground" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">
                  QR Code Generated
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Print this and attach it to the book
                </p>
                <Button variant="outline" size="sm" className="mt-3 text-foreground bg-transparent">
                  Download PNG
                </Button>
              </CardContent>
            </Card>
          )}
        </form>
      </div>
    </div>
  )
}
