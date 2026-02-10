import { NextRequest, NextResponse } from "next/server"
import { mockLoanEvents } from "@/lib/mock-data"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") || "json"

  // TODO: Connect to Supabase and query loan_events with filters

  const data = mockLoanEvents.map((e) => ({
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
    const rows = data.map((row) =>
      Object.values(row)
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    )
    const csv = [headers, ...rows].join("\n")

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=flybrary-ledger.csv",
      },
    })
  }

  return NextResponse.json(data)
}
