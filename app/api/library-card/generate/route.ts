import { NextRequest, NextResponse } from "next/server"
import {
  createUserForLibraryCard,
  createLibraryCard,
  hashPin,
  normalizePinForAuth,
} from "@/lib/server/repositories"

const ADJECTIVES = [
  "Clever", "Bright", "Swift", "Curious", "Wandering", "Bold", "Gentle",
  "Keen", "Noble", "Wise", "Calm", "Merry", "Lucky", "Steady", "Quiet",
]

const ANIMALS = [
  "Raven", "Fox", "Owl", "Deer", "Hawk", "Wolf", "Bear", "Hare", "Wren",
  "Lynx", "Otter", "Crane", "Robin", "Finch", "Badger",
]

function generatePseudonym(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  const num = Math.floor(Math.random() * 100)
  return `${adj}${animal}${num}`
}

function generateCardNumber(): string {
  const segments = []
  for (let i = 0; i < 4; i++) {
    segments.push(Math.floor(Math.random() * 10000).toString().padStart(4, "0"))
  }
  return segments.join(" ")
}

function generatePIN(): string {
  return Math.floor(Math.random() * 10000).toString().padStart(4, "0")
}

const MAX_RETRIES = 4

function isUniqueViolation(err: unknown): boolean {
  const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : ""
  return code === "23505"
}

export async function POST(request: NextRequest) {
  let pseudonym = generatePseudonym()
  try {
    const body = await request.json().catch(() => null)
    if (body?.display_name && typeof body.display_name === "string") {
      const trimmed = body.display_name.trim()
      if (trimmed.length > 0) pseudonym = trimmed
    }
  } catch {
    // use random pseudonym
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        pseudonym = generatePseudonym()
      }
      const pin = generatePIN()
      const cardNumber = generateCardNumber()

      const user = await createUserForLibraryCard(pseudonym)
      const { id: cardId } = await createLibraryCard({
        cardNumber,
        pinHash: hashPin(normalizePinForAuth(pin)),
        userId: user.id,
        pseudonym,
      })

      const card = {
        id: cardId,
        card_number: cardNumber,
        pin,
        pseudonym,
        user_id: user.id,
        created_at: new Date().toISOString(),
        access_count: 0,
        status: "active" as const,
      }

      return NextResponse.json({ success: true, card })
    } catch (error) {
      if (isUniqueViolation(error)) {
        console.warn("Library card generate: unique conflict, retrying with new pseudonym/card", error)
        continue
      }
      console.error("Library card generation error:", error)
      return NextResponse.json(
        { success: false, error: "Failed to generate library card" },
        { status: 500 }
      )
    }
  }

  return NextResponse.json(
    { success: false, error: "Could not generate a unique card. Please try again." },
    { status: 500 }
  )
}