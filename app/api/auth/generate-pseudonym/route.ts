import { NextResponse } from "next/server"

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
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const animal = animals[Math.floor(Math.random() * animals.length)]
  const num = Math.floor(Math.random() * 100)

  const display_name = `${adj}${animal}${num}`

  // TODO: Check uniqueness in Supabase users table
  // If not unique, regenerate

  return NextResponse.json({ display_name })
}
