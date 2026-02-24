"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { LibraryCard } from "@/lib/types"

const STORAGE_KEY = "library_of_things_library_card"
/** One-time migration from previous app name; read once and remove. */
const LEGACY_STORAGE_KEY = "flybrary_library_card" // do not use elsewhere; migration only

/**
 * Custom event name used to synchronise card state across all
 * `useLibraryCard` instances within the same browser tab.
 * (The native `storage` event only fires in *other* tabs.)
 */
const SYNC_EVENT = "library-of-things-card-sync"

/** Broadcast card changes so every hook instance stays in lockstep. */
function broadcastCardChange(card: LibraryCard | null) {
  window.dispatchEvent(
    new CustomEvent(SYNC_EVENT, { detail: card })
  )
}

/**
 * Call login to (a) fill in missing user_id and (b) refresh the session
 * cookie so protected API endpoints accept this user's requests.
 * Silently falls back to the stored card if the server is unreachable.
 */
async function refreshSession(
  parsed: LibraryCard,
  saveCard: (c: LibraryCard) => boolean
): Promise<LibraryCard | null> {
  const cardNumber = (parsed.card_number ?? "").replace(/\s/g, "").trim()
  const pin = typeof parsed.pin === "string" ? parsed.pin : ""
  if (!cardNumber || !pin) return parsed
  try {
    const res = await fetch("/api/library-card/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ card_number: cardNumber, pin }),
    })
    const data = await res.json()
    if (!res.ok || !data.success || !data.card) return parsed
    const fullCard: LibraryCard = {
      ...data.card,
      pin,
      access_count: parsed.access_count ?? 0,
      status: (parsed.status as LibraryCard["status"]) ?? "active",
    }
    saveCard(fullCard)
    return fullCard
  } catch {
    return parsed
  }
}

export function useLibraryCard() {
  const [card, setCard] = useState<LibraryCard | null>(null)
  const [mounted, setMounted] = useState(false)
  const hydratedRef = useRef(false)
  const [hydratingError, setHydratingError] = useState<string | null>(null)

  /* ── Persist + broadcast ── */
  const saveCard = useCallback((newCard: LibraryCard) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCard))
      setCard(newCard)
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
      setCard(null)
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

  /* ── Initial load + one-time migration + hydration ── */
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
        if (parsed.card_number && parsed.pin && !hydratedRef.current) {
          hydratedRef.current = true
          const updated = await refreshSession(parsed, saveCard)
          if (!cancelled && updated) setCard(updated)
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

  /* ── Cross-instance sync within the same tab ── */
  useEffect(() => {
    function handleSync(e: Event) {
      const detail = (e as CustomEvent).detail as LibraryCard | null
      setCard(detail)
    }
    window.addEventListener(SYNC_EVENT, handleSync)
    return () => window.removeEventListener(SYNC_EVENT, handleSync)
  }, [])

  return { card, saveCard, clearCard, updatePseudonym, mounted, hydratingError }
}
