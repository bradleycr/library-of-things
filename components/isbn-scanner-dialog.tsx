"use client"

/**
 * ISBN Barcode Scanner Dialog
 *
 * Architecture & iOS Crash Prevention:
 * ────────────────────────────────────
 * 1. Zero third-party DOM mutation:
 *    Previously, Quagga2's `LiveStream` appended `<video>` and `<canvas>` nodes
 *    directly into a React-managed container that also rendered conditional React
 *    children (`<Loader2>`, scan guide). When status transitioned, React's
 *    reconciler threw `NotFoundError: The node to be removed is not a child of
 *    this node`, crashing the entire client app on iPhone Safari.
 *    Now, React owns a single `<video>` element (`ref={videoRef}`) and never
 *    shares its DOM subtree with imperative code.
 *
 * 2. Single-stream camera lifecycle:
 *    Opens `navigator.mediaDevices.getUserMedia` once per dialog session with
 *    clean cancellation (`sessionRef`). If the user taps "Take photo", closes
 *    the dialog, or submits manually, all tracks are stopped immediately.
 *
 * 3. Crash-proof photo decoding:
 *    iPhone camera photos are 12MP–48MP with EXIF orientation tags. Passing raw
 *    `blob:` URLs to `Quagga.decodeSingle` caused iOS Safari tab crashes / OOM
 *    and failed on portrait EXIF photos. `decodeIsbnFromPhotoFile` draws the
 *    photo to a small offscreen `<canvas>` first (normalizing EXIF and bounding
 *    memory) and runs native + multi-angle adaptive scanline + Quagga passes.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, ImageUp, Loader2, RefreshCw } from "lucide-react"
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
  decodeImageDataScanlines,
  decodeIsbnFromPhotoFile,
  detectWithNative,
  validateScannedIsbn,
} from "@/lib/isbn-scanner-engine"

export interface IsbnScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (isbn: string) => void
}

/** Brief delay after camera starts so autofocus settles before accepting reads. */
const WARMUP_MS = 350
/** Window for two confirming reads from live video frames. */
const CONFIRM_WINDOW_MS = 3000
/** Number of matching valid frames required during live video scanning. */
const REQUIRED_CONFIRMATIONS = 2
/** Interval between live frame decode ticks (~7.5 fps keeps phones cool). */
const LIVE_POLL_MS = 130

type ScannerStatus = "idle" | "loading" | "live" | "photo" | "error" | "no-camera"

/**
 * Picks a stable rear camera on multi-lens phones (avoids ultra-wide / telephoto
 * when labels are available after permission is granted).
 */
async function pickStableRearDeviceId(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return null
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cameras = devices.filter((d) => d.kind === "videoinput" && d.deviceId)
    if (cameras.length <= 1) return null

    const isBack = (label: string) => /back|rear|environment|rück|arrière/i.test(label)
    const isAuxLens = (label: string) => /ultra|tele|macro|depth|desk/i.test(label)

    const primaryBack = cameras.find((c) => isBack(c.label) && !isAuxLens(c.label))
    if (primaryBack) return primaryBack.deviceId

    const anyBack = cameras.find((c) => isBack(c.label))
    return anyBack?.deviceId ?? null
  } catch {
    return null
  }
}

export function IsbnScannerDialog({
  open,
  onOpenChange,
  onScan,
}: IsbnScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionRef = useRef(0)
  const completedRef = useRef(false)
  const readyAtRef = useRef(0)
  const confirmRef = useRef<{ isbn: string | null; at: number; count: number }>({
    isbn: null,
    at: 0,
    count: 0,
  })

  // Keep parent callbacks in refs so inline functions in parents never restart the camera effect
  const onScanRef = useRef(onScan)
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onScanRef.current = onScan
    onOpenChangeRef.current = onOpenChange
  }, [onScan, onOpenChange])

  const [status, setStatus] = useState<ScannerStatus>("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [manualIsbn, setManualIsbn] = useState("")
  const [manualError, setManualError] = useState<string | null>(null)
  const [restartNonce, setRestartNonce] = useState(0)

  /** Stops any active MediaStream and detaches it from `<video>`. */
  const stopCamera = useCallback(() => {
    const stream = streamRef.current
    streamRef.current = null
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop()
        } catch {
          /* ignore */
        }
      }
    }
    const video = videoRef.current
    if (video) {
      try {
        video.pause()
        video.srcObject = null
      } catch {
        /* ignore */
      }
    }
  }, [])

  /** Completes the scan once, stops the camera, and notifies the parent. */
  const finishWithIsbn = useCallback(
    (isbn: string) => {
      if (completedRef.current) return
      completedRef.current = true
      sessionRef.current += 1
      stopCamera()
      setStatus("loading")
      setMessage(`ISBN found: ${isbn}`)
      onScanRef.current(isbn)
      onOpenChangeRef.current(false)
    },
    [stopCamera],
  )

  /** Records a live candidate ISBN and finishes once confirmed across 2 reads. */
  const handleLiveCandidate = useCallback(
    (isbn: string) => {
      if (completedRef.current || Date.now() < readyAtRef.current) return
      const now = Date.now()
      const prev = confirmRef.current
      if (prev.isbn === isbn && now - prev.at <= CONFIRM_WINDOW_MS) {
        prev.count += 1
      } else {
        prev.isbn = isbn
        prev.count = 1
      }
      prev.at = now

      if (prev.count < REQUIRED_CONFIRMATIONS) {
        setMessage(`Detected ${isbn} — hold steady…`)
        return
      }
      finishWithIsbn(isbn)
    },
    [finishWithIsbn],
  )

  /** Live camera effect — React owns the `<video>` element; no third-party DOM mutation. */
  useEffect(() => {
    if (!open) return

    const session = ++sessionRef.current
    completedRef.current = false
    confirmRef.current = { isbn: null, at: 0, count: 0 }
    setManualError(null)
    setStatus("loading")
    setMessage("Opening camera…")

    let pollTimer: ReturnType<typeof setTimeout> | null = null
    const workCanvas = document.createElement("canvas")
    const workCtx = workCanvas.getContext("2d", { willReadFrequently: true })

    const startLive = async () => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        if (sessionRef.current === session) {
          setStatus("no-camera")
          setMessage("Live camera is unavailable here. Tap “Take photo” or type the ISBN above.")
        }
        return
      }

      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          })
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            })
          } catch {
            stream = null
          }
        }
      }

      if (sessionRef.current !== session) {
        stream?.getTracks().forEach((t) => t.stop())
        return
      }

      if (!stream) {
        setStatus("no-camera")
        setMessage("Camera access was blocked or unavailable. Tap “Take photo” or type the ISBN.")
        return
      }

      // If the device has multiple rear lenses and picked an ultra-wide/macro lens, switch cleanly to primary rear
      const preferredId = await pickStableRearDeviceId()
      if (sessionRef.current !== session) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      const currentSettings = stream.getVideoTracks()[0]?.getSettings?.()
      if (preferredId && currentSettings?.deviceId && currentSettings.deviceId !== preferredId) {
        try {
          const betterStream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: preferredId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
          stream.getTracks().forEach((t) => t.stop())
          stream = betterStream
        } catch {
          /* keep original stream */
        }
      }

      if (sessionRef.current !== session) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stopCamera()
        return
      }

      video.srcObject = stream
      try {
        await video.play()
      } catch {
        /* autoplay with muted+playsinline succeeds once metadata arrives */
      }

      if (sessionRef.current !== session) {
        stopCamera()
        return
      }

      readyAtRef.current = Date.now() + WARMUP_MS
      setStatus("live")
      setMessage("Center the 13-digit barcode on the back of the book.")

      const tick = async () => {
        if (sessionRef.current !== session || completedRef.current) return
        const v = videoRef.current
        if (v && v.readyState >= 2 && v.videoWidth > 32 && v.videoHeight > 32 && workCtx) {
          try {
            // Crop middle band (84% width × 60% height) where the guide box sits
            const vw = v.videoWidth
            const vh = v.videoHeight
            const sx = Math.floor(vw * 0.06)
            const sy = Math.floor(vh * 0.18)
            const sw = Math.floor(vw * 0.88)
            const sh = Math.floor(vh * 0.64)

            const scale = Math.min(1, 960 / Math.max(sw, sh))
            const cw = Math.max(120, Math.round(sw * scale))
            const ch = Math.max(80, Math.round(sh * scale))

            if (workCanvas.width !== cw) workCanvas.width = cw
            if (workCanvas.height !== ch) workCanvas.height = ch

            workCtx.drawImage(v, sx, sy, sw, sh, 0, 0, cw, ch)

            // 1. Native detector if available (fast hardware path on Android / Chrome)
            const nativeIsbn = await detectWithNative(workCanvas)
            if (sessionRef.current !== session || completedRef.current) return
            if (nativeIsbn) {
              handleLiveCandidate(nativeIsbn)
              if (completedRef.current) return
            } else {
              // 2. Pure-JS multi-threshold scanline decoder (works on iPhone Safari)
              const imgData = workCtx.getImageData(0, 0, cw, ch)
              // One pass per frame. A second full sweep was freezing iPhone Safari.
              // Two matching frames still confirm before we accept the ISBN.
              const scannedIsbn = decodeImageDataScanlines(imgData, {
                exhaustive: false,
                requireMultipleLines: false,
              })
              if (scannedIsbn) {
                handleLiveCandidate(scannedIsbn)
                if (completedRef.current) return
              }
            }
          } catch {
            /* transient frame read error — continue polling */
          }
        }
        if (sessionRef.current === session && !completedRef.current) {
          pollTimer = setTimeout(tick, LIVE_POLL_MS)
        }
      }

      pollTimer = setTimeout(tick, LIVE_POLL_MS)
    }

    void startLive()

    return () => {
      sessionRef.current += 1
      if (pollTimer) clearTimeout(pollTimer)
      stopCamera()
    }
  }, [open, restartNonce, handleLiveCandidate, stopCamera])

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) {
      setManualIsbn("")
      setManualError(null)
      setMessage(null)
      setStatus("idle")
    }
  }, [open])

  const handleClose = useCallback(() => {
    sessionRef.current += 1
    stopCamera()
    setStatus("idle")
    setMessage(null)
    setManualError(null)
    onOpenChange(false)
  }, [onOpenChange, stopCamera])

  /**
   * Opens the native camera / photo picker synchronously within the click gesture
   * (required by iOS Safari), while stopping the live stream so the hardware
   * camera is free for the native camera sheet.
   */
  const handleTakePhotoClick = () => {
    sessionRef.current += 1
    stopCamera()
    setManualError(null)
    setStatus("idle")
    setMessage("Take a clear photo of the barcode on the back of the book.")
    cameraInputRef.current?.click()
  }

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (cameraInputRef.current) cameraInputRef.current.value = ""
    if (!file) return

    sessionRef.current += 1
    stopCamera()
    setManualError(null)
    setStatus("photo")
    setMessage("Reading barcode from photo…")

    try {
      const isbn = await decodeIsbnFromPhotoFile(file)
      if (isbn) {
        finishWithIsbn(isbn)
        return
      }
      setStatus("error")
      setMessage(
        "Couldn’t read a 978/979 ISBN barcode from that photo. Try a closer, well-lit shot of the barcode, or type the digits above.",
      )
    } catch {
      setStatus("error")
      setMessage("Couldn’t process that photo. Try another shot or type the ISBN above.")
    }
  }

  const handleManualSubmit = () => {
    const validated = validateScannedIsbn(manualIsbn)
    if (!validated.ok) {
      setManualError(validated.error)
      return
    }
    setManualError(null)
    finishWithIsbn(validated.isbn)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose()
      }}
    >
      <DialogContent
        className="max-h-[85vh] w-[min(100vw-2rem,28rem)] max-w-[calc(100vw-2rem)] overflow-y-auto"
        aria-describedby="isbn-scanner-description"
      >
        <DialogHeader>
          <DialogTitle>Scan ISBN</DialogTitle>
          <DialogDescription id="isbn-scanner-description">
            Point your camera at the 13-digit barcode, snap a photo, or type the ISBN.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Manual ISBN input — always available at the top */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <Label htmlFor="manual-isbn" className="text-sm font-medium">
              Type ISBN
            </Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="manual-isbn"
                inputMode="text"
                autoComplete="off"
                placeholder="9780199678112"
                value={manualIsbn}
                onChange={(e) => {
                  setManualIsbn(e.target.value)
                  if (manualError) setManualError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleManualSubmit()
                  }
                }}
              />
              <Button type="button" className="shrink-0" onClick={handleManualSubmit}>
                Use ISBN
              </Button>
            </div>
            {manualError && <p className="mt-2 text-xs text-destructive">{manualError}</p>}
          </div>

          {/* Live camera viewport — React exclusively owns all child DOM nodes */}
          {status !== "no-camera" && (
            <div
              className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black"
              aria-hidden="true"
            >
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="h-full w-full object-cover"
              />

              {(status === "loading" || status === "photo") && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">
                    {status === "photo" ? "Reading barcode from photo…" : "Opening camera…"}
                  </span>
                </div>
              )}

              {status === "live" && (
                <div className="pointer-events-none absolute inset-0 z-20">
                  <div className="absolute inset-x-[7%] top-[20%] bottom-[20%] rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
                  <div className="absolute inset-x-[12%] top-1/2 h-0.5 -translate-y-1/2 bg-emerald-400/80" />
                </div>
              )}
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
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={handleTakePhotoClick}
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
                className="gap-1.5"
                onClick={() => {
                  setManualError(null)
                  setMessage(null)
                  setRestartNonce((n) => n + 1)
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Live camera
              </Button>
            )}

            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>

        {/* Native camera / photo input */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoFileChange}
          className="hidden"
          aria-label="Take a photo of the ISBN barcode"
        />
      </DialogContent>
    </Dialog>
  )
}
