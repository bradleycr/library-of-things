/**
 * Client-side image compression for book cover photos.
 * Resizes and compresses to a small JPEG data URI suitable for DB storage.
 *
 * Target: ~20–40 KB as base64 — lightweight enough to live in a text column
 * without taxing the bootstrap payload or Supabase free-tier limits.
 */

const MAX_WIDTH = 400
const MAX_HEIGHT = 600
const JPEG_QUALITY = 0.65

/**
 * Compress an image File/Blob into a small JPEG data URI.
 * Resolves with `data:image/jpeg;base64,...` ready for <img src> or DB storage.
 */
export function compressBookCoverPhoto(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { width, height } = fitDimensions(
        img.naturalWidth,
        img.naturalHeight,
        MAX_WIDTH,
        MAX_HEIGHT,
      )

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Canvas context unavailable"))
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img, 0, 0, width, height)

      const dataUri = canvas.toDataURL("image/jpeg", JPEG_QUALITY)
      resolve(dataUri)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to load image"))
    }

    img.src = url
  })
}

/** Scale dimensions to fit within max bounds, preserving aspect ratio. */
function fitDimensions(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  let w = srcW
  let h = srcH

  if (w > maxW) {
    h = Math.round(h * (maxW / w))
    w = maxW
  }
  if (h > maxH) {
    w = Math.round(w * (maxH / h))
    h = maxH
  }

  return { width: Math.max(1, w), height: Math.max(1, h) }
}
