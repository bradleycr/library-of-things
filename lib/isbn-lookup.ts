import type { Book } from "@/lib/types"

export type IsbnMetadata = {
  isbn: string
  title: string
  author?: string
  edition?: string
  description?: string
  coverImageUrl?: string
}

export type IsbnMetadataLookupResponse = {
  metadata: IsbnMetadata
}

export type BooksByIsbnResponse = {
  books: Book[]
}
