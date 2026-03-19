import { NextRequest, NextResponse } from "next/server"
import { listBooks } from "@/lib/server/repositories"
import { findBooksByIsbn } from "@/lib/isbn-checkout"
import { normalizeIsbn } from "@/lib/isbn-utils"
import type { BooksByIsbnResponse } from "@/lib/isbn-lookup"

export async function GET(request: NextRequest) {
  try {
    const rawIsbn = request.nextUrl.searchParams.get("isbn") ?? ""
    const normalizedIsbn = normalizeIsbn(rawIsbn)

    if (!normalizedIsbn) {
      return NextResponse.json(
        { error: "Invalid ISBN" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      )
    }

    const books = await listBooks()
    const matches = findBooksByIsbn(books, normalizedIsbn)
    const body: BooksByIsbnResponse = { books: matches }

    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("[api/books/by-isbn]", error)
    return NextResponse.json(
      { error: "Lookup failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
