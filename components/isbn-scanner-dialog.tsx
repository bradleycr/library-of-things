"use client"

/**
 * ISBN scanner — keep this lean.
 *
 * Live: BarcodeDetector + getUserMedia when available; Quagga2 otherwise (iPhone Safari).
 * Photo: always available (never blocked by a stuck camera). Native detect(Blob) first,
 * then Quagga decodeSingle. Manual ISBN entry is the fallback.
 */

import Quagga, { type QuaggaJSResultObject } from "@ericblade/quagga2"
import { useCallback, useEffect, useRef, useState } from "react"
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

const WARMUP_MS = 500
const CONFIRM_MS = 2500
const CONFIRM_COUNT = 2
const POLL_MS = 150

type Status = "idle" | "loading" | "live" | "photo" | "error" | "no-camera"

function isIosOrSafari(): boolean {
  if (typeof navigator === "undefined") return true
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/i.test(ua) || (/Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|Edg/i.test(ua))
}

function validateScannedIsbn(raw: string): { ok: true; isbn: string } | { ok: false; error: string } {
  const isbn = normalizeIsbn(raw)
  if (!isbn) {
    return {
      ok: false,
      error:
        "Not recognized as an ISBN. Use the 13-digit barcode on the back of the book, or type it.",
    }
  }
  if (!validateIsbnCheckDigit(isbn)) {
    return { ok: false, error: "That ISBN fails its check digit. Try again or type it." }
  }
  if (isbn.length === 13 && !isBooklandEan13(isbn)) {
    return {
      ok: false,
      error: "That barcode is not a book ISBN (needs 978/979). Scan the ISBN on the book.",
    }
  }
  return { ok: true, isbn }
}

type Detector = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string; format: string }>>
}

function getDetector(): Detector | null {
  if (typeof window === "undefined") return null
  const Ctor = (window as unknown as { BarcodeDetector?: new (o?: { formats?: string[] }) => Detector })
    .BarcodeDetector
  if (!Ctor) return null
  try {
    return new Ctor({ formats: ["ean_13"] })
  } catch {
    return null
  }
}

async function decodeWithNative(source: ImageBitmapSource): Promise<string | null> {
  const detector = getDetector()
  if (!detector) return null
  try {
    const codes = await detector.detect(source)
    for (const code of codes) {
      if (code.format && code.format !== "ean_13") continue
      const validated = validateScannedIsbn(code.rawValue)
      if (validated.ok) return validated.isbn
    }
  } catch {
    /* fall through */
  }
  return null
}

async function decodeWithQuagga(imageUrl: string): Promise<string | null> {
  const sizes = [1600, 1200, 800]
  for (const size of sizes) {
    try {
      const result = await new Promise<QuaggaJSResultObject | null>((resolve) => {
        let settled = false
        const done = (value: QuaggaJSResultObject | null) => {
          if (settled) return
          settled = true
          resolve(value)
        }
        const timer = setTimeout(() => done(null), 8000)
        const finish = (value: QuaggaJSResultObject | null) => {
          clearTimeout(timer)
          done(value)
        }
        try {
          const maybePromise = Quagga.decodeSingle(
            {
              src: imageUrl,
              numOfWorkers: 0,
              locate: true,
              decoder: { readers: ["ean_reader"] },
              locator: { patchSize: "medium", halfSample: false },
              inputStream: {
                type: "ImageStream",
                size,
                singleChannel: false,
              },
            },
            (r) => finish(r ?? null),
          )
          // Quagga2 may resolve via callback and/or Promise — first wins.
          void Promise.resolve(maybePromise).then(
            (r) => finish((r as QuaggaJSResultObject | null | undefined) ?? null),
            () => finish(null),
          )
        } catch {
          finish(null)
        }
      })
      const code = result?.codeResult?.code
      if (!code) continue
      const validated = validateScannedIsbn(code)
      if (validated.ok) return validated.isbn
    } catch {
      /* try next size */
    }
  }
  return null
}

async function decodePhotoFile(file: File): Promise<string | null> {
  // Chrome/Android: Blob is a valid ImageBitmapSource.
  const fromNative = await decodeWithNative(file)
  if (fromNative) return fromNative

  // Load as an <img> for a second native attempt (some engines prefer elements).
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("image load failed"))
      el.src = objectUrl
    })
    const fromImg = await decodeWithNative(img)
    if (fromImg) return fromImg
    return await decodeWithQuagga(objectUrl)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function IsbnScannerDialog({ open, onOpenChange, onScan }: IsbnScannerDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const stopLiveRef = useRef<(() => Promise<void>) | null>(null)
  const sessionRef = useRef(0)
  const detectedRef = useRef(false)
  const readyAtRef = useRef(0)
  const confirmRef = useRef<{ code: string | null; at: number; count: number }>({
    code: null,
    at: 0,
    count: 0,
  })

  const onScanRef = useRef(onScan)
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onScanRef.current = onScan
    onOpenChangeRef.current = onOpenChange
  }, [onScan, onOpenChange])

  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [manualIsbn, setManualIsbn] = useState("")
  const [manualError, setManualError] = useState<string | null>(null)
  const [restartNonce, setRestartNonce] = useState(0)

  const stopLive = useCallback(async () => {
    const stop = stopLiveRef.current
    stopLiveRef.current = null
    if (stop) await stop()
  }, [])

  const finish = useCallback(
    (isbn: string) => {
      if (detectedRef.current) return
      detectedRef.current = true
      setStatus("loading")
      setMessage(`ISBN: ${isbn}`)
      void stopLive().finally(() => {
        onScanRef.current(isbn)
        onOpenChangeRef.current(false)
      })
    },
    [stopLive],
  )

  const onCandidate = useCallback(
    (raw: string) => {
      if (detectedRef.current || Date.now() < readyAtRef.current) return
      const validated = validateScannedIsbn(raw)
      if (!validated.ok) {
        if (confirmRef.current.code == null) {
          setMessage("Center the ISBN barcode in the frame.")
        }
        return
      }
      const now = Date.now()
      if (confirmRef.current.code === validated.isbn && now - confirmRef.current.at <= CONFIRM_MS) {
        confirmRef.current.count += 1
      } else {
        confirmRef.current = { code: validated.isbn, at: now, count: 1 }
      }
      confirmRef.current.at = now
      if (confirmRef.current.count < CONFIRM_COUNT) {
        setMessage("Got it — hold steady…")
        return
      }
      finish(validated.isbn)
    },
    [finish],
  )

  const startNativeLive = useCallback(
    async (container: HTMLDivElement, session: number): Promise<(() => Promise<void>) | null> => {
      const detector = getDetector()
      if (!detector || isIosOrSafari()) return null

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          })
        } catch {
          return null
        }
      }
      if (sessionRef.current !== session) {
        stream.getTracks().forEach((t) => t.stop())
        return null
      }

      const video = document.createElement("video")
      video.setAttribute("playsinline", "true")
      video.playsInline = true
      video.muted = true
      video.autoplay = true
      video.className = "absolute inset-0 h-full w-full object-cover"
      container.replaceChildren(video)
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        /* ignore */
      }

      let running = true
      let timer: ReturnType<typeof setTimeout> | null = null
      const tick = async () => {
        if (!running || sessionRef.current !== session) return
        if (video.readyState >= 2 && video.videoWidth > 0) {
          try {
            const codes = await detector.detect(video)
            for (const code of codes) {
              if (code.format && code.format !== "ean_13") continue
              onCandidate(code.rawValue)
              if (detectedRef.current) return
            }
          } catch {
            /* keep polling */
          }
        }
        if (running) timer = setTimeout(tick, POLL_MS)
      }
      timer = setTimeout(tick, POLL_MS)

      return async () => {
        running = false
        if (timer) clearTimeout(timer)
        video.pause()
        video.srcObject = null
        stream.getTracks().forEach((t) => t.stop())
        video.remove()
      }
    },
    [onCandidate],
  )

  const startQuaggaLive = useCallback(
    async (container: HTMLDivElement, session: number): Promise<(() => Promise<void>) | null> => {
      let started = false
      const onDetected = (data: QuaggaJSResultObject) => {
        const code = data?.codeResult?.code
        if (!code || data.codeResult?.format !== "ean_13") return
        onCandidate(code)
      }

      try {
        await new Promise<void>((resolve, reject) => {
          Quagga.init(
            {
              inputStream: {
                type: "LiveStream",
                target: container,
                constraints: {
                  facingMode: { ideal: "environment" },
                  width: { ideal: 640 },
                  height: { ideal: 480 },
                },
                willReadFrequently: true,
              },
              decoder: { readers: ["ean_reader"] },
              locate: true,
              frequency: 8,
              numOfWorkers: 0,
              locator: { halfSample: true, patchSize: "medium" },
            },
            (err) => (err ? reject(err) : resolve()),
          )
        })
      } catch {
        return null
      }

      if (sessionRef.current !== session) {
        try {
          await Quagga.stop()
        } catch {
          /* ignore */
        }
        return null
      }

      try {
        Quagga.onDetected(onDetected)
        Quagga.start()
        started = true
      } catch {
        return null
      }

      return async () => {
        try {
          Quagga.offDetected(onDetected)
        } catch {
          /* ignore */
        }
        if (started) {
          try {
            await Quagga.stop()
          } catch {
            /* ignore */
          }
        }
        try {
          await Quagga.CameraAccess?.release?.()
        } catch {
          /* ignore */
        }
        container.replaceChildren()
      }
    },
    [onCandidate],
  )

  useEffect(() => {
    if (!open) return

    const session = ++sessionRef.current
    detectedRef.current = false
    confirmRef.current = { code: null, at: 0, count: 0 }
    setManualError(null)
    setStatus("loading")
    setMessage("Opening camera…")

    let cancelled = false
    let raf = 0

    const launch = async () => {
      const container = containerRef.current
      if (!container || cancelled || sessionRef.current !== session) return

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("no-camera")
        setMessage("Camera not available. Use Take photo or type the ISBN.")
        return
      }

      container.replaceChildren()
      let stop =
        (await startNativeLive(container, session)) ??
        (await startQuaggaLive(container, session))

      if (cancelled || sessionRef.current !== session) {
        await stop?.()
        return
      }
      if (!stop) {
        setStatus("no-camera")
        setMessage("Could not open the camera. Use Take photo or type the ISBN.")
        return
      }

      stopLiveRef.current = stop
      readyAtRef.current = Date.now() + WARMUP_MS
      setStatus("live")
      setMessage("Point at the ISBN barcode on the back of the book.")
    }

    let tries = 0
    const wait = () => {
      if (cancelled || sessionRef.current !== session) return
      if (!containerRef.current) {
        tries += 1
        if (tries > 90) {
          setStatus("no-camera")
          setMessage("Scanner view not ready. Use Take photo or type the ISBN.")
          return
        }
        raf = requestAnimationFrame(wait)
        return
      }
      void launch()
    }
    raf = requestAnimationFrame(wait)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      sessionRef.current += 1
      const stop = stopLiveRef.current
      stopLiveRef.current = null
      void stop?.()
    }
  }, [open, restartNonce, startNativeLive, startQuaggaLive])

  useEffect(() => {
    if (!open) {
      setManualIsbn("")
      setManualError(null)
      setMessage(null)
      setStatus("idle")
    }
  }, [open])

  const handleClose = () => {
    sessionRef.current += 1
    void stopLive()
    setStatus("idle")
    setMessage(null)
    onOpenChange(false)
  }

  const handlePhotoClick = () => {
    // Cancel stuck camera starts, but open the file picker in this same user gesture.
    // iOS Safari ignores input.click() after an await — that broke Take photo.
    sessionRef.current += 1
    setStatus("idle")
    setMessage("Choose or take a photo of the ISBN barcode.")
    photoInputRef.current?.click()
    void stopLive()
  }

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (photoInputRef.current) photoInputRef.current.value = ""
    if (!file) return

    setManualError(null)
    setStatus("photo")
    setMessage("Scanning photo…")

    try {
      // Ensure Quagga live singleton is fully released before decodeSingle.
      await stopLive()
      try {
        await Quagga.stop()
      } catch {
        /* already stopped */
      }

      const isbn = await decodePhotoFile(file)
      if (isbn) {
        finish(isbn)
        return
      }
      setStatus("error")
      setMessage("No ISBN found in that photo. Try a clearer shot of the back barcode, or type it.")
    } catch {
      setStatus("error")
      setMessage("Photo scan failed. Try again or type the ISBN.")
    }
  }

  const handleManual = () => {
    const validated = validateScannedIsbn(manualIsbn)
    if (!validated.ok) {
      setManualError(validated.error)
      return
    }
    setManualError(null)
    finish(validated.isbn)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose() }}>
      <DialogContent
        className="max-h-[85vh] w-[min(100vw-2rem,28rem)] max-w-[calc(100vw-2rem)] overflow-y-auto"
        aria-describedby="isbn-scanner-description"
      >
        <DialogHeader>
          <DialogTitle>Scan ISBN</DialogTitle>
          <DialogDescription id="isbn-scanner-description">
            Type the ISBN, use the camera, or take a photo of the barcode.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <Label htmlFor="manual-isbn" className="text-sm font-medium">
              Type ISBN
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleManual()
                  }
                }}
              />
              <Button type="button" className="shrink-0" onClick={handleManual}>
                Use ISBN
              </Button>
            </div>
            {manualError && <p className="mt-2 text-xs text-destructive">{manualError}</p>}
          </div>

          {status !== "no-camera" && (
            <div
              ref={containerRef}
              className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted"
              aria-hidden
            >
              {(status === "loading" || status === "photo") && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">
                    {status === "photo" ? "Scanning photo…" : "Opening camera…"}
                  </span>
                </div>
              )}
              {status === "live" && (
                <div className="pointer-events-none absolute inset-0 z-20">
                  <div className="absolute inset-x-[8%] top-[22%] bottom-[22%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)]" />
                </div>
              )}
            </div>
          )}

          {message && (
            <p
              role="status"
              aria-live="polite"
              className={status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
            >
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={handlePhotoClick}
              disabled={status === "photo"}
            >
              <Camera className="h-4 w-4" />
              Take photo
            </Button>
            {(status === "error" || status === "no-camera" || status === "idle") && open && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setManualError(null)
                  setMessage(null)
                  setRestartNonce((n) => n + 1)
                }}
              >
                Try camera again
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
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
