"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { BootstrapPayload } from "@/lib/client/bootstrap"
import { fetchBootstrapData } from "@/lib/client/bootstrap"

/** Max automatic retries on transient failure before giving up. */
const MAX_RETRIES = 3
/** Base delay between retries in ms (doubles each attempt). */
const RETRY_BASE_MS = 1500

/**
 * Fetches the full app dataset from /api/bootstrap with automatic retry
 * on transient errors so pages don't stay stuck showing empty data.
 */
export function useBootstrapData() {
  const [data, setData] = useState<BootstrapPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const retryCount = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await fetchBootstrapData()
      setData(payload)
      setError(null)
      retryCount.current = 0
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load data"
      setError(msg)

      // Auto-retry with exponential backoff on transient failures
      if (retryCount.current < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, retryCount.current)
        retryCount.current += 1
        retryTimer.current = setTimeout(() => {
          refetch()
        }, delay)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)
    }
  }, [refetch])

  return { data, loading, error, refetch }
}
