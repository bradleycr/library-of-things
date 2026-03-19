"use client"

import Quagga, { type QuaggaJSResultObject, type QuaggaJSStatic } from "@ericblade/quagga2"
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
import { normalizeIsbn, validateIsbnCheckDigit, isBooklandEan13 } from "@/lib/isbn-utils"

export interface IsbnScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (isbn: string) => void
}

/** Brief delay so the first frames aren’t garbage; keep short to avoid “stuck” feeling. */
const CAMERA_WARMUP_MS = 450
/** Two identical valid reads within this window = accept (standard double-decode pattern). */
const STABLE_READ_MS = 2500
const STABLE_READ_COUNT = 2
const MAX_SCANNER_REF_RETRIES = 60

const PREFERRED_CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: { ideal: "environment" },
}

const FALLBACK_CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
}

type ScannerStatus = "idle" | "loading" | "live" | "photo" | "error" | "no-camera"

function validateScannedIsbn(raw: string): { normalized: string } | { error: string } {
  const normalized = normalizeIsbn(raw)
  if (!normalized) {
    return {
      error: "Barcode not recognized as ISBN. Use the 13-digit ISBN barcode on the back of the book, or type it manually.",
    }
  }

  if (!validateIsbnCheckDigit(normalized)) {
    return {
      error: "That ISBN does not pass its check digit. Try again with a clearer image or type it manually.",
    }
  }

  if (normalized.length === 13 && !isBooklandEan13(normalized)) {
    return {
      error: "That barcode is not a book ISBN. Scan the ISBN barcode on the back of the book, usually starting with 978 or 979.",
    }
  }

  return { normalized }
}

/**
 * Dialog that scans an ISBN via live camera or a photo.
 * Uses a tightened Quagga2 configuration for ISBN-only scanning:
 * EAN-13 only, short warmup, **two** matching valid reads (check digit + Bookland),
 * plus manual / photo fallbacks. Parent `onScan` / `onOpenChange` are read from refs
 * so inline handlers don’t restart the camera on every React render.
 */
export function IsbnScannerDialog({
  open,
  onOpenChange,
  onScan,
}: IsbnScannerDialogProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<ScannerStatus>("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [manualIsbn, setManualIsbn] = useState("")
  const [manualError, setManualError] = useState<string | null>(null)
  const [restartNonce, setRestartNonce] = useState(0)
  const quaggaRef = useRef<QuaggaJSStatic | null>(null)
  const detectedHandlerRef = useRef<((data: QuaggaJSResultObject) => void) | null>(null)
  const detectedRef = useRef(false)
  const liveReadyAtRef = useRef(0)
  const lastCodeRef = useRef<string | null>(null)
  const lastCodeAtRef = useRef<number>(0)
  const sameCodeCountRef = useRef<number>(0)

  /** Stable across renders — prevents Quagga `useEffect` from tearing down the stream. */
  const onScanRef = useRef(onScan)
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onScanRef.current = onScan
    onOpenChangeRef.current = onOpenChange
  }, [onScan, onOpenChange])

  const stopScanner = useCallback(async () => {
    const Quagga = quaggaRef.current
    if (!Quagga) return
    try {
      if (detectedHandlerRef.current) {
        Quagga.offDetected(detectedHandlerRef.current)
        detectedHandlerRef.current = null
      } else {
        Quagga.offDetected()
      }
      await Quagga.stop()
      if (typeof Quagga.CameraAccess?.release === "function") {
        await Quagga.CameraAccess.release()
      }
    } catch {
      // ignore
    }
    quaggaRef.current = null
  }, [])

  const finishScan = useCallback((normalized: string) => {
    if (detectedRef.current) return
    detectedRef.current = true
    setStatus("loading")
    setMessage(`ISBN confirmed: ${normalized}. Opening…`)
    void stopScanner().then(() => {
      onScanRef.current(normalized)
      onOpenChangeRef.current(false)
    })
  }, [stopScanner])

  /** Assigned each render; effect only calls this ref so deps stay minimal. */
  const handleDetectedRef = useRef<(result: QuaggaJSResultObject) => void>(() => {})
  handleDetectedRef.current = (result: QuaggaJSResultObject) => {
    if (detectedRef.current) return
    if (Date.now() < liveReadyAtRef.current) return

    const codeResult = result?.codeResult
    const code = codeResult?.code ?? null
    if (!code || codeResult?.format !== "ean_13") {
      return
    }

    const validated = validateScannedIsbn(code)
    if ("error" in validated) {
      setMessage("Center the ISBN barcode in the frame.")
      sameCodeCountRef.current = 0
      lastCodeRef.current = null
      return
    }

    const normalized = validated.normalized
    const now = Date.now()
    const lastCode = lastCodeRef.current
    const lastAt = lastCodeAtRef.current
    if (normalized === lastCode && now - lastAt <= STABLE_READ_MS) {
      sameCodeCountRef.current += 1
    } else {
      sameCodeCountRef.current = 1
    }
    lastCodeRef.current = normalized
    lastCodeAtRef.current = now

    if (sameCodeCountRef.current < STABLE_READ_COUNT) {
      setMessage("Got it — hold steady…")
      return
    }

    finishScan(normalized)
  }

  useEffect(() => {
    if (!open) return

    let cancelled = false
    let rafId: number
    let retries = 0

    const startScanner = async (
      constraints: MediaTrackConstraints,
      allowFallback: boolean,
    ) => {
      if (cancelled || !scannerRef.current) return

      quaggaRef.current = Quagga

      try {
        await new Promise<void>((resolve, reject) => {
          Quagga.init(
            {
              inputStream: {
                type: "LiveStream",
                target: scannerRef.current!,
                constraints,
                willReadFrequently: true,
                area: {
                  top: "22%",
                  right: "8%",
                  left: "8%",
                  bottom: "22%",
                  borderColor: "rgba(255,255,255,0.92)",
                  borderWidth: 2,
                  backgroundColor: "rgba(255,255,255,0.04)",
                },
              },
              decoder: {
                readers: ["ean_reader"],
              },
              locate: true,
              /** Slightly lower rate = less CPU / less AF thrash on some phones. */
              frequency: 6,
              numOfWorkers:
                typeof navigator !== "undefined"
                  ? Math.max(1, Math.min(2, navigator.hardwareConcurrency || 1))
                  : 1,
              locator: {
                halfSample: true,
                patchSize: "small",
              },
              canvas: {
                createOverlay: true,
              },
            },
            (err: Error | null) => {
              if (err) {
                reject(err)
                return
              }
              resolve()
            },
          )
        })
      } catch {
        await stopScanner()
        if (!cancelled && allowFallback) {
          setMessage("Trying your default camera…")
          await startScanner(FALLBACK_CAMERA_CONSTRAINTS, false)
          return
        }
        if (!cancelled) {
          setStatus("no-camera")
          setMessage(
            "Could not open the camera. Allow camera access and try again, or use Take photo / type the ISBN below.",
          )
        }
        return
      }

      if (cancelled) {
        await stopScanner()
        return
      }

      const detectedHandler = (data: QuaggaJSResultObject) => {
        if (cancelled || detectedRef.current) return
        handleDetectedRef.current(data)
      }
      detectedHandlerRef.current = detectedHandler
      Quagga.onDetected(detectedHandler)

      try {
        Quagga.start()
      } catch {
        await stopScanner()
        if (!cancelled && allowFallback) {
          setMessage("Trying your default camera…")
          await startScanner(FALLBACK_CAMERA_CONSTRAINTS, false)
          return
        }
        if (!cancelled) {
          setStatus("no-camera")
          setMessage(
            "Could not start the camera stream. Try again, use Take photo, or type the ISBN below.",
          )
        }
        return
      }

      liveReadyAtRef.current = Date.now() + CAMERA_WARMUP_MS
      setStatus("live")
      setMessage("Point the camera at the barcode on the back of the book.")
    }

    const tryStart = () => {
      if (cancelled) return
      if (!scannerRef.current) {
        retries += 1
        if (retries >= MAX_SCANNER_REF_RETRIES) {
          setStatus("error")
          setMessage("Scanner view not ready. Please close and try again.")
          return
        }
        rafId = requestAnimationFrame(tryStart)
        return
      }

      const hasGetUserMedia =
        typeof navigator !== "undefined" &&
        navigator.mediaDevices != null &&
        typeof navigator.mediaDevices.getUserMedia === "function"

      if (!hasGetUserMedia) {
        setStatus("no-camera")
        setMessage("Camera not supported in this browser. Use Take photo or type the ISBN below.")
        return
      }

      detectedRef.current = false
      liveReadyAtRef.current = 0
      lastCodeRef.current = null
      lastCodeAtRef.current = 0
      sameCodeCountRef.current = 0
      setManualError(null)
      setStatus("loading")
      setMessage("Opening camera…")
      void startScanner(PREFERRED_CAMERA_CONSTRAINTS, true)
    }

    rafId = requestAnimationFrame(tryStart)

    /* Cleanup only. Deps omit onScan/onOpenChange so parent re-renders don’t
       restart Quagga and refocus the camera. */
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      stopScanner()
      setStatus("idle")
      setMessage(null)
    }
  }, [open, restartNonce, stopScanner])

  const handleClose = useCallback(() => {
    void stopScanner()
    setStatus("idle")
    setMessage(null)
    setManualError(null)
    onOpenChange(false)
  }, [onOpenChange, stopScanner])

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

      const url = URL.createObjectURL(file)

      try {
        const result = await Quagga.decodeSingle({
          decoder: { readers: ["ean_reader"] },
          inputStream: {
            size: 1280,
          },
          locate: true,
          src: url,
        })

        const codeResult = result?.codeResult
        if (!codeResult?.code || codeResult.format !== "ean_13") {
          setMessage("No ISBN barcode found. Try a clearer photo of the back of the book.")
          setStatus("error")
          return
        }

        const validated = validateScannedIsbn(codeResult.code)
        if ("error" in validated) {
          setMessage(validated.error)
          setStatus("error")
          return
        }

        finishScan(validated.normalized)
      } catch {
        setMessage("Photo scan failed. Try a clearer image, or type the ISBN below.")
        setStatus("error")
      } finally {
        URL.revokeObjectURL(url)
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-h-[85vh] w-[min(100vw-2rem,28rem)] max-w-[calc(100vw-2rem)] overflow-y-auto"
        aria-describedby="isbn-scanner-description"
      >
        <DialogHeader>
          <DialogTitle>Scan ISBN</DialogTitle>
          <DialogDescription id="isbn-scanner-description">
            Hold the barcode on the back of the book in front of the camera, or
            take a photo. We&apos;ll fill in the ISBN and look up the book.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Keep the viewport mounted so retries reuse the same target cleanly. */}
          {status !== "no-camera" && (
            <div
              ref={scannerRef}
              className="relative aspect-video w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-muted"
              aria-hidden="true"
            >
              {status === "loading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Opening camera…</span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-[8%] top-[22%] bottom-[22%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)]" />
                <div className="absolute inset-x-[14%] top-1/2 h-px -translate-y-1/2 bg-white/75" />
              </div>
            </div>
          )}

          {message && (
            <p
              className={
                status === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {message}
            </p>
          )}

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <Label htmlFor="manual-isbn" className="text-sm font-medium text-foreground">
              Or type the ISBN manually
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
                variant="outline"
                className="shrink-0"
                onClick={handleManualSubmit}
              >
                Use ISBN
              </Button>
            </div>
            {manualError && <p className="mt-2 text-xs text-destructive">{manualError}</p>}
          </div>

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
                  setMessage(null)
                  setRestartNonce((value) => value + 1)
                }}
              >
                Try again
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
