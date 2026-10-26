/**
 * Pure, dependency-safe EAN-13 / Bookland ISBN decoding engine.
 *
 * Why this exists:
 * Previously, `IsbnScannerDialog` let Quagga2 manage the DOM (`target: container`)
 * and decode raw `blob:` URLs via `Quagga.decodeSingle`. That caused three classes
 * of failures on iPhone Safari:
 *   1. React DOM crash (`NotFoundError: removeChild`) when Quagga mutated a
 *      React-managed container node while overlays/video mounted or unmounted.
 *   2. iOS EXIF Crash / Memory Exhaustion when `Quagga.decodeSingle` fetched raw
 *      12MP–48MP camera photos as `ArrayBuffer`s and ran `String.fromCharCode`
 *      loops + 48-megapixel `Uint8Array` allocations without honoring iPhone
 *      portrait EXIF orientation.
 *   3. Low decode rate on slightly tilted, shadowed, or off-center photos because
 *      Quagga's contour locator requires a contiguous patch cluster and fails on
 *      vertical / angled shots or uneven lighting.
 *
 * How this module works:
 *   • All image/video frames are drawn onto small, bounded offscreen `<canvas>`
 *     elements (`<= 1280px`), so browser `drawImage` automatically normalizes
 *     iOS EXIF orientation and keeps memory under a few megabytes.
 *   • Fast path: Native `BarcodeDetector` (when the browser supports `ean_13`).
 *   • Universal scanline engine: Multi-row, multi-threshold (local sliding-window
 *     mean + Otsu global threshold) scanline sweeps using `Quagga.Readers.EANReader`
 *     across horizontal, vertical, and slight diagonal angles — plus a safe
 *     `Quagga.decodeSingle` pass on a small JPEG data URL.
 *   • Every candidate is strictly validated (ISBN length, check digit, Bookland
 *     978/979 prefix, and per-bar error threshold) before being returned.
 */

import Quagga, { type QuaggaJSResultObject } from "@ericblade/quagga2"
import {
  normalizeIsbn,
  validateIsbnCheckDigit,
  isBooklandEan13,
} from "@/lib/isbn-utils"

/* ────────────────────────────────────────────────────────────────────────────
 * Validation
 * ──────────────────────────────────────────────────────────────────────────── */

export type IsbnValidationResult =
  | { ok: true; isbn: string }
  | { ok: false; error: string }

/**
 * Validates that a raw string (from barcode scanner or manual input) is a
 * genuine Bookland ISBN-13 (or valid ISBN-10 for manual input).
 */
export function validateScannedIsbn(raw: string): IsbnValidationResult {
  const isbn = normalizeIsbn(raw)
  if (!isbn) {
    return {
      ok: false,
      error:
        "Not recognized as an ISBN. Use the 13-digit barcode on the back of the book, or type it.",
    }
  }
  if (!validateIsbnCheckDigit(isbn)) {
    return {
      ok: false,
      error: "That ISBN fails its check digit. Try again or type it.",
    }
  }
  if (isbn.length === 13 && !isBooklandEan13(isbn)) {
    return {
      ok: false,
      error:
        "That barcode is not a book ISBN (needs 978 or 979). Scan the ISBN barcode on the book.",
    }
  }
  return { ok: true, isbn }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Native BarcodeDetector (Chromium / Android / modern WebKit if enabled)
 * ──────────────────────────────────────────────────────────────────────────── */

type NativeDetectedCode = { rawValue?: string; format?: string }
type NativeBarcodeDetector = {
  detect: (source: ImageBitmapSource) => Promise<NativeDetectedCode[]>
}
type NativeBarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): NativeBarcodeDetector
  getSupportedFormats?: () => Promise<string[]>
}

let cachedNativeDetector: NativeBarcodeDetector | null | undefined

function getNativeDetector(): NativeBarcodeDetector | null {
  if (typeof window === "undefined") return null
  if (cachedNativeDetector !== undefined) return cachedNativeDetector

  const Ctor = (
    window as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor }
  ).BarcodeDetector
  if (!Ctor) {
    cachedNativeDetector = null
    return null
  }
  try {
    cachedNativeDetector = new Ctor({ formats: ["ean_13"] })
    return cachedNativeDetector
  } catch {
    cachedNativeDetector = null
    return null
  }
}

export async function detectWithNative(
  source: ImageBitmapSource,
): Promise<string | null> {
  const detector = getNativeDetector()
  if (!detector) return null
  try {
    const codes = await detector.detect(source)
    for (const c of codes) {
      if (!c?.rawValue) continue
      if (c.format && c.format !== "ean_13") continue
      const v = validateScannedIsbn(c.rawValue)
      if (v.ok) return v.isbn
    }
  } catch {
    /* Unsupported source or transient frame error */
  }
  return null
}

/* ────────────────────────────────────────────────────────────────────────────
 * Scanline EAN-13 Decoder (pure JS, zero DOM side-effects)
 * ──────────────────────────────────────────────────────────────────────────── */

type EanReaderInstance = {
  decodePattern: (pattern: number[]) => {
    code?: string
    decodedCodes?: Array<{ error?: number }>
  } | null
}

let sharedEanReader: EanReaderInstance | null = null

function getEanReader(): EanReaderInstance | null {
  if (sharedEanReader) return sharedEanReader
  try {
    const Readers = (
      Quagga as unknown as {
        Readers?: { EANReader?: new () => EanReaderInstance }
      }
    ).Readers
    if (Readers?.EANReader) {
      sharedEanReader = new Readers.EANReader()
      return sharedEanReader
    }
  } catch {
    /* ignore */
  }
  return null
}

/**
 * Rejects low-confidence single-row coincidences that happen to pass mod-10
 * checksum when scanning noisy textures.
 */
function hasAcceptableBarError(
  decoded: { decodedCodes?: Array<{ error?: number }> } | null,
  maxAvgError = 0.28,
): boolean {
  if (!decoded?.decodedCodes?.length) return true
  let sum = 0
  let count = 0
  for (const part of decoded.decodedCodes) {
    if (typeof part?.error === "number" && Number.isFinite(part.error)) {
      sum += part.error
      count += 1
    }
  }
  if (count === 0) return true
  return sum / count <= maxAvgError
}

/**
 * Converts a 1D luminance array `gray` (0..255) into a binary bar array (1 = dark bar, 0 = light space)
 * using a local sliding-window average. This handles uneven lighting, curved book spines,
 * and shadows across the barcode much better than a single global threshold.
 */
function binarizeLineAdaptive(
  gray: Uint8Array,
  out: number[],
  windowRadius: number,
  bias: number,
): void {
  const len = gray.length
  // Prefix sum for O(1) window averages
  let running = 0
  for (let i = 0; i < len; i++) {
    running += gray[i]!
    out[i] = running
  }
  for (let i = 0; i < len; i++) {
    const left = Math.max(0, i - windowRadius)
    const right = Math.min(len - 1, i + windowRadius)
    const count = right - left + 1
    const sum = out[right]! - (left > 0 ? out[left - 1]! : 0)
    const mean = sum / count
    // 1 = black bar, 0 = white space (with white quiet-zone padding at edges)
    out[i] = gray[i]! < mean - bias ? 1 : 0
  }
}

/**
 * Global midpoint threshold binarization (fast and clean on sharp, well-lit barcodes).
 */
function binarizeLineGlobal(gray: Uint8Array, out: number[]): void {
  const len = gray.length
  let min = 255
  let max = 0
  for (let i = 0; i < len; i++) {
    const v = gray[i]!
    if (v < min) min = v
    if (v > max) max = v
  }
  if (max - min < 28) {
    // Low contrast line — cannot contain a crisp barcode
    for (let i = 0; i < len; i++) out[i] = 0
    return
  }
  const threshold = (min + max) >> 1
  for (let i = 0; i < len; i++) {
    out[i] = gray[i]! < threshold ? 1 : 0
  }
}

/**
 * Attempts to decode an EAN-13 ISBN from a single 1D grayscale scanline.
 * Pads quiet zones on both ends so barcodes cropped close to the frame edge still decode.
 */
function tryDecodeGrayLine(
  reader: EanReaderInstance,
  gray: Uint8Array,
  scratch: number[],
  padded: number[],
  maxAvgError: number,
): string | null {
  const len = gray.length
  if (len < 95) return null
  const pad = 16

  const tryBinary = (): string | null => {
    for (let i = 0; i < pad; i++) padded[i] = 0
    for (let i = 0; i < len; i++) padded[pad + i] = scratch[i]!
    for (let i = 0; i < pad; i++) padded[pad + len + i] = 0
    padded.length = len + pad * 2

    const res = reader.decodePattern(padded)
    if (!res?.code) return null
    if (!hasAcceptableBarError(res, maxAvgError)) return null
    const v = validateScannedIsbn(res.code)
    return v.ok ? v.isbn : null
  }

  // Pass 1: Adaptive window (radius ~ 1/16 of line width) — best for real-world lighting/shadows
  const radius = Math.max(12, len >> 4)
  binarizeLineAdaptive(gray, scratch, radius, 5)
  const adaptiveHit = tryBinary()
  if (adaptiveHit) return adaptiveHit

  // Pass 2: Tighter adaptive window for smaller barcodes in a wide frame
  const tightRadius = Math.max(8, len >> 5)
  binarizeLineAdaptive(gray, scratch, tightRadius, 7)
  const tightHit = tryBinary()
  if (tightHit) return tightHit

  // Pass 3: Global min/max midpoint threshold
  binarizeLineGlobal(gray, scratch)
  return tryBinary()
}

/**
 * Sweeps horizontal (and optional vertical) scanlines across `ImageData`.
 *
 * For live video frames (`requireTwoConfirmingLines = false` or `true`), this
 * runs in ~2–4ms on a 640×360 ROI and catches barcodes immediately without
 * waiting on Quagga's full-frame contour locator.
 *
 * For still photos (`exhaustive = true`), it sweeps dense horizontal, vertical,
 * and slight diagonal lines, requiring at least 2 independent scanlines to agree
 * on the same ISBN so a single noisy row can never produce a false positive.
 */
export function decodeImageDataScanlines(
  imageData: ImageData,
  options?: {
    exhaustive?: boolean
    requireMultipleLines?: boolean
  },
): string | null {
  const reader = getEanReader()
  if (!reader) return null

  const { data, width, height } = imageData
  if (width < 95 || height < 20) return null

  const exhaustive = options?.exhaustive ?? false
  const requireMultiple = options?.requireMultipleLines ?? exhaustive
  const maxAvgError = exhaustive ? 0.26 : 0.25

  const counts = new Map<string, number>()
  const recordHit = (isbn: string): string | null => {
    if (!requireMultiple) return isbn
    const next = (counts.get(isbn) ?? 0) + 1
    if (next >= 2) return isbn
    counts.set(isbn, next)
    return null
  }

  const maxDim = Math.max(width, height)
  const scratch = new Array<number>(maxDim)
  const padded = new Array<number>(maxDim + 32)

  // 1. Horizontal scanlines (with 3-row vertical box blur to suppress sensor grain)
  const hSteps = exhaustive ? 48 : 22
  const hLine = new Uint8Array(width)
  const yStart = Math.floor(height * 0.06)
  const yEnd = Math.ceil(height * 0.94)
  const ySpan = Math.max(1, yEnd - yStart)

  for (let s = 0; s < hSteps; s++) {
    // Scan from center outward so centered barcodes hit on the very first iterations
    const offset =
      s % 2 === 0 ? Math.floor(s / 2) : -Math.ceil(s / 2)
    const norm = 0.5 + offset / hSteps
    const y = Math.min(
      height - 2,
      Math.max(1, yStart + Math.floor(norm * ySpan)),
    )

    const rowAbove = (y - 1) * width * 4
    const rowMid = y * width * 4
    const rowBelow = (y + 1) * width * 4

    for (let x = 0; x < width; x++) {
      const i0 = rowAbove + x * 4
      const i1 = rowMid + x * 4
      const i2 = rowBelow + x * 4
      // Green-weighted luminance averaged over 3 vertical pixels
      const lum0 = (data[i0]! + (data[i0 + 1]! << 1) + data[i0 + 2]!) >> 2
      const lum1 = (data[i1]! + (data[i1 + 1]! << 1) + data[i1 + 2]!) >> 2
      const lum2 = (data[i2]! + (data[i2 + 1]! << 1) + data[i2 + 2]!) >> 2
      hLine[x] = (lum0 + (lum1 << 1) + lum2) >> 2
    }

    const isbn = tryDecodeGrayLine(reader, hLine, scratch, padded, maxAvgError)
    if (isbn) {
      const confirmed = recordHit(isbn)
      if (confirmed) return confirmed
    }
  }

  // 2. Slight diagonal horizontal scanlines (handles books held at ±6°–14° tilt)
  const slopes = exhaustive ? [-0.18, -0.09, 0.09, 0.18] : [-0.1, 0.1]
  const diagSteps = exhaustive ? 18 : 9
  for (const slope of slopes) {
    for (let s = 0; s < diagSteps; s++) {
      const yCenter = Math.floor(((s + 1) / (diagSteps + 1)) * height)
      let valid = true
      for (let x = 0; x < width; x++) {
        const y = Math.round(yCenter + (x - width / 2) * slope)
        if (y < 0 || y >= height) {
          valid = false
          break
        }
        const idx = (y * width + x) * 4
        hLine[x] = (data[idx]! + (data[idx + 1]! << 1) + data[idx + 2]!) >> 2
      }
      if (!valid) continue
      const isbn = tryDecodeGrayLine(reader, hLine, scratch, padded, maxAvgError)
      if (isbn) {
        const confirmed = recordHit(isbn)
        if (confirmed) return confirmed
      }
    }
  }

  // 3. Vertical scanlines (handles portrait photos where barcode bars run horizontally)
  const vSteps = exhaustive ? 36 : 12
  const vLine = new Uint8Array(height)
  const xStart = Math.floor(width * 0.08)
  const xEnd = Math.ceil(width * 0.92)
  const xSpan = Math.max(1, xEnd - xStart)

  for (let s = 0; s < vSteps; s++) {
    const offset =
      s % 2 === 0 ? Math.floor(s / 2) : -Math.ceil(s / 2)
    const norm = 0.5 + offset / vSteps
    const x = Math.min(
      width - 2,
      Math.max(1, xStart + Math.floor(norm * xSpan)),
    )

    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4
      vLine[y] = (data[idx]! + (data[idx + 1]! << 1) + data[idx + 2]!) >> 2
    }

    const isbn = tryDecodeGrayLine(reader, vLine, scratch, padded, maxAvgError)
    if (isbn) {
      const confirmed = recordHit(isbn)
      if (confirmed) return confirmed
    }
  }

  return null
}

/* ────────────────────────────────────────────────────────────────────────────
 * Still-Photo Decoding Pipeline
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Loads a `File` or `Blob` into an `HTMLImageElement`.
 * Browser `<img>` decoding automatically respects EXIF orientation on iOS Safari.
 */
function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not load image"))
    }
    img.src = url
  })
}

/**
 * Renders `img` (or a normalized crop box `[sx, sy, sw, sh]` in `0..1` coordinates)
 * into a bounded `<canvas>` with max dimension `maxDim`, optionally rotated by
 * `angleDeg` (0, 90, -90).
 */
function renderNormalizedCanvas(
  img: HTMLImageElement,
  maxDim: number,
  crop: [number, number, number, number] = [0, 0, 1, 1],
  angleDeg: 0 | 90 | -90 = 0,
): HTMLCanvasElement | null {
  const natW = img.naturalWidth || img.width
  const natH = img.naturalHeight || img.height
  if (!natW || !natH) return null

  const sx = Math.floor(crop[0] * natW)
  const sy = Math.floor(crop[1] * natH)
  const sw = Math.max(1, Math.floor(crop[2] * natW))
  const sh = Math.max(1, Math.floor(crop[3] * natH))

  const scale = Math.min(1, maxDim / Math.max(sw, sh))
  const drawW = Math.max(1, Math.round(sw * scale))
  const drawH = Math.max(1, Math.round(sh * scale))

  const canvas = document.createElement("canvas")
  if (angleDeg === 90 || angleDeg === -90) {
    canvas.width = drawH
    canvas.height = drawW
  } else {
    canvas.width = drawW
    canvas.height = drawH
  }

  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  if (angleDeg !== 0) {
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((angleDeg * Math.PI) / 180)
    ctx.drawImage(img, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH)
  } else {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, drawW, drawH)
  }

  return canvas
}

/**
 * Safe wrapper around `Quagga.decodeSingle` using a pre-downscaled JPEG data URL
 * (NOT a `blob:` URL, so Quagga skips its buggy EXIF `ArrayBuffer` reader and
 * never allocates a 48MP buffer).
 */
async function decodeCanvasWithQuagga(
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  let dataUrl: string
  try {
    dataUrl = canvas.toDataURL("image/jpeg", 0.9)
  } catch {
    return null
  }

  const passes: Array<{
    size: number
    halfSample: boolean
    patchSize: "small" | "medium" | "large"
  }> = [
    { size: Math.min(1280, Math.max(canvas.width, canvas.height)), halfSample: false, patchSize: "medium" },
    { size: 800, halfSample: true, patchSize: "medium" },
    { size: 1280, halfSample: false, patchSize: "small" },
  ]

  for (const pass of passes) {
    try {
      const result = await new Promise<QuaggaJSResultObject | null>((resolve) => {
        let settled = false
        const done = (val: QuaggaJSResultObject | null) => {
          if (settled) return
          settled = true
          resolve(val)
        }
        const timer = setTimeout(() => done(null), 3500)
        const finish = (val: QuaggaJSResultObject | null) => {
          clearTimeout(timer)
          done(val)
        }
        try {
          const p = Quagga.decodeSingle(
            {
              src: dataUrl,
              numOfWorkers: 0,
              locate: true,
              decoder: { readers: ["ean_reader"] },
              locator: {
                halfSample: pass.halfSample,
                patchSize: pass.patchSize,
              },
              inputStream: {
                type: "ImageStream",
                sequence: false,
                size: pass.size,
              },
            },
            (r) => finish(r ?? null),
          )
          void Promise.resolve(p).then(
            (r) => finish((r as QuaggaJSResultObject | null | undefined) ?? null),
            () => finish(null),
          )
        } catch {
          finish(null)
        }
      })

      const code = result?.codeResult?.code
      if (!code) continue
      if (!hasAcceptableBarError(result.codeResult, 0.26)) continue
      const v = validateScannedIsbn(code)
      if (v.ok) return v.isbn
    } catch {
      /* try next pass */
    }
  }
  return null
}

/**
 * Decodes an ISBN from a user-captured photo `File`.
 *
 * Strategy:
 *   1. Load via `<img>` and immediately downscale to bounded `<canvas>` views
 *      (prevents iOS Safari memory crashes on 12MP–48MP camera images).
 *   2. Try native `BarcodeDetector` on the normalized canvas.
 *   3. Run our multi-threshold scanline sweeps on:
 *      • Full image (1400px)
 *      • Center crop (where users hold the book)
 *      • Lower-half crop (book barcodes are almost always on the bottom third of the back cover)
 *   4. Run `Quagga.decodeSingle` on the safe JPEG data URL (full + 90° rotated for sideways shots).
 */
export async function decodeIsbnFromPhotoFile(file: File): Promise<string | null> {
  const img = await loadImageElement(file)

  const crops: Array<[number, number, number, number]> = [
    [0, 0, 1, 1], // Full frame
    [0.1, 0.15, 0.8, 0.7], // Center 80%×70%
    [0.08, 0.4, 0.84, 0.55], // Bottom half (most common location on back of book)
    [0.18, 0.22, 0.64, 0.56], // Tight center zoom (when user held phone far from small barcode)
  ]

  let fullCanvas: HTMLCanvasElement | null = null

  for (let i = 0; i < crops.length; i++) {
    const canvas = renderNormalizedCanvas(img, 1440, crops[i], 0)
    if (!canvas) continue
    if (i === 0) fullCanvas = canvas

    // Fast path: Native BarcodeDetector on the normalized canvas
    const nativeHit = await detectWithNative(canvas)
    if (nativeHit) return nativeHit

    // Universal path: Multi-threshold scanline sweep (horizontal + diagonal + vertical)
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const scanlineHit = decodeImageDataScanlines(imageData, {
        exhaustive: true,
        requireMultipleLines: true,
      })
      if (scanlineHit) return scanlineHit
    }
  }

  // Fallback: Quagga contour locator on the safe downscaled JPEG data URL
  if (fullCanvas) {
    const quaggaHit = await decodeCanvasWithQuagga(fullCanvas)
    if (quaggaHit) return quaggaHit
  }

  // Final pass: 90°-rotated canvas forQuagga (in case the photo was taken portrait with vertical bars)
  const rotatedCanvas = renderNormalizedCanvas(img, 1280, [0, 0, 1, 1], 90)
  if (rotatedCanvas) {
    const rotatedNative = await detectWithNative(rotatedCanvas)
    if (rotatedNative) return rotatedNative
    const rotatedQuagga = await decodeCanvasWithQuagga(rotatedCanvas)
    if (rotatedQuagga) return rotatedQuagga
  }

  return null
}
