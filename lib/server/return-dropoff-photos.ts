import "server-only"

import crypto from "crypto"
import { resilientQuery } from "@/lib/server/db"
import { sanitizeCoverUrl } from "@/lib/server/sanitize-cover-url"

/** How long a locker / reception proof photo stays available to stewards. */
export const DROPOFF_PHOTO_TTL_DAYS = 14

export type ReturnDropoffPhoto = {
  id: string
  book_id: string
  book_title: string | null
  asset_number: number | null
  image_data: string
  created_at: Date
  expires_at: Date
}

function expiresAt(from = new Date()): Date {
  return new Date(from.getTime() + DROPOFF_PHOTO_TTL_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * Store a compressed JPEG data URI of the physical drop-off.
 * Rejects anything that is not a small image data URI.
 */
export async function saveReturnDropoffPhoto(input: {
  bookId: string
  imageData: string
  loanEventId?: string | null
}): Promise<{ id: string } | null> {
  const image = sanitizeCoverUrl(input.imageData)
  if (!image.startsWith("data:image/")) return null

  const id = crypto.randomUUID()
  await resilientQuery(
    `insert into return_dropoff_photos (id, book_id, loan_event_id, image_data, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [id, input.bookId, input.loanEventId ?? null, image, expiresAt()]
  )
  return { id }
}

/** Steward inbox: unexpired drop-off photos, newest first. */
export async function listReturnDropoffPhotos(limit = 40): Promise<ReturnDropoffPhoto[]> {
  const { rows } = await resilientQuery<ReturnDropoffPhoto>(
    `select p.id, p.book_id, b.title as book_title, b.asset_number,
            p.image_data, p.created_at, p.expires_at
       from return_dropoff_photos p
       left join books b on b.id = p.book_id
      where p.expires_at > now()
      order by p.created_at desc
      limit $1`,
    [Math.min(Math.max(limit, 1), 100)]
  )
  return rows
}

/** Morning job: drop proofs that have aged out. */
export async function purgeExpiredDropoffPhotos(): Promise<number> {
  const result = await resilientQuery(`delete from return_dropoff_photos where expires_at <= now()`)
  return result.rowCount ?? 0
}
