"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Single add-book flow lives at /add-book (node + Pocket Library / floating).
 * This route redirects so old links and steward dashboard use one canonical page.
 */
export default function StewardAddBookRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/add-book")
  }, [router])
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Redirecting to Add a book…</p>
    </div>
  )
}
