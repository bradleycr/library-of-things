"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { ArrowLeft, Loader2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBootstrapData } from "@/hooks/use-bootstrap-data"
import type { Book } from "@/lib/types"

const SIZES = [
  { id: "1.5", inches: 1.5, label: "1.5″" },
  { id: "1", inches: 1, label: "1″" },
] as const

function cardNumber(item: Book) {
  return item.asset_number != null ? `#${item.asset_number}` : item.title.replace(/^Temporary\s+/i, "")
}

function absoluteCheckoutUrl(item: Book, origin: string) {
  const raw = item.checkout_url.trim()
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw
  const path = raw.startsWith("/") ? raw : `/${raw}`
  return origin ? `${origin}${path}` : path
}

/**
 * Steward print sheet of cut-out QR labels for temporary keycards.
 * Default 1.5″ squares; 1″ option for tighter cards. Hidden from public catalog.
 */
export default function PrintKeycardQrPage() {
  const { data, loading, error, refetch } = useBootstrapData()
  const [sizeId, setSizeId] = useState<(typeof SIZES)[number]["id"]>("1.5")
  const [origin, setOrigin] = useState("")
  const size = SIZES.find((option) => option.id === sizeId) ?? SIZES[0]

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const keycards = useMemo(
    () =>
      (data?.books ?? [])
        .filter((item) => item.item_type === "keycard")
        .sort((a, b) => (a.asset_number ?? 0) - (b.asset_number ?? 0)),
    [data?.books]
  )

  if (loading && !data) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="page-container flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">{error ?? "Could not load keycards."}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </main>
    )
  }

  return (
    <>
      <div className="no-print page-container space-y-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/steward/dashboard">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Button type="button" className="gap-2" onClick={() => window.print()} disabled={keycards.length === 0}>
            <Printer className="h-4 w-4" />
            Print or save as PDF
          </Button>
        </div>
        <div>
          <h1 className="font-lot text-3xl">Print keycard QR labels</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Cut along the dashed line and stick a label on each physical card. Same checkout URL as
            NFC — scan to check out or return. {size.label} squares print well on letter or A4.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Label size</span>
          {SIZES.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={sizeId === option.id ? "default" : "outline"}
              onClick={() => setSizeId(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        {keycards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No temporary keycards yet. Create them from the dashboard first.</p>
        ) : (
          <LabelSheet cards={keycards} inches={size.inches} origin={origin} preview />
        )}
      </div>

      <div className="print-only hidden bg-white print:block">
        <LabelSheet cards={keycards} inches={size.inches} origin={origin} />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { position: static; }
          .no-print { display: none !important; }
          @page { margin: 0.4in; }
        }
      `,
        }}
      />
    </>
  )
}

function LabelSheet({
  cards,
  inches,
  origin,
  preview,
}: {
  cards: Book[]
  inches: number
  origin: string
  preview?: boolean
}) {
  return (
    <div
      className={preview ? "flex flex-wrap gap-3 rounded-xl border bg-muted/30 p-4" : "flex flex-wrap gap-[0.12in]"}
    >
      {cards.map((item) => (
        <div
          key={item.id}
          className="flex flex-col items-center justify-between border-2 border-dashed border-neutral-400 bg-white p-[0.08in] text-black"
          style={{ width: `${inches}in`, height: `${inches}in` }}
        >
          <QRCodeSVG
            value={absoluteCheckoutUrl(item, origin)}
            size={Math.round(inches * 128)}
            level="M"
            marginSize={0}
            className="h-auto w-full max-h-[70%]"
            style={{ aspectRatio: "1" }}
          />
          <p className="text-center font-medium leading-none text-neutral-800" style={{ fontSize: inches <= 1 ? "8px" : "10px" }}>
            {cardNumber(item)}
          </p>
        </div>
      ))}
    </div>
  )
}
