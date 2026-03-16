"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { BootstrapPayload } from "@/lib/client/bootstrap"
import { fetchBootstrapData } from "@/lib/client/bootstrap"

const MAX_RETRIES = 4
const RETRY_BASE_MS = 2_000

/**
 * How long (ms) we trust a cached payload before going back to the server.
 * 60 s matches the ISR revalidation on the homepage, so users see fresh data
 * without hammering the DB on every in-app navigation.
 */
const STALE_MS = 60_000

/* ─── Module-level cache shared across all hook instances ─── */
let cachedPayload: BootstrapPayload | null = null
let cachedAt = 0

function getCachedIfFresh(): BootstrapPayload | null {
  if (!cachedPayload) return null
  if (Date.now() - cachedAt > STALE_MS) return null
  return cachedPayload
}

/**
 * Fetches the full app dataset from `/api/bootstrap` with:
 *
 * - **60 s in-memory cache** so page navigations don't re-fetch.
 * - **Exponential-backoff retry** (up to 4 attempts) on transient errors.
 * - **Stale-while-error**: if a refetch fails but we already have data,
 *   the previous payload stays visible (no flash to empty).
 */
export function useBootstrapData() {
  const [data, setData] = useState<BootstrapPayload | null>(() => getCachedIfFresh())
  const [loading, setLoading] = useState(!getCachedIfFresh())
  const [error, setError] = useState<string | null>(null)
  const retryCount = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refetch = useCallback(async (skipCache = false): Promise<BootstrapPayload | null> => {
    if (!skipCache) {
      const cached = getCachedIfFresh()
      if (cached) {
        setData(cached)
        setLoading(false)
        setError(null)
        return cached
      }
    }

    setLoading(true)

    try {
      const payload = await fetchBootstrapData()

      cachedPayload = payload
      cachedAt = Date.now()
      setData(payload)
      setError(null)
      retryCount.current = 0
      return payload
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load data"
      setError(msg)

      if (cachedPayload) {
        setData((prev) => prev ?? cachedPayload)
      }

      if (retryCount.current < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, retryCount.current)
        retryCount.current += 1
        retryTimer.current = setTimeout(() => refetch(true), delay)
      }
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
    return () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current)
        retryTimer.current = null
      }
    }
  }, [refetch])

  return { data, loading, error, refetch: () => refetch(true) }
}
