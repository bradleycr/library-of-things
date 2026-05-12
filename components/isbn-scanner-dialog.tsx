"use client"

/* ────────────────────────────────────────────────────────────────────────────
 * ISBN Scanner Dialog
 * ────────────────────────────────────────────────────────────────────────────
 * Two-engine, single-UI scanner that resolves to a normalized, validated ISBN.
 *
 *   1. Native engine  — `BarcodeDetector` (iOS 17+ Safari, Chrome, Edge).
 *      Fast, accurate, hardware-accelerated. Used whenever available.
 *
 *   2. Quagga2 engine — pure-JS EAN-13 decoder.
 *      Used on browsers without `BarcodeDetector` (older iOS, Firefox).
 *      Conservative config (no advanced focus modes, modest resolution) so
 *      iPhones don't trigger macro-mode auto-switching between back cameras.
 *
 * Safety nets shared by both engines and the photo path:
 *   • EAN-13 only
 *   • Check-digit validation
 *   • Bookland prefix (978/979) — refuses non-book product barcodes
 *   • Double-read confirmation within a short window — refuses single misreads
 *
 * Parent `onScan` / `onOpenChange` are read through refs so re-renders never
 * tear down the live camera mid-scan.
 * ──────────────────────────────────────────────────────────────────────────── */

import Quagga, {
  type QuaggaJSResultObject,
  type QuaggaJSStatic,
} from "@ericblade/quagga2"
import { useRef, useState, useEffect, useCallback } from "react"
import { Camera, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  normalizeIsbn,
  validateIsbnCheckDigit,
  isBooklandEan13,
} from "@/lib/isbn-utils"

export interface IsbnScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (isbn: string) => void
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tunables
 * ──────────────────────────────────────────────────────────────────────────── */

/** Short delay so first frames (autofocus / exposure) don't burn confirmations. */
const CAMERA_WARMUP_MS = 600
/** Two identical valid reads within this window = accept. */
const STABLE_READ_MS = 4000
const STABLE_READ_COUNT = 2
/** Native engine polling cap. We don't need 60 Hz; this keeps phones cool. */
const NATIVE_SCAN_INTERVAL_MS = 120
/** Retry budget for waiting on the container ref to mount. */
const MAX_SCANNER_REF_RETRIES = 60

type ScannerStatus =
  | "idle"
  | "loading"
  | "live"
  | "photo"
  | "error"
  | "no-camera"

type EngineMode = "native" | "quagga" | null

/* ────────────────────────────────────────────────────────────────────────────
 * Validation
 * ──────────────────────────────────────────────────────────────────────────── */

function validateScannedIsbn(
  raw: string,
): { normalized: string } | { error: string } {
  const normalized = normalizeIsbn(raw)
  if (!normalized) {
    return {
      error:
        "Barcode not recognized as ISBN. Use the 13-digit ISBN barcode on the back of the book, or type it manually.",
    }
  }

  if (!validateIsbnCheckDigit(normalized)) {
    return {
      error:
        "That ISBN does not pass its check digit. Try again with a clearer image or type it manually.",
    }
  }

  if (normalized.length === 13 && !isBooklandEan13(normalized)) {
    return {
      error:
        "That barcode is not a book ISBN. Scan the ISBN barcode on the back of the book, usually starting with 978 or 979.",
    }
  }

  return { normalized }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Native BarcodeDetector — type shim + capability probe
 * ──────────────────────────────────────────────────────────────────────────── */

type DetectedBarcode = { rawValue: string; format: string }
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource | ImageBitmap) => Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = {
  new (init?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector
  return ctor ?? null
}

async function nativeDetectorSupportsEan13(): Promise<boolean> {
  const ctor = getBarcodeDetectorCtor()
  if (!ctor) return false
  try {
    const formats = (await ctor.getSupportedFormats?.()) ?? []
    return formats.includes("ean_13")
  } catch {
    return false
  }
}

function createNativeDetector(): BarcodeDetectorLike | null {
  const ctor = getBarcodeDetectorCtor()
  if (!ctor) return null
  try {
    return new ctor({ formats: ["ean_13"] })
  } catch {
    return null
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Camera helpers
 *
 * Notes on the constraint design:
 *   • No `advanced: [{ focusMode: "continuous" }]`. On iOS Safari (especially
 *     iPhone 13 Pro+) this hint nudges the system into macro/back-camera
 *     auto-switching, which manifests as the camera "switching cameras" and
 *     hunting focus — exactly what users were reporting.
 *   • Modest resolution biases iOS toward the main wide camera, which has the
 *     best close-focus behavior for book barcodes (~10–20 cm).
 * ──────────────────────────────────────────────────────────────────────────── */

const PREFERRED_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: { ideal: "environment" },
}

const QUAGGA_CONSTRAINTS: MediaTrackConstraints = {
  // Matches the historically reliable config; smaller frames = less CPU,
  // less AF thrash, and bias toward the main back camera on iPhones.
  width: { ideal: 640 },
  height: { ideal: 480 },
  facingMode: { ideal: "environment" },
}

const FALLBACK_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
}

/**
 * After camera permission is granted, try to lock onto a "stable" back camera
 * (not labelled as ultra-wide / macro / telephoto). This prevents iOS from
 * silently switching cameras when subject distance changes.
 */
async function pickStableBackCameraId(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return null
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cams = devices.filter((d) => d.kind === "videoinput")
    if (cams.length <= 1) return null

    const isBack = (label: string) => /back|rear|environment/i.test(label)
    const isExotic = (label: string) => /ultra|macro|tele/i.test(label)

    const stable = cams.find((c) => isBack(c.label) && !isExotic(c.label))
    if (stable?.deviceId) return stable.deviceId

    const anyBack = cams.find((c) => isBack(c.label))
    return anyBack?.deviceId ?? null
  } catch {
    return null
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Photo decode (native first, Quagga multi-pass fallback)
 * ──────────────────────────────────────────────────────────────────────────── */

async function decodePhotoNative(file: File): Promise<string | null> {
  const detector = createNativeDetector()
  if (!detector) return null
  try {
    const bitmap = await createImageBitmap(file)
    try {
      const codes = await detector.detect(bitmap)
      for (const code of codes) {
        if (code.format !== "ean_13") continue
        const validated = validateScannedIsbn(code.rawValue)
        if (!("error" in validated)) return validated.normalized
      }
    } finally {
      ;(bitmap as ImageBitmap & { close?: () => void }).close?.()
    }
  } catch {
    return null
  }
  return null
}

async function decodePhotoQuagga(imageUrl: string): Promise<string | null> {
  const passes: Array<{
    size: number
    locator?: { halfSample: boolean; patchSize: string }
  }> = [
    { size: 1280, locator: { halfSample: false, patchSize: "medium" } },
    { size: 800, locator: { halfSample: true, patchSize: "large" } },
    { size: 1280 },
  ]

  for (const pass of passes) {
    try {
      const result = await Quagga.decodeSingle({
        decoder: { readers: ["ean_reader"] },
        inputStream: { size: pass.size },
        locate: true,
        ...(pass.locator ? { locator: pass.locator } : {}),
        src: imageUrl,
      })

      const code = result?.codeResult?.code
      if (!code) continue

      const validated = validateScannedIsbn(code)
      if ("error" in validated) continue

      return validated.normalized
    } catch {
      continue
    }
  }

  return null
}

async function decodePhoto(file: File): Promise<string | null> {
  const native = await decodePhotoNative(file)
  if (native) return native

  const url = URL.createObjectURL(file)
  try {
    return await decodePhotoQuagga(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Stable-read accumulator — shared between engines
 * ──────────────────────────────────────────────────────────────────────────── */

interface StableReadState {
  lastCode: string | null
  lastAt: number
  count: number
}

function pushStableRead(state: StableReadState, normalized: string): boolean {
  const now = Date.now()
  if (
    state.lastCode === normalized &&
    now - state.lastAt <= STABLE_READ_MS
  ) {
    state.count += 1
  } else {
    state.count = 1
  }
  state.lastCode = normalized
  state.lastAt = now
  return state.count >= STABLE_READ_COUNT
}

function freshStableState(): StableReadState {
  return { lastCode: null, lastAt: 0, count: 0 }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────────────── */

export function IsbnScannerDialog({
  open,
  onOpenChange,
  onScan,
}: IsbnScannerDialogProps) {
  /* ---- DOM refs ---- */
  const containerRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  /** Video element used by the native engine. The Quagga engine creates its own. */
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null)

  /* ---- UI state ---- */
  const [status, setStatus] = useState<ScannerStatus>("idle")
  const [engineMode, setEngineMode] = useState<EngineMode>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [manualIsbn, setManualIsbn] = useState("")
  const [manualError, setManualError] = useState<string | null>(null)
  const [restartNonce, setRestartNonce] = useState(0)

  /* ---- Live-scan refs (don't trigger re-render) ---- */
  const stopLiveRef = useRef<(() => Promise<void>) | null>(null)
  const detectedRef = useRef(false)
  const readyAtRef = useRef(0)
  const stableRef = useRef<StableReadState>(freshStableState())

  /* ---- Parent callback refs — keep effect deps minimal ---- */
  const onScanRef = useRef(onScan)
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onScanRef.current = onScan
    onOpenChangeRef.current = onOpenChange
  }, [onScan, onOpenChange])

  /* -----------------------------------------------------------------
   * Finish a scan: stop the engine, return the ISBN, close the dialog.
   * Re-entrancy is blocked by `detectedRef`.
   * ----------------------------------------------------------------- */
  const finishScan = useCallback((normalized: string) => {
    if (detectedRef.current) return
    detectedRef.current = true
    setStatus("loading")
    setMessage(`ISBN confirmed: ${normalized}. Opening…`)
    const stop = stopLiveRef.current
    stopLiveRef.current = null
    const completion = () => {
      onScanRef.current(normalized)
      onOpenChangeRef.current(false)
    }
    if (stop) {
      void stop().finally(completion)
    } else {
      completion()
    }
  }, [])

  /* -----------------------------------------------------------------
   * Frame handler — used by both engines via this closure.
   * Holds the gate during warmup; runs validation + double-read logic.
   * ----------------------------------------------------------------- */
  const handleCandidate = useCallback(
    (raw: string) => {
      if (detectedRef.current) return
      if (Date.now() < readyAtRef.current) return

      const validated = validateScannedIsbn(raw)
      if ("error" in validated) {
        // Don't reset stable counter — invalid frames between valid reads are
        // common during autofocus hunting.
        if (stableRef.current.lastCode === null) {
          setMessage("Center the ISBN barcode in the frame.")
        }
        return
      }

      const confirmed = pushStableRead(stableRef.current, validated.normalized)
      if (!confirmed) {
        setMessage("Got it — hold steady…")
        return
      }
      finishScan(validated.normalized)
    },
    [finishScan],
  )

  /* -----------------------------------------------------------------
   * Native engine — getUserMedia + BarcodeDetector polling loop.
   * Returns a stop function, or null if it could not start.
   * ----------------------------------------------------------------- */
  const startNativeEngine = useCallback(
    async (container: HTMLDivElement): Promise<(() => Promise<void>) | null> => {
      const detector = createNativeDetector()
      if (!detector) return null

      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: PREFERRED_CONSTRAINTS,
          audio: false,
        })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: FALLBACK_CONSTRAINTS,
            audio: false,
          })
        } catch {
          return null
        }
      }

      // Best-effort: pin to a non-macro back camera to prevent iOS from
      // auto-switching cameras when subject distance changes.
      const stableId = await pickStableBackCameraId()
      if (stableId) {
        try {
          const swap = await navigator.mediaDevices.getUserMedia({
            video: { ...PREFERRED_CONSTRAINTS, deviceId: { exact: stableId } },
            audio: false,
          })
          stream.getTracks().forEach((t) => t.stop())
          stream = swap
        } catch {
          // ignore — keep original stream
        }
      }

      const video = document.createElement("video")
      video.setAttribute("playsinline", "true")
      video.setAttribute("muted", "true")
      video.playsInline = true
      video.muted = true
      video.autoplay = true
      video.className =
        "absolute inset-0 h-full w-full object-cover"
      container.appendChild(video)
      nativeVideoRef.current = video
      video.srcObject = stream

      try {
        await video.play()
      } catch {
        // Some browsers throw AbortError on quick close; safe to ignore.
      }

      let running = true
      let pollTimer: ReturnType<typeof setTimeout> | null = null

      const tick = async () => {
        if (!running) return
        if (video.readyState >= 2 && video.videoWidth > 0) {
          try {
            const codes = await detector.detect(video)
            for (const code of codes) {
              if (code.format !== "ean_13") continue
              handleCandidate(code.rawValue)
              if (detectedRef.current) return
            }
          } catch {
            // Transient detect errors are normal (e.g. resize). Keep polling.
          }
        }
        if (running) {
          pollTimer = setTimeout(tick, NATIVE_SCAN_INTERVAL_MS)
        }
      }

      pollTimer = setTimeout(tick, NATIVE_SCAN_INTERVAL_MS)

      return async () => {
        running = false
        if (pollTimer !== null) clearTimeout(pollTimer)
        try {
          video.pause()
          video.srcObject = null
        } catch {
          // ignore
        }
        try {
          stream?.getTracks().forEach((t) => t.stop())
        } catch {
          // ignore
        }
        try {
          if (nativeVideoRef.current === video) {
            nativeVideoRef.current = null
          }
          video.remove()
        } catch {
          // ignore
        }
      }
    },
    [handleCandidate],
  )

  /* -----------------------------------------------------------------
   * Quagga2 engine — fallback for browsers without BarcodeDetector.
   * Conservative config: no advanced focus mode, modest resolution,
   * default-locator patch size, no `area` constraint.
   * ----------------------------------------------------------------- */
  const startQuaggaEngine = useCallback(
    async (
      container: HTMLDivElement,
      constraints: MediaTrackConstraints,
      allowFallback: boolean,
    ): Promise<(() => Promise<void>) | null> => {
      const Q: QuaggaJSStatic = Quagga
      let started = false
      let detachDetected: (() => void) | null = null

      const detectedHandler = (data: QuaggaJSResultObject) => {
        const code = data?.codeResult?.code ?? null
        if (!code || data.codeResult?.format !== "ean_13") return
        handleCandidate(code)
      }

      try {
        await new Promise<void>((resolve, reject) => {
          Q.init(
            {
              inputStream: {
                type: "LiveStream",
                target: container,
                constraints,
                willReadFrequently: true,
              },
              decoder: { readers: ["ean_reader"] },
              locate: true,
              frequency: 6,
              numOfWorkers:
                typeof navigator !== "undefined"
                  ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2))
                  : 2,
              locator: {
                halfSample: true,
                patchSize: "medium",
              },
            },
            (err: Error | null) => (err ? reject(err) : resolve()),
          )
        })
      } catch {
        if (allowFallback) {
          return startQuaggaEngine(container, FALLBACK_CONSTRAINTS, false)
        }
        return null
      }

      try {
        Q.onDetected(detectedHandler)
        detachDetected = () => Q.offDetected(detectedHandler)
        Q.start()
        started = true
      } catch {
        try {
          detachDetected?.()
        } catch {
          // ignore
        }
        return null
      }

      return async () => {
        try {
          detachDetected?.()
        } catch {
          // ignore
        }
        if (started) {
          try {
            await Q.stop()
          } catch {
            // ignore
          }
        }
        try {
          if (typeof Q.CameraAccess?.release === "function") {
            await Q.CameraAccess.release()
          }
        } catch {
          // ignore
        }
      }
    },
    [handleCandidate],
  )

  /* -----------------------------------------------------------------
   * Lifecycle: when the dialog opens, start the best available engine.
   * Keep dependency list small so parent re-renders don't tear down.
   * ----------------------------------------------------------------- */
  useEffect(() => {
    if (!open) return

    let cancelled = false
    let rafId = 0
    let retries = 0

    const launch = async () => {
      const container = containerRef.current
      if (!container || cancelled) return

      detectedRef.current = false
      readyAtRef.current = 0
      stableRef.current = freshStableState()
      setManualError(null)
      setStatus("loading")
      setMessage("Opening camera…")

      const hasGUM =
        typeof navigator !== "undefined" &&
        navigator.mediaDevices != null &&
        typeof navigator.mediaDevices.getUserMedia === "function"

      if (!hasGUM) {
        setStatus("no-camera")
        setEngineMode(null)
        setMessage(
          "Camera not supported in this browser. Use Take photo or type the ISBN below.",
        )
        return
      }

      // Try native first.
      const canNative = await nativeDetectorSupportsEan13()
      if (cancelled) return

      let stop: (() => Promise<void>) | null = null
      let usedEngine: EngineMode = null

      if (canNative) {
        setEngineMode("native")
        stop = await startNativeEngine(container)
        if (stop) usedEngine = "native"
      }

      if (!stop && !cancelled) {
        setEngineMode("quagga")
        stop = await startQuaggaEngine(container, QUAGGA_CONSTRAINTS, true)
        if (stop) usedEngine = "quagga"
      }

      if (cancelled) {
        await stop?.()
        return
      }

      if (!stop) {
        setStatus("no-camera")
        setEngineMode(null)
        setMessage(
          "Could not open the camera. Allow camera access and try again, or use Take photo / type the ISBN below.",
        )
        return
      }

      stopLiveRef.current = stop
      readyAtRef.current = Date.now() + CAMERA_WARMUP_MS
      setStatus("live")
      setEngineMode(usedEngine)
      setMessage("Point the camera at the barcode on the back of the book.")
    }

    const waitForRef = () => {
      if (cancelled) return
      if (!containerRef.current) {
        retries += 1
        if (retries >= MAX_SCANNER_REF_RETRIES) {
          setStatus("error")
          setMessage("Scanner view not ready. Please close and try again.")
          return
        }
        rafId = requestAnimationFrame(waitForRef)
        return
      }
      void launch()
    }

    rafId = requestAnimationFrame(waitForRef)

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      const stop = stopLiveRef.current
      stopLiveRef.current = null
      void stop?.()
      setStatus("idle")
      setEngineMode(null)
      setMessage(null)
    }
  }, [open, restartNonce, startNativeEngine, startQuaggaEngine])

  /* -----------------------------------------------------------------
   * UI handlers
   * ----------------------------------------------------------------- */
  const handleClose = useCallback(() => {
    const stop = stopLiveRef.current
    stopLiveRef.current = null
    void stop?.()
    setStatus("idle")
    setEngineMode(null)
    setMessage(null)
    setManualError(null)
    onOpenChange(false)
  }, [onOpenChange])

  const handlePhotoClick = () => {
    photoInputRef.current?.click()
  }

  const handlePhotoFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (photoInputRef.current) photoInputRef.current.value = ""
      if (!file) return

      setManualError(null)
      setStatus("photo")
      setMessage("Scanning image…")

      try {
        const decoded = await decodePhoto(file)
        if (decoded) {
          finishScan(decoded)
        } else {
          setMessage(
            "No ISBN barcode found. Try a clearer photo of the back of the book, or type the ISBN below.",
          )
          setStatus("error")
        }
      } catch {
        setMessage("Photo scan failed. Try a clearer image, or type the ISBN below.")
        setStatus("error")
      }
    },
    [finishScan],
  )

  const handleManualSubmit = useCallback(() => {
    const validated = validateScannedIsbn(manualIsbn)
    if ("error" in validated) {
      setManualError(validated.error)
      return
    }
    setManualError(null)
    finishScan(validated.normalized)
  }, [finishScan, manualIsbn])

  useEffect(() => {
    if (!open) {
      setManualIsbn("")
      setManualError(null)
    }
  }, [open])

  /* -----------------------------------------------------------------
   * Render
   * ----------------------------------------------------------------- */
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-h-[85vh] w-[min(100vw-2rem,28rem)] max-w-[calc(100vw-2rem)] overflow-y-auto"
        aria-describedby="isbn-scanner-description"
      >
        <DialogHeader>
          <DialogTitle>Scan ISBN</DialogTitle>
          <DialogDescription id="isbn-scanner-description">
            Type the ISBN if you already know it — otherwise use the camera.
            On phones, <strong>Take photo</strong> is the most reliable.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Manual ISBN entry — first to nudge the easiest path. */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <Label
              htmlFor="manual-isbn"
              className="text-sm font-medium text-foreground"
            >
              Type ISBN (often on the copyright page too)
            </Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="manual-isbn"
                inputMode="text"
                placeholder="9780199678112"
                value={manualIsbn}
                onChange={(e) => {
                  setManualIsbn(e.target.value)
                  if (manualError) setManualError(null)
                }}
              />
              <Button
                type="button"
                variant="default"
                className="shrink-0"
                onClick={handleManualSubmit}
              >
                Use ISBN
              </Button>
            </div>
            {manualError && (
              <p className="mt-2 text-xs text-destructive">{manualError}</p>
            )}
          </div>

          {/* Scanner viewport — same container for native <video> and Quagga's video. */}
          {status !== "no-camera" && (
            <div
              ref={containerRef}
              className="relative aspect-video w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-muted"
              aria-hidden="true"
            >
              {status === "loading" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Opening camera…</span>
                </div>
              )}

              {/* Visual scan-area guide — purely informative; both engines scan the full frame. */}
              <div className="pointer-events-none absolute inset-0 z-20">
                <div className="absolute inset-x-[8%] top-[22%] bottom-[22%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)]" />
                <div className="absolute inset-x-[14%] top-1/2 h-px -translate-y-1/2 bg-white/75" />
              </div>
            </div>
          )}

          {message && (
            <p
              role="status"
              aria-live="polite"
              className={
                status === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {message}
              {engineMode === "quagga" && status === "live" && (
                <span className="ml-1 opacity-70">
                  (using fallback scanner — Take photo if it doesn't pick up)
                </span>
              )}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={handlePhotoClick}
              disabled={status === "loading"}
            >
              <Camera className="h-4 w-4" />
              Take photo
            </Button>
            {(status === "error" || status === "no-camera") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setManualError(null)
                  setStatus("idle")
                  setEngineMode(null)
                  setMessage(null)
                  setRestartNonce((v) => v + 1)
                }}
              >
                Try camera again
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
            >
              Cancel
            </Button>
          </div>
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoFile}
          className="hidden"
          aria-label="Choose or take a photo of the barcode"
        />
      </DialogContent>
    </Dialog>
  )
}
