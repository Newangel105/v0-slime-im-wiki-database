"use client"

import { useCallback, useDeferredValue, useMemo, useRef, useState, useEffect } from "react"
import type { Heartprint, Equipment, Charm } from "@/lib/pc-wiki"
import type { TeamBuilderCharacter } from "@/lib/team-builder-character-data"
import {
  toPublicAssetPath, getCharacterVisualTier,
  isExUnboundCharacter, hasExSpecialSkill, isExAttacker,
  normalizeLabel, stripColorTags,
} from "@/lib/pc-wiki"
import { calcSlotStats, calcTeamEP, getEPRankIcon } from "@/lib/ep-calc"
import type { TeamSlotInput, SlotStats } from "@/lib/ep-calc"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

// ---- CATEGORY DISPLAY NAME MAP for Skill Filter Modal ----
const SKILL_CAT_LABELS: Record<string, string> = {
  DamageUP: "Damage UP",
  DamageDown: "Damage DOWN",
  GageUP: "Gauge UP",
  GageDown: "Gauge DOWN",
  AbnormalCondition: "Status Abnormalities",
  BuffChangeAct: "Status Effects",
  ConditionChange: "Condition Change",
  Special: "Special",
}

// ---- Character Type display labels ----
const CHAR_TYPE_DISPLAY: Record<string, string> = {
  Attack: "Attack Growth Type",
  Defense: "Defense Growth Type",
  Support: "Balance Growth Type",
  ExtremeAttack: "Attack Growth Type EX",
  ExtremeDefense: "Defense Growth Type EX",
  ExtremeAverage: "Balance Growth Type EX",
}

// ---- Weapon type icons for attacker picker (match character-browser) ----
const weaponIconMap: Record<string, string> = {
  book: "/weapons/book.png",
  fist: "/weapons/fists.png",
  fists: "/weapons/fists.png",
  greatsword: "/weapons/greatsword.png",
  hammer: "/weapons/hammer.png",
  largesword: "/weapons/greatsword.png",
  katana: "/weapons/katana.png",
  knuckle: "/weapons/fists.png",
  spear: "/weapons/spear.png",
  sword: "/weapons/sword.png",
}

function formatWikiLabel(label: string): string {
  // Capitalize first letter, rest lowercase, replace underscores with space
  if (!label) return ""
  return label.charAt(0).toUpperCase() + label.slice(1).replace(/_/g, " ").toLowerCase()
}

// ---- Force group display labels ----
const FORCE_GROUP_LABELS: Record<string, string> = {
  tribe: "Tribe",
  ability: "Skill / Personality",
  event: "Event / Theme",
  team: "Team",
  others: "Other",
}
const FORCE_GROUP_ORDER = ["tribe", "ability", "event", "team", "others"]

// ---- Color tag renderer ----
function renderColoredDesc(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /<color=(#[0-9a-fA-F]{6,8})>([\s\S]*?)<\/color>/gi
  let last = 0, match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(<span key={match.index} style={{ color: match[1] }}>{match[2]}</span>)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

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
const SPECIAL_EFFECT_ELEMENTS = [
  { key: "SpecialEffectElementAir", label: "SE Air", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementAir.png" },
  { key: "SpecialEffectElementHoly", label: "SE Holy", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementHoly.png" },
  { key: "SpecialEffectElementDark", label: "SE Dark", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementDark.png" },
  { key: "SpecialEffectElementFire", label: "SE Fire", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementFire.png" },
  { key: "SpecialEffectElementWind", label: "SE Wind", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWind.png" },
  { key: "SpecialEffectElementWater", label: "SE Water", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWater.png" },
  { key: "SpecialEffectElementEarth", label: "SE Earth", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEarth.png" },
]
const SPECIAL_EFFECT_ENHANCED_ELEMENTS = [
  { key: "SpecialEffectElementEnhancedAir", label: "SE Air+", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedAir.png" },
  { key: "SpecialEffectElementEnhancedHoly", label: "SE Holy+", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedHoly.png" },
  { key: "SpecialEffectElementEnhancedDark", label: "SE Dark+", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedDark.png" },
  { key: "SpecialEffectElementEnhancedFire", label: "SE Fire+", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedFire.png" },
  { key: "SpecialEffectElementEnhancedWind", label: "SE Wind+", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWind.png" },
  { key: "SpecialEffectElementEnhancedWater", label: "SE Water+", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWater.png" },
  { key: "SpecialEffectElementEnhancedEarth", label: "SE Earth+", icon: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedEarth.png" },
]
const PROT_SUPPORT_TYPES = [
  { key: "all", label: "ALL", icon: "/Image/IcElementBless/IcElementBlessAll.png" },
  { key: "physics", label: "Physical", icon: "/Image/IcElementBless/IcElementBlessPhysics.png" },
  { key: "magic", label: "Magic", icon: "/Image/IcElementBless/IcElementBlessMagic.png" },
  { key: "special", label: "Special", icon: "/Image/IcElementBless/IcElementBlessSpecial.png" },
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
function isProtectorChar(c: TeamBuilderCharacter): boolean {
  return c.character_role === "Supporter" && !c.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}
function isAttackerChar(c: TeamBuilderCharacter): boolean {
  return c.character_role === "Attacker" || c.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}
function getProtectorSupportType(c: TeamBuilderCharacter): "physics" | "magic" | null {
  if (!isProtectorChar(c)) return null
  const leaderSkill = c.skills.find(s => s.slot === "leader_skill")
  if (!leaderSkill) return null
  const desc = (leaderSkill.description_max_level ?? "").toLowerCase()
  if (desc.includes("physical characters'") || desc.includes("increases p-atk")) return "physics"
  if (desc.includes("magic characters'") || desc.includes("increases m-atk")) return "magic"
  return null
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
function getProtectorElementKeys(c: TeamBuilderCharacter): string[] {
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

function getCardIcons(char: TeamBuilderCharacter): [string | null, string | null, string | null] {
  if (isProtectorChar(char)) {
    const forceIcons = char.force_entries
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

function getMiniCardIcons(char: TeamBuilderCharacter): [string | null, string | null] {
  if (isProtectorChar(char)) {
    const forceIcon = char.force_entries.map(e => e.icon ?? null).find(Boolean) ?? null
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
export default function TeamBuilderClient({ characters, heartprints, equipment, charms }: { characters: TeamBuilderCharacter[], heartprints: Heartprint[], equipment: Equipment[], charms: Charm[] }) {
  // 4 main slots + 4 sub-slots + 2 side slots + 2 side sub-slots
  const [mainSlots, setMainSlots] = useState<(number | null)[]>(Array(4).fill(null))
  const [subSlots, setSubSlots] = useState<(number | null)[]>(Array(4).fill(null))
  const [sideSlots, setSideSlots] = useState<(number | null)[]>(Array(2).fill(null))
  const [sideSubSlots, setSideSubSlots] = useState<(number | null)[]>(Array(2).fill(null))
  const [heartPrintId, setHeartPrintId] = useState<number | null>(null)

  // Equipment slots keyed by slotKey (e.g. "main0", "sub0", "main1", "sub1", "side0", "sidesub0")
  // Each has { weapon, armor, accessory } for attackers
  const [equipSlots, setEquipSlots] = useState<Record<string, Record<string, number | null>>>({})
  // Charm slots keyed by slotKey → skill_id
  const [charmSlots, setCharmSlots] = useState<Record<string, number | null>>({})

  // Equipment modal state
  const [showEquipModal, setShowEquipModal] = useState(false)
  const [activeEquipSlot, setActiveEquipSlot] = useState<{ slotKey: string; type: "charm" | "weapon" | "armor" | "accessory" } | null>(null)
  const [equipHoveredId, setEquipHoveredId] = useState<number | null>(null)
  const [equipQuery, setEquipQuery] = useState("")
  const [equipFilterRarity, setEquipFilterRarity] = useState<number | null>(null)

  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null)
  const [pickerMode, setPickerMode] = useState<"main" | "sub" | "side" | "sidesub" | "heartprint">("main")
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false)

  const [query, setQuery] = useState("")
  const [filterEl, setFilterEl] = useState<string | null>(null)
  const [filterAttack, setFilterAttack] = useState<string | null>(null)
  const [filterTactics, setFilterTactics] = useState<string | null>(null)
  const [filterCharType, setFilterCharType] = useState<"normal" | "ex" | null>(null)
  const [filterCharacterType, setFilterCharacterType] = useState<string | null>(null)
  const [filterRarity, setFilterRarity] = useState<number | null>(null)
  const [filterForces, setFilterForces] = useState<string[]>([])
  const [filterSkillGroups, setFilterSkillGroups] = useState<number[]>([])
  const [previewHp, setPreviewHp] = useState<Heartprint | null>(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || ((navigator as any).msMaxTouchPoints && (navigator as any).msMaxTouchPoints > 0)
      setIsTouchDevice(Boolean(hasTouch))
    } catch (e) {
      setIsTouchDevice(false)
    }
  }, [])
  const lastTouchRef = useRef<number>(0)
  const [filterSkillType, setFilterSkillType] = useState<"all" | "secret" | "battle" | "protection" | "skill" | "trait" | "valor" | "other">("all")
  const [expandedSkillCats, setExpandedSkillCats] = useState<string[]>([])
  const [filterWeapon, setFilterWeapon] = useState<string | null>(null)
  const [filterProtType, setFilterProtType] = useState<"all" | "physics" | "magic" | "special">("all")
  const [filterUltimateType, setFilterUltimateType] = useState<"all" | "attack" | "support">("all")
  const [filterEnhancement, setFilterEnhancement] = useState<"all" | "ex" | "unbound">("all")
  const [filterProtSkill, setFilterProtSkill] = useState<"all" | "secret" | "protection" | "skill" | "other">("all")
  const [filterSkillCost, setFilterSkillCost] = useState(0)
  const [filterDragOffset, setFilterDragOffset] = useState<{x: number, y: number}>({x: 0, y: 0})
  const [filterSize, setFilterSize] = useState<{w: number, h: number}>({w: 380, h: 0})
  const filterResizeStart = useRef<{w: number, h: number, px: number, py: number} | null>(null)
  const [showSkillEffect, setShowSkillEffect] = useState(false)
  const deferredQuery = useDeferredValue(query)

  const characterById = useMemo(() => new Map(characters.map((character) => [character.master_pc_id, character])), [characters])
  const ambiguousCharacterNames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const character of characters) {
      const nameKey = normalizeIdentityText(character.name)
      if (!nameKey) continue
      counts.set(nameKey, (counts.get(nameKey) ?? 0) + 1)
    }
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([name]) => name))
  }, [characters])

  const getCharacterById = useCallback((characterId: number | null | undefined): TeamBuilderCharacter | null => {
    if (characterId == null) return null
    return characterById.get(characterId) ?? null
  }, [characterById])

  const forceOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const character of characters) {
      for (const force of character.forces) {
        if (!map.has(force.name)) {
          map.set(force.name, force.icon_path)
        }
      }
    }
    return Array.from(map.entries()).map(([name, icon]) => ({ label: name, value: name, icon: toPublicAssetPath(icon) }))
  }, [characters])

  const filterDragStart = useRef<{x: number, y: number, px: number, py: number} | null>(null)

  // Forces grouped by group field
  const forceGroups = useMemo(() => {
    const groups = new Map<string, Array<{ name: string; icon: string | null }>>()
    for (const c of characters) {
      for (const f of c.forces) {
        if (!groups.has(f.group)) groups.set(f.group, [])
        const arr = groups.get(f.group)!
        if (!arr.find(x => x.name === f.name)) arr.push({ name: f.name, icon: f.icon_path ? toPublicAssetPath(f.icon_path) : null })
      }
    }
    // Sort each group alphabetically
    for (const [, arr] of groups) arr.sort((a, b) => a.name.localeCompare(b.name))
    return groups
  }, [characters])

  // Derived skill filter categories from all character data
  const skillFilterCats = useMemo(() => {
    const cats = new Map<string, Map<string, number>>() // category → (sub_label → group_id)
    for (const c of characters) {
      for (const sk of c.skills) {
        for (const fg of (sk.skill_filter_groups ?? [])) {
          if (!cats.has(fg.category_name)) cats.set(fg.category_name, new Map())
          cats.get(fg.category_name)!.set(fg.sub_category_label, fg.master_skill_filter_group_id)
        }
      }
    }
    return cats
  }, [characters])

  const masterCharacterTacticsOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const c of characters) if (c.master_character_tactics_type) seen.add(c.master_character_tactics_type)
    return Array.from(seen).sort()
  }, [characters])

  const heartprintItems = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return heartprints.filter(hp =>
      hp.still_type === "rare" &&
      (!q || hp.title?.toLowerCase().includes(q) || String(hp.heartprint_id).includes(q))
    )
  }, [deferredQuery, heartprints])

  function isExChar(c: TeamBuilderCharacter) {
    return isExUnboundCharacter(c) || hasExSpecialSkill(c) || isExAttacker(c)
  }

  const results = useMemo(() => {
    if (pickerMode === "heartprint") return []
    const roleFilter = ((pickerMode === "main" || pickerMode === "sub") && pickerOpenFor === 0) ? "supporter" : "attacker"
    const q = deferredQuery.trim().toLowerCase()
    // Build set of already-selected IDs, excluding the current slot being edited
    const taken = new Set<number>()
    mainSlots.forEach((id, idx) => { if (id && !(pickerMode === "main" && pickerOpenFor === idx)) taken.add(id) })
    subSlots.forEach((id, idx) => { if (id && !(pickerMode === "sub" && pickerOpenFor === idx)) taken.add(id) })
    sideSlots.forEach((id, idx) => { if (id && !(pickerMode === "side" && pickerOpenFor === idx)) taken.add(id) })
    sideSubSlots.forEach((id, idx) => { if (id && !(pickerMode === "sidesub" && pickerOpenFor === idx)) taken.add(id) })
    const filtered = characters.filter((c) => {
      if (taken.has(c.master_pc_id)) return false
      if (q && !c.search_text.includes(q)) return false
      if (c.character_role?.toLowerCase() !== roleFilter) return false
      if (filterEl && !elementMatches(c.element ?? "", filterEl)) return false
      if (filterAttack && c.attack_type?.toLowerCase() !== filterAttack.toLowerCase()) return false
      if (filterTactics && c.tactics_type?.toLowerCase() !== filterTactics.toLowerCase()) return false
      if (filterCharType === "normal" && isExChar(c)) return false
      if (filterCharType === "ex" && !isExChar(c)) return false
      if (filterCharacterType && c.master_character_tactics_type !== filterCharacterType) return false
      if (filterRarity != null && getCharacterVisualTier(c) !== filterRarity) return false
      if (filterForces.length && !filterForces.some((forceName) => c.force_names.includes(forceName))) return false
      if (filterWeapon && c.weapon_type?.toLowerCase() !== filterWeapon.toLowerCase()) return false
      if (filterProtType !== "all" && isProtectorChar(c)) {
        if (filterProtType === "special") {
          const el = (c.element ?? "").toLowerCase()
          if (!el.startsWith("specialeffect")) return false
        } else {
          const st = getProtectorSupportType(c)
          if (st && st !== filterProtType) return false
        }
      }
      if (filterEnhancement === "ex" && !isExAttacker(c) && !hasExSpecialSkill(c)) return false
      if (filterEnhancement === "unbound" && !isExUnboundCharacter(c)) return false
      // Protection Skill filter — protectors only
      if (filterProtSkill !== "all" && roleFilter === "supporter") {
        if (filterProtSkill === "secret") {
          if (!c.skills.some(s => s.slot === "bless_skill")) return false
        } else if (filterProtSkill === "protection") {
          const ls = c.skills.find(s => s.slot === "leader_skill")
          const desc = (ls?.description_max_level ?? "").toLowerCase()
          if (!(desc.includes("def") || desc.includes("protect") || desc.includes("guard") || desc.includes("reduce") || desc.includes("resist"))) return false
        } else if (filterProtSkill === "skill") {
          const ls = c.skills.find(s => s.slot === "leader_skill")
          const desc = (ls?.description_max_level ?? "").toLowerCase()
          if (!(desc.includes("atk") || desc.includes("attack") || desc.includes("damage") || desc.includes("increase"))) return false
        } else if (filterProtSkill === "other") {
          const ls = c.skills.find(s => s.slot === "leader_skill")
          const desc = (ls?.description_max_level ?? "").toLowerCase()
          const isDefensive = desc.includes("def") || desc.includes("protect") || desc.includes("guard") || desc.includes("reduce") || desc.includes("resist")
          const isOffensive = desc.includes("atk") || desc.includes("attack") || desc.includes("damage") || desc.includes("increase")
          if (isDefensive || isOffensive) return false
        }
      }
      if (filterSkillGroups.length > 0) {
        const groupSet = new Set(filterSkillGroups)
        const isProtPicker = roleFilter === "supporter"
        const skillsToCheck = filterSkillType === "secret"
          ? (isProtPicker
            ? c.skills.filter(s => s.slot === "bless_skill")
            : c.skills.filter(s => s.slot === "special_skill"))
          : filterSkillType === "battle"
          ? c.skills.filter(s => s.slot.startsWith("active_skill"))
          : filterSkillType === "protection"
          ? c.skills.filter(s => s.slot === "leader_skill" || s.slot === "assist_leader_skill")
          : filterSkillType === "skill"
          ? c.skills.filter(s => s.slot.startsWith("active_skill"))
          : filterSkillType === "trait"
          ? (c.traits as {skill_filter_groups?: {master_skill_filter_group_id:number}[]}[]).filter(t => !(t as any).icon_path?.includes("ArenaPassive"))
          : filterSkillType === "valor"
          ? (c.traits as {skill_filter_groups?: {master_skill_filter_group_id:number}[]}[]).filter(t => (t as any).icon_path?.includes("ArenaPassive"))
          : filterSkillType === "other"
          ? [...c.traits]
          : [...c.skills, ...c.traits]
        if (!skillsToCheck.some(sk => ((sk as {skill_filter_groups?: {master_skill_filter_group_id:number}[]}).skill_filter_groups ?? []).some((fg: {master_skill_filter_group_id:number}) => groupSet.has(fg.master_skill_filter_group_id)))) return false
      }
      // Secret skill sub-filter (ultimate_type) — attackers only
      if (filterSkillType === "secret" && filterUltimateType !== "all" && roleFilter !== "supporter") {
        const ut = (c.ultimate_type ?? "None").toLowerCase()
        if (filterUltimateType === "attack" && ut !== "attack") return false
        if (filterUltimateType === "support" && ut !== "support") return false
      }
      // Skill cost slider filter — only active for All or Battle Skills
      if (filterSkillCost > 0 && (filterSkillType === "all" || filterSkillType === "battle")) {
        const hasMatchingSkill = c.skills.some(s => {
          const cost = s.cost
          if (cost == null) return false
          return cost >= filterSkillCost
        })
        if (!hasMatchingSkill) return false
      }
      return true
    })
    // Sort by rarity descending: EX Unbound (7) > EX (6) > 5 > 4 > 3
    filtered.sort((a, b) => getCharacterVisualTier(b) - getCharacterVisualTier(a))
    return filtered
  }, [characters, deferredQuery, filterAttack, filterCharType, filterCharacterType, filterEl, filterEnhancement, filterForces, filterProtSkill, filterProtType, filterRarity, filterSkillCost, filterSkillGroups, filterSkillType, filterTactics, filterUltimateType, filterWeapon, mainSlots, pickerMode, pickerOpenFor, sideSlots, sideSubSlots, subSlots])

  // Flatten charms into individual skill items, deduplicated by skill_id
  type FlatCharm = { skill_id: number; name: string; description: string | null; image_path: string | null; rarity: number; is_quest_skill: boolean }
  const flatCharms = useMemo(() => {
    const seen = new Set<number>()
    const items: FlatCharm[] = []
    for (const ch of charms) {
      for (const sk of ch.possible_skills) {
        if (seen.has(sk.skill_id)) continue
        seen.add(sk.skill_id)
        items.push({ skill_id: sk.skill_id, name: sk.name ?? "Unknown Charm", description: sk.description, image_path: sk.image_path, rarity: ch.rarity, is_quest_skill: sk.is_quest_skill })
      }
    }
    return items
  }, [charms])

  // Equipment modal: items for the active slot
  const equipModalItems = useMemo(() => {
    if (!activeEquipSlot) return [] as (Equipment | FlatCharm)[]
    const q = equipQuery.trim().toLowerCase()
    if (activeEquipSlot.type === "charm") {
      return flatCharms.filter(c => {
        if (q && !c.name.toLowerCase().includes(q)) return false
        if (equipFilterRarity != null && c.rarity !== equipFilterRarity) return false
        return true
      })
    }
    return equipment.filter(e => {
      if (e.type !== activeEquipSlot.type) return false
      if (q && !e.name.toLowerCase().includes(q)) return false
      if (equipFilterRarity != null && e.base_rarity !== equipFilterRarity) return false
      return true
    })
  }, [activeEquipSlot, equipQuery, equipFilterRarity, flatCharms, equipment])

  // Helper to get equip record for a slotKey
  function getEquipRecord(slotKey: string) {
    return equipSlots[slotKey] ?? { weapon: null, armor: null, accessory: null }
  }
  function setEquipForSlot(slotKey: string, eqType: string, eqId: number | null) {
    setEquipSlots(prev => ({ ...prev, [slotKey]: { ...(prev[slotKey] ?? { weapon: null, armor: null, accessory: null }), [eqType]: eqId } }))
  }

  // Helper to build modal character list grouped: main+sub pairs per battle slot, protector first
  type EquipSlotEntry = { slotKey: string; label: string; charId: number; isProt: boolean; isSub: boolean }
  type EquipSlotGroup = { mainEntry: EquipSlotEntry | null; subEntry: EquipSlotEntry | null; isProtGroup: boolean }
  const equipModalGroups = useMemo(() => {
    const groups: EquipSlotGroup[] = []
    // Slot 0 = protector group, slots 1-3 = battle groups
    for (let i = 0; i < 4; i++) {
      const mainId = mainSlots[i]
      const subId = subSlots[i]
      if (!mainId && !subId) continue
      const mainChar = getCharacterById(mainId)
      const subChar = getCharacterById(subId)
      const protGroup = i === 0
      const mainEntry: EquipSlotEntry | null = mainId ? {
        slotKey: `main${i}`, label: protGroup ? "Protection" : `Battle ${i}`,
        charId: mainId, isProt: protGroup, isSub: false
      } : null
      const subEntry: EquipSlotEntry | null = subId ? {
        slotKey: `sub${i}`, label: protGroup ? "Protection (Sub)" : `Battle ${i} (Sub)`,
        charId: subId, isProt: mainChar ? isProtectorChar(mainChar) : false, isSub: true
      } : null
      groups.push({ mainEntry, subEntry, isProtGroup: protGroup })
    }
    // Side slots
    for (let i = 0; i < 2; i++) {
      const mainId = sideSlots[i]
      const subId = sideSubSlots[i]
      if (!mainId && !subId) continue
      const mainChar = getCharacterById(mainId)
      const isProt = mainChar ? isProtectorChar(mainChar) : false
      const mainEntry: EquipSlotEntry | null = mainId ? {
        slotKey: `side${i}`, label: isProt ? `Side Prot ${i+1}` : `Side ${i+1}`,
        charId: mainId, isProt, isSub: false
      } : null
      const subEntry: EquipSlotEntry | null = subId ? {
        slotKey: `sidesub${i}`, label: isProt ? `Side Prot ${i+1} (Sub)` : `Side ${i+1} (Sub)`,
        charId: subId, isProt: false, isSub: true
      } : null
      groups.push({ mainEntry, subEntry, isProtGroup: isProt })
    }
    return groups
  }, [getCharacterById, mainSlots, sideSlots, sideSubSlots, subSlots])

  // Flat list for backward-compat (used by auto-equip)
  const equipModalChars = useMemo(() => {
    const list: { slotKey: string; label: string; charId: number; isProt: boolean }[] = []
    for (const g of equipModalGroups) {
      if (g.mainEntry) list.push(g.mainEntry)
      if (g.subEntry) list.push(g.subEntry)
    }
    return list
  }, [equipModalGroups])

  // ── Auto-equip logic ──────────────────────────────────────────────────────
  // Scoring model: effective stats the character actually gets from this piece.
  //   Weapon  : effective_atk = max_atk × (1 + 0.20 × weaponTypeMatch + 0.10 × elementMatch)
  //   Armor   : effective_def = max_def × (1 + 0.10 × elementMatch)
  //   Accessory: effective_hp = max_hp  × (1 + 0.10 × elementMatch)
  // Exclusive (name / affiliation in desc) → large flat bonus so they beat generics.
  // Valor Cup effects are excluded (don't apply outside Valor Cup battles).
  //
  // Weapon type normalisation: character names ≠ equipment names
  // Element normalisation (char element → description word):
  //   Holy → light | Air → wind | Wind → wind | EnhancedX → same as X (strip prefix)
  //   Fire | Water | Earth | Dark are same lower-case.

  function normalizeWeaponType(wt: string | null): string {
    if (!wt) return ""
    const n = wt.toLowerCase().trim()
    const map: Record<string, string> = {
      // knuckle / fist synonyms used in equipment vs character data
      fist: "knuckle",
      fists: "knuckle",
      knuckles: "knuckle",
      gauntlet: "knuckle",
      // large/greatsword synonyms
      largesword: "greatsword",
      "large sword": "greatsword",
      "large_sword": "greatsword",
      "large-sword": "greatsword",
      greatsword: "greatsword",
      "great sword": "greatsword",
      "great_sword": "greatsword",
      "great-sword": "greatsword",
      // book / tome synonyms (equipment uses "Magic Tome", characters use "Book")
      "magic tome": "book",
      "magic_tome": "book",
      "magic-tome": "book",
      tome: "book",
      grimoire: "book",
      spellbook: "book",
      "spell book": "book",
      // spear / lance synonyms (equipment may call them Lance/Pike etc.)
      lance: "spear",
      lances: "spear",
      pike: "spear",
      pikes: "spear",
      trident: "spear",
      halberd: "spear",
      glaive: "spear",
    }
    return map[n] ?? n
  }

  const CHAR_ELEMENT_NORM: Record<string, string> = {
    Holy: "light", Air: "space",
    EnhancedHoly: "light", EnhancedAir: "space", EnhancedWind: "wind",
    EnhancedFire: "fire", EnhancedWater: "water", EnhancedEarth: "earth", EnhancedDark: "dark"
  }
  function normalizeElement(el: string | null): string {
    if (!el) return ""
    return (CHAR_ELEMENT_NORM[el] ?? el).toLowerCase()
  }

  function normalizeIdentityText(value: string | null | undefined): string {
    return stripColorTags(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  }

  function getEquipmentTargetPhrases(effects: string[]): string[] {
    const targets = new Set<string>()
    for (const effect of effects) {
      const normalizedEffect = normalizeIdentityText(effect)
      const matches = normalizedEffect.matchAll(/when equipped by (.+?) increases/g)
      for (const match of matches) {
        const target = (match[1] ?? "").trim().replace(/\s+,/g, "").trim()
        if (target) {
          targets.add(target)
        }
      }
    }
    return [...targets]
  }

  function getCharacterIdentityPhrases(char: TeamBuilderCharacter): string[] {
    const name = normalizeIdentityText(char.name)
    const affiliation = normalizeIdentityText(char.affiliation_name)
    if (!name) return []
    if (!affiliation) return [name]

    const phrases = new Set<string>([
      `${name} ${affiliation}`.trim(),
      `${name} the ${affiliation}`.trim(),
    ])

    if (affiliation.startsWith("the ")) {
      phrases.add(`${name} ${affiliation.replace(/^the\s+/, "")}`.trim())
    }

    return [...phrases].filter(Boolean)
  }

  function scoreEquipment(eq: Equipment, char: TeamBuilderCharacter): number {
    // Strip Valor Cup effects — they only apply in arena and never count here
    const validEffects = [eq.effect1 ?? "", eq.effect2 ?? ""]
      .filter(e => !e.toLowerCase().includes("valor cup"))
    const combined = validEffects.join(" ").toLowerCase()
    const equipmentTargets = getEquipmentTargetPhrases(validEffects)

    const charName  = normalizeIdentityText(char.name)
    const charAffil = normalizeIdentityText(char.affiliation_name)
    const charEl    = normalizeElement(char.element ?? "")
    const charWt    = normalizeWeaponType(char.weapon_type ?? "")
    const eqWt      = normalizeWeaponType(eq.weapon_type ?? "")

    // Compute weapon-type and element multipliers
    const weaponMatch   = eq.type === "weapon" && !!charWt && !!eqWt && eqWt === charWt
    const elementMatch  = !!charEl && combined.includes(charEl + " character")

    // Effective primary stat (what the character actually gets)
    let effectiveStat: number
    if (eq.type === "weapon") {
      const atk = eq.max_atk ?? 0
      effectiveStat = atk * (1 + (weaponMatch ? 0.20 : 0) + (elementMatch ? 0.10 : 0))
    } else if (eq.type === "armor") {
      effectiveStat = (eq.max_def ?? 0) * (1 + (elementMatch ? 0.10 : 0))
    } else {
      effectiveStat = (eq.max_hp ?? 0) * (1 + (elementMatch ? 0.10 : 0))
    }

    // Base: effective stat drives sorting (rarity is a tiebreaker)
    let score = effectiveStat + eq.rarity * 0.5 + eq.base_rarity * 0.1

    const identityPhrases = getCharacterIdentityPhrases(char)
    const fullIdentityMatch = identityPhrases.some((phrase) => equipmentTargets.includes(phrase))
    const nameTargetMatch = charName.length > 2 && equipmentTargets.includes(charName)
    const affilInDesc = charAffil.length > 2 && combined.includes(charAffil)

    if (fullIdentityMatch) {
      score += 100000  // confirmed exclusive
    } else if (nameTargetMatch && !ambiguousCharacterNames.has(charName)) {
      score += 80000   // name match alone (covers e.g. "Megumin")
    } else if (affilInDesc) {
      score += 60000   // affiliation only (still likely dedicated piece)
    }

    return score
  }

  function autoEquipAll() {
    // Note: allow the same equipment to be assigned to multiple characters —
    // we intentionally do not track "used" ids across slots so each character
    // receives the best-fitting gear regardless of duplicates.
    const newEquipSlots: Record<string, Record<string, number | null>> = {}

    // Collect all attacker slot keys in order (main first, then sub, side, sidesub)
    const attackerSlots: { slotKey: string; charId: number }[] = []
    for (let i = 0; i < 4; i++) {
      if (mainSlots[i]) {
        const c = getCharacterById(mainSlots[i])
        if (c && !isProtectorChar(c)) attackerSlots.push({ slotKey: `main${i}`, charId: mainSlots[i]! })
      }
      if (subSlots[i]) {
        const c = getCharacterById(subSlots[i])
        if (c && !isProtectorChar(c)) attackerSlots.push({ slotKey: `sub${i}`, charId: subSlots[i]! })
      }
    }
    for (let i = 0; i < 2; i++) {
      if (sideSlots[i]) {
        const c = getCharacterById(sideSlots[i])
        if (c && !isProtectorChar(c)) attackerSlots.push({ slotKey: `side${i}`, charId: sideSlots[i]! })
      }
      if (sideSubSlots[i]) {
        const c = getCharacterById(sideSubSlots[i])
        if (c && !isProtectorChar(c)) attackerSlots.push({ slotKey: `sidesub${i}`, charId: sideSubSlots[i]! })
      }
    }

    for (const { slotKey, charId } of attackerSlots) {
      const char = getCharacterById(charId)
      if (!char) continue
      const slotRec: Record<string, number | null> = { weapon: null, armor: null, accessory: null }

      for (const eqType of ["weapon", "armor", "accessory"] as const) {
        const candidates = equipment.filter(e => {
          if (e.type !== eqType) return false
          // allow reuse of the same equipment across characters

          // Exclude items whose EVERY description effect is a Valor Cup bonus —
          // they provide no benefit outside Valor Cup battles.
          const descEffects = [e.effect1 ?? "", e.effect2 ?? ""].filter(s => s.trim().length > 0)
          if (descEffects.length > 0 && descEffects.every(ef => ef.toLowerCase().includes("valor cup"))) return false

          // If the item explicitly targets a specific character (e.g. "When equipped by My Name Is Megumin,..."),
          // consider it exclusive and only allow it as a candidate for the matching character(s).
          const equipmentTargets = getEquipmentTargetPhrases(descEffects)
          if (equipmentTargets.length > 0) {
            // If any target is generic (mentions "character"/"force"/"ally"/"team"), allow it —
            // these are group targets, not single-character exclusives.
            const hasGenericTarget = equipmentTargets.some(t =>
              t.includes("character") || t.includes("characters") || t.includes("force") || t.includes("ally") || t.includes("allies") || t.includes("team")
            )
            if (!hasGenericTarget) {
              const charName = normalizeIdentityText(char.name)
              const charAffil = normalizeIdentityText(char.affiliation_name)
              const nameAffilA = `${charName} ${charAffil}`.trim()
              const nameAffilB = `${charAffil} ${charName}`.trim()
              const identityPhrases = getCharacterIdentityPhrases(char)

              const descCombined = descEffects.join(" ").toLowerCase()

              const matchesTarget = equipmentTargets.includes(charName)
                || equipmentTargets.includes(nameAffilA)
                || equipmentTargets.includes(nameAffilB)
                || identityPhrases.some(p => equipmentTargets.includes(p))
                || (charAffil.length > 2 && descCombined.includes(charAffil))

              if (!matchesTarget) return false
            }
          }

          return true
        })

        if (candidates.length === 0) continue

        // Helper: does this equipment explicitly target this character (and is not a generic target)?
        const isExclusiveForChar = (e: Equipment) => {
          const descEffects = [e.effect1 ?? "", e.effect2 ?? ""].filter(s => s.trim().length > 0)
          const equipmentTargets = getEquipmentTargetPhrases(descEffects)
          if (equipmentTargets.length === 0) return false
          const hasGenericTarget = equipmentTargets.some(t =>
            t.includes("character") || t.includes("characters") || t.includes("force") || t.includes("ally") || t.includes("allies") || t.includes("team")
          )
          if (hasGenericTarget) return false
          const charName = normalizeIdentityText(char.name)
          const charAffil = normalizeIdentityText(char.affiliation_name)
          const nameAffilA = `${charName} ${charAffil}`.trim()
          const nameAffilB = `${charAffil} ${charName}`.trim()
          const identityPhrases = getCharacterIdentityPhrases(char)
          const descCombined = descEffects.join(" ").toLowerCase()
          return equipmentTargets.includes(charName)
            || equipmentTargets.includes(nameAffilA)
            || equipmentTargets.includes(nameAffilB)
            || identityPhrases.some(p => equipmentTargets.includes(p))
            || (charAffil.length > 2 && descCombined.includes(charAffil))
        }

        const equipmentElementMatch = (e: Equipment) => {
          const validEffects = [e.effect1 ?? "", e.effect2 ?? ""].filter(ef => ef && !ef.toLowerCase().includes("valor cup"))
          if (validEffects.length === 0) return false
          // strip color tags and other markup before matching
          const combined = validEffects.map(s => stripColorTags(s)).join(" ").toLowerCase()
          const nameText = (e.name ?? "").toLowerCase()
          const charEl = normalizeElement(char.element ?? "")
          if (!charEl) return false

          // Common synonyms that may appear in equipment descriptions/names
          const ELEMENT_SYNONYMS: Record<string, string[]> = {
            water: ["water", "aqua", "icy"],
            fire: ["fire", "flame", "flames", "blaze", "blazing"],
            earth: ["earth"],
            dark: ["dark", "shadow"],
            light: ["light", "holy"],
            wind: ["wind", "air"],
            space: ["space"]
          }

          const aliases = ELEMENT_SYNONYMS[charEl] ?? [charEl]
          for (const a of aliases) {
            const token = a.toLowerCase()
            if (combined.includes(`${token} character`) || combined.includes(`${token} characters`) || combined.includes(`${token} element`) || combined.includes(`${token} attribute`)) return true
            // name-based matches (e.g. "Amulet of Icy Water", "Tome of Icy Water")
            if (nameText.includes(token)) return true
          }

          return false
        }

        // If there are any exclusives for this char, pick by name-first, then affiliation.
        const exclusiveCandidates = candidates.filter(isExclusiveForChar)
        if (exclusiveCandidates.length > 0) {
          const charName = normalizeIdentityText(char.name)
          const charAffil = normalizeIdentityText(char.affiliation_name)

          // Helpers for precise identity matching
          const getTargetsForEquip = (e: Equipment) => getEquipmentTargetPhrases([e.effect1 ?? "", e.effect2 ?? ""])
          const descCombinedFor = (e: Equipment) => ([e.effect1 ?? "", e.effect2 ?? ""].join(" ").toLowerCase())

          // Return true if the equipment's target phrase should match this character by name.
          // We treat a target phrase with extra words (e.g. "frey the sky queen") as a specific identity
          // and require the affiliation to match; only single-token phrases count as generic name-only targets.
          const matchesNamePhrase = (e: Equipment) => {
            const targets = getTargetsForEquip(e)
            for (const t of targets) {
              const tNoThe = t.replace(/\bthe\b/g, "").trim()
              const toks = tNoThe.split(/\s+/).filter(Boolean)
              if (toks.length === 1 && toks[0] === charName) return true
              // if phrase contains the name and also contains the character's affiliation, accept
              if (t.includes(charName) && t.includes(charAffil)) return true
            }
            return false
          }

          const targetsIncludeToken = (e: Equipment, token: string) => {
            if (!token) return false
            const targets = getTargetsForEquip(e)
            const descCombined = descCombinedFor(e)
            return targets.some(t => t.includes(token)) || descCombined.includes(token)
          }

          // 1) Prefer items that mention the character name (generic name or name+affiliation as above).
          const nameMatches = exclusiveCandidates.filter(e => matchesNamePhrase(e))
            if (nameMatches.length === 1) {
            slotRec[eqType] = nameMatches[0].id
            continue
          }
          if (nameMatches.length > 1) {
            // If multiple name-matched items, prefer ones that also reference affiliation.
            const affMatches = nameMatches.filter(e => targetsIncludeToken(e, charAffil))
            const pool = affMatches.length > 0 ? affMatches : nameMatches
            pool.sort((a, b) => scoreEquipment(b, char) - scoreEquipment(a, char))
            const best = pool[0]
            slotRec[eqType] = best.id
            continue
          }

          // 2) No name matches — fall back to affiliation-only exclusives (that do not match name above).
          const affOnlyMatches = exclusiveCandidates.filter(e => !matchesNamePhrase(e) && targetsIncludeToken(e, charAffil))
          if (affOnlyMatches.length === 1) {
            slotRec[eqType] = affOnlyMatches[0].id
            continue
          }
          if (affOnlyMatches.length > 1) {
            affOnlyMatches.sort((a, b) => scoreEquipment(b, char) - scoreEquipment(a, char))
            const best = affOnlyMatches[0]
            slotRec[eqType] = best.id
            continue
          }

          // 3) Fallback: pick best exclusive by score.
          exclusiveCandidates.sort((a, b) => scoreEquipment(b, char) - scoreEquipment(a, char))
          const best = exclusiveCandidates[0]
          slotRec[eqType] = best.id
          continue
        }

        // No exclusives — pick by strict matching rules requested:
        // - Weapon: prefer same weapon type, prefer element within that set
        // - Armor/Accessory: prefer element-matching items
        if (eqType === "weapon") {
          const charWt = normalizeWeaponType(char.weapon_type ?? "")
          let wtCandidates = charWt ? candidates.filter(e => normalizeWeaponType(e.weapon_type ?? "") === charWt) : []
          if (wtCandidates.length > 0) {
            const wtElCandidates = wtCandidates.filter(equipmentElementMatch)
            const pool = wtElCandidates.length > 0 ? wtElCandidates : wtCandidates
            pool.sort((a, b) => scoreEquipment(b, char) - scoreEquipment(a, char))
            const best = pool[0]
            slotRec[eqType] = best.id
            continue
          }
        } else {
          // armor or accessory: prefer element-matching
          const elCandidates = candidates.filter(equipmentElementMatch)
          if (elCandidates.length > 0) {
            elCandidates.sort((a, b) => scoreEquipment(b, char) - scoreEquipment(a, char))
            const best = elCandidates[0]
            slotRec[eqType] = best.id
            continue
          }
        }

        // Fallback behavior:
        if (eqType === "weapon") {
          // For weapons, fall back to best-scored candidate
          candidates.sort((a, b) => scoreEquipment(b, char) - scoreEquipment(a, char))
          const best = candidates[0]
          slotRec[eqType] = best.id
        } else {
          // For armor/accessory we require element-matching; leave empty if none found.
          slotRec[eqType] = null
        }
      }
      newEquipSlots[slotKey] = slotRec
    }
    setEquipSlots(prev => ({ ...prev, ...newEquipSlots }))
  }

  function openEquipModal() {
    setActiveEquipSlot(null)
    setEquipQuery("")
    setEquipFilterRarity(null)
    setEquipHoveredId(null)
    setShowEquipModal(true)
  }

  function openPicker(i: number, mode: "main" | "sub" | "side" | "sidesub" | "heartprint") {
    setPickerOpenFor(i); setPickerMode(mode); setQuery("")
    setFilterEl(null); setFilterAttack(null); setFilterTactics(null)
    setFilterCharType(null); setFilterCharacterType(null); setFilterRarity(null); setFilterForces([]); setFilterSkillGroups([])
    setPreviewHp(null); setFilterSkillType("all"); setExpandedSkillCats([])
    setFilterWeapon(null); setFilterProtType("all"); setFilterUltimateType("all")
    setFilterEnhancement("all"); setFilterProtSkill("all"); setFilterDragOffset({x: 0, y: 0})
    setFilterSkillCost(0); setShowSkillEffect(false)
    setShowFilterModal(false)
  }
  function closePicker() { setPickerOpenFor(null) }

  function selectChar(i: number, id: number) {
    if (pickerMode === "heartprint") { setHeartPrintId(id); closePicker(); return }
    // Character selection → set the slot, switch to editing the other slot, don't close
    if (pickerMode === "sub") {
      setSubSlots((s) => { const c = [...s]; c[i] = id; return c })
      setPickerMode("main")
    } else if (pickerMode === "sidesub") {
      setSideSubSlots((s) => { const c = [...s]; c[i] = id; return c })
      setPickerMode("side")
    } else if (pickerMode === "side") {
      setSideSlots((s) => { const c = [...s]; c[i] = id; return c })
      setPickerMode("sidesub")
    } else {
      setMainSlots((s) => { const c = [...s]; c[i] = id; return c })
      setPickerMode("sub")
    }
    setQuery("")
  }

  // ==========================================
  // MAIN SLOT CARD
  // Frame dimensions: high-tier (6-7★) = 264×628, low-tier (3-5★) = 248×612
  // The frame PNG has transparent center; base+portrait fill behind it.
  // ==========================================
  function MainSlotCard({ i }: { i: number }) {
    const charId = mainSlots[i]
    const subCharId = subSlots[i]
    const char = getCharacterById(charId)
    const subChar = getCharacterById(subCharId)
    const isProt = i === 0
    const role: "bless" | "member" = isProt ? "bless" : "member"
    const tier = char ? getCharacterVisualTier(char) : 5
    const { base: mainBase, frame: mainFrame } = getMainFramePaths(tier, role)

    // FRAME_W/FRAME_H defined at component level
    const [mainIcon1, mainIcon2, mainIcon3] = char ? getCardIcons(char) : [null, null, null]
    const mainIcons = [mainIcon1, mainIcon2, mainIcon3].filter(Boolean) as string[]
    const [subIcon1, subIcon2] = subChar ? getMiniCardIcons(subChar) : [null, null]

    // Diamond slot centers measured from frame PNGs (averaged L5/L6):
    // Upper diamond: right≈14%, top≈5%  |  Lower diamond: right≈14%, top≈14.3%
    // Icon width=12% of card width → center offset = 6%, height offset ≈ 2.5%

    return (
      <div
        className="relative flex-shrink-0 overflow-hidden cursor-pointer select-none"
        style={{ aspectRatio: '264 / 628' }}
        onClick={() => openPicker(i, "main")}
      >
        {/* Empty state — diamond shape with + */}
        {!char && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: "rgba(18,20,28,0.85)",
              borderRadius: "4px",
            }}
          >
            <div className="relative" style={{ width: "55%", aspectRatio: "1" }}>
              <div style={{
                width: "100%", height: "100%",
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                background: "linear-gradient(135deg, rgba(80,90,120,0.3), rgba(40,50,70,0.6))",
                border: "none",
              }}>
                <div style={{
                  position: "absolute", inset: "2px",
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                  background: "rgba(12,16,24,0.9)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span className="text-white/40 font-light text-3xl select-none" style={{ transform: "none" }}>+</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filled state: base → portrait → frame overlay */}
        {char && (
          <>
            {/* Base texture — inset to stay within ornate frame borders */}
            <img
              src={mainBase} alt=""
              className="absolute object-fill pointer-events-none"
              style={{ top: '2%', left: '4%', width: '92%', height: '96%' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
            {/* Character portrait — inset to stay within ornate frame borders */}
            <img
              src={`/partyL/${char.master_pc_id}.png`} alt={char.name}
              className="absolute object-fill pointer-events-none"
              style={{ top: '2%', left: '4%', width: '92%', height: '96%' }}
              onError={(e) => { (e.target as HTMLImageElement).src = toPublicAssetPath(char.images.full) }}
            />
            {/* Frame overlay fills entire card (has transparent center) */}
            <img
              src={mainFrame} alt=""
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              style={{ objectFit: "fill" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
          </>
        )}

        {/* Sub-slot at bottom center */}
        <button
          onClick={(e) => { e.stopPropagation(); openPicker(i, "sub") }}
          className="absolute overflow-hidden z-20"
          style={{
            width: "46%", aspectRatio: "1",
            bottom: "4%", left: "27%",
            borderRadius: "4px",
            border: subChar ? "none" : "1.5px solid rgba(140,140,150,0.5)",
            background: "rgba(10,12,18,0.8)",
          }}
        >
          {subChar ? (
            <>
              <div className="absolute inset-0" style={{ backgroundImage: `url('${toPublicAssetPath(subChar.images.icon)}')`, backgroundSize: 'cover', backgroundPosition: 'top center' }} />
              {(() => {
                const t = getCharacterVisualTier(subChar)
                const r: "bless" | "member" = isProtectorChar(subChar) ? "bless" : "member"
                const { frame } = getMiniFramePaths(t, r)
                return <img src={frame} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-fill"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
              })()}
              {(subIcon1 || subIcon2) && (
                <div className="absolute top-0.5 right-0.5 z-20 flex flex-col gap-0.5">
                  {subIcon1 && <img src={subIcon1} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow" />}
                  {subIcon2 && <img src={subIcon2} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow" />}
                </div>
              )}
            </>
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-white/35 font-light text-lg">+</span>
          )}
        </button>

        {/* Attacker icons — positioned at frame's diamond slots */}
        {char && !isProt && mainIcons.length > 0 && (
          <>
            {mainIcons[0] && (
              <img src={mainIcons[0]} alt=""
                className="absolute z-30 object-contain drop-shadow-lg"
                style={ tier >= 6
                  ? { right: '3%', top: '1.5%', width: '22%' }
                  : { right: '0.8%', top: '0.1%', width: '22%' } }
              />
            )}
            {mainIcons[1] && (
              <img src={mainIcons[1]} alt=""
                className="absolute z-30 object-contain drop-shadow-lg"
                style={ tier >= 6
                  ? { right: '3.5%', top: '10.3%', width: '21.5%' }
                  : { right: '1%', top: '9.4%', width: '22%' } }
              />
            )}
          </>
        )}
        {/* Protector icons — simple stack */}
        {char && isProt && mainIcons.length > 0 && (
          <div className="absolute z-30 flex flex-col items-center gap-0.5"
            style={{ top: '1.7%', right: '4%' }}>
            {mainIcons.map((src, idx) => (
              <img key={idx} src={src} alt=""
                className="object-contain drop-shadow-lg w-8 h-8 sm:w-11 sm:h-11" />
            ))}
          </div>
        )}


      </div>
    )
  }

  // ==========================================
  // SIDE SLOT CARD — tall portrait slots (same frame as main slots, smaller width)
  // ==========================================
  function SideSlotCard({ i }: { i: number }) {
    const charId = sideSlots[i]
    const sideSubCharId = sideSubSlots[i]
    const char = getCharacterById(charId)
    const sideSubChar = getCharacterById(sideSubCharId)
    const tier = char ? getCharacterVisualTier(char) : 5
    const role: "bless" | "member" = char && isProtectorChar(char) ? "bless" : "member"
    const { base: sideBase, frame } = getMainFramePaths(tier, role)
    const [icon1, icon2] = char ? getMiniCardIcons(char) : [null, null]
    const [sideSubIcon1, sideSubIcon2] = sideSubChar ? getMiniCardIcons(sideSubChar) : [null, null]

    return (
      <div
        className="relative w-full overflow-hidden cursor-pointer select-none"
        style={{ aspectRatio: '264 / 628' }}
        onClick={() => openPicker(i, "side")}
      >
        {!char && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(18,20,28,0.85)", borderRadius: "4px" }}>
            <div className="relative" style={{ width: "55%", aspectRatio: "1" }}>
              <div style={{
                width: "100%", height: "100%",
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                background: "linear-gradient(135deg, rgba(80,90,120,0.3), rgba(40,50,70,0.6))",
              }}>
                <div style={{
                  position: "absolute", inset: "2px",
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                  background: "rgba(12,16,24,0.9)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span className="text-white/40 font-light text-xl select-none">+</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {char && (
          <>
            <img src={sideBase} alt=""
              className="absolute object-fill pointer-events-none"
              style={{ top: '2%', left: '4%', width: '92%', height: '96%' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
            <img src={`/partyL/${char.master_pc_id}.png`} alt={char.name}
              className="absolute object-fill pointer-events-none"
              style={{ top: '2%', left: '4%', width: '92%', height: '96%' }}
              onError={(e) => { (e.target as HTMLImageElement).src = toPublicAssetPath(char.images.full) }} />
            <img src={frame} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-fill z-10"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
            {icon1 && (
              <img src={icon1} alt=""
                className="absolute z-20 object-contain drop-shadow"
                style={tier >= 6
                  ? { right: '3%', top: '1.5%', width: '22%' }
                  : { right: '0.8%', top: '0.1%', width: '22%' }}
              />
            )}
            {icon2 && (
              <img src={icon2} alt=""
                className="absolute z-20 object-contain drop-shadow"
                style={tier >= 6
                  ? { right: '3.5%', top: '10.3%', width: '21.5%' }
                  : { right: '1%', top: '9.4%', width: '22%' }}
              />
            )}
            {/* Sub-slot at bottom center */}
            <button
              onClick={(e) => { e.stopPropagation(); openPicker(i, "sidesub") }}
              className="absolute overflow-hidden z-20"
              style={{
                width: "46%", aspectRatio: "1",
                bottom: "4%", left: "27%",
                borderRadius: "4px",
                border: sideSubChar ? "none" : "1.5px solid rgba(140,140,150,0.5)",
                background: "rgba(10,12,18,0.8)",
              }}
            >
              {sideSubChar ? (
                <>
                  <div className="absolute inset-0" style={{ backgroundImage: `url('${toPublicAssetPath(sideSubChar.images.icon)}')`, backgroundSize: 'cover', backgroundPosition: 'top center' }} />
                  {(() => {
                    const t = getCharacterVisualTier(sideSubChar)
                    const r: "bless" | "member" = isProtectorChar(sideSubChar) ? "bless" : "member"
                    const { frame: subFrame } = getMiniFramePaths(t, r)
                    return <img src={subFrame} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-fill"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                  })()}
                  {(sideSubIcon1 || sideSubIcon2) && (
                    <div className="absolute top-0.5 right-0.5 z-20 flex flex-col gap-0.5">
                      {sideSubIcon1 && <img src={sideSubIcon1} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow" />}
                      {sideSubIcon2 && <img src={sideSubIcon2} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow" />}
                    </div>
                  )}
                </>
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-white/35 font-light text-lg">+</span>
              )}
            </button>
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
    const isProt = (pickerMode === "main" || pickerMode === "sub") && pickerOpenFor === 0
    const isHP = pickerMode === "heartprint"
    const isSideMode = pickerMode === "side" || pickerMode === "sidesub"
    const isEditingMain = pickerMode === "main" || pickerMode === "side"

    // Slot preview chars for the left panel
    const slotMainId = isSideMode ? sideSlots[pickerOpenFor] : mainSlots[pickerOpenFor]
    const slotSubId = isSideMode ? sideSubSlots[pickerOpenFor] : subSlots[pickerOpenFor]
    const slotMainChar = getCharacterById(slotMainId)
    const slotSubChar = getCharacterById(slotSubId)

    // Active filter count badge
    const activeFilterCount = [
      filterEl !== null, filterAttack !== null, filterTactics !== null,
      filterCharType !== null, filterCharacterType !== null, filterRarity !== null,
      filterForces.length > 0, filterSkillGroups.length > 0,
      filterWeapon !== null, filterProtType !== "all", filterSkillType !== "all",
      filterEnhancement !== "all", filterProtSkill !== "all", filterUltimateType !== "all",
      filterSkillCost > 0,
    ].filter(Boolean).length

    function clearAllFilters() {
      setFilterEl(null); setFilterAttack(null); setFilterTactics(null)
      setFilterCharType(null); setFilterCharacterType(null); setFilterRarity(null)
      setFilterForces([]); setFilterSkillGroups([])
      setFilterWeapon(null); setFilterProtType("all"); setFilterSkillType("all"); setFilterUltimateType("all")
      setFilterEnhancement("all"); setFilterProtSkill("all"); setFilterSkillCost(0)
    }

    return (
      <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closePicker} />
        <div className="relative z-50 m-auto flex flex-col max-h-[95vh] w-[95vw] max-w-6xl rounded-xl overflow-hidden shadow-2xl"
          style={{ background: "linear-gradient(180deg, #0c1929 0%, #111d2e 100%)" }}>

          {isHP ? (
            /* ── HEARTPRINT PICKER: top bar + left preview + right grid ── */
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 shrink-0">
                <Input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name..." className="h-8 flex-1 border-gray-700 bg-gray-800/80 text-white text-sm" />
                <div className="text-xs text-amber-300/60 px-1 shrink-0">HeartPrint — {heartprintItems.length}</div>
                <button onClick={closePicker} className="w-8 h-8 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-gray-400 shrink-0">✕</button>
              </div>
              <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left: preview panel */}
                <div className="w-[42%] shrink-0 flex flex-col p-3 border-r border-white/10 overflow-y-auto bg-[#09131f]">
                  {(() => {
                    const hp = previewHp ?? (heartPrintId ? heartprints.find(h => h.heartprint_id === heartPrintId) ?? null : null)
                    if (!hp) return (
                      <div className="flex-1 flex items-center justify-center text-[11px] text-gray-600 text-center p-4">
                        Hover over a still to preview
                      </div>
                    )
                    const isRare = hp.still_type === "rare"
                    const frameImg = isRare ? "/StillFrame/StillFrame3_m.png" : "/StillFrame/StillFrame1_m.png"
                    return (
                      <div className="flex flex-col gap-3">
                        <div className="relative w-full overflow-hidden rounded bg-black/40" style={{ aspectRatio: "245 / 146" }}>
                          <img src={`/SkillStill/${hp.heartprint_id}/skill_still_${hp.heartprint_id}_L.png`} alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2" }} />
                          <img src={frameImg} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-fill"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                          {isRare && (
                            <div className="absolute bottom-2 left-2 flex gap-1">
                              {[1,2,3].map(i => <img key={i} src="/UI/Texture/CommonEtcAtlas/iconRarity3.png" alt=""
                                className="w-4 h-4 object-contain drop-shadow" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />)}
                            </div>
                          )}
                        </div>
                        <div className="text-[13px] font-semibold text-white leading-tight">{hp.title}{isRare ? " Lv.3" : ""}</div>
                            {hp.skill_description && (
                              <div className="text-[11px] text-gray-300 leading-relaxed">{renderColoredDesc(hp.skill_description)}</div>
                            )}
                            {isTouchDevice && (
                              <div className="mt-2 block sm:hidden">
                                <button onClick={() => { setHeartPrintId(hp.heartprint_id); closePicker() }}
                                  className="px-2 py-1 text-sm bg-amber-500 text-black rounded font-semibold">Select</button>
                              </div>
                            )}
                      </div>
                    )
                  })()}
                </div>
                {/* Right: thumbnail grid — overscroll-contain prevents page scroll */}
                <div className="flex-1 overflow-y-auto overscroll-contain p-2">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed border-gray-600 p-2 hover:bg-white/5 transition-colors"
                      style={{ aspectRatio: "245 / 146" }} onClick={() => { setHeartPrintId(null); closePicker() }}>
                      <span className="text-gray-500 text-xl">×</span>
                      <span className="text-[10px] text-gray-500">Remove</span>
                    </div>
                    {heartprintItems.map(hp => {
                      const isRare = hp.still_type === "rare"
                      const frameImg = isRare ? "/StillFrame/StillFrame3_s.png" : "/StillFrame/StillFrame1_s.png"
                      return (
                        <div key={hp.heartprint_id}
                          className="flex flex-col items-center gap-1 rounded hover:bg-white/5 cursor-pointer transition-colors"
                          onTouchEnd={(e) => { try { e.preventDefault(); e.stopPropagation() } catch (err) {} ; setPreviewHp(hp); lastTouchRef.current = Date.now() }}
                          onClick={(e) => {
                            // ignore synthetic click fired after touch
                            if (Date.now() - (lastTouchRef.current || 0) < 700) { lastTouchRef.current = 0; return }
                            setHeartPrintId(hp.heartprint_id); closePicker()
                          }}
                          onMouseEnter={() => setPreviewHp(hp)}
                          onMouseLeave={() => setPreviewHp(null)}>
                          <div className="relative w-full overflow-hidden rounded bg-black/40" style={{ aspectRatio: "245 / 146" }}>
                            <img src={`/SkillStill/${hp.heartprint_id}/skill_still_${hp.heartprint_id}_S.png`} alt=""
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2" }} />
                            <img src={frameImg} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-fill"
                              onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                            {isRare && (
                              <div className="absolute bottom-1 left-1 flex gap-0.5">
                                {[1,2,3].map(i => <img key={i} src="/UI/Texture/CommonEtcAtlas/iconRarity3.png" alt=""
                                  className="w-3 h-3 object-contain drop-shadow" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />)}
                              </div>
                            )}
                            {(heartPrintId === hp.heartprint_id || (isTouchDevice && previewHp?.heartprint_id === hp.heartprint_id)) && <div className="absolute inset-0 ring-2 ring-amber-400 ring-inset rounded" />}
                          </div>
                          <span className="text-[9px] text-gray-400 leading-none text-center line-clamp-1 w-full px-1">{hp.title}</span>
                        </div>
                      )
                    })}
                  </div>
                  {heartprintItems.length === 0 && <p className="py-6 text-center text-xs text-gray-500">No HeartPrint skills match</p>}
                </div>
              </div>
            </>
          ) : (
            /* ── CHARACTER PICKER: left slot panel + right search/grid ── */
            <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-auto overscroll-contain">

              {/* LEFT PANEL: game-style card preview with sub-slot overlaid */}
              {mobileLeftOpen && <div className="absolute inset-0 z-40 bg-black/60 sm:hidden" onClick={() => setMobileLeftOpen(false)} />}
              <div className={`${mobileLeftOpen ? 'absolute inset-4 z-50 rounded-xl overflow-hidden flex' : 'hidden sm:flex'} sm:w-[18%] min-w-0 sm:min-w-[140px] max-w-[200px] sm:shrink-0 flex-col items-center sm:border-r sm:border-white/10 bg-[#090f1b] min-h-0 p-3 gap-2 overflow-y-auto`}>
                {mobileLeftOpen && (
                  <button className="sm:hidden absolute top-3 right-3 z-50 px-2 py-1 rounded bg-white/5 text-sm text-gray-200" onClick={() => setMobileLeftOpen(false)}>✕</button>
                )}
                {/* Main card with sub-slot overlaid on it */}
                <div
                  className="relative w-full cursor-pointer"
                  style={{ aspectRatio: '264 / 628' }}
                  onClick={() => setPickerMode(isSideMode ? "side" : "main")}
                >
                  <div
                    className={`absolute inset-0 rounded-lg overflow-hidden transition-all
                      ${isEditingMain ? "ring-2 ring-teal-400/70 shadow-lg shadow-teal-900/30" : "ring-1 ring-white/10 hover:ring-white/20"}`}
                    style={{ background: "rgba(18,20,28,0.85)" }}
                  >
                    {slotMainChar ? (() => {
                      const t = getCharacterVisualTier(slotMainChar)
                      const r: "bless" | "member" = isProtectorChar(slotMainChar) ? "bless" : "member"
                      const { base, frame } = getMainFramePaths(t, r)
                      const isProt = isProtectorChar(slotMainChar)
                      const [mi1, mi2, mi3] = getCardIcons(slotMainChar)
                      const mIcons = [mi1, mi2, mi3].filter(Boolean) as string[]
                      return (
                        <>
                          <img src={base} alt="" className="absolute object-fill pointer-events-none"
                            style={{ top: '2%', left: '4%', width: '92%', height: '96%' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                          <img src={`/partyL/${slotMainChar.master_pc_id}.png`} alt={slotMainChar.name}
                            className="absolute object-fill pointer-events-none"
                            style={{ top: '2%', left: '4%', width: '92%', height: '96%' }}
                            onError={e => { (e.target as HTMLImageElement).src = toPublicAssetPath(slotMainChar.images.full) }} />
                          <img src={frame} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                          {/* Element / type icons */}
                          {!isProt && mIcons.length > 0 && (
                            <>
                              {mIcons[0] && <img src={mIcons[0]} alt="" className="absolute z-30 object-contain drop-shadow-lg"
                                style={ t >= 6 ? { right: '3%', top: '1.5%', width: '22%' } : { right: '0.8%', top: '0.1%', width: '22%' } } />}
                              {mIcons[1] && <img src={mIcons[1]} alt="" className="absolute z-30 object-contain drop-shadow-lg"
                                style={ t >= 6 ? { right: '3.5%', top: '10.3%', width: '21.5%' } : { right: '1%', top: '9.4%', width: '22%' } } />}
                            </>
                          )}
                          {isProt && mIcons.length > 0 && (
                            <div className="absolute z-30 flex flex-col items-center gap-0.5" style={{ top: '3%', right: '3%' }}>
                              {mIcons.map((src, idx) => <img key={idx} src={src} alt="" className="object-contain drop-shadow-lg" style={{ width: '30px' }} />)}
                            </div>
                          )}
                        </>
                      )
                    })() : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                        <div className="w-10 h-10 rotate-45 border-2 border-gray-500/50 flex items-center justify-center rounded-sm">
                          <span className="text-white/40 text-lg -rotate-45">+</span>
                        </div>
                      </div>
                    )}
                    {isEditingMain && (
                      <div className="absolute top-1 left-1 bg-teal-500/80 text-white text-[7px] font-bold px-1 rounded z-20">EDIT</div>
                    )}
                  </div>
                  {/* Sub-slot overlaid on main card — bottom center */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setPickerMode(isSideMode ? "sidesub" : "sub") }}
                    className={`absolute z-20 overflow-hidden rounded cursor-pointer transition-all
                      ${!isEditingMain ? "ring-2 ring-teal-400/70 shadow-lg shadow-teal-900/30" : "ring-1.5 ring-white/20 hover:ring-white/30"}`}
                    style={{
                      width: "42%", aspectRatio: "1",
                      bottom: "5%", left: "29%",
                      background: "rgba(10,12,18,0.85)",
                    }}
                  >
                    {slotSubChar ? (
                      <>
                        <div className="absolute inset-0" style={{ backgroundImage: `url('${toPublicAssetPath(slotSubChar.images.icon)}')`, backgroundSize: 'cover', backgroundPosition: 'top center' }} />
                        {(() => {
                          const t = getCharacterVisualTier(slotSubChar)
                          const r: "bless" | "member" = isProtectorChar(slotSubChar) ? "bless" : "member"
                          const { frame } = getMiniFramePaths(t, r)
                          return <img src={frame} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-fill"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                        })()}
                        {(() => {
                          const [si1, si2] = getMiniCardIcons(slotSubChar)
                          return (si1 || si2) ? (
                            <div className="absolute top-0.5 right-0.5 z-20 flex flex-col gap-0.5">
                              {si1 && <img src={si1} alt="" className="w-4 h-4 object-contain drop-shadow" />}
                              {si2 && <img src={si2} alt="" className="w-4 h-4 object-contain drop-shadow" />}
                            </div>
                          ) : null
                        })()}
                      </>
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-white/35 font-light text-lg">+</span>
                    )}
                    {!isEditingMain && (
                      <div className="absolute top-0.5 left-0.5 bg-teal-500/80 text-white text-[6px] font-bold px-0.5 rounded">EDIT</div>
                    )}
                  </button>
                </div>
                <div className="text-[9px] text-gray-500 text-center shrink-0">{results.length} units</div>
              </div>

              {/* RIGHT: search bar + filter button + character grid */}
              <div className="flex-1 flex flex-col min-w-0 relative overflow-visible sm:overflow-hidden">
                {/* Top bar */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 shrink-0">
                  <button className="sm:hidden px-2 py-1 rounded bg-white/5 text-[12px] text-gray-200 font-semibold" onClick={() => setMobileLeftOpen(v => !v)} aria-expanded={mobileLeftOpen} aria-label="Toggle preview">{mobileLeftOpen ? "Close" : "Edit"}</button>
                  <Input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Search by name..." className="h-8 flex-1 border-gray-700 bg-gray-800/80 text-white text-sm" />
                  <button onClick={() => setShowFilterModal(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all shrink-0 ${activeFilterCount > 0 ? "bg-teal-800/50 text-teal-300 ring-1 ring-teal-400/30" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                  </button>
                  <button onClick={closePicker} className="w-8 h-8 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-gray-400 shrink-0">✕</button>
                </div>

                {/* Character grid */}
                <div className="flex-1 sm:overflow-y-auto overscroll-contain p-2">
                  <div className="grid gap-1.5 grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8">
                    <div className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed border-gray-600 p-1.5 hover:bg-white/5 transition-colors aspect-square"
                      onClick={() => {
                        if (pickerMode === "sub") setSubSlots(s => { const c = [...s]; c[pickerOpenFor] = null; return c })
                        else if (pickerMode === "side") setSideSlots(s => { const c = [...s]; c[pickerOpenFor] = null; return c })
                        else if (pickerMode === "sidesub") setSideSubSlots(s => { const c = [...s]; c[pickerOpenFor] = null; return c })
                        else setMainSlots(s => { const c = [...s]; c[pickerOpenFor] = null; return c })
                        closePicker()
                      }}>
                      <div className="w-10 h-10 flex items-center justify-center border border-dashed border-gray-500 rounded">
                        <span className="text-gray-500 text-sm">x</span>
                      </div>
                      <span className="text-[9px] text-gray-500">Remove</span>
                    </div>
                    {results.map((c, index) => {
                      const t = getCharacterVisualTier(c)
                      const r: "bless" | "member" = c.character_role?.toLowerCase() === "supporter" ? "bless" : "member"
                      const { base, frame } = getMiniFramePaths(t, r)
                      const [ci1, ci2] = getMiniCardIcons(c)
                      const imageLoading = index < 24 ? "eager" : "lazy"
                      return (
                        <div key={c.master_pc_id} className="flex flex-col items-center gap-0.5 p-1 rounded hover:bg-white/5 cursor-pointer transition-colors"
                          style={{ contentVisibility: "auto", containIntrinsicSize: "72px" }}
                          onClick={() => selectChar(pickerOpenFor, c.master_pc_id)}>
                          <div className="relative w-full" style={{ aspectRatio: "1" }}>
                            <img src={base} alt="" loading={imageLoading} decoding="async" className="absolute inset-0 w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                            <img src={toPublicAssetPath(c.images.icon)} alt={c.name} className="absolute inset-0 w-full h-full object-cover object-top"
                              loading={imageLoading} decoding="async"
                              onError={e => { (e.target as HTMLImageElement).src = toPublicAssetPath(c.images.full) }} />
                            <img src={frame} alt="" loading={imageLoading} decoding="async" className="pointer-events-none absolute inset-0 w-full h-full object-contain"
                              onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                            <img src={STAR_ASSETS[t] ?? STAR_ASSETS[5]} alt="" loading={imageLoading} decoding="async" className="pointer-events-none absolute bottom-0 left-0 right-0 h-[14%] object-contain" />
                            {(ci1 || ci2) && (
                              <div className="absolute top-0.5 right-0.5 z-10 flex flex-col gap-0.5">
                                {ci1 && <img src={ci1} alt="" className="w-4 h-4 sm:w-6 sm:h-6 object-contain drop-shadow" />}
                                {ci2 && <img src={ci2} alt="" className="w-4 h-4 sm:w-6 sm:h-6 object-contain drop-shadow" />}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {results.length === 0 && <p className="py-6 text-center text-xs text-gray-500">No characters match</p>}
                </div>

                {/* ── FLOATING FILTER PANEL ── */}
                {showFilterModal && (
                  <div className="fixed z-[60] flex flex-col overflow-hidden rounded-lg shadow-2xl border border-white/10"
                    style={{
                      background: "rgba(12,25,41,0.97)",
                      backdropFilter: "blur(12px)",
                      top: `calc(50% + ${filterDragOffset.y}px)`,
                      right: `calc(10% - ${filterDragOffset.x}px)`,
                      transform: "translateY(-50%)",
                      width: `${filterSize.w}px`,
                      maxWidth: "95vw",
                      height: filterSize.h > 0 ? `${filterSize.h}px` : "min(80vh, 700px)",
                      maxHeight: "95vh",
                    }}>
                    {/* Drag handle header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 cursor-move select-none"
                      onPointerDown={(e) => {
                        filterDragStart.current = { x: filterDragOffset.x, y: filterDragOffset.y, px: e.clientX, py: e.clientY }
                        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
                      }}
                      onPointerMove={(e) => {
                        if (!filterDragStart.current) return
                        const dx = e.clientX - filterDragStart.current.px
                        const dy = e.clientY - filterDragStart.current.py
                        setFilterDragOffset({ x: filterDragStart.current.x + dx, y: filterDragStart.current.y + dy })
                      }}
                      onPointerUp={() => { filterDragStart.current = null }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">⠿</span>
                        <span className="text-[13px] font-bold text-white tracking-wide">Filters</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {activeFilterCount > 0 && (
                          <button onClick={clearAllFilters} className="text-[11px] text-red-400/80 hover:text-red-300 underline">
                            Clear all ({activeFilterCount})
                          </button>
                        )}
                        <button onClick={() => setShowFilterModal(false)} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
                      </div>
                    </div>

                    {/* Scrollable filter sections */}
                    <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-5 min-h-0">

                      {/* ── Attribute / Support Type ── */}
                      <div>
                        <div className="text-[11px] font-semibold text-white/80 bg-white/[0.04] rounded px-2 py-1.5 mb-2 uppercase tracking-wider">
                          {isProt ? "Divine Protection - Attribute / Attack Type" : "Attribute"}
                        </div>
                        {isProt ? (
                          <div className="flex gap-3">
                            {/* Left: element grid */}
                            <div className="flex-1 space-y-1">
                              <div className="flex flex-wrap gap-1">
                                <FilterBtn active={filterEl === null} onClick={() => setFilterEl(null)}>ALL</FilterBtn>
                                {NORMAL_ELEMENTS.map(e => <FilterIcon key={e.key} active={filterEl === e.key} icon={e.icon} label={e.label} onClick={() => setFilterEl(filterEl === e.key ? null : e.key)} />)}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {ENHANCED_ELEMENTS.map(e => <FilterIcon key={e.key} active={filterEl === e.key} icon={e.icon} label={e.label} onClick={() => setFilterEl(filterEl === e.key ? null : e.key)} />)}
                              </div>
                              <div className="border-t border-white/[0.08] my-1" />
                              <div className="flex flex-wrap gap-1">
                                {SPECIAL_EFFECT_ELEMENTS.map(e => <FilterIcon key={e.key} active={filterEl === e.key} icon={e.icon} label={e.label} onClick={() => setFilterEl(filterEl === e.key ? null : e.key)} />)}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {SPECIAL_EFFECT_ENHANCED_ELEMENTS.map(e => <FilterIcon key={e.key} active={filterEl === e.key} icon={e.icon} label={e.label} onClick={() => setFilterEl(filterEl === e.key ? null : e.key)} />)}
                              </div>
                            </div>
                            {/* Right: support type icons */}
                            <div className="flex flex-col gap-1 shrink-0">
                              {PROT_SUPPORT_TYPES.map(t => (
                                <button key={t.key} onClick={() => setFilterProtType(t.key as any)}
                                  className={`w-9 h-9 flex items-center justify-center rounded transition-all ${filterProtType === t.key ? "ring-2 ring-white bg-white/20" : "bg-white/5 hover:bg-white/10"}`}
                                  title={t.label}>
                                  <img src={t.icon} alt={t.label} className={`w-6 h-6 object-contain ${filterProtType === t.key ? "opacity-100" : "opacity-50"}`}
                                    onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-1 mb-1">
                              <FilterBtn active={filterEl === null} onClick={() => setFilterEl(null)}>ALL</FilterBtn>
                              {NORMAL_ELEMENTS.map(e => <FilterIcon key={e.key} active={filterEl === e.key} icon={e.icon} label={e.label} onClick={() => setFilterEl(filterEl === e.key ? null : e.key)} />)}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {ENHANCED_ELEMENTS.map(e => <FilterIcon key={e.key} active={filterEl === e.key} icon={e.icon} label={e.label} onClick={() => setFilterEl(filterEl === e.key ? null : e.key)} />)}
                            </div>
                          </>
                        )}
                      </div>

                      {/* ── Attack Type (attacker only) ── */}
                      {!isProt && (
                        <div>
                          <div className="text-[11px] font-semibold text-white/80 bg-white/[0.04] rounded px-2 py-1.5 mb-2 uppercase tracking-wider">Attack Type</div>
                          <div className="flex gap-1">
                            <FilterBtn active={filterAttack === null} onClick={() => setFilterAttack(null)}>ALL</FilterBtn>
                            {ATTACK_TYPES.map(a => <FilterIcon key={a.key} active={filterAttack === a.key} icon={a.icon} label={a.label} onClick={() => setFilterAttack(filterAttack === a.key ? null : a.key)} />)}
                          </div>
                        </div>
                      )}

                      {/* ── Weapon (attacker only) ── */}
                      {!isProt && (
                        <div>
                          <div className="text-[11px] font-semibold text-white/80 bg-white/[0.04] rounded px-2 py-1.5 mb-2 uppercase tracking-wider">Weapon</div>
                          <div className="flex flex-wrap gap-1">
                            <FilterBtn active={filterWeapon === null} onClick={() => setFilterWeapon(null)}>ALL</FilterBtn>
                            {[...new Set(characters.map(c => normalizeWeaponType(c.weapon_type)).filter(Boolean))]
                              .map(key => key.toLowerCase())
                              .sort((a, b) => a.localeCompare(b))
                              .map(key => (
                                <button key={key} onClick={() => setFilterWeapon(filterWeapon === key ? null : key)} title={formatWikiLabel(key)}
                                  className={`w-7 h-7 flex items-center justify-center rounded transition-all relative overflow-hidden ${filterWeapon === key ? "bg-white/20 ring-1 ring-white/50" : "bg-white/5 hover:bg-white/10"}`}>
                                  <div
                                    className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm border border-white/20 bg-white/5 pointer-events-none"
                                  />
                                  <img src={weaponIconMap[key]} alt={formatWikiLabel(key)} className={`relative w-4 h-4 object-contain ${filterWeapon === key ? "opacity-100" : "opacity-50"}`}
                                    onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* ── Protection Skill (protector only, above Tactics) ── */}
                      {isProt && (
                        <div>
                          <div className="text-[11px] font-semibold text-white/80 bg-white/[0.04] rounded px-2 py-1.5 mb-2 uppercase tracking-wider">Protection Skill</div>
                          <div className="flex flex-wrap gap-1">
                            {([["all","ALL"],["secret","Secret Skills"],["protection","Protection"],["skill","Skill"],["other","Other"]] as const).map(([k, l]) => (
                              <button key={k} onClick={() => setFilterProtSkill(k as any)}
                                className={`px-2 py-1 rounded text-[11px] transition-all ${filterProtSkill === k ? "bg-white/20 text-white ring-1 ring-white/40" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Tactics Type ── */}
                      <div>
                        <div className="text-[11px] font-semibold text-white/80 bg-white/[0.04] rounded px-2 py-1.5 mb-2 uppercase tracking-wider">Tactics Type</div>
                        <div className="flex flex-wrap gap-1">
                          <FilterBtn active={filterTactics === null} onClick={() => setFilterTactics(null)}>ALL</FilterBtn>
                          {TACTICS_TYPES.map(t => (
                            <button key={t.key} onClick={() => setFilterTactics(filterTactics === t.key ? null : t.key)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-all ${filterTactics === t.key ? "bg-white/20 text-white ring-1 ring-white/40" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                              <img src={t.icon} alt="" className={`w-4 h-4 object-contain ${filterTactics === t.key ? "opacity-100" : "opacity-50"}`} />{t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Secret Skills (attacker only, below Tactics) ── */}
                      {!isProt && (
                        <div>
                          <div className="text-[11px] font-semibold text-white/80 bg-white/[0.04] rounded px-2 py-1.5 mb-2 uppercase tracking-wider">Secret Skills</div>
                          <div className="flex flex-wrap gap-1">
                            {(["all","attack","support"] as const).map(k => (
                              <button key={k} onClick={() => setFilterUltimateType(k)}
                                className={`px-2 py-1 rounded text-[11px] transition-all ${filterUltimateType === k ? "bg-white/20 text-white ring-1 ring-white/40" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                                {k === "all" ? "ALL" : k === "attack" ? "Attack" : "Support"}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Rarity ── */}
                      <div>
                        <div className="text-[11px] font-semibold text-white/80 bg-white/[0.04] rounded px-2 py-1.5 mb-2 uppercase tracking-wider">Rarity</div>
                        <div className="flex flex-wrap gap-1">
                          <FilterBtn active={filterRarity === null} onClick={() => setFilterRarity(null)}>ALL</FilterBtn>
                          {[3,4,5,6,7].map(tier => (
                            <button key={tier} onClick={() => setFilterRarity(filterRarity === tier ? null : tier)}
                              className={`h-7 px-1.5 flex items-center justify-center rounded transition-all ${filterRarity === tier ? "ring-2 ring-white/60 bg-white/20" : "bg-white/5 hover:bg-white/10"}`}>
                              <img src={STAR_ASSETS[tier]} alt={`L${tier}`} className={`h-4 object-contain ${filterRarity === tier ? "opacity-100" : "opacity-55"}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Character Type ── */}
                      <div>
                        <div className="text-[11px] font-semibold text-white/80 bg-white/[0.04] rounded px-2 py-1.5 mb-2 uppercase tracking-wider">Character Type</div>
                        <div className="flex flex-wrap gap-1">
                          <FilterBtn active={filterCharacterType === null} onClick={() => setFilterCharacterType(null)}>ALL</FilterBtn>
                          {masterCharacterTacticsOptions.map(type => (
                            <button key={type} onClick={() => setFilterCharacterType(filterCharacterType === type ? null : type)}
                              className={`px-2 py-1 rounded text-[11px] transition-all ${filterCharacterType === type ? "bg-white/20 text-white ring-1 ring-white/40" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                              {CHAR_TYPE_DISPLAY[type] ?? type}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Character Enhancement ── */}
                      <div>
                        <div className="text-[11px] font-semibold text-white/80 bg-white/[0.04] rounded px-2 py-1.5 mb-2 uppercase tracking-wider">Character Enhancement</div>
                        <div className="flex flex-wrap gap-1">
                          {([["all","ALL"],["ex","EX Enhancement"],["unbound","Attribute Unbound"]] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setFilterEnhancement(k as any)}
                              className={`px-2 py-1 rounded text-[11px] transition-all ${filterEnhancement === k ? "bg-white/20 text-white ring-1 ring-white/40" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Forces (grouped inline) ── */}
                      <div>
                        <div className="text-[11px] font-semibold text-white/80 bg-white/[0.04] rounded px-2 py-1.5 mb-2 uppercase tracking-wider flex items-center justify-between">
                          <span>Forces</span>
                          {filterForces.length > 0 && (
                            <button onClick={() => setFilterForces([])} className="text-[10px] text-teal-400 hover:text-teal-300 normal-case underline">
                              Clear ({filterForces.length})
                            </button>
                          )}
                        </div>
                        {FORCE_GROUP_ORDER.filter(g => forceGroups.has(g)).map(group => (
                          <div key={group} className="mb-3">
                            <div className="text-[10px] font-semibold text-white/50 mb-1">{FORCE_GROUP_LABELS[group] ?? group}</div>
                            <div className="grid grid-cols-2 gap-1">
                              {forceGroups.get(group)!.map(f => {
                                const active = filterForces.includes(f.name)
                                return (
                                  <button key={f.name}
                                    onClick={() => setFilterForces(prev => active ? prev.filter(x => x !== f.name) : [...prev, f.name])}
                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] border transition-all text-left ${active ? "bg-teal-600/20 border-teal-400/60 text-white" : "bg-white/[0.03] border-white/[0.06] text-gray-400 hover:bg-white/[0.08]"}`}>
                                    {f.icon && <img src={f.icon} alt="" className="w-4 h-4 object-contain shrink-0 rounded-full"
                                      onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />}
                                    <span className="leading-tight truncate">{f.name}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* ── Skill Effect ── */}
                      <div>
                        <div className="text-[11px] font-semibold text-white/80 bg-white/[0.04] rounded px-2 py-1.5 mb-3 uppercase tracking-wider flex items-center justify-between">
                          <span>Skill Effect {(filterSkillGroups.length > 0 || filterSkillCost > 0) ? `(${filterSkillGroups.length + (filterSkillCost > 0 ? 1 : 0)} active)` : ""}</span>
                        </div>

                        {/* Skill Cost Slider — single slider, disabled unless All or Battle Skills */}
                        <div className="mb-4">
                          <div className={`text-[10px] mb-2 ${filterSkillType === "all" || filterSkillType === "battle" ? "text-gray-500" : "text-gray-600"}`}>
                            Skill Cost (SP): {filterSkillCost},85+
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-gray-500 w-4 text-right">0</span>
                            <input type="range" min={0} max={85} step={5} value={filterSkillCost}
                              disabled={filterSkillType !== "all" && filterSkillType !== "battle"}
                              onChange={e => { setFilterSkillCost(Number(e.target.value)) }}
                              className={`flex-1 h-1 accent-teal-500 bg-white/10 rounded appearance-none ${filterSkillType === "all" || filterSkillType === "battle" ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`} />
                            <span className="text-[10px] text-gray-500 w-6">85+</span>
                          </div>
                          {filterSkillCost > 0 && (
                            <button onClick={() => setFilterSkillCost(0)} className="text-[10px] text-teal-400 hover:text-teal-300 underline mt-1">Reset</button>
                          )}
                        </div>

                        {/* Skill Type */}
                        <div className="mb-4">
                          <div className="text-[10px] text-gray-500 mb-1.5">Skill Type</div>
                          <div className="flex flex-wrap gap-1.5">
                            {(isProt
                              ? [["all","ALL"],["secret","Secret Skills"],["battle","Battle Skills"],["trait","Trait"],["valor","Valor Trait"]] as const
                              : [["all","ALL"],["secret","Secret Skills"],["battle","Battle Skills"],["trait","Trait"],["valor","Valor Trait"]] as const
                            ).map(([k, l]) => (
                              <button key={k} onClick={() => { setFilterSkillType(k as any); if (k !== "all" && k !== "battle") setFilterSkillCost(0) }}
                                className={`px-2.5 py-1.5 rounded text-[11px] border flex items-center gap-1.5 transition-all ${filterSkillType === k ? "bg-teal-600/30 border-teal-400/70 text-white" : "bg-white/5 border-white/15 text-gray-400 hover:bg-white/10"}`}>
                                {filterSkillType === k && <span className="text-teal-400 text-[10px]">✓</span>}
                                <span>{l}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Effect Type — game-style category grid + collapsible subcategories */}
                        <div>
                          <div className="text-[10px] text-gray-500 mb-1.5">Effect Type</div>

                          {/* Top-level: "Select All" button row */}
                          <div className="mb-3">
                            <div className="text-[10px] text-white/40 mb-1.5 border-b border-white/10 pb-1">
                              {filterSkillGroups.length === 0 ? "Select All" : "Select Specified"}
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button onClick={() => setFilterSkillGroups([])}
                                className={`px-2 py-2 rounded text-[11px] border font-semibold transition-all flex items-center justify-center gap-1.5 ${filterSkillGroups.length === 0 ? "bg-teal-600/30 border-teal-400/70 text-white" : "bg-white/5 border-white/15 text-gray-400 hover:bg-white/10"}`}>
                                {filterSkillGroups.length === 0 && <span className="text-teal-400 text-[10px]">✓</span>}ALL
                              </button>
                              {Array.from(skillFilterCats.entries()).map(([cat, subMap]) => {
                                const catLabel = SKILL_CAT_LABELS[cat] ?? cat
                                const catGroupIds = Array.from(subMap.values())
                                const allSelected = catGroupIds.length > 0 && catGroupIds.every(id => filterSkillGroups.includes(id))
                                const someSelected = catGroupIds.some(id => filterSkillGroups.includes(id))
                                return (
                                  <button key={cat}
                                    onClick={() => {
                                      if (allSelected) {
                                        setFilterSkillGroups(prev => prev.filter(id => !catGroupIds.includes(id)))
                                      } else {
                                        setFilterSkillGroups(prev => [...new Set([...prev, ...catGroupIds])])
                                      }
                                    }}
                                    className={`px-2 py-2 rounded text-[10px] border font-medium transition-all text-center ${allSelected ? "bg-teal-600/30 border-teal-400/70 text-white" : someSelected ? "bg-teal-600/15 border-teal-400/40 text-teal-300" : "bg-white/5 border-white/15 text-gray-400 hover:bg-white/10"}`}>
                                    {catLabel}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Subcategories — collapsible per category */}
                          {filterSkillGroups.length > 0 && Array.from(skillFilterCats.entries()).map(([cat, subMap]) => {
                            const catLabel = SKILL_CAT_LABELS[cat] ?? cat
                            const catGroupIds = Array.from(subMap.values())
                            const someSelected = catGroupIds.some(id => filterSkillGroups.includes(id))
                            const isExpanded = expandedSkillCats.includes(cat)
                            return (
                              <div key={cat} className="mb-1">
                                <button
                                  onClick={() => setExpandedSkillCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-[11px] font-semibold transition-all ${someSelected ? "bg-white/[0.06] text-white" : "bg-white/[0.03] text-gray-400 hover:bg-white/[0.06]"}`}
                                >
                                  <span>{catLabel}</span>
                                  <div className="flex items-center gap-2">
                                    {someSelected && <span className="text-teal-400 text-[10px]">Selected</span>}
                                    <span className="text-[10px] text-gray-400">{isExpanded ? "▲" : "▼"}</span>
                                  </div>
                                </button>
                                {isExpanded && (
                                  <div className="grid grid-cols-2 gap-1 mt-1.5 pl-2">
                                    {Array.from(subMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([label, groupId]) => {
                                      const active = filterSkillGroups.includes(groupId)
                                      return (
                                        <button key={groupId}
                                          onClick={() => setFilterSkillGroups(prev => active ? prev.filter(id => id !== groupId) : [...prev, groupId])}
                                          className={`px-2 py-1.5 rounded text-[10px] border text-left transition-all flex items-center gap-1 ${active ? "bg-teal-500/20 border-teal-400/50 text-teal-200" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"}`}>
                                          {active && <span className="text-teal-400 text-[9px] shrink-0">✓</span>}
                                          <span className="truncate" dangerouslySetInnerHTML={{ __html: label }} />
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {filterSkillGroups.length > 0 && (
                            <div className="text-[10px] text-teal-400 mt-2">{filterSkillGroups.length} selected</div>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Filter footer */}
                    <div className="shrink-0 px-4 py-2.5 border-t border-white/10 flex justify-between items-center">
                      <button onClick={clearAllFilters} className="text-[11px] text-gray-400 hover:text-white underline">Clear all</button>
                      <button onClick={() => setShowFilterModal(false)}
                        className="px-5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-[11px] rounded transition-all font-semibold">
                        Apply{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                      </button>
                    </div>
                    {/* Resize handle */}
                    <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                      onPointerDown={(e) => {
                        const el = (e.target as HTMLElement).closest("[class*='fixed']") as HTMLElement
                        filterResizeStart.current = { w: el?.offsetWidth ?? filterSize.w, h: el?.offsetHeight ?? 500, px: e.clientX, py: e.clientY }
                        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
                      }}
                      onPointerMove={(e) => {
                        if (!filterResizeStart.current) return
                        const dw = e.clientX - filterResizeStart.current.px
                        const dh = e.clientY - filterResizeStart.current.py
                        setFilterSize({ w: Math.max(300, filterResizeStart.current.w + dw), h: Math.max(250, filterResizeStart.current.h + dh) })
                      }}
                      onPointerUp={() => { filterResizeStart.current = null }}
                    >
                      <svg viewBox="0 0 10 10" className="w-full h-full text-white/20"><path d="M9 1L1 9M9 5L5 9" stroke="currentColor" fill="none" strokeWidth="1" /></svg>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

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
  // Layout (all top-aligned):
  //   [Main0] [Main1] [Main2] [Main3]  [Side0] [Side1]
  //                                    [  Heartprint  ]
  //
  // Main cards use frame aspect (264/628). Side slots + heartprint combined
  // height equals main card height. We calculate this using CSS.
  //
  // scale factor to increase sizes (30% larger)
  const SIZE_SCALE = 1.5
  const MAIN_CARD_WIDTH = `calc(clamp(110px, 12vw, 155px) * ${SIZE_SCALE})`
  const SIDE_SLOT_WIDTH = `calc(clamp(78px, 8.5vw, 109px) * ${SIZE_SCALE})`
  const FRAME_W = 264, FRAME_H = 628
  // All cards use the same 264:628 aspect ratio for consistency
  const MAIN_ASPECT = 264 / 628

  const teamRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  async function savePng() {
    const el = cardsRef.current
    if (!el) return
    // Dynamically load html2canvas from CDN
    const w = window as any
    if (!w.html2canvas) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script")
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
        s.onload = () => resolve()
        s.onerror = reject
        document.head.appendChild(s)
      })
    }
    const canvas = await w.html2canvas(el, { useCORS: true, allowTaint: true, backgroundColor: null })
    const link = document.createElement("a")
    link.download = "team.png"
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  const protChar = getCharacterById(mainSlots[0])
  const protSubChar = getCharacterById(subSlots[0])
  const leaderSkill = protChar?.skills.find((s) => s.slot === "leader_skill") ?? null
  const assistSkill = protSubChar?.skills.find((s) => s.slot === "assist_leader_skill") ?? null
  const selectedHp = heartPrintId ? heartprints.find(h => h.heartprint_id === heartPrintId) ?? null : null

  // ── EP Calculation ──
  const teamEP = useMemo(() => {
    const slots: TeamSlotInput[] = [0, 1, 2, 3].map((i) => {
      const mainChar = getCharacterById(mainSlots[i])
      const subChar = getCharacterById(subSlots[i])
      const eq = equipSlots[`main${i}`] ?? {}
      const weapon = eq.weapon ? equipment.find(e => e.id === eq.weapon) ?? null : null
      const armor = eq.armor ? equipment.find(e => e.id === eq.armor) ?? null : null
      const accessory = eq.accessory ? equipment.find(e => e.id === eq.accessory) ?? null : null
      return { mainChar, subChar, weapon, armor, accessory }
    })
    // Side slots
    const sideInputs: TeamSlotInput[] = [0, 1].map((i) => {
      const mainChar = getCharacterById(sideSlots[i])
      const subChar = getCharacterById(sideSubSlots[i])
      const eq = equipSlots[`side${i}`] ?? {}
      const weapon = eq.weapon ? equipment.find(e => e.id === eq.weapon) ?? null : null
      const armor = eq.armor ? equipment.find(e => e.id === eq.armor) ?? null : null
      const accessory = eq.accessory ? equipment.find(e => e.id === eq.accessory) ?? null : null
      return { mainChar, subChar, weapon, armor, accessory }
    })
    return calcTeamEP([...slots, ...sideInputs])
  }, [equipment, equipSlots, getCharacterById, mainSlots, sideSlots, sideSubSlots, subSlots])

  return (
    <div className="w-full flex flex-col items-center px-2 sm:px-4">

      {/* ── HEADER ── */}
      <div className="w-full flex items-end justify-center mb-3 select-none gap-2 sm:gap-3">
        <img src="/brand/battleSlime16.png" alt=""
          className="h-10 sm:h-16 object-contain pointer-events-none drop-shadow-lg"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
        <img src="/brand/Logo.png" alt="Tensura Memories"
          className="h-20 sm:h-28 object-contain drop-shadow-xl"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
        <img src="/brand/battleSplashB_02.png" alt=""
          className="h-10 sm:h-16 object-contain pointer-events-none drop-shadow-lg"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
      </div>

      {/* ── TEAM CAPTURE AREA ── */}
      <div ref={teamRef} className="w-full flex flex-col items-center">

      {/* ── PROTECTOR SKILL INFO BAR ── */}
      {(leaderSkill || assistSkill) && (
        <div className="mb-3 rounded-lg overflow-hidden text-xs"
          style={{
            width: `calc(4 * (clamp(110px, 12vw, 155px) * ${SIZE_SCALE}) + 2 * (clamp(78px, 8.5vw, 109px) * ${SIZE_SCALE}) + 32px)`,
            maxWidth: "100%",
            background: "rgba(8,12,22,0.92)", border: "1px solid rgba(255,255,255,0.08)"
          }}>
          {/* Leader skill row */}
          {leaderSkill && (
            <div className="flex items-start gap-2 px-3 py-2"
              style={{ borderBottom: assistSkill ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
              {leaderSkill.icon_path && (
                <img src={`/${leaderSkill.icon_path}.png`} alt=""
                  className="w-8 h-8 flex-shrink-0 object-contain rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
              )}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-white/60 font-semibold text-[10px] uppercase tracking-wide">{leaderSkill.name}</span>
                <span className="text-white/85 leading-snug break-words whitespace-pre-line w-full">
                  {renderColoredDesc(leaderSkill.description_max_level ?? "")}
                </span>
              </div>
            </div>
          )}
          {/* Assist leader skill row */}
          {assistSkill && (
            <div className="flex items-start gap-2 px-3 py-2">
              {assistSkill.icon_path && (
                <img src={`/${assistSkill.icon_path}.png`} alt=""
                  className="w-8 h-8 flex-shrink-0 object-contain rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
              )}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-white/50 font-semibold text-[10px] uppercase tracking-wide">{assistSkill.name}</span>
                <span className="text-white/70 leading-snug break-words whitespace-pre-line w-full">
                  {renderColoredDesc(assistSkill.description_max_level ?? "")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

        {/* Main container - horizontally scrollable on mobile, centered on desktop */}
        <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <div ref={cardsRef} className="flex flex-nowrap gap-1 sm:gap-1.5 items-start pb-4 mx-auto w-fit">

        {/* 4 main character slots */}
        {[0, 1, 2, 3].map((i) => {
          return (
          <div key={i} className="flex-shrink-0" style={{ width: MAIN_CARD_WIDTH }}>
            <MainSlotCard i={i} />
          </div>
          )
        })}

        {/* Right panel: 2 side slots side-by-side + heartprint below */}
        {/* Height matches main card height using aspect ratio calc */}
        <div
          className="flex flex-col gap-2 flex-shrink-0"
          style={{
            width: `calc(${SIDE_SLOT_WIDTH} * 2 + 8px)`,
            height: `calc(${MAIN_CARD_WIDTH} / ${MAIN_ASPECT})`,
          }}
        >
          {/* 2 side slots in a row — each uses 264:628 aspect ratio, determines row height */}
          <div className="flex gap-2 flex-shrink-0">
            {[0, 1].map((i) => {
              return (
              <div key={i} className="flex-1 min-w-0">
                <SideSlotCard i={i} />
              </div>
              )
            })}
          </div>

          {/* Heartprint skill slot — fills remaining height below side slots */}
          <button
            onClick={() => openPicker(0, "heartprint")}
            className="relative w-full flex-1 overflow-hidden transition-opacity hover:opacity-90"
            style={{
              minHeight: "60px",
              borderRadius: "6px",
              border: "2px solid rgba(120,120,130,0.4)",
              background: "rgba(18,20,28,0.85)",
            }}
          >
            {heartPrintId ? (
              <>
                <img src={`/SkillStill/${heartPrintId}/skill_still_${heartPrintId}_L.png`} alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3" }} />
                <img src={selectedHp?.still_type === "rare" ? "/StillFrame/StillFrame3_s.png" : "/StillFrame/StillFrame1_s.png"} alt=""
                  className="pointer-events-none absolute inset-0 w-full h-full object-fill"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                <div className="absolute bottom-1 left-1 flex gap-0.5">
                  {selectedHp?.still_type === "rare"
                    ? [1,2,3].map(i => <img key={i} src="/UI/Texture/CommonEtcAtlas/iconRarity3.png" alt="" className="w-3.5 h-3.5 object-contain drop-shadow" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />)
                    : [1].map(i => <img key={i} src="/UI/Texture/CommonEtcAtlas/iconRarity1.png" alt="" className="w-3.5 h-3.5 object-contain drop-shadow" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />)
                  }
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span className="text-white/40 text-lg font-light">+</span>
                <span className="text-[9px] text-gray-400 text-center leading-tight">Heartprint Skill Unassigned</span>
              </div>
            )}
          </button>
        </div>

        </div>
        </div>
      </div>

      {/* EP bar hidden until formula is confirmed */}
      {false && teamEP.total > 0 && (
        <div className="mt-2 flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg select-none"
          style={{ background: "linear-gradient(135deg, rgba(20,28,44,0.9), rgba(12,20,35,0.95))", border: "1px solid rgba(200,170,80,0.25)" }}>
          <img src={getEPRankIcon(teamEP.total)} alt=""
            className="w-8 h-8 object-contain drop-shadow"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
          <span className="text-[11px] text-amber-400/80 font-semibold uppercase tracking-wider">Troop EP</span>
          <span className="text-base text-amber-200 font-bold tabular-nums tracking-wide">{teamEP.total.toLocaleString()}</span>
        </div>
      )}



      {/* ── ACTION BUTTONS ── */}
      <div className="mt-4 flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
        <button
          onClick={savePng}
          className="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2236 100%)", border: "1px solid rgba(100,160,255,0.3)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Save PNG
        </button>
        <button
          onClick={openEquipModal}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg, #3a1e5f 0%, #22103f 100%)", border: "1px solid rgba(180,100,255,0.3)" }}
        >
          <img src="/UI/Texture/QuestAtlas/icBtnEquip.png" alt="" className="w-5 h-5 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
          Equipment
        </button>
      </div>

      {PickerModal()}

      {/* ── EQUIPMENT MODAL ── */}
      {showEquipModal && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowEquipModal(false)} />
          <div className="relative z-50 isolate m-auto flex flex-col max-h-[95vh] w-[98vw] sm:w-[95vw] max-w-5xl rounded-xl overflow-hidden shadow-2xl"
            style={{ background: "linear-gradient(180deg, #0c1929 0%, #111d2e 100%)" }}>
            {/* Header */}
            <div className="relative z-50 flex items-center gap-2 px-4 py-2.5 border-b border-white/10 shrink-0">
              <img src="/UI/Texture/QuestAtlas/icBtnEquip.png" alt="" className="w-5 h-5 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
              <span className="text-[12px] font-semibold text-white/90 uppercase tracking-wider">Equipment &amp; Charms</span>
              <div className="flex-1" />
              <button
                onClick={autoEquipAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold transition-all bg-amber-700/40 hover:bg-amber-600/50 text-amber-200 border border-amber-500/30"
                title="Auto-assign best equipment to all battle characters">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                Auto Equip
              </button>
              <button onClick={() => setShowEquipModal(false)} className="w-8 h-8 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-gray-400 shrink-0">✕</button>
            </div>

            <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
              {/* LEFT: Characters + Slots */}
              <div className="relative z-10 w-full sm:w-[40%] sm:min-w-[260px] sm:max-w-[380px] border-b sm:border-b-0 sm:border-r border-white/10 overflow-y-auto shrink-0 max-h-[40vh] sm:max-h-none">
                {equipModalGroups.length === 0 && (
                  <div className="flex items-center justify-center h-full text-[11px] text-gray-500 p-6 text-center">
                    Add characters to your team first
                  </div>
                )}

                {/* Section headers + grouped rows */}
                {(() => {
                  const protGroups = equipModalGroups.filter(g => g.isProtGroup)
                  const battleGroups = equipModalGroups.filter(g => !g.isProtGroup)

                  function renderEntry(entry: EquipSlotEntry, isSub: boolean) {
                    const ch = getCharacterById(entry.charId)
                    if (!ch) return null
                    const isActiveRow = activeEquipSlot?.slotKey === entry.slotKey
                    const selectedSkillId = charmSlots[entry.slotKey] ?? null
                    const selectedFlatCharm = selectedSkillId ? flatCharms.find(fc => fc.skill_id === selectedSkillId) ?? null : null
                    const slots = getEquipRecord(entry.slotKey)
                    const isProtChar = entry.isProt

                    return (
                      <div key={entry.slotKey}
                        className={`px-3 py-2.5 border-b border-white/[0.06] transition-colors ${isActiveRow ? (isProtChar ? "bg-purple-950/20" : "bg-sky-950/20") : ""} ${isSub ? "pl-9 bg-white/[0.015]" : ""}`}>
                        {/* Sub-slot indicator tab */}
                        {isSub && (
                          <div className="flex items-center gap-1 mb-1.5">
                            <div className="w-2 h-px bg-white/20" />
                            <span className="text-[8px] text-white/30 uppercase tracking-widest">Sub Slot</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`relative overflow-hidden rounded ${isSub ? "w-9 h-9" : "w-11 h-11"}`}>
                            <img src={toPublicAssetPath(ch.images.icon)} alt={ch.name} className="absolute inset-0 w-full h-full object-cover object-top" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`font-semibold truncate ${isSub ? "text-[9px]" : "text-[10px]"} ${isProtChar ? "text-purple-300" : "text-cyan-300"}`}>{ch.name}</div>
                            {ch.weapon_type && !isProtChar && (
                              <div className="flex items-center gap-1 mt-0.5">
                                {weaponIconMap[normalizeWeaponType(ch.weapon_type)] && (
                                  <img src={weaponIconMap[normalizeWeaponType(ch.weapon_type)]} alt="" className="w-3 h-3 object-contain opacity-60" />
                                )}
                                <span className="text-[8px] text-gray-500">{formatWikiLabel(ch.weapon_type)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          {isProtChar ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <button
                                onClick={() => { setActiveEquipSlot({ slotKey: entry.slotKey, type: "charm" }); setEquipQuery(""); setEquipFilterRarity(null); setEquipHoveredId(null) }}
                                className={`w-14 h-14 rounded border flex items-center justify-center transition-all overflow-hidden relative ${activeEquipSlot?.slotKey === entry.slotKey && activeEquipSlot?.type === "charm" ? "border-purple-400 ring-1 ring-purple-400/50 bg-purple-900/20" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.08]"}`}
                                title="Charm">
                                {selectedFlatCharm ? (() => {
                                  const match = selectedFlatCharm.image_path?.match(/\/(\d+)\//)
                                  const img = match ? `/Equip/Accessory/${match[1]}/Accessory_${match[1]}_AccessoryM.png` : null
                                  return img ? <img src={img} alt="" className="w-12 h-12 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} /> : <span className="text-purple-300/50 text-lg">♦</span>
                                })() : (
                                  <span className="text-white/30 text-2xl">+</span>
                                )}
                              </button>
                              <span className="text-[8px] text-gray-500">Charm</span>
                            </div>
                          ) : (
                            (["weapon", "armor", "accessory"] as const).map(eqType => {
                              const eqId = slots[eqType]
                              const eq = eqId ? equipment.find(e => e.id === eqId) ?? null : null
                              const isActive = activeEquipSlot?.slotKey === entry.slotKey && activeEquipSlot?.type === eqType
                              return (
                                <div key={eqType} className="flex flex-col items-center gap-0.5">
                                  <button
                                    onClick={() => { setActiveEquipSlot({ slotKey: entry.slotKey, type: eqType }); setEquipQuery(""); setEquipFilterRarity(null); setEquipHoveredId(null) }}
                                    className={`w-14 h-14 rounded border flex items-center justify-center transition-all overflow-hidden ${isActive ? "border-sky-400 ring-1 ring-sky-400/50 bg-sky-900/20" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.08]"}`}
                                    title={eqType}>
                                    {eq?.image ? (
                                      <img src={eq.image} alt={eq.name} className="w-12 h-12 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                                    ) : (
                                      <span className="text-white/30 text-2xl">+</span>
                                    )}
                                  </button>
                                  <span className="text-[8px] text-gray-500 capitalize">{eqType}</span>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <>
                          {protGroups.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 bg-purple-950/30 border-b border-purple-400/10 sm:sticky top-0 z-20">
                            <span className="text-[9px] font-bold text-purple-300/70 uppercase tracking-widest">Protection Character</span>
                          </div>
                          {protGroups.map(g => (
                            <div key={g.mainEntry?.slotKey ?? g.subEntry?.slotKey}>
                              {g.mainEntry && renderEntry(g.mainEntry, false)}
                              {g.subEntry && renderEntry(g.subEntry, true)}
                            </div>
                          ))}
                        </>
                      )}
                      {battleGroups.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 bg-sky-950/30 border-b border-sky-400/10 sm:sticky top-0 z-20 mt-0">
                            <span className="text-[9px] font-bold text-sky-300/70 uppercase tracking-widest">Battle Characters</span>
                          </div>
                          {battleGroups.map(g => (
                            <div key={g.mainEntry?.slotKey ?? g.subEntry?.slotKey}>
                              {g.mainEntry && renderEntry(g.mainEntry, false)}
                              {g.subEntry && renderEntry(g.subEntry, true)}
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* RIGHT: Effects + Grid */}
              <div className="flex-1 flex flex-col min-w-0 relative overflow-y-auto sm:overflow-hidden">
                {!activeEquipSlot ? (
                  <div className="flex-1 flex items-center justify-center text-[11px] text-gray-500 text-center p-4">
                    Select an equipment or charm slot on the left to edit
                  </div>
                ) : (
                  <>
                    {/* Effects + Search wrapper: keep description and search on same background so description never overlaps */}
                    <div className="relative px-3 py-3 border-b border-white/10 bg-[#0a1525] transition-all duration-200 mb-2">
                      <div className="text-[10px] text-amber-300/80 font-semibold uppercase tracking-wider mb-1">Effects</div>
                      {(() => {
                        if (activeEquipSlot.type === "charm") {
                          const hoveredFc = equipHoveredId != null ? flatCharms.find(fc => fc.skill_id === equipHoveredId) ?? null : null
                          const selectedFc = charmSlots[activeEquipSlot.slotKey] ? flatCharms.find(fc => fc.skill_id === charmSlots[activeEquipSlot.slotKey]) ?? null : null
                          const fc = hoveredFc ?? selectedFc
                          if (fc) return (
                            <div>
                              <div className="text-[11px] text-white/90 font-medium">{fc.name}</div>
                              <div className="text-[10px] text-gray-300 mt-0.5">{fc.description ? renderColoredDesc(fc.description) : "—"}</div>
                            </div>
                          )
                        } else {
                          const hoveredEq = equipHoveredId != null ? equipment.find(e => e.id === equipHoveredId) ?? null : null
                          const currentEqId = getEquipRecord(activeEquipSlot.slotKey)[activeEquipSlot.type]
                          const selectedEq = currentEqId ? equipment.find(e => e.id === currentEqId) ?? null : null
                          const eq = hoveredEq ?? selectedEq
                          if (eq) return (
                            <div>
                              <div className="text-[11px] text-white/90 font-medium">{eq.name}</div>
                              <div className="text-[10px] text-gray-300 mt-0.5 flex gap-3">
                                <span>ATK {eq.max_atk}</span>
                                <span>DEF {eq.max_def}</span>
                                <span>HP {eq.max_hp}</span>
                                <span className="text-amber-400">★{eq.rarity} <span className="text-gray-500">({eq.base_rarity}★ base)</span></span>
                              </div>
                              {(eq.effect1 || eq.effect2) && (
                                <div className="mt-1 space-y-0.5">
                                  {eq.effect1 && <div className="text-[10px] text-gray-300">{renderColoredDesc(eq.effect1)}</div>}
                                  {eq.effect2 && <div className="text-[10px] text-gray-300">{renderColoredDesc(eq.effect2)}</div>}
                                </div>
                              )}
                            </div>
                          )
                        }
                        return <div className="text-[10px] text-gray-600">Hover over an item to see its effects</div>
                      })()}

                      {/* Search + Rarity filter (moved inside same background to avoid clipping) */}
                      <div className="mt-3 flex items-center gap-2 px-0 py-1.5 border-t border-white/5 shrink-0">
                        <input
                          value={equipQuery} onChange={e => setEquipQuery(e.target.value)}
                          placeholder={activeEquipSlot.type === "charm" ? "Search charms..." : `Search ${activeEquipSlot.type}s...`}
                          className="h-7 flex-1 rounded border border-gray-700 bg-gray-800/80 text-white text-[11px] px-2 outline-none focus:border-sky-500" />
                        {(activeEquipSlot.type === "charm" ? [3, 2, 1] : [6, 3, 2, 1]).map(r => (
                          <button key={r} onClick={() => setEquipFilterRarity(equipFilterRarity === r ? null : r)}
                            className={`w-6 h-6 rounded text-[9px] font-bold transition-all ${equipFilterRarity === r ? "bg-amber-500 text-black" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                            {r}★
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Item grid */}
                    <div className="flex-1 sm:overflow-y-auto overscroll-contain p-2">
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {/* Remove button */}
                        <div className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed border-gray-600 p-2 hover:bg-white/5 transition-colors"
                          style={{ aspectRatio: "1" }}
                          onClick={() => {
                            if (activeEquipSlot.type === "charm") {
                              setCharmSlots(prev => ({ ...prev, [activeEquipSlot.slotKey]: null }))
                            } else {
                              setEquipForSlot(activeEquipSlot.slotKey, activeEquipSlot.type, null)
                            }
                          }}>
                          <span className="text-gray-500 text-xl">⊘</span>
                          <span className="text-[10px] text-gray-500">Remove</span>
                        </div>

                        {/* Items */}
                        {activeEquipSlot.type === "charm" ? (
                          (equipModalItems as FlatCharm[]).map(fc => {
                            const isSelected = charmSlots[activeEquipSlot.slotKey] === fc.skill_id
                            const match = fc.image_path?.match(/\/(\d+)\//)
                            const img = match ? `/Equip/Accessory/${match[1]}/Accessory_${match[1]}_AccessoryM.png` : null
                            return (
                              <div key={fc.skill_id}
                                className={`flex flex-col items-center gap-1 rounded cursor-pointer transition-colors p-1 ${equipHoveredId === fc.skill_id ? "bg-white/10" : "hover:bg-white/5"}`}
                                onPointerEnter={() => setEquipHoveredId(fc.skill_id)}
                                onPointerLeave={() => setEquipHoveredId(prev => prev === fc.skill_id ? null : prev)}
                                onClick={() => setCharmSlots(prev => ({ ...prev, [activeEquipSlot.slotKey]: fc.skill_id }))}>
                                <div className="relative w-full overflow-hidden rounded" style={{ aspectRatio: "1" }}>
                                  <img src={`/UI/Texture/CommonRarityAtlas/itemRrarity${Math.min(fc.rarity + 1, 4)}.png`} alt=""
                                    className="absolute inset-0 w-full h-full object-fill pointer-events-none" />
                                  {img ? (
                                    <img src={img} alt="" className="absolute inset-0 w-full h-full object-contain p-1.5 z-10" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center z-10"><span className="text-purple-300/50 text-lg">♦</span></div>
                                  )}
                                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-px">
                                    {Array.from({ length: fc.rarity }, (_, i) => (
                                      <img key={i} src="/UI/Texture/CommonRarityAtlas/starOn.png" alt="★" className="w-3 h-3 object-contain" />
                                    ))}
                                  </div>
                                  {isSelected && <div className="absolute inset-0 ring-2 ring-purple-400 ring-inset rounded" />}
                                </div>
                                <span className="text-[9px] text-gray-400 leading-none text-center line-clamp-2 w-full px-0.5">{fc.name}</span>
                              </div>
                            )
                          })
                        ) : (
                          (equipModalItems as Equipment[]).map(eq => {
                            const isSelected = getEquipRecord(activeEquipSlot.slotKey)[activeEquipSlot.type] === eq.id
                            return (
                              <div key={eq.id}
                                className={`flex flex-col items-center gap-1 rounded cursor-pointer transition-colors p-1 ${equipHoveredId === eq.id ? "bg-white/10" : "hover:bg-white/5"}`}
                                onPointerEnter={() => setEquipHoveredId(eq.id)}
                                onPointerLeave={() => setEquipHoveredId(prev => prev === eq.id ? null : prev)}
                                onClick={() => setEquipForSlot(activeEquipSlot.slotKey, activeEquipSlot.type, eq.id)}>
                                <div className="relative w-full overflow-hidden rounded bg-black/40" style={{ aspectRatio: "1" }}>
                                  {eq.image && (
                                    <img src={eq.image} alt={eq.name} className="absolute inset-0 w-full h-full object-contain p-1" onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2" }} />
                                  )}
                                  <div className="absolute bottom-0.5 left-0.5 flex gap-0">
                                    {Array.from({ length: Math.min(eq.rarity, 8) }, (_, i) => (
                                      <img key={i} src="/UI/Texture/CharaInfoAtlas/awakeEvolutionRarityStarAdd.png" alt="★" className="w-3.5 h-3.5 object-contain -mr-0.5" />
                                    ))}
                                  </div>
                                  <div className="absolute top-0.5 right-0.5 text-[8px] font-bold text-sky-300 bg-black/60 px-1 rounded">
                                    {eq.type === "weapon" ? `ATK ${eq.max_atk}` : eq.type === "armor" ? `DEF ${eq.max_def}` : `HP ${eq.max_hp}`}
                                  </div>
                                  {isSelected && <div className="absolute inset-0 ring-2 ring-amber-400 ring-inset rounded" />}
                                </div>
                                <span className="text-[9px] text-gray-400 leading-none text-center line-clamp-1 w-full px-0.5">{eq.name || `#${eq.id}`}</span>
                              </div>
                            )
                          })
                        )}
                      </div>
                      {equipModalItems.length === 0 && <p className="py-6 text-center text-xs text-gray-500">No items match</p>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
