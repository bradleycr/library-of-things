"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { LibraryCard } from "@/lib/types"

const STORAGE_KEY = "library_of_things_library_card"
/** Prior project name; we still read and migrate from this key for existing users. */
const LEGACY_STORAGE_KEY = "flybrary_library_card"
const SESSION_TS_KEY = "lot_session_ts"

const SYNC_EVENT = "library-of-things-card-sync"

const SESSION_REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

function broadcastCardChange(card: LibraryCard | null) {
  window.dispatchEvent(
    new CustomEvent(SYNC_EVENT, { detail: card })
  )
}

type RefreshResult =
  | { ok: true; card: LibraryCard }
  | { ok: false; reason: "invalid" | "network" | "rate_limited" }

async function callLogin(
  cardNumber: string,
  pin: string
): Promise<RefreshResult> {
  try {
    const res = await fetch("/api/library-card/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ card_number: cardNumber, pin }),
    })
    if (res.status === 429) return { ok: false, reason: "rate_limited" }
    const data = await res.json()
    if (!res.ok || !data.success || !data.card) return { ok: false, reason: "invalid" }
    return { ok: true, card: data.card }
  } catch {
    return { ok: false, reason: "network" }
  }
}

function shouldRefresh(): boolean {
  try {
    const ts = localStorage.getItem(SESSION_TS_KEY)
    if (!ts) return true
    return Date.now() - Number(ts) > SESSION_REFRESH_INTERVAL_MS
  } catch {
    return true
  }
}

function markRefreshed() {
  try {
    localStorage.setItem(SESSION_TS_KEY, String(Date.now()))
  } catch { /* ignore */ }
}

export function useLibraryCard() {
  const [card, setCard] = useState<LibraryCard | null>(null)
  const [mounted, setMounted] = useState(false)
  const refreshedRef = useRef(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const saveCard = useCallback((newCard: LibraryCard) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCard))
      setCard(newCard)
      setSessionError(null)
      broadcastCardChange(newCard)
      return true
    } catch {
      return false
    }
  }, [])

  const clearCard = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      localStorage.removeItem(SESSION_TS_KEY)
      setCard(null)
      setSessionError(null)
      broadcastCardChange(null)
      return true
    } catch {
      return false
    }
  }, [])

  const updatePseudonym = useCallback((newPseudonym: string) => {
    const trimmed = newPseudonym.trim()
    if (!trimmed.length) return false
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return false
      const parsed = JSON.parse(stored) as LibraryCard
      const updated = { ...parsed, pseudonym: trimmed }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      setCard(updated)
      broadcastCardChange(updated)
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        let stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) {
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
          if (legacy) {
            localStorage.setItem(STORAGE_KEY, legacy)
            localStorage.removeItem(LEGACY_STORAGE_KEY)
            stored = legacy
          }
        }
        if (!stored) {
          setMounted(true)
          return
        }

        const parsed = JSON.parse(stored) as LibraryCard
        setCard(parsed)

        const cardNumber = (parsed.card_number ?? "").replace(/\s/g, "").trim()
        const pin = typeof parsed.pin === "string" ? parsed.pin : ""

        if (cardNumber && pin && !refreshedRef.current && shouldRefresh()) {
          refreshedRef.current = true
          const result = await callLogin(cardNumber, pin)

          if (cancelled) return

          if (result.ok) {
            const fullCard: LibraryCard = {
              ...result.card,
              pin,
              access_count: parsed.access_count ?? 0,
              status: (parsed.status as LibraryCard["status"]) ?? "active",
            }
            saveCard(fullCard)
            markRefreshed()
          } else if (result.reason === "invalid") {
            setSessionError(
              "Your library card is no longer recognised. Please get a new card or log in again."
            )
            localStorage.removeItem(STORAGE_KEY)
            localStorage.removeItem(SESSION_TS_KEY)
            setCard(null)
            broadcastCardChange(null)
          } else if (result.reason === "network") {
            // Server unreachable — keep the card, try again next time
          }
          // rate_limited — do nothing, try again next navigation
        }
      } catch {
        if (!cancelled) setCard(null)
      } finally {
        if (!cancelled) setMounted(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [saveCard])

  useEffect(() => {
    function handleSync(e: Event) {
      const detail = (e as CustomEvent).detail as LibraryCard | null
      setCard(detail)
      if (!detail) setSessionError(null)
    }
    window.addEventListener(SYNC_EVENT, handleSync)
    return () => window.removeEventListener(SYNC_EVENT, handleSync)
  }, [])

  return { card, saveCard, clearCard, updatePseudonym, mounted, sessionError }
}
