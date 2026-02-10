"use client"

import { useState } from "react"
import { BookOpen } from "lucide-react"

interface BookCoverProps {
  src?: string
  title: string
  className?: string
}

export function BookCover({ src, title, className = "" }: BookCoverProps) {
  const [hasError, setHasError] = useState(false)

  if (!src || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted p-4 ${className}`}
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
      src={src || "/placeholder.svg"}
      alt={`Cover of ${title}`}
      className={`h-full w-full object-cover ${className}`}
      onError={() => setHasError(true)}
    />
  )
}
