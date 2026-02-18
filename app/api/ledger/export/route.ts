import { NextRequest, NextResponse } from "next/server"
import type { LoanEvent } from "@/lib/types"
import { listLoanEvents } from "@/lib/server/repositories"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") || "json"

  const events = await listLoanEvents()
  type ExportRow = {
    timestamp: string | undefined
    event_type: string
    book_id: string
    book_title: string | undefined
    user_id: string | undefined
    user_display_name: string | undefined
    location: string | undefined
    notes: string
  }
  const data: ExportRow[] = events.map((e: LoanEvent) => ({
    timestamp: e.timestamp,
    event_type: e.event_type,
    book_id: e.book_id,
    book_title: e.book_title,
    user_id: e.user_id,
    user_display_name: e.user_display_name,
    location: e.location_text,
    notes: e.notes || "",
  }))

  if (format === "csv") {
    const headers = Object.keys(data[0] || {}).join(",")
    const rows = data.map((row: ExportRow) =>
      Object.values(row)
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    )
    const csv = [headers, ...rows].join("\n")

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=library-of-things-ledger.csv",
      },
    })
  }

  return NextResponse.json(data)
}
