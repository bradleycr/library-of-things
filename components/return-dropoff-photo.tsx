"use client"

/**
 * Optional proof that a keycard (or book) was left at reception or in the locker.
 * Same compress path as cover photos — small JPEG data URI, camera-first on phones.
 */

import { useCallback, useRef, useState } from "react"
import { Camera, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { compressBookCoverPhoto } from "@/lib/image-utils"
import { BERLIN_DROPOFF } from "@/lib/berlin-dropoff"

type Props = {
  value: string | null
  onChange: (dataUri: string | null) => void
  disabled?: boolean
}

export function ReturnDropoffPhoto({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      setBusy(true)
      try {
        const dataUri = await compressBookCoverPhoto(file)
        onChange(dataUri)
      } catch {
        setError("Couldn’t use that photo. Try again.")
      } finally {
        setBusy(false)
      }
    },
    [onChange]
  )

  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 px-3 py-3">
      <p className="text-sm leading-relaxed text-foreground">{BERLIN_DROPOFF.photoOptional}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled || busy}
        aria-label="Photo of the card in the return locker"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
          if (inputRef.current) inputRef.current.value = ""
        }}
      />

      {value ? (
        <div className="flex items-start gap-3">
          <img
            src={value}
            alt="Drop-off photo"
            className="h-24 w-24 shrink-0 rounded-lg border border-border object-cover"
          />
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Attached. Stewards can see this for two weeks.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={disabled || busy}
                onClick={() => inputRef.current?.click()}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retake
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                disabled={disabled || busy}
                onClick={() => onChange(null)}
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-2"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
          {busy ? "Preparing photo…" : "Add drop-off photo"}
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
