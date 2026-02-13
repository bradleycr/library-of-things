"use client"

import { useCallback, useEffect, useState } from "react"
import type { BootstrapPayload } from "@/lib/client/bootstrap"
import { fetchBootstrapData } from "@/lib/client/bootstrap"

export function useBootstrapData() {
  const [data, setData] = useState<BootstrapPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await fetchBootstrapData()
      setData(payload)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
