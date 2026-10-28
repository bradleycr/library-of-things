/**
 * How to finish a return at the Foresight Berlin node.
 *
 * Marking returned in the app is only half of it. The physical book or
 * keycard still has to land at CIC reception, or in the after-hours locker.
 */

export type DropoffItemWord = "book" | "card" | "books" | "cards"

export const BERLIN_DROPOFF = {
  place: "CIC Berlin",
  reception:
    "Leave it with reception at CIC Berlin during reception hours.",
  locker:
    "After reception hours, put it in the return locker in the node office (bottom right of the lockers).",
  photoOptional:
    "You can take a photo of it in the locker so a steward can see it was left. Photos are kept for a short time.",
} as const

/** Short steps for emails and on-screen return prompts. */
export function berlinDropoffSteps(item: DropoffItemWord = "card"): string[] {
  const thing =
    item === "books" || item === "book"
      ? item === "books"
        ? "the books"
        : "the book"
      : item === "cards"
        ? "the cards"
        : "the card"
  return [
    `Mark ${thing} returned in the app (scan the QR or NFC tag).`,
    BERLIN_DROPOFF.reception,
    BERLIN_DROPOFF.locker,
  ]
}

/** One paragraph for letters that already listed the titles. */
export function berlinDropoffProse(item: DropoffItemWord = "book"): string {
  const thing = item === "books" || item === "cards" ? "them" : "it"
  return [
    `After you mark ${thing} returned in the app, leave ${thing} with reception at CIC Berlin.`,
    "If reception is closed, put it in the return locker in the node office (bottom right of the lockers).",
  ].join(" ")
}
