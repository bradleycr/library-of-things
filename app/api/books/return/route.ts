import { NextRequest, NextResponse } from "next/server"
import { returnBook } from "@/lib/server/repositories"
import { getSessionUserId } from "@/lib/server/session"
import { parseJsonBody, isUuid, LIMITS, clampString } from "@/lib/server/validate"

/** Server-side cap so we never hang indefinitely; client uses a slightly longer timeout. */
const RETURN_HANDLER_TIMEOUT_MS = 10_000

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("RETURN_TIMEOUT")), ms)
  )
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody<{ book_id: string; user_id: string; return_node_id?: string; notes?: string }>(request)
    if (!parsed.ok) return parsed.response

    const { book_id, user_id, return_node_id, notes } = parsed.data

    if (!book_id || !user_id) {
      return NextResponse.json(
        { error: "book_id and user_id are required" },
        { status: 400 }
      )
    }
    if (!isUuid(book_id) || !isUuid(user_id)) {
      return NextResponse.json(
        { error: "Invalid book_id or user_id" },
        { status: 400 }
      )
    }
    if (return_node_id != null && !isUuid(return_node_id)) {
      return NextResponse.json(
        { error: "Invalid return_node_id" },
        { status: 400 }
      )
    }

    const sessionUserId = await getSessionUserId()
    if (!sessionUserId || sessionUserId !== user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
      await Promise.race([
        returnBook({
          bookId: book_id,
          userId: user_id,
          returnNodeId: return_node_id,
          notes: clampString(notes, LIMITS.ledgerNote) ?? undefined,
        }),
        timeoutPromise(RETURN_HANDLER_TIMEOUT_MS),
      ])
      return NextResponse.json({ success: true })
    } catch (error) {
      if (error instanceof Error && error.message === "RETURN_TIMEOUT") {
        console.error("[api/books/return] handler timeout", { book_id, user_id })
        return NextResponse.json(
          { error: "Return is taking too long. Please try again, or open the return page by scanning the book's QR or NFC tag." },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Return failed" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("[api/books/return]", error)
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
