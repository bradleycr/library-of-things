"use client"

import { useRef, useState, useCallback } from "react"
import { Camera, RotateCcw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { compressBookCoverPhoto } from "@/lib/image-utils"

interface CoverPhotoCaptureProps {
  onCapture: (dataUri: string) => void
  onCancel: () => void
}

/**
 * Camera / file-picker for book cover photos.
 * Shows framing guidance before capture, then a compressed preview.
 * Returns a JPEG data URI small enough to store alongside the book record.
 */
export function CoverPhotoCapture({ onCapture, onCancel }: CoverPhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setCompressing(true)
    try {
      const dataUri = await compressBookCoverPhoto(file)
      setPreview(dataUri)
    } catch {
      setError("Couldn't process that image — try another photo.")
    } finally {
      setCompressing(false)
    }
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void handleFile(file)
      if (inputRef.current) inputRef.current.value = ""
    },
    [handleFile],
  )

  const handleRetake = () => {
    setPreview(null)
    setError(null)
    inputRef.current?.click()
  }

  const handleConfirm = () => {
    if (preview) onCapture(preview)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Hidden file input — accepts images, hints camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
        aria-label="Take or choose a book cover photo"
      />

      {preview ? (
        /* ── Preview state ─────────────────────────────────── */
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="relative mx-auto h-44 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-muted shadow-sm sm:mx-0">
            <img
              src={preview}
              alt="Cover preview"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Looking good? Confirm to use this photo, or retake.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleConfirm}
                className="gap-1.5"
              >
                Use this photo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetake}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retake
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Guidance + capture state ──────────────────────── */
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center">
          {compressing ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
          ) : (
            <>
              {/* Framing guide illustration */}
              <div className="relative flex h-28 w-20 items-center justify-center rounded-md border-2 border-dashed border-primary/30 bg-white/60">
                <Camera className="h-7 w-7 text-primary/40" />
                {/* Corner brackets */}
                <span className="absolute -left-1 -top-1 h-3 w-3 border-l-2 border-t-2 border-primary/50 rounded-tl-sm" />
                <span className="absolute -right-1 -top-1 h-3 w-3 border-r-2 border-t-2 border-primary/50 rounded-tr-sm" />
                <span className="absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2 border-primary/50 rounded-bl-sm" />
                <span className="absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-primary/50 rounded-br-sm" />
              </div>

              <div className="max-w-xs space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Photograph the cover
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Fill the frame with the front cover — keep it centered, 
                  minimize background, and make sure the title is legible.
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => inputRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                Open Camera
              </Button>
            </>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}
