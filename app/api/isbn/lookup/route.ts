import { NextRequest, NextResponse } from "next/server"
import { isbn10To13, normalizeIsbn } from "@/lib/isbn-utils"
import type { IsbnMetadata, IsbnMetadataLookupResponse } from "@/lib/isbn-lookup"

const LOOKUP_TIMEOUT_MS = 6_000
const JSON_HEADERS = { "Cache-Control": "no-store" }

type OpenLibraryEdition = {
  title?: string
  by_statement?: string
  edition_name?: string
  publish_date?: string
  authors?: { key: string }[]
  works?: { key: string }[]
}

type OpenLibraryAuthor = { name?: string }

type OpenLibraryWork = {
  description?: string | { value?: string }
}

type OpenLibrarySearchResponse = {
  docs?: Array<{
    title?: string
    author_name?: string[]
    first_publish_year?: number
  }>
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

function buildCandidateIsbns(normalizedIsbn: string): string[] {
  const candidates = new Set<string>([normalizedIsbn])
  if (normalizedIsbn.length === 10) {
    const as13 = isbn10To13(normalizedIsbn)
    if (as13) candidates.add(as13)
  }
  return Array.from(candidates)
}

function coverImageUrlFor(normalizedIsbn: string) {
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(normalizedIsbn)}-L.jpg`
}

async function fetchEditionMetadata(normalizedIsbn: string): Promise<IsbnMetadata | null> {
  const edition = await fetchJson<OpenLibraryEdition>(
    `https://openlibrary.org/isbn/${encodeURIComponent(normalizedIsbn)}.json`,
  )
  if (!edition?.title) return null

  let author = edition.by_statement?.trim() || undefined
  if (!author && edition.authors?.[0]?.key) {
    const authorData = await fetchJson<OpenLibraryAuthor>(
      `https://openlibrary.org${edition.authors[0].key}.json`,
    )
    author = authorData?.name?.trim() || undefined
  }

  let description: string | undefined
  if (edition.works?.[0]?.key) {
    const work = await fetchJson<OpenLibraryWork>(
      `https://openlibrary.org${edition.works[0].key}.json`,
    )
    const rawDescription =
      typeof work?.description === "string"
        ? work.description
        : work?.description?.value
    if (rawDescription?.trim()) {
      description = rawDescription.trim().slice(0, 3000)
    }
  }

  return {
    isbn: normalizedIsbn,
    title: edition.title.trim(),
    author,
    edition: edition.edition_name?.trim() || edition.publish_date?.trim() || undefined,
    description,
    coverImageUrl: coverImageUrlFor(normalizedIsbn),
  }
}

async function fetchSearchMetadata(normalizedIsbn: string): Promise<IsbnMetadata | null> {
  const search = await fetchJson<OpenLibrarySearchResponse>(
    `https://openlibrary.org/search.json?isbn=${encodeURIComponent(normalizedIsbn)}&limit=1`,
  )
  const doc = search?.docs?.[0]
  if (!doc?.title) return null

  return {
    isbn: normalizedIsbn,
    title: doc.title.trim(),
    author: doc.author_name?.[0]?.trim() || undefined,
    edition:
      typeof doc.first_publish_year === "number"
        ? String(doc.first_publish_year)
        : undefined,
    coverImageUrl: coverImageUrlFor(normalizedIsbn),
  }
}

export async function GET(request: NextRequest) {
  try {
    const rawIsbn = request.nextUrl.searchParams.get("isbn") ?? ""
    const normalizedIsbn = normalizeIsbn(rawIsbn)

    if (!normalizedIsbn) {
      return NextResponse.json(
        { error: "Invalid ISBN" },
        { status: 400, headers: JSON_HEADERS },
      )
    }

    for (const candidate of buildCandidateIsbns(normalizedIsbn)) {
      const metadata =
        (await fetchEditionMetadata(candidate)) ??
        (await fetchSearchMetadata(candidate))

      if (metadata) {
        const body: IsbnMetadataLookupResponse = { metadata }
        return NextResponse.json(body, { headers: JSON_HEADERS })
      }
    }

    return NextResponse.json(
      { error: "No book metadata found for this ISBN" },
      { status: 404, headers: JSON_HEADERS },
    )
  } catch (error) {
    console.error("[api/isbn/lookup]", error)
    return NextResponse.json(
      { error: "ISBN lookup failed" },
      { status: 500, headers: JSON_HEADERS },
    )
  }
}
