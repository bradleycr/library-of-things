"use client"

import { useState, useEffect, useCallback, useRef, type SyntheticEvent } from "react"
import { BookOpen } from "lucide-react"
import { NanowheelSpinner } from "@/components/nanowheel-spinner"

interface BookCoverProps {
  /** Primary image URL (external, data URI, or /api/books/[id]/cover). */
  src?: string
  /** Fallback URL used when the primary fails (typically the generated SVG endpoint). */
  fallbackSrc?: string
  title: string
  className?: string
  /**
   * The cover someone opened on purpose (the book page). It starts immediately.
   * Grids stay lazy so a shelf of Open Library files doesn't all compete.
   */
  priority?: boolean
}

/**
 * Resilient book cover image with automatic fallback chain:
 *   1. Try `src` (OpenLibrary URL, data URI, etc.)
 *   2. If it fails or loads as a degenerate blank image → try `fallbackSrc`
 *   3. If both fail → show pastel icon + title placeholder
 *
 * While a file is still on its way, the Foresight wheel holds the frame
 * so a slow cover reads as loading rather than as a blank card.
 *
 * Detects OpenLibrary's "no cover" response (a tiny 1×1 or 43-byte transparent
 * GIF that loads with HTTP 200 but is visually blank).
 */
export function BookCover({
  src,
  fallbackSrc,
  title,
  className = "",
  priority = false,
}: BookCoverProps) {
  const [activeSrc, setActiveSrc] = useState(src)
  const [showPlaceholder, setShowPlaceholder] = useState(false)
  const [pending, setPending] = useState(true)
  const triedFallback = useRef(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setActiveSrc(src)
    setShowPlaceholder(false)
    setPending(Boolean(src))
    triedFallback.current = false
  }, [src])

  // A cover already in cache can finish before React paints the spinner.
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 1) setPending(false)
  }, [activeSrc])

  const tryFallback = useCallback(() => {
    if (!triedFallback.current && fallbackSrc && fallbackSrc !== activeSrc) {
      triedFallback.current = true
      setPending(true)
      setActiveSrc(fallbackSrc)
    } else {
      setPending(false)
      setShowPlaceholder(true)
    }
  }, [activeSrc, fallbackSrc])

  const handleLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget
      if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
        tryFallback()
        return
      }
      setPending(false)
    },
    [tryFallback],
  )

  if (!activeSrc || showPlaceholder) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-muted p-4 ${className}`}>
        <div className="flex flex-col items-center gap-2 text-center">
          <BookOpen className="h-6 w-6 text-muted-foreground/60" />
          <span className="line-clamp-3 text-xs font-medium text-muted-foreground">{title}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative h-full w-full overflow-hidden bg-muted ${className}`}>
      {pending ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          role="status"
          aria-label={`Loading cover of ${title}`}
        >
          <NanowheelSpinner className="size-7 sm:size-8" />
        </div>
      ) : null}
      <img
        ref={imgRef}
        src={activeSrc}
        alt={`Cover of ${title}`}
        className={`h-full w-full object-cover transition-opacity duration-200 ${pending ? "opacity-0" : "opacity-100"}`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={handleLoad}
        onError={tryFallback}
      />
    </div>
  )
}
