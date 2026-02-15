import { NextResponse } from "next/server"
import { db } from "@/lib/server/db"

const adjectives = [
  "Clever",
  "Bright",
  "Swift",
  "Curious",
  "Wandering",
  "Bold",
  "Gentle",
  "Keen",
  "Noble",
  "Wise",
  "Calm",
  "Merry",
  "Lucky",
  "Steady",
  "Quiet",
]

const animals = [
  "Raven",
  "Fox",
  "Owl",
  "Deer",
  "Hawk",
  "Wolf",
  "Bear",
  "Hare",
  "Wren",
  "Lynx",
  "Otter",
  "Crane",
  "Robin",
  "Finch",
  "Badger",
]

export async function GET() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const animal = animals[Math.floor(Math.random() * animals.length)]
    const num = Math.floor(Math.random() * 100)
    const display_name = `${adj}${animal}${num}`

    const { rows } = await db.query<{ exists: boolean }>(
      "select exists(select 1 from users where display_name = $1)",
      [display_name]
    )
    if (!rows[0]?.exists) {
      return NextResponse.json({ display_name })
    }
  }

  return NextResponse.json(
    { error: "Could not generate unique pseudonym" },
    { status: 500 }
  )
}
