"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Camera, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { normalizeIsbn } from "@/lib/isbn-utils"

export interface IsbnScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (isbn: string) => void
}

/**
 * Dialog that scans an ISBN via live camera or a photo.
 * Uses Quagga2 for EAN-13 (and EAN-8) decoding; result is normalized
 * and passed to onScan. Manual entry remains on the parent form.
 */
export function IsbnScannerDialog({
  open,
  onOpenChange,
  onScan,
}: IsbnScannerDialogProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<
    "idle" | "loading" | "live" | "photo" | "error" | "no-camera"
  >("idle")
  const [message, setMessage] = useState<string | null>(null)
  const quaggaRef = useRef<typeof import("@ericblade/quagga2").default | null>(
    null,
  )
  const detectedRef = useRef(false)

  const stopScanner = useCallback(async () => {
    const Quagga = quaggaRef.current
    if (!Quagga) return
    try {
      Quagga.stop()
      if (typeof Quagga.CameraAccess?.release === "function") {
        await Quagga.CameraAccess.release()
      }
    } catch {
      // ignore
    }
    quaggaRef.current = null
  }, [])

  const handleDetected = useCallback(
    (code: string) => {
      if (detectedRef.current) return
      const normalized = normalizeIsbn(code)
      if (!normalized) {
        setMessage("Barcode not recognized as ISBN (need 10 or 13 digits). Try again or use Take photo.")
        setStatus("error")
        return
      }
      detectedRef.current = true
      stopScanner().then(() => {
        onScan(normalized)
        onOpenChange(false)
      })
    },
    [onScan, onOpenChange, stopScanner],
  )

  // Start live stream when dialog opens. Wait for ref (portal may mount after first paint).
  useEffect(() => {
    if (!open) return

    let cancelled = false
    let rafId: number
    let retries = 0
    const maxRetries = 30

    const tryStart = () => {
      if (cancelled) return
      if (!scannerRef.current) {
        retries += 1
        if (retries >= maxRetries) {
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
        setMessage("Camera not supported in this browser. Use \"Take photo\" instead.")
        return
      }

      detectedRef.current = false
      setStatus("loading")
      setMessage("Opening camera…")

      import("@ericblade/quagga2").then((mod) => {
        const Quagga = mod.default
        if (cancelled) return
        quaggaRef.current = Quagga

        if (!scannerRef.current) {
          setStatus("error")
          setMessage("Scanner view not ready. Please close and try again.")
          quaggaRef.current = null
          return
        }

        Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target: scannerRef.current,
              constraints: {
                width: 640,
                height: 480,
                facingMode: "environment",
              },
            },
            decoder: {
              readers: ["ean_reader", "ean_8_reader"],
            },
            locate: true,
          },
          (err: Error | null) => {
            if (cancelled) return
            if (err) {
              setStatus("no-camera")
              setMessage(
                "Could not access the camera. Allow camera permission or try \"Take photo\".",
              )
              quaggaRef.current = null
              return
            }
            setStatus("live")
            setMessage("Point your camera at the barcode on the back of the book.")
            Quagga.onDetected((data) => {
              if (cancelled || detectedRef.current) return
              const code = data?.codeResult?.code ?? null
              if (code) handleDetected(code)
            })
            Quagga.start()
          },
        )
      })
    }

    rafId = requestAnimationFrame(tryStart)

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      stopScanner()
      setStatus("idle")
      setMessage(null)
    }
  }, [open, handleDetected, stopScanner])

  const handleClose = useCallback(() => {
    stopScanner()
    setStatus("idle")
    setMessage(null)
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

      setStatus("photo")
      setMessage("Scanning image…")

      const Quagga = await import("@ericblade/quagga2").then((m) => m.default)
      const url = URL.createObjectURL(file)

      Quagga.decodeSingle(
        {
          decoder: { readers: ["ean_reader", "ean_8_reader"] },
          locate: true,
          src: url,
        },
        (result: { codeResult?: { code?: string | null } } | undefined) => {
          URL.revokeObjectURL(url)
          const code = result?.codeResult?.code ?? null
          if (!code) {
            setMessage("No barcode found. Try a clearer photo of the back of the book.")
            setStatus("error")
            return
          }
          const normalized = normalizeIsbn(code)
          if (normalized) {
            onScan(normalized)
            onOpenChange(false)
          } else {
            setMessage("Barcode not recognized as ISBN (need 10 or 13 digits). Try another photo.")
            setStatus("error")
          }
        },
      )
    },
    [onScan, onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto"
        aria-describedby="isbn-scanner-description"
      >
        <DialogHeader>
          <DialogTitle>Scan ISBN</DialogTitle>
          <DialogDescription id="isbn-scanner-description">
            Hold the barcode on the back of the book in front of the camera, or
            take a photo. We&apos;ll fill in the ISBN and look up the book.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Live scanner viewport — Quagga attaches here; keep mounted for error so user can retry */}
          {status !== "no-camera" && (
            <div
              ref={scannerRef}
              className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted"
              aria-hidden="true"
            >
              {status === "loading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Opening camera…</span>
                </div>
              )}
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
            {status === "error" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus("live")
                  setMessage("Point your camera at the barcode on the back of the book.")
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
