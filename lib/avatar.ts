/**
 * Generate a deterministic pixel art avatar URL using DiceBear API.
 * The avatar is unique to each user based on their ID, ensuring consistency.
 *
 * @param seed - Unique identifier (user ID or display name) to generate avatar
 * @param style - DiceBear style (default: pixel-art for retro pixel avatars)
 * @returns URL to the generated avatar SVG
 */
export function getAvatarUrl(
  seed: string,
  style: "pixel-art" | "bottts" | "identicon" | "avataaars" | "fun-emoji" = "pixel-art"
): string {
  // Use DiceBear v9 API for deterministic pixel art avatars
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`
}

/**
 * Resolve the avatar seed for a user. We use the user id only so avatars are
 * deterministic and no avatar-related data is stored in the database.
 * (Regenerate-avatar feature is disabled; could be re-added later with a stored seed if desired.)
 */
export function getAvatarSeed(user: { id: string }): string {
  return user.id
}

/**
 * Get initials from a display name for fallback text.
 * Takes first letter of first two capitalized words or segments.
 */
export function getInitials(displayName: string): string {
  return displayName
    .split(/(?=[A-Z0-9])/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
}
