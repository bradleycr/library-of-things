"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { BookOpen } from "lucide-react"

interface BookCoverProps {
  /** Primary image URL (external, data URI, or /api/books/[id]/cover). */
  src?: string
  /** Fallback URL used when the primary fails (typically the generated SVG endpoint). */
  fallbackSrc?: string
  title: string
  className?: string
}

/**
 * Resilient book cover image with automatic fallback chain:
 *   1. Try `src` (OpenLibrary URL, data URI, etc.)
 *   2. If it fails or loads as a degenerate blank image → try `fallbackSrc`
 *   3. If both fail → show pastel icon + title placeholder
 *
 * Detects OpenLibrary's "no cover" response (a tiny 1×1 or 43-byte transparent
 * GIF that loads with HTTP 200 but is visually blank).
 */
export function BookCover({ src, fallbackSrc, title, className = "" }: BookCoverProps) {
  const [activeSrc, setActiveSrc] = useState(src)
  const [showPlaceholder, setShowPlaceholder] = useState(false)
  const triedFallback = useRef(false)

  useEffect(() => {
    setActiveSrc(src)
    setShowPlaceholder(false)
    triedFallback.current = false
  }, [src])

  const tryFallback = useCallback(() => {
    if (!triedFallback.current && fallbackSrc) {
      triedFallback.current = true
      setActiveSrc(fallbackSrc)
    } else {
      setShowPlaceholder(true)
    }
  }, [fallbackSrc])

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
        tryFallback()
      }
    },
    [tryFallback],
  )

  if (!activeSrc || showPlaceholder) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-muted p-4 ${className}`}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <BookOpen className="h-6 w-6 text-muted-foreground/60" />
          <span className="line-clamp-3 text-xs font-medium text-muted-foreground">
            {title}
          </span>
        </div>
      </div>
    )
  }

  return (
    <img
      src={activeSrc}
      alt={`Cover of ${title}`}
      className={`h-full w-full object-cover ${className}`}
      onLoad={handleLoad}
      onError={tryFallback}
    />
  )
}
