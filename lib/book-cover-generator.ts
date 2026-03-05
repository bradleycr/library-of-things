/**
 * Deterministic pastel pixel-art gradient cover generator.
 * Same seed (e.g. book id) always produces the same SVG — no external APIs.
 */

/** URL to use for a book cover: real cover if set, otherwise our generated pastel pixel-art. */
export function getBookCoverUrl(book: {
  id: string
  cover_image_url?: string | null
}): string {
  return book.cover_image_url?.trim() || `/api/books/${book.id}/cover`
}

const PASTEL_PALETTE = [
  "#E8D5E0", "#F5D7E3", "#F0E6EF", "#E8E0E8", "#DDD5E8",
  "#D5E0E8", "#D5E8E5", "#E0E8D5", "#E8E5D5", "#E8DDD5",
  "#F5E6D5", "#F0E8E0", "#FFE4EC", "#E4F0FF", "#E4FFF4",
  "#FFF4E4", "#F4E4FF", "#E8F4E4", "#E4E8F4", "#F4E8E4",
  "#B8D4E3", "#D4B8E3", "#E3D4B8", "#B8E3D4", "#E3B8D4",
  "#D4E3B8", "#C9B8E3", "#B8C9E3", "#E3C9B8", "#C9E3B8",
]

/** Simple deterministic hash from string (djb2-style). */
function hash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i)
  }
  return Math.abs(h) >>> 0
}

/** Return deterministic index in [0, max) from seed. */
function pick(seed: number, max: number): number {
  return seed % max
}

/** Second index (using rotated seed) for variety. */
function pick2(seed: number, max: number): number {
  return ((seed >>> 7) + 31) % max
}

/** Wrap text into lines that fit in width (approx chars per line). Single words longer than maxCharsPerLine are truncated with ellipsis. */
function wrapLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const needSpace = current.length > 0 ? 1 : 0
    const fits = current.length + needSpace + word.length <= maxCharsPerLine
    if (fits) {
      current = current ? current + " " + word : word
    } else if (current) {
      lines.push(truncateLine(current, maxCharsPerLine))
      current = word.length <= maxCharsPerLine ? word : word.slice(0, maxCharsPerLine - 3) + "…"
    } else {
      current = word.length <= maxCharsPerLine ? word : word.slice(0, maxCharsPerLine - 3) + "…"
    }
  }
  if (current) lines.push(truncateLine(current, maxCharsPerLine))
  return lines
}

/** Ensure a single line does not exceed max length; add ellipsis if truncated. */
function truncateLine(line: string, maxLen: number): string {
  if (line.length <= maxLen) return line
  return line.slice(0, maxLen - 3) + "…"
}

export interface GenerateBookCoverOptions {
  /** Unique seed (e.g. book id) for deterministic colors/layout. */
  seed: string
  /** Book title to render on the cover (recommended). */
  title?: string
  /** Optional author line below title. */
  author?: string
}

/**
 * Generate a pastel pixel-art gradient SVG for a book cover.
 * Aspect ratio 2:3; same seed always yields the same image.
 * When title (and optional author) are provided, they are drawn on the cover.
 */
export function generateBookCoverSvg(
  seedOrOptions: string | GenerateBookCoverOptions
): string {
  const opts: GenerateBookCoverOptions =
    typeof seedOrOptions === "string"
      ? { seed: seedOrOptions }
      : seedOrOptions
  const { seed, title, author } = opts

  const h = hash(seed)
  const c1 = PASTEL_PALETTE[pick(h, PASTEL_PALETTE.length)]
  const c2 = PASTEL_PALETTE[pick2(h, PASTEL_PALETTE.length)]
  const c3 = PASTEL_PALETTE[pick(h + 1, PASTEL_PALETTE.length)]
  // Off-black for strong contrast on pastel backgrounds (always readable).
  const textColor = "#1a1a1a"

  // Pixel grid: 16x24 blocks for chunky pixel look
  const cols = 16
  const rows = 24
  const cellW = 200 / cols
  const cellH = 300 / rows
  const pixels: string[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellSeed = hash(`${seed}-${row}-${col}`)
      const opacity = 0.12 + (cellSeed % 5) * 0.08
      const color = cellSeed % 3 === 0 ? c1 : cellSeed % 3 === 1 ? c2 : c3
      const x = col * cellW
      const y = row * cellH
      pixels.push(
        `<rect x="${x}" y="${y}" width="${cellW + 0.5}" height="${cellH + 0.5}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`
      )
    }
  }

  const displayTitle = (title || "A Book").slice(0, 72)
  const lines = wrapLines(displayTitle, 18)
  const maxLines = 4
  const titleLines = lines.slice(0, maxLines).map((line) => truncateLine(line, 18))
  const lineHeight = 14
  const titleStartY = 120 - (titleLines.length * lineHeight) / 2
  const titleEls = titleLines
    .map(
      (line, i) =>
        `<text x="100" y="${titleStartY + (i + 1) * lineHeight}" text-anchor="middle" font-size="12" font-weight="700" font-family="system-ui, sans-serif" fill="${textColor}" opacity="0.95">${escapeXml(line)}</text>`
    )
    .join("")
  const authorTrimmed = author?.trim()
  const authorDisplay = authorTrimmed
    ? truncateLine(authorTrimmed.slice(0, 28), 28)
    : ""
  const authorLine =
    authorDisplay
      ? `<text x="100" y="${titleStartY + titleLines.length * lineHeight + 22}" text-anchor="middle" font-size="10" font-family="system-ui, sans-serif" fill="${textColor}" opacity="0.85">${escapeXml(authorDisplay)}</text>`
      : ""

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" width="200" height="300">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c1}"/>
      <stop offset="50%" style="stop-color:${c2}"/>
      <stop offset="100%" style="stop-color:${c3}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="300" fill="url(#bg)"/>
  <g id="pixels">${pixels.join("")}</g>
  <g id="title">${titleEls}${authorLine}</g>
</svg>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
