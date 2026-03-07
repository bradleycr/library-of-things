import "server-only"

import { NextRequest, NextResponse } from "next/server"

/**
 * Validates that a value is a usable text ID (non-empty string, max 255 chars).
 * IDs in this app are `text` columns — may be UUIDs or short codes like "n1".
 * Actual existence is enforced by DB foreign key constraints.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 255
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
  /** Short notes attached to ledger events (returns, steward edits). Kept small so history stays readable and layout-safe. */
  ledgerNote: 200,
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
