"use client"

import { useEffect, useMemo, useState } from "react"
import type { WikiCharacter } from "@/lib/pc-wiki"
import { toPublicAssetPath, getCharacterVisualTier, getDisplayElementLabel, normalizeLabel, getForceIconLookup } from "@/lib/pc-wiki"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

export default function TeamBuilderClient({ characters }: { characters: WikiCharacter[] }) {
  const [slots, setSlots] = useState<Array<number | null>>(Array(6).fill(null))
  const [miniSlots, setMiniSlots] = useState<Array<number | null>>(Array(6).fill(null))
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null)
  const [pickerMode, setPickerMode] = useState<"main" | "mini">("main")
  const [query, setQuery] = useState("")
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [selectedRarity, setSelectedRarity] = useState<number | null>(null)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [slotSizes, setSlotSizes] = useState<Record<number, { partyLW?: number; partyLH?: number; partyMW?: number; partyMH?: number }>>({})

  const allChars = useMemo(() => characters, [characters])
  const elementIconMap: Record<string, string> = {
    air: "/elements/space.png",
    all: "/Image/IcElementBless/IcElementBlessAll.png",
    dark: "/elements/dark.png",
    earth: "/elements/earth.png",
    enhancedair: "/Image/IcElementBless/IcElementBlessEnhancedAir.png",
    enhanceddark: "/Image/IcElementBless/IcElementBlessEnhancedDark.png",
    enhancedearth: "/Image/IcElementBless/IcElementBlessEnhancedEarth.png",
    enhancedfire: "/Image/IcElementBless/IcElementBlessEnhancedFire.png",
    enhancedholy: "/Image/IcElementBless/IcElementBlessEnhancedHoly.png",
    enhancedwater: "/Image/IcElementBless/IcElementBlessEnhancedWater.png",
    enhancedwind: "/Image/IcElementBless/IcElementBlessEnhancedWind.png",
    fire: "/elements/fire.png",
    holy: "/elements/light.png",
    light: "/elements/icElementlight.png",
    magic: "/Image/IcElementBless/IcElementBlessMagic.png",
    physics: "/Image/IcElementBless/IcElementBlessPhysics.png",
    space: "/elements/icElementspace.png",
    special: "/Image/IcElementBless/IcElementBlessSpecial.png",
    water: "/elements/water.png",
    wind: "/elements/wind.png",
  }

  const elementOptions = useMemo(
    () =>
      Array.from(new Set(characters.map((c) => c.element).filter(Boolean))).map((el) => ({
        label: getDisplayElementLabel(el),
        value: el,
        icon: elementIconMap[normalizeLabel(el)] ?? undefined,
      })),
    [characters],
  )
  const rarityOptions = useMemo(() => Array.from(new Set(characters.map((c) => c.rarity).filter(Boolean))).sort(), [characters])
  const tacticsOptions = useMemo(() => Array.from(new Set(characters.map((c) => c.tactics_type).filter(Boolean))).map((v) => ({ label: v, value: v })), [characters])
  const forceOptions = useMemo(() => {
    const map = getForceIconLookup()
    return Array.from(map.entries()).map(([name, icon]) => ({ label: name, value: name, icon: toPublicAssetPath(icon) }))
  }, [characters])

  // preload all known main frame assets (both Member and Bless variants) so we can size placeholders
  const [frameInfo, setFrameInfo] = useState<Record<string, { w: number; h: number; src: string }>>({})
  useEffect(() => {
    const files = [
      'frameBlessL3.png','frameBlessL4.png','frameBlessL5.png','frameBlessL5u.png','frameBlessL5up.png','frameBlessL6u.png','frameBlessL6up.png',
      'frameMemberL3.png','frameMemberL4.png','frameMemberL5.png','frameMemberL6.png','frameMemberL6u.png','frameMemberL6up.png',
    ]
    files.forEach((file) => {
      const img = new Image()
      const src = `/frames/${file}`
      img.src = src
      img.onload = () => setFrameInfo((prev) => ({ ...prev, [file]: { w: img.naturalWidth, h: img.naturalHeight, src } }))
    })
  }, [])

  // helpers to compute frame filenames based on role + visual tier
  function isProtectorCharacter(c: WikiCharacter | null) {
    return !!c && c.character_role === "Supporter"
  }

  function getMainFrameFilenameForCharacter(c: WikiCharacter | null) {
    const tier = c ? getCharacterVisualTier(c) : 5
    const prot = isProtectorCharacter(c)
    const base = prot ? 'frameBlessL' : 'frameMemberL'
    if (tier === 3) return `${base}3.png`
    if (tier === 4) return `${base}4.png`
    if (tier === 5) return `${base}5.png`
    if (tier === 6) return `${base}6u.png`
    if (tier === 7) return `${base}6up.png`
    return `${base}5.png`
  }

  function getMiniFrameFilenameForCharacter(c: WikiCharacter | null) {
    const tier = c ? getCharacterVisualTier(c) : 5
    const prot = isProtectorCharacter(c)
    const base = prot ? 'frameBlessM' : 'frameMemberM'
    return `${base}${tier}.png`
  }

  // local toggle helpers for the modal filters (declared before results so memo deps work)
  const [selectedTactics, setSelectedTactics] = useState<string[]>([])
  const [selectedForces, setSelectedForces] = useState<string[]>([])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allChars.filter((c) => {
      if (q && !(c.name.toLowerCase().includes(q) || String(c.master_pc_id) === q)) return false
      if (selectedElement && normalizeLabel(selectedElement) !== normalizeLabel(c.element)) return false
      if (selectedRarity && Number(c.rarity) !== Number(selectedRarity)) return false
      if (selectedRole && c.character_role?.toLowerCase() !== selectedRole) return false
      if (selectedTactics.length && !selectedTactics.includes(normalizeLabel(c.tactics_type))) return false
      if (selectedForces.length) {
        const forceNames = c.forces.map((f) => f.name)
        if (!selectedForces.every((val) => forceNames.includes(val))) return false
      }
      return true
    })
  }, [allChars, query, selectedElement, selectedRarity, selectedRole, selectedTactics, selectedForces])

  useEffect(() => {
    if (pickerOpenFor === null) setQuery("")
  }, [pickerOpenFor])

  function openPicker(i: number, mode: "main" | "mini" = "main") {
    setPickerOpenFor(i)
    setPickerMode(mode)
  }

  function closePicker() {
    setPickerOpenFor(null)
    setPickerMode("main")
  }

  function selectCharacter(i: number, id: number) {
    if (pickerMode === "mini") {
      setMiniSlots((s) => {
        const copy = [...s]
        copy[i] = id
        return copy
      })
    } else {
      setSlots((s) => {
        const copy = [...s]
        copy[i] = id
        return copy
      })
    }
    closePicker()
  }

  function clearSlot(i: number) {
    setSlots((s) => {
      const copy = [...s]
      copy[i] = null
      return copy
    })
  }

  function clearMiniSlot(i: number) {
    setMiniSlots((s) => {
      const copy = [...s]
      copy[i] = null
      return copy
    })
  }

  function ToggleFilter({ title, options, selectedValues, onToggle }: { title: string; options: { label: string; value: string; icon?: string }[]; selectedValues: string[]; onToggle: (value: string) => void }) {
    const selectedOptions = options.filter((o) => selectedValues.includes(o.value))
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-auto min-h-[2.25rem] justify-between gap-2 border-gray-600 bg-gray-700 px-3 py-1.5 text-white hover:bg-gray-600">
            {selectedOptions.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {selectedOptions.map((o) => (
                  <span key={o.value} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium">
                    {o.icon && <img src={o.icon} alt="" className="h-4 w-4 object-contain" />}
                    {o.label}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-sm text-gray-300">{title}</span>
            )}
            <Badge variant="secondary" className="ml-1 shrink-0 bg-gray-900 text-white">
              {selectedValues.length}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 border-gray-600 bg-gray-700 p-0 text-white" align="start">
          <div className="border-b border-gray-600 px-4 py-3">
            <p className="text-sm font-semibold text-white">{title}</p>
          </div>
          <ScrollArea className="h-72 px-4 py-3">
            <div className="space-y-1">
              {options.map((option) => {
                const checked = selectedValues.includes(option.value)
                return (
                  <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors ${checked ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5"}`}>
                    <Checkbox checked={checked} onCheckedChange={() => onToggle(option.value)} />
                    {option.icon && <img src={option.icon} alt="" className="h-6 w-auto max-w-[80px] shrink-0 object-contain" />}
                    <span>{option.label}</span>
                  </label>
                )
              })}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    )
  }

  function IconToggleBar({ options, selectedValues, onToggle }: { options: { label: string; value: string; icon?: string }[]; selectedValues: string[]; onToggle: (value: string) => void }) {
    return (
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const isSelected = selectedValues.includes(opt.value)
          return (
            <button
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              title={opt.label}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${isSelected ? "bg-white/20 ring-2 ring-white/70" : "bg-white/5 hover:bg-white/10"}`}>
              {opt.icon ? (
                <img src={opt.icon} alt={opt.label} className={`h-7 w-7 object-contain transition-opacity ${isSelected ? "opacity-100" : "opacity-50"}`} />
              ) : (
                <span className={`px-1 text-center text-[11px] font-bold leading-tight ${isSelected ? "text-white" : "text-gray-400"}`}>{opt.label}</span>
              )}
            </button>
          )
        })}
      </div>
    )
  }


  function toggleValue(values: string[], setter: (next: string[]) => void, value: string) {
    setter(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value])
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Team Builder</h1>
        </div>

        <div className="mx-auto w-[65vw]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 items-start py-4">
          {slots.map((charId, i) => {
            const character = charId ? characters.find((c) => c.master_pc_id === charId) : null
            const miniChar = miniSlots[i] ? characters.find((c) => c.master_pc_id === miniSlots[i]) : null
            const mainTier = character ? getCharacterVisualTier(character) : 5
            const miniTier = miniChar ? getCharacterVisualTier(miniChar) : 5
            const mainFrameFile = getMainFrameFilenameForCharacter(character)
            const dims = frameInfo[mainFrameFile]
            return (
              <div key={i} className="relative p-0 w-full" style={{ height: 'min(72vh, calc(100vh - 8rem))' }}>
                <div className="relative w-full h-full flex items-center justify-center">
                  <div
                    className="relative w-full h-full flex items-center justify-center cursor-pointer"
                    onClick={() => openPicker(i, "main")}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="relative w-full" style={{ width: '100%', maxHeight: '100%', aspectRatio: dims ? `${dims.w}/${dims.h}` : undefined }}>
                      {character ? (
                        <>
                          <img
                            src={`/partyL/${character.master_pc_id}.png`}
                            alt={character.name}
                            onLoad={(e) => {
                              const img = e.target as HTMLImageElement
                              setSlotSizes((s) => ({ ...s, [i]: { ...(s[i] ?? {}), partyLW: img.naturalWidth, partyLH: img.naturalHeight } }))
                            }}
                            onError={(e) => { (e.target as HTMLImageElement).src = toPublicAssetPath(character.images.full) }}
                            style={{ height: '100%', width: 'auto', maxWidth: '100%' }}
                            className="object-contain block mx-auto"
                          />

                          <img
                            src={frameInfo[mainFrameFile]?.src ?? `/frames/${mainFrameFile}`}
                            alt="frame"
                            className="pointer-events-none absolute left-0 top-0 w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                          />
                        </>
                      ) : (
                        <div className="h-full w-full rounded-none border-4 border-white/80 bg-transparent flex items-center justify-center">
                          <div className="text-center text-gray-300 pointer-events-none">
                            <div className="text-4xl font-bold">+</div>
                          </div>
                        </div>
                      )}

                      {/* mini inside the main frame (centered, inside) */}
                      <button
                        onClick={(e) => { e.stopPropagation(); openPicker(i, "mini") }}
                        title="Select mini-slot character"
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{ bottom: '28px', width: 'clamp(72px, 9vw, 140px)', height: 'clamp(72px, 9vw, 140px)' }}
                      >
                        <div className="relative w-full h-full">
                          {miniChar ? (
                            <div className="relative w-full h-full">
                              <img src={`/frame/${getMiniFrameFilenameForCharacter(miniChar)}`} alt="mini-frame" className="pointer-events-none absolute inset-0 w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                              <img src={toPublicAssetPath(miniChar.images.icon)} alt={miniChar.name} className="absolute inset-2 w-[calc(100%-8px)] h-[calc(100%-8px)] object-contain" onError={(e) => { (e.target as HTMLImageElement).src = toPublicAssetPath(miniChar.images.full) }} />
                              <button onClick={(e) => { e.stopPropagation(); clearMiniSlot(i) }} className="absolute top-1 right-1 bg-white/10 hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-xs">×</button>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-full h-full flex items-center justify-center bg-black/60 border border-white/10 rounded-sm">
                                <span className="text-white text-3xl font-bold leading-none">+</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          </div>
        </div>

        {/* Picker modal (search + filters inside) */}
        {pickerOpenFor !== null && (
          <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/60" onClick={closePicker} />
            <div className="relative z-50 m-auto max-w-4xl w-full bg-gray-900 rounded-lg p-4 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search characters by name or ID" className="flex-1 rounded px-3 py-2 bg-gray-800 border border-gray-700 text-white" />
                <button onClick={closePicker} className="px-3 py-2 rounded bg-white/10">Close</button>
              </div>

                <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">Element</span>
                  <div className="ml-2">
                    <IconToggleBar
                      options={elementOptions}
                      selectedValues={selectedElement ? [selectedElement] : []}
                      onToggle={(v) => setSelectedElement((prev) => (prev === v ? null : v))}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select onValueChange={(v) => setSelectedRarity(v === "all" ? null : Number(v))}>
                    <SelectTrigger className="w-28 border-gray-600 bg-gray-700 text-white">
                      <SelectValue placeholder="Rarity" />
                    </SelectTrigger>
                    <SelectContent className="border-gray-600 bg-gray-700 text-white">
                      <SelectItem value="all">All</SelectItem>
                      {rarityOptions.map((r) => (
                        <SelectItem key={String(r)} value={String(r)}>{String(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Select onValueChange={(v) => setSelectedRole(v === "all" ? null : v)}>
                    <SelectTrigger className="w-32 border-gray-600 bg-gray-700 text-white">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent className="border-gray-600 bg-gray-700 text-white">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="attacker">Attacker</SelectItem>
                      <SelectItem value="supporter">Supporter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <div className="flex gap-2">
                    <ToggleFilter title="Tactics" options={tacticsOptions} selectedValues={selectedTactics} onToggle={(v) => toggleValue(selectedTactics, setSelectedTactics, v)} />
                    <ToggleFilter title="Forces" options={forceOptions} selectedValues={selectedForces} onToggle={(v) => toggleValue(selectedForces, setSelectedForces, v)} />
                  </div>
                  {pickerOpenFor !== null && (
                    <button
                      onClick={() => {
                        if (pickerMode === "mini") clearMiniSlot(pickerOpenFor)
                        else clearSlot(pickerOpenFor)
                      }}
                      className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[60vh] overflow-auto">
                {results.map((c) => {
                  const smallFrame = `/frame/${getMiniFrameFilenameForCharacter(c)}`
                  return (
                    <div key={c.master_pc_id} className="flex flex-col items-center gap-2 p-3 rounded bg-gray-800 hover:bg-gray-700 cursor-pointer" onClick={() => selectCharacter(pickerOpenFor, c.master_pc_id)}>
                      <div className="relative h-20 w-20">
                        <img src={toPublicAssetPath(c.images.icon)} alt={c.name} className="absolute inset-3 w-[calc(100%-24px)] h-[calc(100%-24px)] object-contain rounded" onError={(e) => { (e.target as HTMLImageElement).src = toPublicAssetPath(c.images.full) }} />
                        <img src={smallFrame} alt="frame" className="pointer-events-none absolute inset-0 w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                      </div>
                      <div className="text-center text-sm font-semibold">{c.name}</div>
                      <div className="text-xs text-gray-400">ID: {c.master_pc_id}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
