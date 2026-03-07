"use client"

import { useSearchParams } from "next/navigation"
import { useMemo, Suspense } from "react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Printer } from "lucide-react"

/**
 * Print-ready QR code page.
 * Opens from add-book success with ?url=... (full or path-only).
 * Renders a single page with the QR centered at a fixed print size (2" × 2")
 * and optional cut-line, so the user can Print → Save as PDF or send to printer.
 */
function PrintQrContent() {
  const searchParams = useSearchParams()
  const urlParam = searchParams.get("url")

  const fullUrl = useMemo(() => {
    if (!urlParam?.trim()) return null
    const raw = urlParam.trim()
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    return `${origin}${raw.startsWith("/") ? raw : `/${raw}`}`
  }, [urlParam])

  if (!fullUrl) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">No checkout URL provided.</p>
        <Link href="/add-book">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Add book
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Screen-only: instructions and actions */}
      <div className="no-print flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-6">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="font-serif text-xl font-semibold text-foreground">
            Print QR code
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the button below to open the print view. Then choose Print or Save as PDF
            to get a page-sized label you can cut out and glue into your book.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              className="gap-2"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Print or save as PDF
            </Button>
            <Link href="/add-book">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Print-only: single page, QR centered at 2" × 2" with cut line */}
      <div className="print-only hidden min-h-[100vh] flex-col items-center justify-center gap-2 bg-white p-0 print:flex">
        <div
          className="qr-cut-wrapper flex flex-col items-center gap-1"
          style={{
            width: "2in",
            height: "2in",
          }}
        >
          <div className="qr-inner flex h-full w-full items-center justify-center rounded-sm border-2 border-dashed border-neutral-400 bg-white p-1">
            <QRCodeSVG
              value={fullUrl}
              size={256}
              level="M"
              marginSize={1}
              className="h-full max-h-full w-full max-w-full"
              style={{ aspectRatio: "1" }}
            />
          </div>
        </div>
        <p className="text-center text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Cut along dashed line
        </p>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only {
            position: fixed; inset: 0;
            background: white;
            display: flex !important;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .no-print { display: none !important; }
        }
      `,
        }}
      />
    </>
  )
}

export default function PrintQrPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <PrintQrContent />
    </Suspense>
  )
}
