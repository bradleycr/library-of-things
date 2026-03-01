import "server-only"

import { NextRequest, NextResponse } from "next/server"

/** UUID v4 regex — allows hyphenated form only. */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value)
}

/**
 * Parse JSON body from a request. Returns a 400 NextResponse if body is missing
 * or invalid JSON. Use in POST/PATCH handlers for consistent error handling.
 */
export async function parseJsonBody<T = unknown>(
  request: NextRequest
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let data: T
  try {
    const text = await request.text()
    if (!text?.trim()) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Request body is required" },
          { status: 400 }
        ),
      }
    }
    data = JSON.parse(text) as T
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    }
  }
  return { ok: true, data }
}

/** Reasonable max lengths for API string fields (2026 best practice: explicit limits). */
export const LIMITS = {
  title: 1000,
  author: 500,
  edition: 200,
  description: 3000,
  isbn: 20,
  notes: 2000,
  url: 2048,
  displayName: 200,
  operatingHours: 500,
} as const

export function clampString(
  value: unknown,
  maxLen: number
): string | undefined {
  if (value === undefined || value === null) return undefined
  const s = typeof value === "string" ? value.trim() : String(value).trim()
  return s === "" ? undefined : s.slice(0, maxLen)
}
