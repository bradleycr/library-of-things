"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { LibraryCard } from "@/lib/types"

const STORAGE_KEY = "flybrary_library_card"

/**
 * Custom event name used to synchronise card state across all
 * `useLibraryCard` instances within the same browser tab.
 * (The native `storage` event only fires in *other* tabs.)
 */
const SYNC_EVENT = "flybrary-card-sync"

/** Broadcast card changes so every hook instance stays in lockstep. */
function broadcastCardChange(card: LibraryCard | null) {
  window.dispatchEvent(
    new CustomEvent(SYNC_EVENT, { detail: card })
  )
}

/**
 * If the stored card has card_number + pin but no user_id (e.g. old or corrupted save),
 * re-login once to get the full card with user_id so Profile/Settings recognise the user.
 */
async function hydrateCardIfNeeded(
  parsed: LibraryCard,
  saveCard: (c: LibraryCard) => boolean
): Promise<LibraryCard | null> {
  if (parsed.user_id) return parsed
  const cardNumber = (parsed.card_number ?? "").replace(/\s/g, "").trim()
  const pin = typeof parsed.pin === "string" ? parsed.pin : ""
  if (!cardNumber || !pin) return parsed
  try {
    const res = await fetch("/api/library-card/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  /* ── Initial load + hydration ── */
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) {
          setMounted(true)
          return
        }
        const parsed = JSON.parse(stored) as LibraryCard
        if (!parsed.user_id && parsed.card_number && parsed.pin && !hydratedRef.current) {
          hydratedRef.current = true
          const updated = await hydrateCardIfNeeded(parsed, saveCard)
          if (!cancelled) setCard(updated)
        } else {
          setCard(parsed)
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
