"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Copy, ArrowRight, QrCode, Smartphone } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/** Universal link to NFC Tools app site (works on all devices). */
const NFC_TOOLS_URL = "https://www.nfctools.com/"

interface AddBookSuccessCardProps {
  checkoutUrl: string
  bookId: string | null
  locationType: "node" | "pocket"
}

/**
 * Shown after a book is added. URL is always visible and copyable.
 * Optional "Add to book" guide (NFC + QR) with a "Do it later" to collapse it.
 */
export function AddBookSuccessCard({
  checkoutUrl,
  bookId,
  locationType,
}: AddBookSuccessCardProps) {
  const [urlCopied, setUrlCopied] = useState(false)
  const [showGuide, setShowGuide] = useState(true)

  const fullUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${checkoutUrl}`
      : checkoutUrl

  const copyUrl = () => {
    void navigator.clipboard.writeText(fullUrl).then(() => {
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2000)
    })
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col items-center p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-7 w-7 text-primary" />
        </div>
        <p className="mt-4 font-medium text-foreground">
          {locationType === "pocket"
            ? "Pocket Library book added!"
            : "Book added to the catalog"}
        </p>

        {/* URL — always visible, easy to copy */}
        <div className="mt-4 w-full max-w-md">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Checkout link (for QR or NFC)
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <code className="flex-1 truncate text-left text-sm text-foreground">
              {fullUrl}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1"
              onClick={copyUrl}
            >
              {urlCopied ? (
                <Check className="h-4 w-4 text-accent" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {urlCopied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        {/* Optional guide: how to add link to the book */}
        {showGuide ? (
          <div className="mt-6 w-full max-w-md space-y-4 rounded-lg border border-border/80 bg-background/50 p-4 text-left">
            <p className="text-sm font-medium text-foreground">
              Add this link to your book
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">NFC tag:</strong> Use an
                  app like{" "}
                  <a
                    href={NFC_TOOLS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:no-underline"
                  >
                    NFC Tools
                  </a>{" "}
                  to write the URL above to a tag, then stick the tag in the
                  book.
                </span>
              </li>
              <li className="flex gap-2">
                <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">No NFC tag?</strong> Print a
                  QR code label (or save as PDF), cut it out, and glue it into the book.
                </span>
              </li>
            </ul>
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="rounded-lg border border-border bg-white p-3">
                <QRCodeSVG
                  value={fullUrl}
                  size={180}
                  level="M"
                  marginSize={1}
                  className="h-[180px] w-[180px]"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Save or print → cut out → glue in book
              </p>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="mt-1 w-full gap-2 sm:w-auto"
                onClick={() => {
                  const printUrl = `/add-book/print-qr?url=${encodeURIComponent(fullUrl)}`
                  window.open(printUrl, "_blank", "noopener,noreferrer")
                }}
              >
                <QrCode className="h-4 w-4" />
                Print QR code (ready-to-print page)
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setShowGuide(false)}
            >
              Do this later
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-4 text-muted-foreground"
            onClick={() => setShowGuide(true)}
          >
            Show how to add link to book
          </Button>
        )}

        {bookId && (
          <Link href={`/book/${bookId}`} className="mt-4">
            <Button variant="outline" className="gap-2">
              View book page
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
