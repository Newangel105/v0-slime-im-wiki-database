"use client"

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"
import { getAllWikiCharacters, getCharacterVisualTier, getAllHeartprints } from "@/lib/pc-wiki"
import { Input } from "@/components/ui/input"
import autoAnimate from "@formkit/auto-animate"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"
import { Search } from "lucide-react"
import * as pako from "pako"
import { compressToEncodedURIComponent } from "lz-string"
import { decompressFromEncodedURIComponent } from "lz-string"


type Tier = { name: string; items: string[]; color?: string }
type TierListEntry = { name: string; tiers: Tier[] }

const DEFAULT_TIER_NAMES = ["S", "A", "B", "C", "D"]
const STORAGE_KEY = "tierList_v1"
const LISTS_STORAGE_KEY = "tierLists_v2"
const HEART_LISTS_KEY = "heartTierLists_v1"

const DEFAULT_TIER_COLORS = ["#dc2626", "#ea580c", "#eab308", "#f59e0b", "#84cc16"]
const RARITY_ASSETS: Record<number, string> = {
  3: "/UI/Texture/CommonRarityAtlas/starCharaL3.webp",
  4: "/UI/Texture/CommonRarityAtlas/starCharaL4.webp",
  5: "/UI/Texture/CommonRarityAtlas/starCharaL5.webp",
  6: "/UI/Texture/CommonRarityAtlas/starCharaL6.webp",
  7: "/UI/Texture/CommonRarityAtlas/starCharaL6_SpecialPlus.webp",
  8: "/UI/Texture/CommonRarityAtlas/starCharaL7_Epic.webp",
}

function getMiniFramePath(tier: number, pfx: string) {
  if (tier === 8) return `UI/Texture/CommonRarityAtlas/frame${pfx}M7_Epic.webp`
  if (tier === 7) return `UI/Texture/CommonRarityAtlas/frame${pfx}M6_SpecialPlus.webp`
  if (tier === 6) return `UI/Texture/CommonRarityAtlas/frame${pfx}M6_Special.webp`
  const t = Math.min(Math.max(tier, 3), 5)
  return `UI/Texture/CommonRarityAtlas/frame${pfx}M${t}.webp`
}

function getMiniBasePath(tier: number, pfx: string) {
  if (tier === 8) return `UI/Texture/CommonRarityAtlas/base${pfx}M7_Epic.webp`
  if (tier === 7) return `UI/Texture/CommonRarityAtlas/base${pfx}M6_SpecialPlus.webp`
  if (tier === 6) return `UI/Texture/CommonRarityAtlas/base${pfx}M6_Special.webp`
  const t = Math.min(Math.max(tier, 3), 5)
  return `UI/Texture/CommonRarityAtlas/base${pfx}M${t}.webp`
}

function getContrastColor(hex?: string) {
  if (!hex) return "#ffffff"
  try {
    const h = hex.replace("#", "")
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    const yiq = (r * 299 + g * 587 + b * 114) / 1000
    return yiq >= 128 ? "#000000" : "#ffffff"
  } catch (e) {
    return "#ffffff"
  }
}

function hexToRgb(hex?: string) {
  const h = (hex ?? "#ffffff").replace("#", "")
  const r = parseInt(h.substring(0, 2) || "ff", 16)
  const g = parseInt(h.substring(2, 4) || "ff", 16)
  const b = parseInt(h.substring(4, 6) || "ff", 16)
  return { r, g, b }
}

// Insertion index for a drag, computed from the cursor against the items'
// geometry on the STABLE container (items are pointer-events:none while
// dragging) — so opening the gap can't re-trigger detection and loop.
function computeDropIndex(container: HTMLElement, clientX: number, clientY: number): number {
  const items = Array.from(container.querySelectorAll<HTMLElement>("[data-item-index]"))
  for (let i = 0; i < items.length; i++) {
    const r = items[i].getBoundingClientRect()
    if (clientY < r.top) return i
    if (clientY <= r.bottom && clientX < r.left + r.width / 2) return i
  }
  return items.length
}

export function OceanTierMaker() {
  // Force desktop mode on mobile
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]')
    const prevViewport = meta?.getAttribute('content') ?? null
    if (meta) {
      meta.setAttribute('content', 'width=1024, user-scalable=no')
    }
    // Force 100% so the drag-and-drop hit-testing coordinates stay stable.
    document.documentElement.style.zoom = '100%'
    return () => {
      // Restore on unmount — otherwise this forced zoom leaks onto every other
      // page and overrides the global responsive zoom until a full reload.
      document.documentElement.style.zoom = ''
      if (meta && prevViewport != null) meta.setAttribute('content', prevViewport)
    }
  }, [])

  const allChars = useMemo(() => getAllCharacterBrowserData(), [])
  const wikiChars = useMemo(() => getAllWikiCharacters(), [])
  const allHearts = useMemo(() => getAllHeartprints(), [])

  const skillChangeIds = useMemo(() => {
    const s = new Set<number>()
    for (const c of wikiChars) {
      if (c.skills?.some((sk: any) => sk.is_skill_change)) s.add(c.master_pc_id)
    }
    return s
  }, [wikiChars])

  const [tierLists, setTierLists] = useState<TierListEntry[]>([
    { name: "Tier List 1", tiers: DEFAULT_TIER_NAMES.map((n, i) => ({ name: n, items: [], color: DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length] })) }
  ])
  const [activeListIndex, setActiveListIndex] = useState(0)
  const [mode, setMode] = useState<"characters" | "heartprints">("characters")

  // Helper to create default tier list structure (avoids duplication across 5+ locations)
  const createDefaultTierList = useCallback((name: string = "Tier List 1"): TierListEntry => ({
    name,
    tiers: DEFAULT_TIER_NAMES.map((n, i) => ({
      name: n,
      items: [],
      color: DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length]
    }))
  }), [])

  // Helper to expand compact tier format (avoids duplication in multiple decode paths)
  const expandCompactTiers = useCallback((ct: any, i: number) => ({
    name: ct.n ?? DEFAULT_TIER_NAMES[i] ?? String(i),
    color: ct.c ?? DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length],
    items: (ct.i ?? []).map(String),
  }), [])

  // Generic localStorage retrieval (consolidates 3 nearly-identical functions)
  const getStoredLists = useCallback((key: string): TierListEntry[] => {
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (e) {}
    return [createDefaultTierList()]
  }, [createDefaultTierList])

  // Smoothly animate characters being added / removed / reordered within a tier.
  const animateRef = useCallback((el: HTMLElement | null) => { if (el) autoAnimate(el) }, [])

  const tiers = tierLists[activeListIndex]?.tiers ?? []
  const setTiers: React.Dispatch<React.SetStateAction<Tier[]>> = (action) => {
    setTierLists(prev => {
      const copy = prev.map(tl => ({ ...tl }))
      const current = copy[activeListIndex]
      if (!current) return prev
      const newTiers = typeof action === 'function' ? action(current.tiers) : action
      copy[activeListIndex] = { ...current, tiers: newTiers }
      return copy
    })
  }

  const [imageSearch, setImageSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "protector" | "attacker">("all")
  const [rarityFilter, setRarityFilter] = useState<number | null>(null)
  // Live drop-position preview while dragging — opens a gap between items.
  const [dropPreview, setDropPreview] = useState<{ tier: number; index: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const draggedIdRef = useRef<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(mode === "characters" ? LISTS_STORAGE_KEY : HEART_LISTS_KEY, JSON.stringify(tierLists))
    } catch (e) {}
  }, [tierLists, mode])

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const params = new URLSearchParams(window.location.search)
      const d = params.get("d")
      const gistParam = params.get("gist")
      const modeParam = params.get("mode")
      const initMode = modeParam === "heartprints" ? "heartprints" : "characters"

      if (d) {
        try {
          let parsed: any

          try {
            const jsonStr = decompressFromEncodedURIComponent(d)
            if (!jsonStr) throw new Error("Invalid compressed data")
            parsed = JSON.parse(jsonStr)
          } catch {
            // Legacy gzip fallback
            const binary = atob(d)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
            parsed = JSON.parse(pako.ungzip(bytes, { to: "string" }) as string)
          }

          // New shared format: { c: {...}, h: {...} } with both character and heartprint lists
          if (parsed?.c && parsed?.h) {
            const expandData = (data: any) => {
              if (Array.isArray(data)) {
                return [{ name: "Shared List", tiers: data.map((ct: any, i: number) => expandCompactTiers(ct, i)) }]
              }
              if (data?.l && Array.isArray(data.l)) {
                return data.l.map((tl: any) => ({
                  name: tl.n ?? "Tier List",
                  tiers: (tl.t ?? []).map((ct: any, i: number) => expandCompactTiers(ct, i)),
                }))
              }
              return []
            }
            const charLists = expandData(parsed.c)
            const heartLists = expandData(parsed.h)
            if (initMode === "heartprints") {
              setTierLists(heartLists.length > 0 ? heartLists : charLists)
            } else {
              setTierLists(charLists.length > 0 ? charLists : heartLists)
            }
            try {
              localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(charLists))
              localStorage.setItem(HEART_LISTS_KEY, JSON.stringify(heartLists))
            } catch (e) {}
            setActiveListIndex(0)
            setMode(initMode)
            return
          }

          // Compact multi: { l: [{n, t}] }
          if (parsed?.l && Array.isArray(parsed.l)) {
            setTierLists(parsed.l.map((tl: any) => ({
              name: tl.n ?? "Tier List",
              tiers: (tl.t ?? []).map((ct: any, i: number) => expandCompactTiers(ct, i)),
            })))
            setActiveListIndex(0)
            setMode(initMode)
            return
          }

          // Legacy multi: { lists: TierListEntry[] }
          if (parsed?.lists && Array.isArray(parsed.lists)) {
            setTierLists(parsed.lists)
            setActiveListIndex(0)
            setMode(initMode)
            return
          }

          if (Array.isArray(parsed) && parsed.length > 0) {
            // Compact single: [{i, n?, c?}]
            if ("i" in parsed[0]) {
              setTierLists([{ name: "Shared List", tiers: parsed.map((ct: any, i: number) => expandCompactTiers(ct, i)) }])
            } else {
              // Legacy single: Tier[] with full keys
              setTierLists([{ name: "Shared List", tiers: parsed }])
            }
            setActiveListIndex(0)
            setMode(initMode)
            return
          }
        } catch (e) {}
      }

      if (gistParam) {
        ;(async () => {
          try {
            const res = await fetch(`/api/tier-list?gist=${encodeURIComponent(gistParam)}`)
            if (res.ok) {
              const json = await res.json()

              if (json?.charLists || json?.heartLists) {
                const charLists = json.charLists || []
                const heartLists = json.heartLists || []

                try {
                  localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(charLists))
                  localStorage.setItem(HEART_LISTS_KEY, JSON.stringify(heartLists))
                } catch (e) {}

                if (initMode === "heartprints") {
                  setTierLists(heartLists.length > 0 ? heartLists : charLists)
                } else {
                  setTierLists(charLists.length > 0 ? charLists : heartLists)
                }

                setActiveListIndex(0)
                setMode(initMode)
              }
            }
          } catch (e) {}
        })()
        return
      }

      // Try new multi-list format first
      try {
        const savedLists = localStorage.getItem(LISTS_STORAGE_KEY)
        if (savedLists) {
          const parsed = JSON.parse(savedLists)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTierLists(parsed)
            setActiveListIndex(0)
            return
          }
        }
      } catch (e) {}

      // Fall back to legacy single-list format
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            setTierLists([{
              name: "Tier List 1",
              tiers: parsed.map((t: any, i: number) => ({
                name: t.name ?? "",
                items: (t.items || []).map((it: any) => String(it)),
                color: t.color ?? DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length],
              }))
            }])
            setActiveListIndex(0)
            return
          }
        }
      } catch (e) {}

      ;(async () => {
        try {
          const res = await fetch("/api/tier-list")
          if (!res.ok) return
          const json = await res.json()
          if (json?.tiers) {
            setTierLists([{ name: "Tier List 1", tiers: json.tiers }])
            setActiveListIndex(0)
          }
        } catch (e) {}
      })()
    } catch (e) {}
  }, [])

  // Inline dialog component to edit a tier's name and color.
  const TierEditDialog = ({ tier, idx }: { tier: Tier; idx: number }) => {
    const [name, setName] = useState(tier.name)
    const [color, setColor] = useState(tier.color ?? DEFAULT_TIER_COLORS[idx % DEFAULT_TIER_COLORS.length])
    const colorInputRef = React.useRef<HTMLInputElement | null>(null)
    const isValidHex = (s: string) => /^#([0-9a-fA-F]{6})$/.test(s)
    useEffect(() => {
      setName(tier.name)
      setColor(tier.color ?? DEFAULT_TIER_COLORS[idx % DEFAULT_TIER_COLORS.length])
    }, [tier])

    function handleSave() {
      setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, name, color } : t)))
    }

    return (
      <Dialog>
        <DialogTrigger asChild>
          <button className="text-xs bg-card/55 text-foreground hover:text-foreground hover:bg-[rgba(46,92,132,0.92)] border border-border/[0.22] px-2 py-1 rounded">Edit</button>
        </DialogTrigger>
        <DialogContent className="w-80 bg-muted text-foreground border border-border/[0.22]">
          <DialogHeader>
            <DialogTitle>Edit tier</DialogTitle>
            <DialogDescription>Change the tier name and color</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-sm text-foreground/65 mb-1 block">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 rounded-md border border-border/[0.22] bg-card/55 px-3 text-foreground placeholder:text-foreground/65"
              />
            </div>

            <div>
              <label className="text-sm text-foreground/65 mb-1 block">Color</label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={isValidHex(color) ? color : "#ffffff"}
                    onChange={(e) => setColor(e.target.value)}
                    style={{ position: "absolute", left: 0, top: 0, width: 32, height: 32, padding: 0, margin: 0, opacity: 0, border: 0 }}
                  />
                  <div
                    role="button"
                    title="Open color picker"
                    onClick={() => colorInputRef.current?.click()}
                    className="w-8 h-8 rounded-sm border cursor-pointer"
                    style={{ backgroundColor: isValidHex(color) ? color : "transparent" }}
                  />
                </div>
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-9 rounded-md border-border/[0.22] bg-card/55 px-2 text-foreground w-28 text-sm placeholder:text-foreground/65" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <button onClick={handleSave} className="px-3 py-1 bg-card/55 text-foreground rounded">Save</button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  function removeFromTiers(charId: string) {
    setTiers((prev) => prev.map((t) => ({ ...t, items: t.items.filter((id) => id !== charId) })))
  }

  function insertCharAt(charId: string, targetTierIndex: number, targetIndex: number) {
    setTiers((prev) => {
      if (!prev[targetTierIndex]) return prev
      const originalIndex = prev[targetTierIndex].items.indexOf(charId)
      const without = prev.map((t) => ({ ...t, items: t.items.filter((id) => id !== charId) }))
      let insertionIndex = Math.max(0, Math.min(targetIndex, without[targetTierIndex].items.length))
      if (originalIndex !== -1 && originalIndex < targetIndex) insertionIndex = Math.max(0, insertionIndex - 1)
      const items = [...without[targetTierIndex].items]
      items.splice(insertionIndex, 0, charId)
      without[targetTierIndex] = { ...without[targetTierIndex], items }
      return without
    })
  }

  // Swap two items' positions within the SAME tier (drop A onto B → exchange).
  function swapInTier(charId: string, tierIndex: number, targetItemIndex: number) {
    setTiers((prev) => {
      const tier = prev[tierIndex]
      if (!tier) return prev
      const fromIndex = tier.items.indexOf(charId)
      if (fromIndex === -1 || fromIndex === targetItemIndex || targetItemIndex < 0 || targetItemIndex >= tier.items.length) return prev
      const items = [...tier.items]
      const tmp = items[fromIndex]
      items[fromIndex] = items[targetItemIndex]
      items[targetItemIndex] = tmp
      return prev.map((t, i) => (i === tierIndex ? { ...t, items } : t))
    })
  }

  function appendCharToTier(charId: string, tierIndex: number) {
    setTiers((prev) => {
      const copy = prev.map((t) => ({ ...t, items: t.items.filter((id) => id !== charId) }))
      if (!copy[tierIndex]) return prev
      copy[tierIndex].items.push(charId)
      return copy
    })
  }

  function handleDragStart(e: React.DragEvent, charId: string, fromTierIndex: number) {
    draggedIdRef.current = charId
    setIsDragging(true)
    try {
      e.dataTransfer.setData("application/json", JSON.stringify({ charId, fromTierIndex }))
      e.dataTransfer.effectAllowed = "move"
    } catch (err) {}
  }

  function handleDropOnItem(e: React.DragEvent, targetTierIndex: number, targetItemIndex: number) {
    e.preventDefault()
    try {
      const raw = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain")
      if (!raw) return
      const parsed = JSON.parse(raw)
      const charId = String(parsed.charId ?? parsed.id ?? parsed)
      if (!charId) return
      const fromTierIndex = typeof parsed.fromTierIndex === "number" ? parsed.fromTierIndex : -1
      if (fromTierIndex === targetTierIndex && targetTierIndex >= 0) {
        swapInTier(charId, targetTierIndex, targetItemIndex)
      } else {
        insertCharAt(charId, targetTierIndex, targetItemIndex)
      }
    } catch (err) {}
  }

  function handleDropOnTier(e: React.DragEvent, tierIndex: number) {
    e.preventDefault()
    try {
      const raw = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain")
      if (!raw) return
      const parsed = JSON.parse(raw)
      const charId = String(parsed.charId ?? parsed.id ?? parsed)
      if (!charId) return
      appendCharToTier(charId, tierIndex)
    } catch (err) {}
  }

  function handleDropOnPins(e: React.DragEvent) {
    e.preventDefault()
    try {
      const raw = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain")
      if (!raw) return
      const parsed = JSON.parse(raw)
      const charId = String(parsed.charId ?? parsed.id ?? parsed)
      if (!charId) return
      removeFromTiers(charId)
    } catch (err) {}
  }

  // Drop onto a tier: insert at the previewed gap position (or append at the end).
  function handleTierDrop(e: React.DragEvent, tierIndex: number) {
    e.preventDefault()
    try {
      const raw = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain")
      if (raw) {
        const parsed = JSON.parse(raw)
        const charId = String(parsed.charId ?? parsed.id ?? parsed)
        if (charId) {
          const target = dropPreview && dropPreview.tier === tierIndex ? dropPreview.index : (tiers[tierIndex]?.items.length ?? 0)
          insertCharAt(charId, tierIndex, target)
        }
      }
    } catch (err) {}
    setDropPreview(null)
    setIsDragging(false)
    draggedIdRef.current = null
  }

  // Push the item at the previewed gap aside (margin) so a slot visibly opens.
  function itemDragStyle(tierIndex: number, itemIndex: number, itemsLen: number, id: string): React.CSSProperties {
    const dp = dropPreview && dropPreview.tier === tierIndex ? dropPreview : null
    return {
      touchAction: "none",
      // Keep the dragged item itself interactive — disabling pointer-events on
      // the drag source mid-drag aborts the drag in some browsers.
      pointerEvents: isDragging && id !== draggedIdRef.current ? "none" : undefined,
      marginLeft: dp && dp.index === itemIndex ? "4.5rem" : undefined,
      marginRight: dp && dp.index === itemsLen && itemIndex === itemsLen - 1 ? "4.5rem" : undefined,
      transition: "margin 0.18s ease",
    }
  }

  const assigned = useMemo(() => new Set(tiers.flatMap((t) => t.items)), [tiers])

  const pins = useMemo(() => {
    const out: Array<{ id: string; masterId: number; name: string; image: string; variant: "base" | "skill" }> = []
    for (const c of allChars) {
      const baseId = String(c.master_pc_id)
      out.push({ id: baseId, masterId: c.master_pc_id, name: c.name, image: c.images.icon, variant: "base" })
      if (skillChangeIds.has(c.master_pc_id)) out.push({ id: `${baseId}:skill`, masterId: c.master_pc_id, name: c.name, image: c.images.icon, variant: "skill" })
    }
    return out
  }, [allChars, skillChangeIds])

  // Pointer-based mobile drag fallback: store active drag data and handle pointerup
  const touchDragRef = useRef<{ charId: string; fromTierIndex: number } | null>(null)
  const touchDragImageRef = useRef<string | null>(null)
  const touchGhostRef = useRef<HTMLElement | null>(null)
  const touchLastYRef = useRef<number | null>(null)
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)
  const touchInScrollableRef = useRef<boolean>(false)

  function removeTouchGhost() {
    try {
      const el = touchGhostRef.current
      if (el && el.parentNode) el.parentNode.removeChild(el)
    } catch (e) {}
    touchGhostRef.current = null
    touchDragImageRef.current = null
  }

  function createTouchGhost(src?: string) {
    try {
      removeTouchGhost()
      const el = document.createElement("div")
      el.style.position = "fixed"
      el.style.left = "0px"
      el.style.top = "0px"
      el.style.width = "48px"
      el.style.height = "48px"
      el.style.pointerEvents = "none"
      el.style.zIndex = "999999"
      el.style.borderRadius = "6px"
      el.style.overflow = "hidden"
      el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.5)"
      el.style.transform = "translate(-50%, -50%)"
      const img = document.createElement("img")
      img.src = src ?? ""
      img.style.width = "100%"
      img.style.height = "100%"
      img.style.objectFit = "contain"
      el.appendChild(img)
      document.body.appendChild(el)
      touchGhostRef.current = el
      return el
    } catch (e) {
      return null
    }
  }

  function moveTouchGhost(x: number, y: number) {
    const el = touchGhostRef.current
    if (!el) return
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }

  useEffect(() => {
    function handlePointerUp(ev: PointerEvent) {
      if (!touchDragRef.current) return
      const { charId, fromTierIndex } = touchDragRef.current
      touchDragRef.current = null
      touchLastYRef.current = null
      const x = ev.clientX
      const y = ev.clientY
      removeTouchGhost()
      const el = document.elementFromPoint(x, y) as HTMLElement | null
      if (!el) return

      const tierEl = el.closest("[data-tier-index]") as HTMLElement | null
      if (tierEl) {
        const ti = Number(tierEl.getAttribute("data-tier-index"))
        const itemEl = el.closest("[data-item-index]") as HTMLElement | null
        if (itemEl && itemEl.getAttribute("data-tier-index") === String(ti)) {
          const itemIndex = Number(itemEl.getAttribute("data-item-index"))
          insertCharAt(charId, ti, itemIndex)
        } else {
          appendCharToTier(charId, ti)
        }
        return
      }

      const pinsEl = el.closest("[data-pins]")
      if (pinsEl) {
        removeFromTiers(charId)
      }
    }

    function handlePointerMove(ev: PointerEvent) {
      try {
        if (ev.pointerType === 'touch' && touchDragRef.current) {
          const last = touchLastYRef.current ?? ev.clientY
          const delta = ev.clientY - last
          if (delta !== 0) {
            try {
              const se = document.scrollingElement || document.documentElement
              se.scrollTop = (se.scrollTop || 0) + delta
            } catch (e) {}
          }
          touchLastYRef.current = ev.clientY
          // update ghost position so it follows finger
          moveTouchGhost(ev.clientX, ev.clientY)
        }
      } catch (e) {}
    }

    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointermove", handlePointerMove, { passive: false })
    return () => {
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointermove", handlePointerMove as any)
    }
  }, [insertCharAt, appendCharToTier, removeFromTiers])

  // Touch fallback for browsers that don't emit pointer events (older Safari/Android)
  useEffect(() => {
    function handleTouchEnd(ev: TouchEvent) {
      if (!touchDragRef.current) return
      const { charId, fromTierIndex } = touchDragRef.current
      touchDragRef.current = null
      touchLastYRef.current = null
      const touch = ev.changedTouches && ev.changedTouches[0]
      if (!touch) return
      const x = touch.clientX
      const y = touch.clientY
      // remove visual ghost before hit-testing so it doesn't block elementFromPoint
      removeTouchGhost()
      const el = document.elementFromPoint(x, y) as HTMLElement | null
      if (!el) return

      const tierEl = el.closest("[data-tier-index]") as HTMLElement | null
      if (tierEl) {
        const ti = Number(tierEl.getAttribute("data-tier-index"))
        const itemEl = el.closest("[data-item-index]") as HTMLElement | null
        if (itemEl && itemEl.getAttribute("data-tier-index") === String(ti)) {
          const itemIndex = Number(itemEl.getAttribute("data-item-index"))
          insertCharAt(charId, ti, itemIndex)
        } else {
          appendCharToTier(charId, ti)
        }
        return
      }

      const pinsEl = el.closest("[data-pins]")
      if (pinsEl) {
        removeFromTiers(charId)
      }
    }

    window.addEventListener("touchend", handleTouchEnd)
    window.addEventListener("touchcancel", handleTouchEnd)
    return () => {
      window.removeEventListener("touchend", handleTouchEnd)
      window.removeEventListener("touchcancel", handleTouchEnd)
    }
  }, [insertCharAt, appendCharToTier, removeFromTiers])

  // Update or create the visual ghost while touching and ensure cleanup
  useEffect(() => {
    function handleTouchMove(ev: TouchEvent) {
      if (!touchDragRef.current) return
      // while dragging on touch, prevent the default panning and manually scroll the page
      try { ev.preventDefault() } catch (e) {}
      const t = ev.touches && ev.touches[0]
      if (!t) return
      const last = touchLastYRef.current ?? t.clientY
      const delta = t.clientY - last
      if (delta !== 0) {
        try {
          const se = document.scrollingElement || document.documentElement
          se.scrollTop = (se.scrollTop || 0) + delta
        } catch (e) {}
      }
      touchLastYRef.current = t.clientY
      if (!touchGhostRef.current && touchDragImageRef.current) createTouchGhost(touchDragImageRef.current)
      moveTouchGhost(t.clientX, t.clientY)
    }

    // listener must be non-passive so preventDefault() works
    window.addEventListener("touchmove", handleTouchMove, { passive: false })
    return () => {
      window.removeEventListener("touchmove", handleTouchMove)
      removeTouchGhost()
    }
  }, [])

  // Desktop drag auto-scroll: while an HTML5 drag is active, scroll the page when
  // the cursor nears the top/bottom edge of the viewport (so you can drag a pin
  // or a tiered character up/down past what's currently on screen).
  useEffect(() => {
    let raf = 0
    let active = false
    let pointerY = 0
    const EDGE = 110        // px from each edge where auto-scroll kicks in
    const MAX_SPEED = 24    // px per frame at the very edge

    function step() {
      if (!active) return
      const vh = window.innerHeight
      let dy = 0
      if (pointerY < EDGE) dy = -MAX_SPEED * (1 - Math.max(0, pointerY) / EDGE)
      else if (pointerY > vh - EDGE) dy = MAX_SPEED * (1 - Math.max(0, vh - pointerY) / EDGE)
      if (dy !== 0) window.scrollBy(0, dy)
      raf = requestAnimationFrame(step)
    }
    function onDragOver(e: DragEvent) {
      pointerY = e.clientY
      if (!active) { active = true; raf = requestAnimationFrame(step) }
    }
    function stop() {
      active = false
      cancelAnimationFrame(raf)
      setDropPreview(null)
      setIsDragging(false)
      draggedIdRef.current = null
    }

    window.addEventListener("dragover", onDragOver)
    window.addEventListener("drop", stop)
    window.addEventListener("dragend", stop)
    return () => {
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("drop", stop)
      window.removeEventListener("dragend", stop)
      cancelAnimationFrame(raf)
    }
  }, [])

  function isProtectorChar(wc: any) {
    if (!wc) return false
    // mirrors logic used on forces/characters page
    if (wc.character_role !== "Supporter") return false
    return !wc.skills.some((s: any) => s.slot === "special_skill" && s.kind === "special")
  }

  function isAttackerChar(wc: any) {
    if (!wc) return false
    if (wc.character_role === "Attacker") return true
    return wc.skills.some((s: any) => s.slot === "special_skill" && s.kind === "special")
  }

  const availablePins = useMemo(() => {
    const wcMap = new Map(wikiChars.map((w: any) => [w.master_pc_id, w]))
    return pins
      .filter((p) => {
        if (assigned.has(p.id)) return false
        if (imageSearch && !p.name.toLowerCase().includes(imageSearch.toLowerCase())) return false
        const wc = wcMap.get(p.masterId)
        if (roleFilter === "protector" && !isProtectorChar(wc)) return false
        if (roleFilter === "attacker" && !isAttackerChar(wc)) return false
        if (rarityFilter != null) {
          if (!wc) return false
          const vt = getCharacterVisualTier(wc)
          if (vt !== rarityFilter) return false
        }
        return true
      })
      .sort((a, b) => {
        const wcA = wcMap.get(a.masterId)
        const wcB = wcMap.get(b.masterId)
        const tierA = wcA ? getCharacterVisualTier(wcA) : 5
        const tierB = wcB ? getCharacterVisualTier(wcB) : 5
        if (tierB !== tierA) return tierB - tierA
        return a.name.localeCompare(b.name)
      })
  }, [pins, assigned, imageSearch, roleFilter, rarityFilter, wikiChars])

  const heartPins = useMemo(() => {
    const out: Array<{ id: string; masterId: number; name: string; image: string }> = []
    for (const c of allHearts) {
      if (c.still_type === "rare")
        out.push({ id: String(c.heartprint_id), masterId: c.heartprint_id, name: c.title, image: c.picture_path.replace("{0}", "L") + ".webp" })
    }
    return out
  }, [allHearts])

  const heartAvailablePins = useMemo(() => {
    return heartPins
      .filter((p) => {
        if (assigned.has(p.id)) return false
        if (imageSearch && !p.name.toLowerCase().includes(imageSearch.toLowerCase())) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [heartPins, assigned, imageSearch])

  

  function exportJson() {
    const blob = new Blob([JSON.stringify(tiers, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "tier-list.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportAllJson() {
    const blob = new Blob([JSON.stringify({ lists: tierLists }, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "tier-lists-all.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  function uint8ToBase64(bytes: Uint8Array) {
    let binary = ""
    const chunkSize = 0x8000

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }

    return btoa(binary)
  }

  // Compact encode: short keys + integer IDs + omit defaults → smaller ?d= URL
  function _compactTiers(ts: Tier[]) {
    return ts.map((tier, i) => {
      const items = tier.items.map((id) => {
        const n = Number(id)
        return Number.isInteger(n) && n >= 0 && String(n) === id ? n : id
      })
      const ct: Record<string, unknown> = { i: items }
      if (tier.name !== DEFAULT_TIER_NAMES[i]) ct.n = tier.name
      if (tier.color !== DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length]) ct.c = tier.color
      return ct
    })
  }


  function encodeSharePayload(charLists: TierListEntry[], heartLists: TierListEntry[]): string {
    const compact = {
      c: charLists.length === 1
        ? _compactTiers(charLists[0].tiers)
        : { l: charLists.map((tl) => ({ n: tl.name, t: _compactTiers(tl.tiers) })) },
      h: heartLists.length === 1
        ? _compactTiers(heartLists[0].tiers)
        : { l: heartLists.map((tl) => ({ n: tl.name, t: _compactTiers(tl.tiers) })) }
    }
    return compressToEncodedURIComponent(JSON.stringify(compact))
  }

  async function copyShareLink() {
    try {
      const charLists =
        mode === "characters" ? tierLists : getStoredLists(LISTS_STORAGE_KEY)
      const heartLists =
        mode === "heartprints" ? tierLists : getStoredLists(HEART_LISTS_KEY)

      const res = await fetch("/api/tier-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ charLists, heartLists }),
      })

      if (!res.ok) {
        const text = await res.text()
        console.error("API error:", text)
        throw new Error("API request failed")
      }

      const data = await res.json()

      const url = `${window.location.origin}${window.location.pathname}?gist=${data.gistId}`

      await navigator.clipboard.writeText(url)
      alert("Share link copied to clipboard")
    } catch (e) {
      console.error(e)
      alert("Failed to copy link")
    }
  }

  async function exportAsImage() {
    let wrapper: HTMLDivElement | null = null
    try {
      const el = document.getElementById("tier-board")
      if (!el) return alert("Board element not found")
      const html2canvas = (await import("html2canvas")).default

      // Clone the board and render an off-screen copy so we can tweak styles
      const clone = el.cloneNode(true) as HTMLElement
      // hide interactive buttons and controls in the clone so they don't appear in the export
      clone.querySelectorAll("button").forEach((b) => {
        ;(b as HTMLElement).style.display = "none"
      })

      // Replace editable inputs for tier names in the clone with plain centered divs
      try {
        const nameInputs = clone.querySelectorAll('[data-tid="tier-name"]') || []
        nameInputs.forEach((el) => {
          let txt = ""
          try {
            if ((el as HTMLInputElement).value !== undefined) {
              txt = (el as HTMLInputElement).value ?? el.getAttribute("value") ?? ""
            } else {
              txt = el.textContent ?? el.getAttribute("value") ?? ""
            }
          } catch (e) {
            txt = el.textContent ?? el.getAttribute("value") ?? ""
          }
          const cs = window.getComputedStyle(el as Element)
          const d = document.createElement("div")
          d.textContent = txt
          d.style.display = "flex"
          d.style.alignItems = "center"
          d.style.justifyContent = "center"
          d.style.width = "100%"
          d.style.height = "100%"
          d.style.fontSize = cs.fontSize
          d.style.fontFamily = cs.fontFamily
          d.style.fontWeight = cs.fontWeight
          d.style.color = cs.color
          d.style.padding = cs.padding
          d.style.letterSpacing = cs.letterSpacing
          // ensure no caret or outline
          d.style.userSelect = "none"
          el.parentNode?.replaceChild(d, el)
        })
      } catch (e) {
        // ignore errors during clone transform
      }

      wrapper = document.createElement("div")
      wrapper.style.position = "fixed"
      wrapper.style.left = "-9999px"
      wrapper.style.top = "0"
      wrapper.style.background = "transparent"
      wrapper.style.padding = "8px"
      // lock clone to the original board size so html2canvas captures the same layout
      try {
        clone.style.boxSizing = "border-box"
        clone.style.width = `${el.offsetWidth}px`
        clone.style.height = `${el.offsetHeight}px`
      } catch (e) {}
      wrapper.appendChild(clone)
      document.body.appendChild(wrapper)

      const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 2))
      const canvas = await html2canvas(wrapper as HTMLElement, {
        backgroundColor: null, // produce a transparent PNG
        scale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        // ensure full wrapper area is captured
        width: (wrapper as HTMLElement).offsetWidth,
        height: (wrapper as HTMLElement).offsetHeight,
        scrollX: 0,
        scrollY: 0,
      })

      return new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) return resolve()
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = "tier-board.webp"
          a.click()
          URL.revokeObjectURL(url)
          resolve()
        }, "image/png")
      })
    } catch (e) {
      alert("Image export failed: " + String(e))
    } finally {
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper)
    }
  }

  function importJson(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (parsed?.lists && Array.isArray(parsed.lists)) {
          setTierLists(parsed.lists)
          setActiveListIndex(0)
        } else if (Array.isArray(parsed)) {
          setTiers(parsed)
        } else if (parsed?.tiers) {
          setTiers(parsed.tiers)
        } else {
          alert("Unsupported file format")
        }
      } catch (e) {
        alert("Failed to parse file")
      }
    }
    reader.readAsText(file)
  }



  function resetAll() {
    if (!confirm("Reset all tier lists to default and clear saved state?")) return
    const def: TierListEntry[] = [{ name: "Tier List 1", tiers: DEFAULT_TIER_NAMES.map((n, i) => ({ name: n, items: [], color: DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length] })) }]
    setTierLists(def)
    setActiveListIndex(0)
    try {
      localStorage.removeItem(mode === "characters" ? LISTS_STORAGE_KEY : HEART_LISTS_KEY)
      if (mode === "characters") localStorage.removeItem(STORAGE_KEY)
    } catch (e) {}
  }

  function addTier(afterIndex: number | null = null) {
    setTiers((prev) => {
      const newTier: Tier = { name: "New", items: [], color: DEFAULT_TIER_COLORS[prev.length % DEFAULT_TIER_COLORS.length] }
      if (afterIndex === null) return [...prev, newTier]
      const copy = [...prev]
      copy.splice(afterIndex + 1, 0, newTier)
      return copy
    })
  }

  function deleteTier(index: number) { setTiers((prev) => { const copy = [...prev]; copy.splice(index, 1); return copy }) }

  function addTierList() {
    const name = `Tier List ${tierLists.length + 1}`
    setTierLists(prev => [...prev, { name, tiers: DEFAULT_TIER_NAMES.map((n, i) => ({ name: n, items: [], color: DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length] })) }])
    setActiveListIndex(tierLists.length)
  }

  function removeTierList(index: number) {
    if (tierLists.length <= 1) return
    if (!confirm(`Delete "${tierLists[index]?.name}"?`)) return
    setTierLists(prev => prev.filter((_, i) => i !== index))
    setActiveListIndex(prev => {
      const newLen = tierLists.length - 1
      if (prev > index) return prev - 1
      if (prev >= newLen) return Math.max(0, newLen - 1)
      return prev
    })
  }

  function renameTierList(index: number) {
    const current = tierLists[index]?.name ?? ""
    const newName = prompt("Rename tier list:", current)
    if (newName == null || newName.trim() === "") return
    setTierLists(prev => prev.map((tl, i) => i === index ? { ...tl, name: newName.trim() } : tl))
  }

  function moveTierLeft(index: number) { setTiers((prev) => { if (index <= 0) return prev; const copy = [...prev]; const tmp = copy[index - 1]; copy[index - 1] = copy[index]; copy[index] = tmp; return copy }) }
  function moveTierRight(index: number) { setTiers((prev) => { if (index >= prev.length - 1) return prev; const copy = [...prev]; const tmp = copy[index + 1]; copy[index + 1] = copy[index]; copy[index] = tmp; return copy }) }

  function moveItemUp(tierIndex: number, itemIndex: number) { setTiers((prev) => { const copy = prev.map((t) => ({ ...t, items: [...t.items] })); const items = copy[tierIndex]?.items; if (!items || itemIndex <= 0) return prev; const tmp = items[itemIndex - 1]; items[itemIndex - 1] = items[itemIndex]; items[itemIndex] = tmp; return copy }) }
  function moveItemDown(tierIndex: number, itemIndex: number) { setTiers((prev) => { const copy = prev.map((t) => ({ ...t, items: [...t.items] })); const items = copy[tierIndex]?.items; if (!items || itemIndex >= items.length - 1) return prev; const tmp = items[itemIndex + 1]; items[itemIndex + 1] = items[itemIndex]; items[itemIndex] = tmp; return copy }) }

  

  

  function switchMode(newMode: "characters" | "heartprints") {
    if (newMode === mode) return
    try { localStorage.setItem(mode === "characters" ? LISTS_STORAGE_KEY : HEART_LISTS_KEY, JSON.stringify(tierLists)) } catch (e) {}
    const savedKey = newMode === "characters" ? LISTS_STORAGE_KEY : HEART_LISTS_KEY
    try {
      const saved = localStorage.getItem(savedKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTierLists(parsed)
          setActiveListIndex(0)
          setMode(newMode)
          return
        }
      }
    } catch (e) {}
    setTierLists([{ name: "Tier List 1", tiers: DEFAULT_TIER_NAMES.map((n, i) => ({ name: n, items: [], color: DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length] })) }])
    setActiveListIndex(0)
    setMode(newMode)
  }

  return (
    <main className="site-page slime-page-tier-maker text-foreground">
      <div className="max-w-7xl mx-auto pl-6 pr-4 sm:pl-8 sm:pr-6 lg:px-8 py-8">
        {/* Mode selector */}
        <div className="mb-4 flex gap-2 border-b border-border/[0.22] pb-3">
          <button
            onClick={() => switchMode("characters")}
            className={`px-4 py-1.5 rounded text-sm font-medium border transition-colors ${mode === "characters" ? "bg-[rgba(46,92,132,0.92)] text-foreground border-accent/50" : "bg-card/55 text-foreground/65 border-border/[0.22] hover:text-foreground hover:bg-[rgba(46,92,132,0.92)]"}`}
          >
            Characters
          </button>
          <button
            onClick={() => switchMode("heartprints")}
            className={`px-4 py-1.5 rounded text-sm font-medium border transition-colors ${mode === "heartprints" ? "bg-[rgba(46,92,132,0.92)] text-foreground border-accent/50" : "bg-card/55 text-foreground/65 border-border/[0.22] hover:text-foreground hover:bg-[rgba(46,92,132,0.92)]"}`}
          >
            Heartprints
          </button>
        </div>

        {/* Tier list tabs */}
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          {tierLists.map((tl, i) => (
            <button
              key={i}
              onClick={() => setActiveListIndex(i)}
              onDoubleClick={() => renameTierList(i)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border whitespace-nowrap transition-colors ${i === activeListIndex ? 'bg-[rgba(46,92,132,0.92)] text-foreground border-accent/50' : 'bg-card/55 text-foreground/65 border-border/[0.22] hover:text-foreground hover:bg-[rgba(46,92,132,0.92)]'}`}
              title="Double-click to rename"
            >
              <span className="truncate max-w-[120px]">{tl.name}</span>
              {tierLists.length > 1 && (
                <span
                  onClick={(e) => { e.stopPropagation(); removeTierList(i) }}
                  className="ml-0.5 text-foreground/65 hover:text-red-400 text-xs cursor-pointer"
                >
                  ×
                </span>
              )}
            </button>
          ))}
          <button onClick={addTierList} className="px-2 py-1.5 rounded bg-card/55 text-foreground/65 hover:text-foreground border border-border/[0.22] text-sm" title="Add new tier list">+</button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <button className="px-3 py-1 rounded bg-card/55 text-foreground hover:text-foreground hover:bg-[rgba(46,92,132,0.92)] border border-border/[0.22] text-sm" onClick={() => addTier(null)}>Add Tier</button>
          <button className="px-3 py-1 rounded bg-card/55 text-foreground hover:text-foreground hover:bg-[rgba(46,92,132,0.92)] border border-border/[0.22] text-sm" onClick={copyShareLink}>Copy Share Link</button>
          <button className="px-3 py-1 rounded bg-card/55 text-foreground hover:text-foreground hover:bg-[rgba(46,92,132,0.92)] border border-border/[0.22] text-sm" onClick={exportJson}>Export</button>
          <button className="px-3 py-1 rounded bg-card/55 text-foreground hover:text-foreground hover:bg-[rgba(46,92,132,0.92)] border border-border/[0.22] text-sm" onClick={exportAllJson}>Export All</button>
          <label className="px-3 py-1 rounded bg-card/55 text-foreground hover:text-foreground hover:bg-[rgba(46,92,132,0.92)] border border-border/[0.22] text-sm cursor-pointer">
            Import
            <input type="file" accept="application/json" className="hidden" onChange={(e) => importJson(e.target.files?.[0] ?? null)} />
          </label>
          <button className="px-3 py-1 rounded bg-card/55 text-foreground hover:text-foreground hover:bg-[rgba(46,92,132,0.92)] border border-border/[0.22] text-sm" onClick={resetAll}>Reset</button>
          <button className="px-3 py-1 rounded bg-card/55 text-foreground hover:text-foreground hover:bg-[rgba(46,92,132,0.92)] border border-border/[0.22] text-sm" onClick={async () => { await exportAsImage(); }}>Export Image</button>
          <div className="ml-auto inline-flex items-center rounded-md border border-border/[0.28] bg-card/85 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-md">{tiers.length} tiers</div>
        </div>

        <div id="tier-board" className="space-y-3">
          {tiers.map((tier, idx) => {
            const defaultColor = DEFAULT_TIER_COLORS[idx % DEFAULT_TIER_COLORS.length]
            const curRgb = hexToRgb(tier.color ?? defaultColor)
            return (
              <div key={`tier-${idx}`} className="flex items-stretch">
                <div className={`w-28 min-w-[7rem] flex items-stretch font-bold border border-black/20 rounded-l-md`} style={{ backgroundColor: tier.color ?? DEFAULT_TIER_COLORS[idx % DEFAULT_TIER_COLORS.length] }}>
                  <div className="w-full px-1 flex items-center justify-center relative h-full">
                    <div
                      data-tid="tier-name"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => {
                        const name = (e.target as HTMLElement).innerText
                        setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, name } : t)))
                      }}
                      className="bg-transparent text-sm text-center w-full leading-tight font-bold p-0 m-0 focus:outline-none whitespace-pre-wrap break-words"
                      style={{
                        color: getContrastColor(tier.color ?? DEFAULT_TIER_COLORS[idx % DEFAULT_TIER_COLORS.length]),
                        minHeight: '2rem',
                        display: 'block',
                        textAlign: 'center',
                        padding: 0,
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {tier.name}
                    </div>
                  </div>
                </div>

                <div data-tier-index={idx} className="flex-1 min-h-[140px] md:min-h-[5rem] border border-border/[0.22]/50 bg-muted/80 text-foreground rounded-md flex items-start justify-between px-3 py-3 pr-35 md:pr-20 relative overflow-hidden" onDragOver={(e) => { e.preventDefault(); const at = computeDropIndex(e.currentTarget as HTMLElement, e.clientX, e.clientY); setDropPreview((p) => (p && p.tier === idx && p.index === at) ? p : { tier: idx, index: at }) }} onDrop={(e) => handleTierDrop(e as React.DragEvent, idx)}>
                  <div ref={animateRef} className="flex-1 min-w-0 flex flex-wrap gap-1 md:gap-2 items-start max-w-[calc(100vw-7rem)] md:max-w-none">
                    {tier.items.map((id, itemIndex) => {
                      if (mode === "heartprints") {
                        const h = allHearts.find((x) => x.heartprint_id === Number(id))
                        if (!h) return null
                        return (
                          <div
                            key={id}
                            draggable
                            onDragStart={(e) => handleDragStart(e as React.DragEvent, id, idx)}
                            onDragOver={(e) => e.preventDefault()}
                            data-tier-index={idx}
                            data-item-index={itemIndex}
                            onPointerDown={(e) => { if ((e as any).pointerType === 'touch') { try { (e as any).preventDefault() } catch (err) {} touchLastYRef.current = (e as any).clientY; touchDragRef.current = { charId: id, fromTierIndex: idx }; touchDragImageRef.current = h.picture_path.replace("{0}", "M") + ".webp"; try { createTouchGhost(h.picture_path.replace("{0}", "M") + ".webp"); moveTouchGhost((e as any).clientX, (e as any).clientY) } catch (err) {} } }}
                            onTouchStart={(e) => { if ((e as any).touches && (e as any).touches.length === 1) { try { (e as any).preventDefault() } catch (err) {} const t = (e as any).touches[0]; touchLastYRef.current = t.clientY; touchDragRef.current = { charId: id, fromTierIndex: idx }; touchDragImageRef.current = h.picture_path.replace("{0}", "M") + ".webp"; try { createTouchGhost(h.picture_path.replace("{0}", "M") + ".webp"); moveTouchGhost(t.clientX, t.clientY) } catch (err) {} } }}
                            onTouchCancel={() => { touchDragRef.current = null; touchDragImageRef.current = null; touchLastYRef.current = null; removeTouchGhost() }}
                            className="relative w-40 h-20 flex-shrink-0"
                            title={h.title}
                            style={itemDragStyle(idx, itemIndex, tier.items.length, id)}
                          >
                            <img
                              src={h.picture_path.replace("{0}", "M") + ".webp"}
                              alt={h.title}
                              draggable={false}
                              onContextMenu={(e) => e.preventDefault()}
                              className="w-full h-full object-cover"
                              style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserDrag: "none" } as any}
                            />
                          </div>
                        )
                      }
                      const [baseId, variant] = String(id).split(":")
                      const c = allChars.find((x) => x.master_pc_id === Number(baseId))
                      if (!c) return null
                      const wc = wikiChars.find((w: any) => w.master_pc_id === c.master_pc_id)
                      const visualTier = wc ? getCharacterVisualTier(wc) : 5
                      const pfx = wc && isProtectorChar(wc) ? "Bless" : "Member"
                      const miniFrame = wc ? getMiniFramePath(visualTier, pfx) : null
                      const starAsset = RARITY_ASSETS[visualTier] ?? null
                      return (
                        <div
                          key={id}
                          draggable
                          onDragStart={(e) => handleDragStart(e as React.DragEvent, id, idx)}
                          onDragOver={(e) => e.preventDefault()}
                          data-tier-index={idx}
                          data-item-index={itemIndex}
                          onPointerDown={(e) => { if ((e as any).pointerType === 'touch') { try { (e as any).preventDefault() } catch (err) {} touchLastYRef.current = (e as any).clientY; touchDragRef.current = { charId: id, fromTierIndex: idx }; touchDragImageRef.current = c.images.icon; try { createTouchGhost(c.images.icon); moveTouchGhost((e as any).clientX, (e as any).clientY) } catch (err) {} } }}
                          onTouchStart={(e) => { if ((e as any).touches && (e as any).touches.length === 1) { try { (e as any).preventDefault() } catch (err) {} const t = (e as any).touches[0]; touchLastYRef.current = t.clientY; touchDragRef.current = { charId: id, fromTierIndex: idx }; touchDragImageRef.current = c.images.icon; try { createTouchGhost(c.images.icon); moveTouchGhost(t.clientX, t.clientY) } catch (err) {} } }}
                          onTouchCancel={() => { touchDragRef.current = null; touchDragImageRef.current = null; touchLastYRef.current = null; removeTouchGhost() }}
                          className="relative w-20 h-20 flex-shrink-0"
                          title={c.name}
                          style={itemDragStyle(idx, itemIndex, tier.items.length, id)}
                        >
                          {visualTier >= 8
                            ? <div className="absolute inset-[7%]"><img src={getMiniBasePath(visualTier, pfx)} alt="" className="pointer-events-none w-full h-full object-fill" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} /></div>
                            : <img src={getMiniBasePath(visualTier, pfx)} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-fill" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                          {visualTier >= 8
                            ? <div className="absolute inset-[4%] rounded-[6%] overflow-hidden"><img src={c.images.icon} alt={c.name} draggable={false} onContextMenu={(e) => e.preventDefault()} className="w-full h-full object-cover object-top" style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserDrag: "none" } as any} /></div>
                            : <img src={c.images.icon} alt={c.name} draggable={false} onContextMenu={(e) => e.preventDefault()} className="absolute inset-0 w-full h-full object-cover object-top" style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserDrag: "none" } as any} />}
                          {miniFrame && <img src={miniFrame} alt="rarity-frame" className="pointer-events-none absolute inset-0 w-full h-full object-fill z-10" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                          {starAsset && <img src={starAsset} alt="" className="pointer-events-none absolute bottom-0 left-0 right-0 h-[28%] object-contain z-20" />}
                          {variant === "skill" && <img src="/skill-icons/skill_integrated_3400001_ItemM.webp" alt="skill-change" draggable={false} onContextMenu={(e) => e.preventDefault()} className="absolute bottom-1 right-1 w-5 h-5 z-20" style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserDrag: "none" } as any} />}
                        </div>
                      )
                    })}
                  </div>



                  <div className="absolute bottom-2 right-2 md:top-3 md:bottom-auto md:top-3 md:bottom-auto flex flex-col md:flex-row gap-2 items-end md:items-start z-20">
                    <div className="flex flex-col gap-1">
                      <button className="text-xs bg-card/55 text-foreground hover:text-foreground hover:bg-[rgba(46,92,132,0.92)] border border-border/[0.22] px-2 py-1 rounded" onClick={() => moveTierLeft(idx)} aria-label="Move tier up">▲</button>
                      <button className="text-xs bg-card/55 text-foreground hover:text-foreground hover:bg-[rgba(46,92,132,0.92)] border border-border/[0.22] px-2 py-1 rounded" onClick={() => moveTierRight(idx)} aria-label="Move tier down">▼</button>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button className="text-xs bg-card/55 text-foreground hover:text-foreground hover:bg-[rgba(46,92,132,0.92)] border border-border/[0.22] px-2 py-1 rounded" onClick={() => deleteTier(idx)}>Del</button>
                      <div className="pt-0">
                        <TierEditDialog tier={tier} idx={idx} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 mb-2">
          {mode === "heartprints" ? (
            <>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                <div className="relative w-64 lg:w-80 ml-auto">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/65" />
                  <Input value={imageSearch} onChange={(e) => setImageSearch(e.target.value)} placeholder="Search heartprints" className="h-9 w-full border-border/[0.22] bg-card/55 pl-10 text-foreground placeholder:text-foreground/65" />
                </div>
              </div>
              <div data-pins="true" className="grid grid-cols-6 gap-2 max-h-full lg:overflow-auto image-scroll lg:max-h-[40vh]" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropOnPins(e as React.DragEvent)}>
                {heartAvailablePins.map((pin) => (
                  <div
                    key={pin.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e as React.DragEvent, pin.id, -1)}
                    onPointerDown={(e) => { if ((e as any).pointerType === 'touch') { try { (e as any).preventDefault() } catch (err) {} touchLastYRef.current = (e as any).clientY; touchDragRef.current = { charId: pin.id, fromTierIndex: -1 }; touchDragImageRef.current = pin.image; try { createTouchGhost(pin.image); moveTouchGhost((e as any).clientX, (e as any).clientY) } catch (err) {} } }}
                    onTouchStart={(e) => { if ((e as any).touches && (e as any).touches.length === 1) { try { (e as any).preventDefault() } catch (err) {} const t = (e as any).touches[0]; touchLastYRef.current = t.clientY; touchDragRef.current = { charId: pin.id, fromTierIndex: -1 }; touchDragImageRef.current = pin.image; try { createTouchGhost(pin.image); moveTouchGhost(t.clientX, t.clientY) } catch (err) {} } }}
                    onTouchCancel={() => { touchDragRef.current = null; touchDragImageRef.current = null; touchLastYRef.current = null; removeTouchGhost() }}
                    data-pin-id={pin.id}
                    title={pin.name}
                    style={{ backgroundColor: 'rgb(20 53 82)', touchAction: 'none' }}
                  >
                    <img
                      src={pin.image}
                      alt={pin.name}
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      className="w-full h-full object-cover"
                      style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserDrag: "none" } as any}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-row items-center gap-2">
                    <span className="inline-flex items-center rounded-md border border-border/[0.28] bg-card/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground whitespace-nowrap backdrop-blur-md">ROLE</span>
                    <div className="flex items-center gap-2 overflow-x-auto">
                      <button className={`h-8 w-8 rounded flex items-center justify-center text-xs transition-colors flex-shrink-0 ${roleFilter === "all" ? "bg-[rgba(46,92,132,0.92)] text-foreground" : "text-foreground/65 hover:bg-[rgba(46,92,132,0.7)] hover:text-foreground"}`} onClick={() => setRoleFilter("all")} aria-label="All roles"><span className="select-none">All</span></button>
                      <button className={`h-8 w-8 rounded flex items-center justify-center text-sm transition-colors flex-shrink-0 ${roleFilter === "protector" ? "bg-[rgba(46,92,132,0.92)] text-foreground" : "text-foreground/65 hover:bg-[rgba(46,92,132,0.7)] hover:text-foreground"}`} onClick={() => setRoleFilter("protector")} aria-label="Protector"><img src="/UI/Texture/CommonLotteryInfoPanelAtlas/icCharaTypeBless.webp" alt="" className="w-5 h-5 object-contain" /></button>
                      <button className={`h-8 w-8 rounded flex items-center justify-center text-sm transition-colors flex-shrink-0 ${roleFilter === "attacker" ? "bg-[rgba(46,92,132,0.92)] text-foreground" : "text-foreground/65 hover:bg-[rgba(46,92,132,0.7)] hover:text-foreground"}`} onClick={() => setRoleFilter("attacker")} aria-label="Attacker"><img src="/UI/Texture/CommonLotteryInfoPanelAtlas/icCharaTypePc.webp" alt="" className="w-5 h-5 object-contain" /></button>
                    </div>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <span className="inline-flex items-center rounded-md border border-border/[0.28] bg-card/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground whitespace-nowrap backdrop-blur-md">RARITY</span>
                    <div className="flex items-center gap-2 overflow-x-auto">
                      <button className={`h-8 w-8 rounded flex items-center justify-center text-xs transition-colors flex-shrink-0 ${rarityFilter === null ? "bg-[rgba(46,92,132,0.92)] text-foreground" : "text-foreground/65 hover:bg-[rgba(46,92,132,0.7)] hover:text-foreground"}`} onClick={() => setRarityFilter(null)} aria-label="All rarities"><span className="select-none">All</span></button>
                      {[3, 4, 5, 6, 7, 8].map((r) => (
                        <button key={r} onClick={() => setRarityFilter(r)} title={`${r}★`} className={`w-8 h-8 rounded p-0 flex items-center justify-center transition-colors flex-shrink-0 ${rarityFilter === r ? "bg-[rgba(46,92,132,0.92)]" : "bg-transparent hover:bg-[rgba(46,92,132,0.7)]"}`}>
                          <img src={RARITY_ASSETS[r]} alt={`star-${r}`} className="w-5 h-5 object-contain" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="relative w-64 lg:w-80 ml-auto">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/65" />
                  <Input value={imageSearch} onChange={(e) => setImageSearch(e.target.value)} placeholder="Search images" className="h-9 w-full border-border/[0.22] bg-card/55 pl-10 text-foreground placeholder:text-foreground/65" />
                </div>
              </div>
              <div data-pins="true" className="grid grid-cols-12 gap-2 max-h-full lg:overflow-auto image-scroll lg:max-h-[40vh]" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropOnPins(e as React.DragEvent)}>
                {availablePins.map((pin) => {
                  const wc = wikiChars.find((w: any) => w.master_pc_id === pin.masterId)
                  const visualTier = wc ? getCharacterVisualTier(wc) : 5
                  const pfx = wc && isProtectorChar(wc) ? "Bless" : "Member"
                  const miniFrame = wc ? getMiniFramePath(visualTier, pfx) : null
                  const starAsset = RARITY_ASSETS[visualTier] ?? null
                  return (
                    <div
                      key={pin.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e as React.DragEvent, pin.id, -1)}
                      onPointerDown={(e) => { if ((e as any).pointerType === 'touch') { try { (e as any).preventDefault() } catch (err) {} touchLastYRef.current = (e as any).clientY; touchDragRef.current = { charId: pin.id, fromTierIndex: -1 }; touchDragImageRef.current = pin.image; try { createTouchGhost(pin.image); moveTouchGhost((e as any).clientX, (e as any).clientY) } catch (err) {} } }}
                      onTouchStart={(e) => { if ((e as any).touches && (e as any).touches.length === 1) { try { (e as any).preventDefault() } catch (err) {} const t = (e as any).touches[0]; touchLastYRef.current = t.clientY; touchDragRef.current = { charId: pin.id, fromTierIndex: -1 }; touchDragImageRef.current = pin.image; try { createTouchGhost(pin.image); moveTouchGhost(t.clientX, t.clientY) } catch (err) {} } }}
                      onTouchCancel={() => { touchDragRef.current = null; touchDragImageRef.current = null; touchLastYRef.current = null; removeTouchGhost() }}
                      data-pin-id={pin.id}
                      className="relative w-16 h-16 rounded-md cursor-grab overflow-hidden"
                      title={pin.name}
                      style={{ touchAction: 'none' }}
                    >
                      {visualTier >= 8
                        ? <div className="absolute inset-[7%]"><img src={getMiniBasePath(visualTier, pfx)} alt="" className="pointer-events-none w-full h-full object-fill" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} /></div>
                        : <img src={getMiniBasePath(visualTier, pfx)} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-fill" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                      {visualTier >= 8
                        ? <div className="absolute inset-[4%] rounded-[6%] overflow-hidden"><img src={pin.image} alt={pin.name} draggable={false} onContextMenu={(e) => e.preventDefault()} className="w-full h-full object-cover object-top" style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserDrag: "none" } as any} /></div>
                        : <img src={pin.image} alt={pin.name} draggable={false} onContextMenu={(e) => e.preventDefault()} className="absolute inset-0 w-full h-full object-cover object-top" style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserDrag: "none" } as any} />}
                      {miniFrame && <img src={miniFrame} alt="rarity-frame" className="pointer-events-none absolute inset-0 w-full h-full object-fill z-10" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                      {starAsset && <img src={starAsset} alt="" className="pointer-events-none absolute bottom-0 left-0 right-0 h-[33%] object-contain z-20" />}
                      {pin.variant === "skill" && <img src="/skill-icons/skill_integrated_3400001_ItemM.webp" alt="skill-change" draggable={false} onContextMenu={(e) => e.preventDefault()} className="absolute bottom-1 right-1 w-5 h-5 z-20" style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserDrag: "none" } as any} />}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
