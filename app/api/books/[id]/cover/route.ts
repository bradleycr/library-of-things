import { NextResponse } from "next/server"
import { generateBookCoverSvg } from "@/lib/book-cover-generator"
import { getBookById } from "@/lib/server/repositories"

/**
 * GET /api/books/[id]/cover
 * Returns a deterministic pastel pixel-art gradient SVG for the book,
 * with the book title (and author) on the cover. Use when the book has no cover_image_url.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Book id required" }, { status: 400 })
  }

  const book = await getBookById(id)
  const title = book?.title
  const author = book?.author

  const svg = generateBookCoverSvg({
    seed: id,
    title: title ?? "A Book",
    author: author ?? undefined,
  })

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
