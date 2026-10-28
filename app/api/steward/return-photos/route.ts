import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { listReturnDropoffPhotos } from "@/lib/server/return-dropoff-photos"
import { getStewardCookieName, verifyStewardToken } from "@/lib/server/steward-auth"

export const dynamic = "force-dynamic"

/** Steward-only: recent physical drop-off photos (auto-expire after two weeks). */
export async function GET() {
  const token = (await cookies()).get(getStewardCookieName())?.value
  if (!token || !verifyStewardToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const photos = await listReturnDropoffPhotos()
    return NextResponse.json({
      photos: photos.map((photo) => ({
        id: photo.id,
        book_id: photo.book_id,
        book_title: photo.book_title,
        asset_number: photo.asset_number,
        image_data: photo.image_data,
        created_at: photo.created_at,
        expires_at: photo.expires_at,
      })),
    })
  } catch (error) {
    console.error("[return-photos]", error)
    return NextResponse.json({ error: "Could not load drop-off photos." }, { status: 500 })
  }
}
