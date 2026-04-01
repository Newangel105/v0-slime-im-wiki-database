"use client"

import { useMemo, useState } from "react"
import type { WikiCharacter } from "@/lib/pc-wiki"
import {
  toPublicAssetPath, getCharacterVisualTier, getForceIconLookup,
  isExUnboundCharacter, hasExSpecialSkill, isExAttacker,
  normalizeLabel, stripColorTags, getCharacterForceEntries,
} from "@/lib/pc-wiki"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

// ---- HEARTPRINT IDs (SkillStill folder IDs — NOT character master_pc_ids) ----
const HEARTPRINT_IDS = [
  1100201, 1100601, 1100602, 1100801, 1101001, 1101101, 1101301, 1101602, 1101603, 1101901,
  1102101, 1102801, 1102901, 1103101, 1103501, 1103601, 1103701, 1103702, 1103703, 1103704,
  1104201, 1104801, 1105002, 1105101, 1106402, 1106601, 1106802, 1200111, 1200401, 1200801,
  1201101, 1201102, 1202001, 1202301, 1400101, 1400102, 1400201, 2100101, 2101401, 2101701,
  2103401, 2105001, 2106401, 2106801, 2400101, 2400501, 2500008, 2500082, 2500083, 2500086,
  2500087, 2500088, 2500089,
]

// ---- FRAME PATH HELPERS ----
function getMainFramePaths(tier: number, role: "member" | "bless") {
  const t = Math.min(Math.max(tier, 3), 7)
  const pfx = role === "bless" ? "Bless" : "Member"
  const baseTier = t === 7 ? 6 : t
  const isHigh = t >= 6
  const [fw, fh, bx, by] = isHigh ? [264, 628, 28, 35] : [248, 612, 17, 17]
  const intW = fw - 2 * bx
  const intH = fh - 2 * by
  const frameStyle: React.CSSProperties = {
    position: "absolute",
    width: `${(fw / intW) * 100}%`,
    height: `${(fh / intH) * 100}%`,
    left: `${-(bx / intW) * 100}%`,
    top: `${-(by / intH) * 100}%`,
    objectFit: "fill",
  }
  return {
    base: `/frames/base${pfx}L${baseTier}.png`,
    frame: `/frames/frame${pfx}L${t}.png`,
    frameStyle,
  }
}
function getMiniFramePaths(tier: number, role: "member" | "bless") {
  const t = Math.min(Math.max(tier, 3), 7)
  const pfx = role === "bless" ? "Bless" : "Member"
  return { base: `/frame/base${pfx}M${t}.png`, frame: `/frame/frame${pfx}M${t}.png` }
}

function elementMatches(charEl: string, filterKey: string): boolean {
  const el = charEl.toLowerCase(), key = filterKey.toLowerCase()
  if (el === key) return true
  if (key.startsWith("enhanced")) return el.endsWith(key)
  return el.endsWith(key) && !el.endsWith("enhanced" + key)
}

// ---- FILTER OPTION DEFINITIONS ----
const NORMAL_ELEMENTS = [
  { key: "Air", label: "Air", icon: "/elements/space.png" },
  { key: "Holy", label: "Holy", icon: "/elements/light.png" },
  { key: "Dark", label: "Dark", icon: "/elements/dark.png" },
  { key: "Fire", label: "Fire", icon: "/elements/fire.png" },
  { key: "Wind", label: "Wind", icon: "/elements/wind.png" },
  { key: "Water", label: "Water", icon: "/elements/water.png" },
  { key: "Earth", label: "Earth", icon: "/elements/earth.png" },
]
const ENHANCED_ELEMENTS = [
  { key: "EnhancedAir", label: "Air+", icon: "/elements/Enhancedspace.png" },
  { key: "EnhancedHoly", label: "Holy+", icon: "/elements/Enhancedlight.png" },
  { key: "EnhancedDark", label: "Dark+", icon: "/elements/Enhanceddark.png" },
  { key: "EnhancedFire", label: "Fire+", icon: "/elements/Enhancedfire.png" },
  { key: "EnhancedWind", label: "Wind+", icon: "/elements/Enhancedwind.png" },
  { key: "EnhancedWater", label: "Water+", icon: "/elements/Enhancedwater.png" },
  { key: "EnhancedEarth", label: "Earth+", icon: "/elements/Enhancedearth.png" },
]
const ATTACK_TYPES = [
  { key: "Physical", label: "Physical", icon: "/type_dmg/icAttackTypePhysics.png" },
  { key: "Magic", label: "Magic", icon: "/type_dmg/icAttackTypeMagic.png" },
]
const TACTICS_TYPES = [
  { key: "Speed", label: "Speed", icon: "/Image/Tactics/speed.png" },
  { key: "Defense", label: "Defense", icon: "/Image/Tactics/defense.png" },
  { key: "Charge", label: "Charge", icon: "/Image/Tactics/charge.png" },
  { key: "Normal", label: "Neutral", icon: "/Image/Tactics/normal.png" },
]
const STAR_ASSETS: Record<number, string> = {
  3: "/stars/starCharaL3A.png", 4: "/stars/starCharaL4A.png",
  5: "/stars/starCharaL5A.png", 6: "/stars/starCharaL6A.png", 7: "/stars/starCharaL7A.png",
}

// Card overlay icons
const ATTACKER_ELEMENT_ICONS: Record<string, string> = {
  air: "/elements/icElementspace.png", dark: "/elements/icElementDark.png",
  earth: "/elements/icElementEarth.png", fire: "/elements/icElementFire.png",
  holy: "/elements/icElementlight.png", water: "/elements/icElementWater.png",
  wind: "/elements/icElementWind.png",
  enhancedair: "/elements/Enhancedspace.png", enhanceddark: "/elements/Enhanceddark.png",
  enhancedearth: "/elements/Enhancedearth.png", enhancedfire: "/elements/Enhancedfire.png",
  enhancedholy: "/elements/Enhancedlight.png", enhancedwater: "/elements/Enhancedwater.png",
  enhancedwind: "/elements/Enhancedwind.png",
}
const ATK_TYPE_ICONS: Record<string, string> = {
  physical: "/type_dmg/icAttackTypePhysics.png",
  magic: "/type_dmg/icAttackTypeMagic.png",
}

// ---- Protector detection ----
function isProtectorChar(c: WikiCharacter): boolean {
  return c.character_role === "Supporter" && !c.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}
function isAttackerChar(c: WikiCharacter): boolean {
  return c.character_role === "Attacker" || c.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}

// ---- Full element icon map ----
const FULL_ELEMENT_ICON_MAP: Record<string, string> = {
  air: "/Image/IcElementBless/IcElementBlessAir.png",
  all: "/Image/IcElementBless/IcElementBlessAll.png",
  dark: "/Image/IcElementBless/IcElementBlessDark.png",
  earth: "/Image/IcElementBless/IcElementBlessEarth.png",
  fire: "/Image/IcElementBless/IcElementBlessFire.png",
  holy: "/Image/IcElementBless/IcElementBlessHoly.png",
  magic: "/Image/IcElementBless/IcElementBlessMagic.png",
  physics: "/Image/IcElementBless/IcElementBlessPhysics.png",
  water: "/Image/IcElementBless/IcElementBlessWater.png",
  wind: "/Image/IcElementBless/IcElementBlessWind.png",
  enhancedair: "/Image/IcElementBless/IcElementBlessEnhancedAir.png",
  enhanceddark: "/Image/IcElementBless/IcElementBlessEnhancedDark.png",
  enhancedearth: "/Image/IcElementBless/IcElementBlessEnhancedEarth.png",
  enhancedfire: "/Image/IcElementBless/IcElementBlessEnhancedFire.png",
  enhancedholy: "/Image/IcElementBless/IcElementBlessEnhancedHoly.png",
  enhancedwater: "/Image/IcElementBless/IcElementBlessEnhancedWater.png",
  enhancedwind: "/Image/IcElementBless/IcElementBlessEnhancedWind.png",
  specialeffectelementearth: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEarth.png",
  specialeffectelementair: "/Image/IcElementBless/IcElementBlessSpecialEffectElementAir.png",
  specialeffectelementwind: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWind.png",
  specialeffectelementwater: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWater.png",
  specialeffectelementfire: "/Image/IcElementBless/IcElementBlessSpecialEffectElementFire.png",
  specialeffectelementholy: "/Image/IcElementBless/IcElementBlessSpecialEffectElementHoly.png",
  specialeffectelementdark: "/Image/IcElementBless/IcElementBlessSpecialEffectElementDark.png",
  specialeffectelementenhancedearth: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedEarth.png",
  specialeffectelementenhancedair: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedAir.png",
  specialeffectelementenhancedwind: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWind.png",
  specialeffectelementenhancedwater: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWater.png",
  specialeffectelementenhancedfire: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedFire.png",
  specialeffectelementenhancedholy: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedHoly.png",
  specialeffectelementenhanceddark: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedDark.png",
  special: "/Image/IcElementBless/IcElementBlessSpecial.png",
  specialeffectelementnone: "/Image/IcElementBless/IcElementBlessSpecialEffectElementNone.png",
}

// Derive element values for protector
const _baseElementKeys = new Set(["air", "dark", "earth", "fire", "holy", "water", "wind"])
const _leaderSkillDmgPattern = /to\s+(?:fire|water|earth|space|wind|dark|light)\s+attribute(?:\s+and\s+(?:fire|water|earth|space|wind|dark|light)\s+attribute)*\s+enemies/i
const _dmgAttrMap: Record<string, string> = { fire: "fire", water: "water", earth: "earth", space: "air", wind: "wind", dark: "dark", light: "holy" }
const _elemPatterns: [RegExp, string][] = [
  [/increases?\s+fire\s+atk/i, "fire"], [/increases?\s+water\s+atk/i, "water"], [/increases?\s+earth\s+atk/i, "earth"],
  [/increases?\s+space\s+atk/i, "air"], [/increases?\s+wind\s+atk/i, "wind"], [/increases?\s+dark\s+atk/i, "dark"],
  [/increases?\s+light\s+atk/i, "holy"], [/increases?\s+p-atk/i, "physics"], [/physical characters'/i, "physics"],
  [/increases?\s+m-atk/i, "magic"], [/magic characters'/i, "magic"], [/all allies' atk/i, "all"],
]
function getProtectorElementKeys(c: WikiCharacter): string[] {
  const normalized = normalizeLabel(c.element)
  const leaderSkill = c.skills.find((s) => s.slot === "leader_skill")
  const desc = leaderSkill ? stripColorTags(leaderSkill.description_max_level ?? "") : ""
  const values: string[] = []
  if (_leaderSkillDmgPattern.test(desc)) {
    const matches = [...desc.matchAll(/(?:to|and)\s+(fire|water|earth|space|wind|dark|light)\s+attribute/gi)]
    const isEnhSpecial = normalized.startsWith("specialeffectelementenhanced")
    const isSpecial = normalized.startsWith("specialeffectelement")
    for (const m of matches) {
      const base = _dmgAttrMap[m[1].toLowerCase()] ?? ""
      const key = isEnhSpecial ? `specialeffectelementenhanced${base}` : isSpecial ? `specialeffectelement${base}` : base
      if (key && !values.includes(key)) values.push(key)
    }
  } else {
    for (const [pat, val] of _elemPatterns) {
      if (pat.test(desc) && !values.includes(val)) values.push(val)
    }
  }
  if (values.length === 0) values.push(normalized)
  return values
}

function getCardIcons(char: WikiCharacter): [string | null, string | null, string | null] {
  if (isProtectorChar(char)) {
    const forceIcons = getCharacterForceEntries(char)
      .map(e => e.icon ?? null).filter(Boolean) as string[]
    const elementIcons = getProtectorElementKeys(char)
      .map(k => FULL_ELEMENT_ICON_MAP[k] ?? null).filter(Boolean) as string[]
    const maxForces = elementIcons.length > 0 ? Math.min(forceIcons.length, 2) : Math.min(forceIcons.length, 3)
    const icons = [...forceIcons.slice(0, maxForces), ...elementIcons].slice(0, 3)
    return [icons[0] ?? null, icons[1] ?? null, icons[2] ?? null]
  }
  const elKey = normalizeLabel(char.element)
  const atkKey = normalizeLabel(char.attack_type)
  return [ATTACKER_ELEMENT_ICONS[elKey] ?? null, ATK_TYPE_ICONS[atkKey] ?? null, null]
}

function getMiniCardIcons(char: WikiCharacter): [string | null, string | null] {
  if (isProtectorChar(char)) {
    const forceIcon = getCharacterForceEntries(char).map(e => e.icon ?? null).find(Boolean) ?? null
    const allKeys = getProtectorElementKeys(char)
    const QUALIFIERS = new Set(["physics", "magic", "all"])
    const elKeys = allKeys.filter(k => !QUALIFIERS.has(k))
    const qualKey = allKeys.find(k => QUALIFIERS.has(k)) ?? null
    const elIcon1 = elKeys[0] ? (FULL_ELEMENT_ICON_MAP[elKeys[0]] ?? null) : null
    const elIcon2 = elKeys[1] ? (FULL_ELEMENT_ICON_MAP[elKeys[1]] ?? null) : null
    const qualIcon = qualKey ? (FULL_ELEMENT_ICON_MAP[qualKey] ?? null) : null
    if (forceIcon) {
      const elementIcon = FULL_ELEMENT_ICON_MAP[normalizeLabel(char.element)] ?? null
      return [forceIcon, elementIcon]
    }
    if (elIcon1 && elIcon2) return [elIcon1, elIcon2]
    if (elIcon1 && qualIcon) return [elIcon1, qualIcon]
    if (elIcon1) return [elIcon1, null]
    return [qualIcon, null]
  }
  const elKey = normalizeLabel(char.element)
  const atkKey = normalizeLabel(char.attack_type)
  return [ATTACKER_ELEMENT_ICONS[elKey] ?? null, ATK_TYPE_ICONS[atkKey] ?? null]
}

// =================================
export default function TeamBuilderClient({ characters }: { characters: WikiCharacter[] }) {
  // 4 main slots + 4 sub-slots + 2 side slots (side-by-side)
  const [mainSlots, setMainSlots] = useState<(number | null)[]>(Array(4).fill(null))
  const [subSlots, setSubSlots] = useState<(number | null)[]>(Array(4).fill(null))
  const [sideSlots, setSideSlots] = useState<(number | null)[]>(Array(2).fill(null))
  const [heartPrintId, setHeartPrintId] = useState<number | null>(null)

  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null)
  const [pickerMode, setPickerMode] = useState<"main" | "sub" | "side" | "heartprint">("main")
  const [showFilters, setShowFilters] = useState(false)

  const [query, setQuery] = useState("")
  const [filterEl, setFilterEl] = useState<string | null>(null)
  const [filterAttack, setFilterAttack] = useState<string | null>(null)
  const [filterTactics, setFilterTactics] = useState<string | null>(null)
  const [filterCharType, setFilterCharType] = useState<"normal" | "ex" | null>(null)
  const [filterRarity, setFilterRarity] = useState<number | null>(null)
  const [filterForces, setFilterForces] = useState<string[]>([])

  const forceOptions = useMemo(() => {
    const map = getForceIconLookup()
    return Array.from(map.entries()).map(([name, icon]) => ({ label: name, value: name, icon: toPublicAssetPath(icon) }))
  }, [])

  const heartprintItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return HEARTPRINT_IDS.filter((id) => !q || String(id).includes(q))
  }, [query])

  function isExChar(c: WikiCharacter) {
    return isExUnboundCharacter(c) || hasExSpecialSkill(c) || isExAttacker(c)
  }

  const results = useMemo(() => {
    if (pickerMode === "heartprint") return []
    // slot 0 = protector, slots 1-4 = attackers for main
    // side slots are always attackers
    const roleFilter = (pickerMode === "main" && pickerOpenFor === 0) ? "supporter" : "attacker"
    const q = query.trim().toLowerCase()
    return characters.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false
      if (c.character_role?.toLowerCase() !== roleFilter) return false
      if (filterEl && !elementMatches(c.element ?? "", filterEl)) return false
      if (filterAttack && c.attack_type?.toLowerCase() !== filterAttack.toLowerCase()) return false
      if (filterTactics && c.tactics_type?.toLowerCase() !== filterTactics.toLowerCase()) return false
      if (filterCharType === "normal" && isExChar(c)) return false
      if (filterCharType === "ex" && !isExChar(c)) return false
      if (filterRarity != null && c.rarity !== filterRarity) return false
      if (filterForces.length && !filterForces.some((f) => c.forces.map((x) => x.name).includes(f))) return false
      return true
    })
  }, [characters, pickerMode, pickerOpenFor, query, filterEl, filterAttack, filterTactics, filterCharType, filterRarity, filterForces])

  function openPicker(i: number, mode: "main" | "sub" | "side" | "heartprint") {
    setPickerOpenFor(i); setPickerMode(mode); setQuery("")
    setFilterEl(null); setFilterAttack(null); setFilterTactics(null)
    setFilterCharType(null); setFilterRarity(null); setFilterForces([])
    setShowFilters(false)
  }
  function closePicker() { setPickerOpenFor(null) }

  function selectChar(i: number, id: number) {
    if (pickerMode === "heartprint") setHeartPrintId(id)
    else if (pickerMode === "sub") setSubSlots((s) => { const c = [...s]; c[i] = id; return c })
    else if (pickerMode === "side") setSideSlots((s) => { const c = [...s]; c[i] = id; return c })
    else setMainSlots((s) => { const c = [...s]; c[i] = id; return c })
    closePicker()
  }

  // ==========================================
  // MAIN SLOT CARD
  // The outer div is sized to the FULL frame dimensions (fw × fh).
  // The inner "viewport" (bx, by, intW, intH) clips the base+portrait.
  // The frame image is placed absolute over the full outer div.
  // This ensures the frame is fully visible and correctly proportioned.
  // ==========================================
  function MainSlotCard({ i }: { i: number }) {
    const charId = mainSlots[i]
    const subCharId = subSlots[i]
    const char = charId ? characters.find((c) => c.master_pc_id === charId) ?? null : null
    const subChar = subCharId ? characters.find((c) => c.master_pc_id === subCharId) ?? null : null
    const isProt = i === 0
    const role: "bless" | "member" = isProt ? "bless" : "member"
    const tier = char ? getCharacterVisualTier(char) : 5
    const { base: mainBase, frame: mainFrame } = getMainFramePaths(tier, role)

    // Frame pixel dimensions from getMainFramePaths logic
    const isHigh = tier >= 6
    const [fw, fh, bx, by] = isHigh ? [264, 628, 28, 35] : [248, 612, 17, 17]
    // Interior dimensions (the art viewport)
    const intW = fw - 2 * bx
    const intH = fh - 2 * by
    // As percentages of the full frame
    const artLeft = `${(bx / fw) * 100}%`
    const artTop = `${(by / fh) * 100}%`
    const artW = `${(intW / fw) * 100}%`
    const artH = `${(intH / fh) * 100}%`
    // Sub-slot: ~30% of interior width, square
    const subSlotW = `${(intW * 0.42 / fw) * 100}%`

    const [mainIcon1, mainIcon2, mainIcon3] = char ? getCardIcons(char) : [null, null, null]
    const mainIcons = [mainIcon1, mainIcon2, mainIcon3].filter(Boolean) as string[]
    const [subIcon1, subIcon2] = subChar ? getMiniCardIcons(subChar) : [null, null]

    return (
      /*
       * Outer box is the FULL frame size.
       * aspect-ratio = fw/fh so it scales uniformly in the flex row.
       * overflow: visible so the frame shadow/glow can bleed out.
       */
      <div
        className="relative flex-shrink-0 cursor-pointer select-none"
        style={{ aspectRatio: `${fw}/${fh}`, width: "100%", overflow: "visible" }}
        onClick={() => openPicker(i, "main")}
      >
        {/* ── Art viewport (clipped to interior) ── */}
        <div
          className="absolute overflow-hidden"
          style={{
            left: artLeft, top: artTop, width: artW, height: artH,
            border: "1.5px solid rgba(160,160,160,0.3)",
            background: char ? "transparent" : "rgba(20,20,24,0.72)",
          }}
        >
          {!char && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/40 font-light select-none" style={{ fontSize: "clamp(1.5rem,3vw,2.5rem)" }}>+</span>
            </div>
          )}
          {char && (
            <>
              <img src={mainBase} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
              <img src={`/partyL/${char.master_pc_id}.png`} alt={char.name}
                className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                onError={(e) => { (e.target as HTMLImageElement).src = toPublicAssetPath(char.images.full) }} />
            </>
          )}

          {/* Sub-slot: bottom-center of art viewport */}
          <button
            onClick={(e) => { e.stopPropagation(); openPicker(i, "sub") }}
            className="absolute overflow-hidden rounded-sm z-20"
            style={{
              width: subSlotW, aspectRatio: "1",
              bottom: "4%", left: "50%", transform: "translateX(-50%)",
              border: "1.5px solid rgba(160,160,160,0.45)",
              background: "rgba(0,0,0,0.65)",
            }}
          >
            {subChar ? (
              <>
                <img src={toPublicAssetPath(subChar.images.icon)} alt={subChar.name}
                  className="absolute inset-0 w-full h-full object-cover object-top" />
                {(() => {
                  const t = getCharacterVisualTier(subChar)
                  const r: "bless" | "member" = isProtectorChar(subChar) ? "bless" : "member"
                  const { frame } = getMiniFramePaths(t, r)
                  return <img src={frame} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                })()}
                {(subIcon1 || subIcon2) && (
                  <div className="absolute top-0.5 right-0.5 z-20 flex flex-col gap-0.5">
                    {subIcon1 && <img src={subIcon1} alt="" className="w-3 h-3 object-contain drop-shadow" />}
                    {subIcon2 && <img src={subIcon2} alt="" className="w-3 h-3 object-contain drop-shadow" />}
                  </div>
                )}
                <button onClick={(e) => { e.stopPropagation(); setSubSlots((s) => { const c = [...s]; c[i] = null; return c }) }}
                  className="absolute top-0 left-0 bg-black/75 w-3 h-3 flex items-center justify-center text-[7px] z-30 text-white rounded-br-sm">x</button>
              </>
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-white/30 font-light text-base">+</span>
            )}
          </button>
        </div>

        {/* ── Full frame image over entire outer box ── */}
        {char && (
          <img src={mainFrame} alt=""
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            style={{ objectFit: "fill" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
        )}

        {/* ── Element / type icons — top-right of art viewport ── */}
        {char && mainIcons.length > 0 && (
          <div className="absolute z-30 flex flex-col items-end gap-0.5"
            style={{ top: `calc(${artTop} + 4%)`, right: `calc(${artLeft} + 2%)` }}>
            {mainIcons.map((src, idx) => (
              <img key={idx} src={src} alt="" className="w-5 h-5 object-contain drop-shadow-md" />
            ))}
          </div>
        )}

        {/* Clear button */}
        {char && (
          <button onClick={(e) => { e.stopPropagation(); setMainSlots((s) => { const c = [...s]; c[i] = null; return c }) }}
            className="absolute bg-black/70 hover:bg-black/90 rounded-full w-5 h-5 flex items-center justify-center text-[10px] z-30 text-white"
            style={{ top: `calc(${artTop} + 2px)`, right: `calc(${artLeft} + 2px)` }}>x</button>
        )}
      </div>
    )
  }

  // ==========================================
  // SIDE SLOT CARD — tall vertical, same aspect as main card art viewport
  // ==========================================
  function SideSlotCard({ i }: { i: number }) {
    const charId = sideSlots[i]
    const char = charId ? characters.find((c) => c.master_pc_id === charId) ?? null : null
    const tier = char ? getCharacterVisualTier(char) : 5
    const role: "bless" | "member" = char && isProtectorChar(char) ? "bless" : "member"
    const { base: sideBase, frame } = getMiniFramePaths(tier, role)
    const [icon1, icon2] = char ? getMiniCardIcons(char) : [null, null]

    return (
      <div
        className="relative w-full h-full overflow-hidden cursor-pointer select-none rounded-sm"
        style={{
          border: "1.5px solid rgba(160,160,160,0.35)",
          background: char ? "transparent" : "rgba(20,20,24,0.72)",
        }}
        onClick={() => openPicker(i, "side")}
      >
        {!char && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/40 text-2xl font-light">+</span>
          </div>
        )}
        {char && (
          <>
            <img src={sideBase} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
            <img src={toPublicAssetPath(char.images.icon)} alt={char.name}
              className="absolute inset-0 w-full h-full object-cover object-top" />
            <img src={frame} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
            {(icon1 || icon2) && (
              <div className="absolute top-1 right-1 z-20 flex flex-col gap-0.5">
                {icon1 && <img src={icon1} alt="" className="w-4 h-4 object-contain drop-shadow" />}
                {icon2 && <img src={icon2} alt="" className="w-4 h-4 object-contain drop-shadow" />}
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); setSideSlots((s) => { const c = [...s]; c[i] = null; return c }) }}
              className="absolute top-0 left-0 bg-black/75 w-4 h-4 flex items-center justify-center text-[8px] z-30 text-white rounded-br-sm">x</button>
          </>
        )}
      </div>
    )
  }

  // ==========================================
  // PICKER MODAL
  // ==========================================
  function PickerModal() {
    if (pickerOpenFor === null) return null
    const isProt = pickerMode === "main" && pickerOpenFor === 0
    const isHP = pickerMode === "heartprint"

    return (
      <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closePicker} />
        <div className="relative z-50 m-auto flex max-h-[95vh] w-[95vw] max-w-6xl rounded-xl overflow-hidden shadow-2xl"
          style={{ background: "linear-gradient(180deg, #0c1929 0%, #111d2e 100%)" }}>

          {/* Right panel - filters and grid */}
          <div className="flex-1 flex flex-col min-w-0 max-h-[95vh]">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Input
                  autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder={isHP ? "Search by ID..." : "Search by name..."}
                  className="h-8 flex-1 border-gray-700 bg-gray-800/80 text-white text-sm" />
              </div>
              {!isHP && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all ${showFilters ? "bg-teal-800/50 text-teal-300 ring-1 ring-teal-400/30" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  Filter
                </button>
              )}
              <button onClick={closePicker} className="w-8 h-8 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-gray-400 text-sm">x</button>
            </div>

            {/* Role indicator */}
            {!isHP && (
              <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium border-b border-white/5 ${isProt ? "text-purple-300 bg-purple-900/10" : "text-sky-300 bg-sky-900/10"}`}>
                <img src={isProt ? "/UI/Texture/CharaInfoAtlas/icSkillBlessLeader.png" : "/UI/Texture/CharaInfoAtlas/icSkillAttacker.png"}
                  alt="" className="h-4 w-4 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                {isProt ? "Protector" : "Attacker"} - {results.length} units
              </div>
            )}
            {isHP && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-amber-300/70 border-b border-white/5 bg-amber-900/5">
                HeartPrint Skills - {heartprintItems.length} available
              </div>
            )}

            {/* Filters */}
            {showFilters && !isHP && (
              <div className="px-3 py-3 border-b border-white/5 bg-[#0a1420] space-y-3 overflow-y-auto max-h-[40vh]">
                {/* Attribute */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Attribute</div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    <FilterBtn active={filterEl === null} onClick={() => setFilterEl(null)}>ALL</FilterBtn>
                    {NORMAL_ELEMENTS.map((e) => <FilterIcon key={e.key} active={filterEl === e.key} icon={e.icon} label={e.label} onClick={() => setFilterEl(filterEl === e.key ? null : e.key)} />)}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ENHANCED_ELEMENTS.map((e) => <FilterIcon key={e.key} active={filterEl === e.key} icon={e.icon} label={e.label} onClick={() => setFilterEl(filterEl === e.key ? null : e.key)} />)}
                  </div>
                </div>

                {/* Attack Type */}
                {!isProt && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Attack Type</div>
                    <div className="flex gap-1">
                      <FilterBtn active={filterAttack === null} onClick={() => setFilterAttack(null)}>ALL</FilterBtn>
                      {ATTACK_TYPES.map((a) => <FilterIcon key={a.key} active={filterAttack === a.key} icon={a.icon} label={a.label} onClick={() => setFilterAttack(filterAttack === a.key ? null : a.key)} />)}
                    </div>
                  </div>
                )}

                {/* Tactics Type */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Tactics Type</div>
                  <div className="flex flex-wrap gap-1">
                    <FilterBtn active={filterTactics === null} onClick={() => setFilterTactics(null)}>ALL</FilterBtn>
                    {TACTICS_TYPES.map((t) => (
                      <button key={t.key} onClick={() => setFilterTactics(filterTactics === t.key ? null : t.key)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-all ${filterTactics === t.key ? "bg-white/20 text-white ring-1 ring-white/40" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                        <img src={t.icon} alt="" className={`w-4 h-4 object-contain ${filterTactics === t.key ? "opacity-100" : "opacity-50"}`} />{t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Character Type + Rarity */}
                <div className="flex gap-6 flex-wrap">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Character Type</div>
                    <div className="flex gap-1">
                      {([["ALL", null], ["Normal", "normal"], ["EX", "ex"]] as [string, "normal" | "ex" | null][]).map(([lbl, val]) => (
                        <FilterBtn key={String(val)} active={filterCharType === val} onClick={() => setFilterCharType(val)}>{lbl}</FilterBtn>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Rarity</div>
                    <div className="flex gap-1">
                      <FilterBtn active={filterRarity === null} onClick={() => setFilterRarity(null)}>ALL</FilterBtn>
                      {[3, 4, 5].map((r) => <FilterBtn key={r} active={filterRarity === r} onClick={() => setFilterRarity(filterRarity === r ? null : r)}>{r}*</FilterBtn>)}
                    </div>
                  </div>
                </div>

                {/* Forces */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Forces</div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-7 gap-1.5 border-gray-600 bg-gray-800 px-2.5 text-white hover:bg-gray-700 text-[11px]">
                        {filterForces.length > 0 ? `${filterForces.length} selected` : "Select Forces"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 border-gray-600 bg-gray-800 p-0 text-white z-[60]" align="start">
                      <ScrollArea className="h-52 px-2 py-2">
                        <div className="space-y-0.5">
                          {forceOptions.map((opt) => {
                            const checked = filterForces.includes(opt.value)
                            return (
                              <label key={opt.value} className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs ${checked ? "bg-white/10" : "hover:bg-white/5"}`}>
                                <Checkbox checked={checked} onCheckedChange={() => setFilterForces((prev) => checked ? prev.filter((v) => v !== opt.value) : [...prev, opt.value])} />
                                {opt.icon && <img src={opt.icon} alt="" className="h-4 w-auto max-w-[50px] shrink-0 object-contain" />}
                                <span>{opt.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  {filterForces.length > 0 && <button onClick={() => setFilterForces([])} className="ml-2 text-[10px] text-gray-500 hover:text-gray-300 underline">clear</button>}
                </div>
              </div>
            )}

            {/* Character grid */}
            <div className="flex-1 overflow-auto p-2">
              <div className={`grid gap-1.5 ${isHP ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5" : "grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8"}`}>
                {/* Remove card */}
                <div className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed border-gray-600 p-1.5 hover:bg-white/5 transition-colors aspect-square"
                  onClick={() => {
                    if (isHP) setHeartPrintId(null)
                    else if (pickerMode === "sub") setSubSlots((s) => { const c = [...s]; c[pickerOpenFor] = null; return c })
                    else if (pickerMode === "side") setSideSlots((s) => { const c = [...s]; c[pickerOpenFor] = null; return c })
                    else setMainSlots((s) => { const c = [...s]; c[pickerOpenFor] = null; return c })
                    closePicker()
                  }}>
                  <div className="w-10 h-10 flex items-center justify-center border border-dashed border-gray-500 rounded">
                    <span className="text-gray-500 text-sm">x</span>
                  </div>
                  <span className="text-[9px] text-gray-500">Remove</span>
                </div>

                {isHP ? heartprintItems.map((id) => (
                  <div key={id} className="flex flex-col items-center gap-0.5 p-1 rounded hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => { setHeartPrintId(id); closePicker() }}>
                    <div className="relative w-full overflow-hidden rounded bg-black/40" style={{ aspectRatio: "245 / 146" }}>
                      <img src={`/SkillStill/${id}/skill_still_${id}_S.png`} alt="" className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2" }} />
                      <img src="/StillFrame/StillFrame1_s.png" alt="" className="pointer-events-none absolute inset-0 w-full h-full object-fill"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                      {heartPrintId === id && <div className="absolute inset-0 ring-2 ring-amber-400 ring-inset rounded" />}
                    </div>
                  </div>
                )) : results.map((c) => {
                  const t = getCharacterVisualTier(c)
                  const r: "bless" | "member" = c.character_role?.toLowerCase() === "supporter" ? "bless" : "member"
                  const { base, frame } = getMiniFramePaths(t, r)
                  return (
                    <div key={c.master_pc_id} className="flex flex-col items-center gap-0.5 p-1 rounded hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => selectChar(pickerOpenFor, c.master_pc_id)}>
                      <div className="relative w-full" style={{ aspectRatio: "1" }}>
                        <img src={base} alt="" className="absolute inset-0 w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                        <img src={toPublicAssetPath(c.images.icon)} alt={c.name} className="absolute inset-0 w-full h-full object-cover object-top"
                          onError={(e) => { (e.target as HTMLImageElement).src = toPublicAssetPath(c.images.full) }} />
                        <img src={frame} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                        <img src={STAR_ASSETS[t] ?? STAR_ASSETS[5]} alt="" className="pointer-events-none absolute bottom-0 left-0 right-0 h-[14%] object-contain" />
                      </div>
                    </div>
                  )
                })}
              </div>

              {!isHP && results.length === 0 && <p className="py-6 text-center text-xs text-gray-500">No characters match</p>}
              {isHP && heartprintItems.length === 0 && <p className="py-6 text-center text-xs text-gray-500">No HeartPrint skills match</p>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Filter helpers
  function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
      <button onClick={onClick}
        className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${active ? "bg-white/20 text-white ring-1 ring-white/30" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
      >{children}</button>
    )
  }
  function FilterIcon({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
    return (
      <button onClick={onClick} title={label}
        className={`w-8 h-8 flex items-center justify-center rounded transition-all ${active ? "ring-2 ring-white bg-white/20" : "bg-white/5 hover:bg-white/10"}`}>
        <img src={icon} alt={label} className={`w-5 h-5 object-contain ${active ? "opacity-100" : "opacity-50"}`} />
      </button>
    )
  }

  // ============================
  // MAIN RENDER
  // ============================
  //
  // Layout:
  //   [Main0] [Main1] [Main2] [Main3]  [Side0] [Side1]
  //                                    [  Heartprint  ]
  //
  // 4 main cards drive the height. Side slots are narrower but the same
  // aspect ratio as the art viewport (intW:intH ≈ 208:558 for high tier).
  // Heartprint is below the 2 side slots, spanning their combined width.
  //
  // We give each main card a fixed width and let its aspect-ratio determine
  // its height. The right panel matches that height via flex-stretch.
  //
  const MAIN_CARD_WIDTH = "clamp(100px, 13vw, 155px)"
  const SIDE_CARD_WIDTH = "clamp(72px, 9vw, 108px)"
  // Art viewport aspect for side slots: use intW:intH of high-tier (208:558 ≈ 0.373)
  const SIDE_ASPECT = "208 / 558"

  return (
    <div className="w-full flex flex-col items-center">
      <h1 className="mb-4 text-2xl font-bold text-white sm:text-3xl self-start">Team Builder</h1>

      <div className="flex flex-nowrap gap-2 items-end justify-center w-full overflow-x-auto pb-2">

        {/* 4 main character slots — width-driven, height auto from aspect ratio */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex-shrink-0" style={{ width: MAIN_CARD_WIDTH }}>
            <MainSlotCard i={i} />
          </div>
        ))}

        {/* Right panel: 2 side slots side-by-side + heartprint below */}
        <div className="flex flex-col gap-1.5 flex-shrink-0" style={{ width: `calc(${SIDE_CARD_WIDTH} * 2 + 6px)` }}>

          {/* 2 side slots in a single row */}
          <div className="flex gap-1.5">
            {[0, 1].map((i) => (
              <div key={i} className="flex-1" style={{ aspectRatio: SIDE_ASPECT }}>
                <SideSlotCard i={i} />
              </div>
            ))}
          </div>

          {/* Heartprint skill slot — full width, fixed height */}
          <button
            onClick={() => openPicker(0, "heartprint")}
            className="relative w-full overflow-hidden rounded-sm transition-opacity hover:opacity-90"
            style={{
              height: "clamp(48px, 6vw, 72px)",
              border: "1.5px solid rgba(160,160,160,0.35)",
              background: "rgba(20,20,24,0.72)",
            }}
          >
            {heartPrintId ? (
              <>
                <img src={`/SkillStill/${heartPrintId}/skill_still_${heartPrintId}_S.png`} alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3" }} />
                <img src="/StillFrame/StillFrame1_s.png" alt=""
                  className="pointer-events-none absolute inset-0 w-full h-full object-fill"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                <button onClick={(e) => { e.stopPropagation(); setHeartPrintId(null) }}
                  className="absolute top-0.5 right-0.5 bg-black/70 rounded-full w-4 h-4 flex items-center justify-center text-[9px] z-10 text-white">x</button>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span className="text-white/35 text-base font-light">+</span>
                <span className="text-[8px] text-gray-400 text-center leading-tight px-1">Heartprint Skill Unassigned</span>
              </div>
            )}
          </button>
        </div>

      </div>

      <PickerModal />
    </div>
  )
}
