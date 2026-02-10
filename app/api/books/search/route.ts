import { NextRequest, NextResponse } from "next/server"
import { mockBooks } from "@/lib/mock-data"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { query, filters } = body as {
    query?: string
    filters?: {
      availability?: string
      community_id?: string
      lending_terms?: string[]
      distance_km?: number
    }
  }

  let results = [...mockBooks]

  if (query) {
    const q = query.toLowerCase()
    results = results.filter(
      (book) =>
        book.title.toLowerCase().includes(q) ||
        (book.author && book.author.toLowerCase().includes(q)) ||
        (book.isbn && book.isbn.includes(q))
    )
  }

  if (filters?.availability === "available") {
    results = results.filter((b) => b.availability_status === "available")
  }

  if (filters?.lending_terms && filters.lending_terms.length > 0) {
    results = results.filter((b) =>
      filters.lending_terms!.includes(b.lending_terms.type)
    )
  }

  // TODO: Implement geospatial distance filtering with Supabase
  // TODO: Implement community-based filtering

  return NextResponse.json({ books: results })
}
