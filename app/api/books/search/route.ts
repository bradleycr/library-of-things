import { NextRequest, NextResponse } from "next/server"
import { searchBooks } from "@/lib/server/repositories"

export async function POST(request: NextRequest) {
  try {
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

    const results = await searchBooks({
      query,
      availability: filters?.availability,
      lendingTerms: filters?.lending_terms,
      nodeId: filters?.community_id,
    })

    return NextResponse.json({ books: results })
  } catch (error) {
    console.error("[api/books/search]", error)
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    )
  }
}
