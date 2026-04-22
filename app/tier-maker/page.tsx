"use client"

import React, { useEffect, useMemo, useState, useRef } from "react"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"
import { getAllWikiCharacters, getCharacterVisualTier } from "@/lib/pc-wiki"
import { Input } from "@/components/ui/input"
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

type Tier = { name: string; items: string[]; color?: string }
type TierListEntry = { name: string; tiers: Tier[] }

const DEFAULT_TIER_NAMES = ["S", "A", "B", "C", "D"]
const STORAGE_KEY = "tierList_v1"
const LISTS_STORAGE_KEY = "tierLists_v2"

const DEFAULT_TIER_COLORS = ["#dc2626", "#ea580c", "#eab308", "#f59e0b", "#84cc16"]
const RARITY_ASSETS: Record<number, string> = {
  3: "/stars/starCharaL3A.webp",
  4: "/stars/starCharaL4A.webp",
  5: "/stars/starCharaL5A.webp",
  6: "/stars/starCharaL6A.webp",
  7: "/stars/starCharaL7A.webp",
  8: "/stars/starCharaL7_Epic.webp",
}

function getMiniFramePath(tier: number, pfx: string) {
  if (tier === 8) return `UI/Texture/CommonRarityAtlas/frame${pfx}M7_Epic.webp`
  if (tier === 7) return `UI/Texture/CommonRarityAtlas/frame${pfx}M6_SpecialPlus.webp`
  const t = Math.min(Math.max(tier, 3), 7)
  return `UI/Texture/CommonRarityAtlas/frame${pfx}M${t}.webp`
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

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function encodeUnicodeToBase64(str: string) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (_m, p1) {
      return String.fromCharCode(parseInt(p1, 16))
    }),
  )
}

function decodeBase64ToUnicode(b64: string) {
  try {
    const bin = atob(b64)
    const str = Array.prototype.map
      .call(bin, function (ch: string) {
        return "%" + ("00" + ch.charCodeAt(0).toString(16)).slice(-2)
      })
      .join("")
    return decodeURIComponent(str)
  } catch (e) {
    return ""
  }
}

export default function TierMakerPage() {
  const allChars = useMemo(() => getAllCharacterBrowserData(), [])
  const wikiChars = useMemo(() => getAllWikiCharacters(), [])

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

  useEffect(() => {
    try {
      localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(tierLists))
    } catch (e) {}
  }, [tierLists])

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const params = new URLSearchParams(window.location.search)
      const d = params.get("d")
      const gistParam = params.get("gist")
      if (d) {
        try {
          const decoded = decodeBase64ToUnicode(d)
          const parsed = JSON.parse(decoded)
          if (parsed?.lists && Array.isArray(parsed.lists)) {
            setTierLists(parsed.lists)
            setActiveListIndex(0)
            return
          }
          if (Array.isArray(parsed)) {
            setTierLists([{ name: "Shared List", tiers: parsed }])
            setActiveListIndex(0)
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
              if (json?.tiers) {
                setTierLists([{ name: "Gist List", tiers: json.tiers }])
                setActiveListIndex(0)
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
          <button className="text-xs bg-[#232c3a] text-gray-200 hover:text-white hover:bg-[#2a3444] border border-gray-700 px-2 py-1 rounded">Edit</button>
        </DialogTrigger>
        <DialogContent className="w-80 bg-[#0b1220] text-white border border-gray-700">
          <DialogHeader>
            <DialogTitle>Edit tier</DialogTitle>
            <DialogDescription>Change the tier name and color</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 rounded-md border border-gray-700 bg-[#232c3a] px-3 text-white placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="text-sm text-gray-300 mb-1 block">Color</label>
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
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-9 rounded-md border-gray-600 bg-gray-700 px-2 text-white w-28 text-sm placeholder:text-gray-400" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <button onClick={handleSave} className="px-3 py-1 bg-[#232c3a] text-white rounded">Save</button>
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

  function appendCharToTier(charId: string, tierIndex: number) {
    setTiers((prev) => {
      const copy = prev.map((t) => ({ ...t, items: t.items.filter((id) => id !== charId) }))
      if (!copy[tierIndex]) return prev
      copy[tierIndex].items.push(charId)
      return copy
    })
  }

  function handleDragStart(e: React.DragEvent, charId: string, fromTierIndex: number) {
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
      insertCharAt(charId, targetTierIndex, targetItemIndex)
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
      const { charId } = touchDragRef.current
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
          // Prevent default panning while a drag is active
          try { ev.preventDefault() } catch (e) {}
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
      const { charId } = touchDragRef.current
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

  function copyShareLink() {
    try {
      const payload = tierLists.length === 1 ? tiers : { lists: tierLists }
      const encoded = encodeUnicodeToBase64(JSON.stringify(payload))
      const url = `${window.location.origin}${window.location.pathname}?d=${encodeURIComponent(encoded)}`
      navigator.clipboard.writeText(url)
      alert("Share link copied to clipboard")
    } catch (e) {
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
        const nameInputs = (clone.querySelectorAll('[data-tid="tier-name"]') as NodeListOf<HTMLInputElement>) || []
        nameInputs.forEach((inp) => {
          const txt = inp.value ?? inp.getAttribute("value") ?? ""
          const cs = window.getComputedStyle(inp as Element)
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
          inp.parentNode?.replaceChild(d, inp)
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
    try { localStorage.removeItem(LISTS_STORAGE_KEY); localStorage.removeItem(STORAGE_KEY) } catch (e) {}
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

  

  

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0a1a2f] via-[#0f1f35] to-[#1a2740]">
      <div className="max-w-7xl mx-auto pl-6 pr-4 sm:pl-8 sm:pr-6 lg:px-8 py-8">
        

        {/* Tier list tabs */}
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          {tierLists.map((tl, i) => (
            <button
              key={i}
              onClick={() => setActiveListIndex(i)}
              onDoubleClick={() => renameTierList(i)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border whitespace-nowrap transition-colors ${i === activeListIndex ? 'bg-[#2a3444] text-white border-gray-500' : 'bg-[#232c3a] text-gray-400 border-gray-700 hover:text-white hover:bg-[#2a3444]'}`}
              title="Double-click to rename"
            >
              <span className="truncate max-w-[120px]">{tl.name}</span>
              {tierLists.length > 1 && (
                <span
                  onClick={(e) => { e.stopPropagation(); removeTierList(i) }}
                  className="ml-0.5 text-gray-500 hover:text-red-400 text-xs cursor-pointer"
                >
                  ×
                </span>
              )}
            </button>
          ))}
          <button onClick={addTierList} className="px-2 py-1.5 rounded bg-[#232c3a] text-gray-400 hover:text-white border border-gray-700 text-sm" title="Add new tier list">+</button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <button className="px-3 py-1 rounded bg-[#232c3a] text-gray-200 hover:text-white hover:bg-[#2a3444] border border-gray-700 text-sm" onClick={() => addTier(null)}>Add Tier</button>
          <button className="px-3 py-1 rounded bg-[#232c3a] text-gray-200 hover:text-white hover:bg-[#2a3444] border border-gray-700 text-sm" onClick={copyShareLink}>Copy Share Link</button>
          <button className="px-3 py-1 rounded bg-[#232c3a] text-gray-200 hover:text-white hover:bg-[#2a3444] border border-gray-700 text-sm" onClick={exportJson}>Export</button>
          <button className="px-3 py-1 rounded bg-[#232c3a] text-gray-200 hover:text-white hover:bg-[#2a3444] border border-gray-700 text-sm" onClick={exportAllJson}>Export All</button>
          <label className="px-3 py-1 rounded bg-[#232c3a] text-gray-200 hover:text-white hover:bg-[#2a3444] border border-gray-700 text-sm cursor-pointer">
            Import
            <input type="file" accept="application/json" className="hidden" onChange={(e) => importJson(e.target.files?.[0] ?? null)} />
          </label>
          <button className="px-3 py-1 rounded bg-[#232c3a] text-gray-200 hover:text-white hover:bg-[#2a3444] border border-gray-700 text-sm" onClick={resetAll}>Reset</button>
          <button className="px-3 py-1 rounded bg-[#232c3a] text-gray-200 hover:text-white hover:bg-[#2a3444] border border-gray-700 text-sm" onClick={async () => { await exportAsImage(); }}>Export Image</button>
          <div className="ml-auto text-sm text-gray-300">{tiers.length} tiers</div>
        </div>

        <div id="tier-board" className="space-y-3">
          {tiers.map((tier, idx) => {
            const defaultColor = DEFAULT_TIER_COLORS[idx % DEFAULT_TIER_COLORS.length]
            const curRgb = hexToRgb(tier.color ?? defaultColor)
            return (
              <div key={`tier-${idx}`} className="flex items-stretch">
                <div className={`w-28 min-w-[7rem] flex items-stretch font-bold border border-black/20 rounded-l-md`} style={{ backgroundColor: tier.color ?? DEFAULT_TIER_COLORS[idx % DEFAULT_TIER_COLORS.length] }}>
                  <div className="w-full px-1 flex items-center justify-center relative h-full">
                    <input
                      data-tid="tier-name"
                      value={tier.name}
                      onChange={(e) => {
                        const name = e.target.value
                        setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, name } : t)))
                      }}
                      className="bg-transparent text-sm text-center w-full h-full leading-none font-bold"
                      style={{ color: getContrastColor(tier.color ?? DEFAULT_TIER_COLORS[idx % DEFAULT_TIER_COLORS.length]) }}
                    />
                  </div>
                </div>

                <div data-tier-index={idx} className="flex-1 min-h-[5rem] border border-gray-700/50 bg-[#0f1b2a]/80 text-white rounded-md flex items-start justify-between px-3 py-3 relative" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropOnTier(e as React.DragEvent, idx)}>
                  <div className="flex flex-wrap gap-2 items-start">
                    {tier.items.map((id, itemIndex) => {
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
                          onDrop={(e) => handleDropOnItem(e as React.DragEvent, idx, itemIndex)}
                          data-tier-index={idx}
                          data-item-index={itemIndex}
                          onPointerDown={(e) => { if ((e as any).pointerType === 'touch') { try { (e as any).preventDefault() } catch (err) {} touchLastYRef.current = (e as any).clientY; touchDragRef.current = { charId: id, fromTierIndex: idx }; touchDragImageRef.current = c.images.icon; try { createTouchGhost(c.images.icon); moveTouchGhost((e as any).clientX, (e as any).clientY) } catch (err) {} } }}
                          onTouchStart={(e) => { if ((e as any).touches && (e as any).touches.length === 1) { try { (e as any).preventDefault() } catch (err) {} const t = (e as any).touches[0]; touchLastYRef.current = t.clientY; touchDragRef.current = { charId: id, fromTierIndex: idx }; touchDragImageRef.current = c.images.icon; try { createTouchGhost(c.images.icon); moveTouchGhost(t.clientX, t.clientY) } catch (err) {} } }}
                          onTouchCancel={() => { touchDragRef.current = null; touchDragImageRef.current = null; touchLastYRef.current = null; removeTouchGhost() }}
                          className="relative w-20 h-20 flex-shrink-0"
                          title={c.name}
                          style={{ touchAction: 'none' }}
                        >
                          <div className="w-full h-full flex items-center justify-center bg-[#0b1220] rounded-md p-1">
                            <img
                              src={c.images.icon}
                              alt={c.name}
                              draggable={false}
                              onContextMenu={(e) => e.preventDefault()}
                              className="max-w-full max-h-full object-contain"
                              style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserDrag: "none" } as any}
                            />
                          </div>
                          {miniFrame && <img src={miniFrame} alt="rarity-frame" className="pointer-events-none absolute inset-0 w-full h-full object-fill z-10" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                          {starAsset && <img src={starAsset} alt="" className="pointer-events-none absolute bottom-0 left-0 right-0 h-[28%] object-contain z-20" />}
                          {variant === "skill" && <img src="/skill-icons/skill_integrated_3400001_ItemM.webp" alt="skill-change" draggable={false} onContextMenu={(e) => e.preventDefault()} className="absolute bottom-1 right-1 w-5 h-5 z-20" style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserDrag: "none" } as any} />}
                        </div>
                      )
                    })}
                  </div>



                  <div className="flex gap-3 ml-4 items-start">
                    <div className="flex flex-col gap-2">
                      <button className="text-xs bg-[#232c3a] text-gray-200 hover:text-white hover:bg-[#2a3444] border border-gray-700 px-2 py-1 rounded" onClick={() => moveTierLeft(idx)} aria-label="Move tier up">▲</button>
                      <button className="text-xs bg-[#232c3a] text-gray-200 hover:text-white hover:bg-[#2a3444] border border-gray-700 px-2 py-1 rounded" onClick={() => moveTierRight(idx)} aria-label="Move tier down">▼</button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button className="text-xs bg-[#232c3a] text-gray-200 hover:text-white hover:bg-[#2a3444] border border-gray-700 px-2 py-1 rounded" onClick={() => deleteTier(idx)}>Del</button>
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1 mb-2">
              <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1">
                      <span className="text-xs text-gray-300">ROLE</span>
                      <div className="flex items-center gap-2 overflow-x-auto">
                        <button
                          className={`h-8 w-8 rounded flex items-center justify-center text-xs transition-colors ${roleFilter === "all" ? "bg-[#2a3444] text-white" : "text-gray-400 hover:bg-gray-600 hover:text-white"}`}
                          onClick={() => setRoleFilter("all")}
                          aria-label="All roles"
                        >
                          <span className="select-none">All</span>
                        </button>

                        <button
                          className={`h-8 w-8 rounded flex items-center justify-center text-sm transition-colors ${roleFilter === "protector" ? "bg-[#2a3444] text-white" : "text-gray-400 hover:bg-gray-600 hover:text-white"}`}
                          onClick={() => setRoleFilter("protector")}
                          aria-label="Protector"
                        >
                          <img src="/UI/Texture/CommonLotteryInfoPanelAtlas/icCharaTypeBless.webp" alt="" className="w-5 h-5 object-contain" />
                        </button>

                        <button
                          className={`h-8 w-8 rounded flex items-center justify-center text-sm transition-colors ${roleFilter === "attacker" ? "bg-[#2a3444] text-white" : "text-gray-400 hover:bg-gray-600 hover:text-white"}`}
                          onClick={() => setRoleFilter("attacker")}
                          aria-label="Attacker"
                        >
                          <img src="/UI/Texture/CommonLotteryInfoPanelAtlas/icCharaTypePc.webp" alt="" className="w-5 h-5 object-contain" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="text-xs text-gray-300">RARITY</span>
                      <div className="flex items-center gap-2">
                        <button
                          className={`h-8 w-8 rounded flex items-center justify-center text-xs transition-colors ${rarityFilter === null ? "bg-[#2a3444] text-white" : "text-gray-400 hover:bg-gray-600 hover:text-white"}`}
                          onClick={() => setRarityFilter(null)}
                          aria-label="All rarities"
                        >
                          <span className="select-none">All</span>
                        </button>
                        {[3, 4, 5, 6, 7, 8].map((r) => (
                          <button
                            key={r}
                            onClick={() => setRarityFilter(r)}
                            title={`${r}★`}
                            className={`w-8 h-8 rounded p-0 flex items-center justify-center transition-colors ${rarityFilter === r ? "bg-[#2a3444]" : "bg-transparent hover:bg-gray-600"}`}
                          >
                            <img src={RARITY_ASSETS[r]} alt={`star-${r}`} className="w-5 h-5 object-contain" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
              </div>
            </div>

            <div className="relative w-full sm:w-64 lg:w-80 mt-1 sm:mt-0 sm:ml-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input value={imageSearch} onChange={(e) => setImageSearch(e.target.value)} placeholder="Search images" className="h-9 w-full border-gray-600 bg-gray-700 pl-10 text-white placeholder:text-gray-400" />
            </div>
          </div>

          <div data-pins="true" className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2 max-h-[40vh] overflow-auto image-scroll" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropOnPins(e as React.DragEvent)}>
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
                  className="relative w-16 h-16 rounded-md p-1 cursor-grab flex items-center justify-center"
                  title={pin.name}
                  style={{ backgroundColor: 'rgb(55 65 81)', touchAction: 'none' }}
                >
                  <img
                    src={pin.image}
                    alt={pin.name}
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    className="max-w-full max-h-full object-contain"
                    style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserDrag: "none" } as any}
                  />
                  {miniFrame && <img src={miniFrame} alt="rarity-frame" className="pointer-events-none absolute inset-0 w-full h-full object-fill z-10" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                  {starAsset && <img src={starAsset} alt="" className="pointer-events-none absolute bottom-0 left-0 right-0 h-[33%] object-contain z-20" />}
                  {pin.variant === "skill" && <img src="/skill-icons/skill_integrated_3400001_ItemM.webp" alt="skill-change" draggable={false} onContextMenu={(e) => e.preventDefault()} className="absolute bottom-1 right-1 w-5 h-5 z-20" style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserDrag: "none" } as any} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}
