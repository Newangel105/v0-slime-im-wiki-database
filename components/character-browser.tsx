"use client"

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useState, useRef } from "react"
import { Grid as VirtualizedGrid, type CellComponentProps } from "react-window"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDownUp, LayoutGrid, List, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RangeSlider } from "@/components/ui/range-slider"
import {
  skillMatchesEffectFilters,
  getSkillEffectFilterGroups,
  type CharacterEffectFilterGroup,
} from "@/lib/character-effect-filters"
import { type BrowserCharacter } from "@/lib/character-browser-data"
import {
  formatWikiLabel,
  getCharacterVisualTier,
  getCharacterRarityLabel,
  getDisplayElementLabel,
  isExUnboundCharacter,
  normalizeLabel,
  stripColorTags,
  type WikiCharacter,
} from "@/lib/pc-wiki"

type SortKey = "name" | "release_date" | "rarity" | "attack" | "hp" | "defense" | "existence" | "skill_cost"

// Skill cost (SP) filter: sliders go from 0 to 85, where 85 acts as a
// "+ ceiling" (matches any cost >= 85). Real data ranges 0..100, with a
// cluster of high-cost skills (86..100); 85+ surfaces them as one bucket.
const SKILL_COST_MIN = 0
const SKILL_COST_MAX = 85

function skillCostInRange(cost: number | null | undefined, min: number, max: number) {
  if (cost == null) return false
  if (max >= SKILL_COST_MAX) return cost >= min
  return cost >= min && cost <= max
}
type FilterMode = "AND" | "OR"
type CharacterViewMode = "cards" | "compact"

type FilterOption = {
  label: string
  value: string
  icon?: string
}

type CharacterBrowserStoredState = {
  filtersOpen?: boolean
  searchText?: string
  selectedAttackerElements?: string[]
  selectedDefenderElements?: string[]
  selectedAttackTypes?: string[]
  selectedTactics?: string[]
  selectedForces?: string[]
  selectedSkillFilters?: string[]
  selectedTraitNames?: string[]
  selectedValorTraitNames?: string[]
  selectedFacilities?: string[]
  selectedWeapons?: string[]
  selectedRoles?: string[]
  selectedUltimateTypes?: string[]
  selectedRarities?: string[]
  sortKey?: SortKey
  sortAsc?: boolean
  showStats?: boolean
  viewMode?: CharacterViewMode
  filterMode?: FilterMode
  searchSkills?: boolean
  skillCostMin?: number
  skillCostMax?: number
}

const CHARACTER_BROWSER_STORAGE_KEY = "slimeWiki.characterBrowserState.v1"
const CHARACTER_BROWSER_QUERY_KEYS = [
  "tag",
  "attacker",
  "defender",
  "type",
  "tactics",
  "weapon",
  "role",
  "ulti",
  "rarity",
  "force",
  "facility",
  "skill",
  "trait",
  "valor",
  "sort",
  "asc",
  "mode",
  "skills",
  "cmin",
  "cmax",
]
const SORT_KEYS = new Set<SortKey>(["name", "release_date", "rarity", "attack", "hp", "defense", "existence", "skill_cost"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
}

function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && SORT_KEYS.has(value as SortKey)
}

function isFilterMode(value: unknown): value is FilterMode {
  return value === "AND" || value === "OR"
}

function isCharacterViewMode(value: unknown): value is CharacterViewMode {
  return value === "cards" || value === "compact"
}

function readCharacterBrowserState(): CharacterBrowserStoredState | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(CHARACTER_BROWSER_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null

    return {
      filtersOpen: typeof parsed.filtersOpen === "boolean" ? parsed.filtersOpen : undefined,
      searchText: typeof parsed.searchText === "string" ? parsed.searchText : undefined,
      selectedAttackerElements: readStringList(parsed.selectedAttackerElements),
      selectedDefenderElements: readStringList(parsed.selectedDefenderElements),
      selectedAttackTypes: readStringList(parsed.selectedAttackTypes),
      selectedTactics: readStringList(parsed.selectedTactics),
      selectedForces: readStringList(parsed.selectedForces),
      selectedSkillFilters: readStringList(parsed.selectedSkillFilters),
      selectedTraitNames: readStringList(parsed.selectedTraitNames),
      selectedValorTraitNames: readStringList(parsed.selectedValorTraitNames),
      selectedFacilities: readStringList(parsed.selectedFacilities),
      selectedWeapons: readStringList(parsed.selectedWeapons),
      selectedRoles: readStringList(parsed.selectedRoles),
      selectedUltimateTypes: readStringList(parsed.selectedUltimateTypes),
      selectedRarities: readStringList(parsed.selectedRarities),
      sortKey: isSortKey(parsed.sortKey) ? parsed.sortKey : undefined,
      sortAsc: typeof parsed.sortAsc === "boolean" ? parsed.sortAsc : undefined,
      showStats: typeof parsed.showStats === "boolean" ? parsed.showStats : undefined,
      viewMode: isCharacterViewMode(parsed.viewMode) ? parsed.viewMode : undefined,
      filterMode: isFilterMode(parsed.filterMode) ? parsed.filterMode : undefined,
      searchSkills: typeof parsed.searchSkills === "boolean" ? parsed.searchSkills : undefined,
      skillCostMin: typeof parsed.skillCostMin === "number" ? parsed.skillCostMin : undefined,
      skillCostMax: typeof parsed.skillCostMax === "number" ? parsed.skillCostMax : undefined,
    }
  } catch {
    return null
  }
}

function getQueryList(params: URLSearchParams, key: string): string[] {
  return params.get(key)?.split(",").map((entry) => entry.trim()).filter(Boolean) ?? []
}

function hasCharacterBrowserQueryState(params: URLSearchParams) {
  return CHARACTER_BROWSER_QUERY_KEYS.some((key) => params.has(key))
}

const STAR_ASSETS: Record<number, string> = {
  3: "/UI/Texture/CommonRarityAtlas/starCharaL3.webp",
  4: "/UI/Texture/CommonRarityAtlas/starCharaL4.webp",
  5: "/UI/Texture/CommonRarityAtlas/starCharaL5.webp",
  6: "/UI/Texture/CommonRarityAtlas/starCharaL6.webp",
  7: "/UI/Texture/CommonRarityAtlas/starCharaL6_SpecialPlus.webp",
  8: "/UI/Texture/CommonRarityAtlas/starCharaL7_Epic.webp",
}

const RARITY_OPTIONS: FilterOption[] = [3, 4, 5, 6, 7, 8].map((rarity) => ({
  label: `${rarity}★`,
  value: String(rarity),
  icon: STAR_ASSETS[rarity],
}))

const elementIconMap: Record<string, string> = {
  air: "/UI/Texture/CommonLotteryInfoPanelAtlas/space.webp",
  all: "/Image/IcElementBless/IcElementBlessAll.webp",
  dark: "/UI/Texture/CommonLotteryInfoPanelAtlas/dark.webp",
  earth: "/UI/Texture/CommonLotteryInfoPanelAtlas/earth.webp",
  enhancedair: "/Image/IcElementBless/IcElementBlessEnhancedAir.webp",
  enhanceddark: "/Image/IcElementBless/IcElementBlessEnhancedDark.webp",
  enhancedearth: "/Image/IcElementBless/IcElementBlessEnhancedEarth.webp",
  enhancedfire: "/Image/IcElementBless/IcElementBlessEnhancedFire.webp",
  enhancedholy: "/Image/IcElementBless/IcElementBlessEnhancedHoly.webp",
  enhancedwater: "/Image/IcElementBless/IcElementBlessEnhancedWater.webp",
  enhancedwind: "/Image/IcElementBless/IcElementBlessEnhancedWind.webp",
  fire: "/UI/Texture/CommonLotteryInfoPanelAtlas/fire.webp",
  holy: "/UI/Texture/CommonLotteryInfoPanelAtlas/light.webp",
  light: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementHoly.webp",
  magic: "/Image/IcElementBless/IcElementBlessMagic.webp",
  physics: "/Image/IcElementBless/IcElementBlessPhysics.webp",
  space: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementAir.webp",
  special: "/Image/IcElementBless/IcElementBlessSpecial.webp",
  
  specialeffectelementair: "/Image/IcElementBless/IcElementBlessSpecialEffectElementAir.webp",
  specialeffectelementdark: "/Image/IcElementBless/IcElementBlessSpecialEffectElementDark.webp",
  specialeffectelementearth: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEarth.webp",
  specialeffectelementenhancedair: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedAir.webp",
  specialeffectelementenhanceddark: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedDark.webp",
  specialeffectelementenhancedearth: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedEarth.webp",
  specialeffectelementenhancedfire: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedFire.webp",
  specialeffectelementenhancedholy: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedHoly.webp",
  specialeffectelementenhancedwater: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWater.webp",
  specialeffectelementenhancedwind: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWind.webp",
  specialeffectelementfire: "/Image/IcElementBless/IcElementBlessSpecialEffectElementFire.webp",
  specialeffectelementholy: "/Image/IcElementBless/IcElementBlessSpecialEffectElementHoly.webp",
  specialeffectelementnone: "/Image/IcElementBless/IcElementBlessSpecialEffectElementNone.webp",
  specialeffectelementwater: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWater.webp",
  specialeffectelementwind: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWind.webp",
  water: "/UI/Texture/CommonLotteryInfoPanelAtlas/water.webp",
  wind: "/UI/Texture/CommonLotteryInfoPanelAtlas/wind.webp",
}

// "Increases <element> ATK by" → base element icon (e.g. wind.webp)
const defenderBaseElementIconMap: Record<string, string> = {
  air: "/UI/Texture/CommonLotteryInfoPanelAtlas/space.webp",
  dark: "/UI/Texture/CommonLotteryInfoPanelAtlas/dark.webp",
  earth: "/UI/Texture/CommonLotteryInfoPanelAtlas/earth.webp",
  fire: "/UI/Texture/CommonLotteryInfoPanelAtlas/fire.webp",
  holy: "/UI/Texture/CommonLotteryInfoPanelAtlas/light.webp",
  water: "/UI/Texture/CommonLotteryInfoPanelAtlas/water.webp",
  wind: "/UI/Texture/CommonLotteryInfoPanelAtlas/wind.webp",
}

// "damage done by ... to <element> attribute enemies" → Anti icon (e.g. Anti-Wind.webp)
const defenderAntiElementIconMap: Record<string, string> = {
  air: "/UI/Texture/CommonLotteryInfoPanelAtlas/Anti-Space.webp",
  dark: "/UI/Texture/CommonLotteryInfoPanelAtlas/Anti-Dark.webp",
  earth: "/UI/Texture/CommonLotteryInfoPanelAtlas/Anti-Earth.webp",
  fire: "/UI/Texture/CommonLotteryInfoPanelAtlas/Anti-Fire.webp",
  holy: "/UI/Texture/CommonLotteryInfoPanelAtlas/Anti-Light.webp",
  water: "/UI/Texture/CommonLotteryInfoPanelAtlas/Anti-Water.webp",
  wind: "/UI/Texture/CommonLotteryInfoPanelAtlas/Anti-Wind.webp",
}

// Same as Anti but for EX Unbound protectors → unbound icon (e.g. anti_wind_attribute_unbound.webp)
const defenderAntiExElementIconMap: Record<string, string> = {
  air: "/UI/Texture/CommonLotteryInfoPanelAtlas/anti_space_attribute_unbound.webp",
  dark: "/UI/Texture/CommonLotteryInfoPanelAtlas/anti_dark_attribute_unbound.webp",
  earth: "/UI/Texture/CommonLotteryInfoPanelAtlas/anti_earth_attribute_unbound.webp",
  fire: "/UI/Texture/CommonLotteryInfoPanelAtlas/anti_fire_attribute_unbound.webp",
  holy: "/UI/Texture/CommonLotteryInfoPanelAtlas/anti_light_attribute_unbound.webp",
  water: "/UI/Texture/CommonLotteryInfoPanelAtlas/anti_water_attribute_unbound.webp",
  wind: "/UI/Texture/CommonLotteryInfoPanelAtlas/anti_wind_attribute_unbound.webp",
}

const attackerElementIconMap: Record<string, string> = {
  air: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementAir.webp",
  dark: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementDark.webp",
  earth: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEarth.webp",
  enhancedair: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedAir.webp",
  enhanceddark: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedDark.webp",
  enhancedearth: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedEarth.webp",
  enhancedfire: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedFire.webp",
  enhancedholy: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedHoly.webp",
  enhancedwater: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedWater.webp",
  enhancedwind: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedWind.webp",
  fire: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementFire.webp",
  holy: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementHoly.webp",
  water: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementWater.webp",
  wind: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementWind.webp",
}

const leaderSkillElementPatterns: [RegExp, string][] = [
  [/increases?\s+fire\s+atk/i, "Fire"],
  [/increases?\s+water\s+atk/i, "Water"],
  [/increases?\s+earth\s+atk/i, "Earth"],
  [/increases?\s+space\s+atk/i, "Air"],
  [/increases?\s+wind\s+atk/i, "Wind"],
  [/increases?\s+dark\s+atk/i, "Dark"],
  [/increases?\s+light\s+atk/i, "Holy"],
  [/increases?\s+p-atk/i, "Physics"],
  [/physical characters'/i, "Physics"],
  [/increases?\s+m-atk/i, "Magic"],
  [/magic characters'/i, "Magic"],
  [/all allies' atk/i, "All"],
]

const leaderSkillDamageToAttributePattern = /to\s+(?:fire|water|earth|space|wind|dark|light)\s+attribute(?:\s+and\s+(?:fire|water|earth|space|wind|dark|light)\s+attribute)*\s+enemies/i

const damageToAttributeElementMap: Record<string, string> = {
  fire: "Fire", water: "Water", earth: "Earth", space: "Air",
  wind: "Wind", dark: "Dark", light: "Holy",
}

type DefenderElementEntry = {
  value: string
  source: "atk" | "damage_to_attribute" | "raw"
}

function getDefenderElementEntries(character: BrowserCharacter): DefenderElementEntry[] {
  if (!isProtectorCharacter(character)) return [{ value: character.element, source: "raw" }]

  // Derive defender entries from the character element and the canonical
  // `master_leader_skill_element_type_2` field. Do not parse leader_skill text.
  const values = getDefenderElementValues(character)
  return values.map((v) => ({ value: v, source: "raw" }))
}

function getDefenderElementValues(character: BrowserCharacter): string[] {
  if (!isProtectorCharacter(character)) return [normalizeLabel(character.element)]

  const normalized = normalizeLabel(character.element)
  const values: string[] = []

  // Primary: use the character's element (base or specialeffect key) if present
  if (normalized.startsWith("specialeffectelement")) {
    values.push(normalized)
  } else if (baseElementKeys.has(normalized)) {
    values.push(normalized)
  } else if (normalized === "physics" || normalized === "magic") {
    values.push(normalized) // protector-type primary elements
  }

  // Secondary: use canonical `master_leader_skill_element_type_2` (no leader_skill parsing)
  const secondRaw = (character as any).master_leader_skill_element_type_2 ?? null
  if (secondRaw) {
    const secondKey = normalizeLabel(secondRaw)
    if (secondKey && secondKey !== "none" && !values.includes(secondKey)) {
      values.push(secondKey)
    }
  }

  // Fallback to raw element value if nothing matched
  if (values.length === 0 && normalized && normalized !== "none") {
    values.push(normalized)
  }

  return values
}

function isProtectorCharacter(character: BrowserCharacter): boolean {
  return character.character_role === "Supporter" &&
    !character.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}

function isAttackerCharacter(character: BrowserCharacter): boolean {
  if (character.character_role === "Attacker") return true
  return character.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}

// Helpers: element key maps, ordering, and utilities
const specialEffectToBase: Record<string, string> = {
  all: "Earth",
  special: "Air",
  specialeffectelementearth: "Earth",
  specialeffectelementair: "Air",
  specialeffectelementwind: "Wind",
  specialeffectelementwater: "Water",
  specialeffectelementfire: "Fire",
  specialeffectelementholy: "Holy",
  specialeffectelementdark: "Dark",
  specialeffectelementenhancedearth: "EnhancedEarth",
  specialeffectelementenhancedair: "EnhancedAir",
  specialeffectelementenhancedwind: "EnhancedWind",
  specialeffectelementenhancedwater: "EnhancedWater",
  specialeffectelementenhancedfire: "EnhancedFire",
  specialeffectelementenhancedholy: "EnhancedHoly",
  specialeffectelementenhanceddark: "EnhancedDark",
}

const baseElementKeys = new Set(["air", "dark", "earth", "fire", "holy", "water", "wind"])
const hiddenElementKeys = new Set(["none", "specialeffectelementnone"])

const attackerElementOrder = [
  "air",
  "dark",
  "earth",
  "fire",
  "holy",
  "water",
  "wind",
  "enhancedair",
  "enhanceddark",
  "enhancedearth",
  "enhancedfire",
  "enhancedholy",
  "enhancedwater",
  "enhancedwind",
]
const attackerElementKeys = new Set(attackerElementOrder)

const defenderElementOrder = [
  "all",
  "special",
  "physics",
  "magic",
  "fire",
  "water",
  "earth",
  "air",
  "wind",
  "dark",
  "holy",
  "specialeffectelementair",
  "specialeffectelementdark",
  "specialeffectelementearth",
  "specialeffectelementfire",
  "specialeffectelementholy",
  "specialeffectelementwater",
  "specialeffectelementwind",
  "specialeffectelementenhancedair",
  "specialeffectelementenhanceddark",
  "specialeffectelementenhancedearth",
  "specialeffectelementenhancedfire",
  "specialeffectelementenhancedholy",
  "specialeffectelementenhancedwater",
  "specialeffectelementenhancedwind",
]
const defenderElementKeys = new Set(defenderElementOrder)

const attackerElementOrderIndex = new Map(attackerElementOrder.map((v, i) => [v, i]))
const defenderElementOrderIndex = new Map(defenderElementOrder.map((v, i) => [v, i]))

function toEnhancedElementValue(value: string): string {
  return `Enhanced${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function getCharacterElementValue(character: BrowserCharacter): string {
  if (isProtectorCharacter(character)) {
    return getDefenderElementValues(character)[0]
  }
  const normalized = normalizeLabel(character.element)
  const baseFromSpecial = specialEffectToBase[normalized]
  if (isAttackerCharacter(character) && baseFromSpecial) {
    const baseNormalized = normalizeLabel(baseFromSpecial)
    if (baseElementKeys.has(baseNormalized) && isExUnboundCharacter(character)) {
      return toEnhancedElementValue(baseNormalized)
    }
    return baseFromSpecial
  }
  if (isAttackerCharacter(character) && baseElementKeys.has(normalized) && isExUnboundCharacter(character)) {
    return toEnhancedElementValue(normalized)
  }
  return character.element
}

function compareElementValues(left: string, right: string, orderIndex: Map<string, number>): number {
  const leftNormalized = normalizeLabel(left)
  const rightNormalized = normalizeLabel(right)
  const leftIndex = orderIndex.get(leftNormalized)
  const rightIndex = orderIndex.get(rightNormalized)

  if (leftIndex !== undefined || rightIndex !== undefined) {
    if (leftIndex === undefined) return 1
    if (rightIndex === undefined) return -1
    return leftIndex - rightIndex
  }

  return getDisplayElementLabel(left).localeCompare(getDisplayElementLabel(right))
}

function getElementIcon(value: string | null | undefined): string | undefined {
  const normalized = normalizeLabel(value)
  if (hiddenElementKeys.has(normalized)) {
    return undefined
  }
  return elementIconMap[normalized]
}

function getAttackerElementIcon(value: string | null | undefined): string | undefined {
  const normalized = normalizeLabel(value)
  if (hiddenElementKeys.has(normalized)) {
    return undefined
  }
  return attackerElementIconMap[normalized]
}

function getCharacterElementIcon(character: BrowserCharacter): string | undefined {
  const characterElementValue = getCharacterElementValue(character)
  if (isProtectorCharacter(character)) {
    return getElementIcon(characterElementValue)
  }
  if (isAttackerCharacter(character)) {
    return getAttackerElementIcon(characterElementValue)
  }
  return undefined
}

function getDefenderEntryIcon(entry: DefenderElementEntry, character: BrowserCharacter): string | undefined {
  const normalized = normalizeLabel(entry.value)
  if (hiddenElementKeys.has(normalized)) return undefined

  // Base elements → IcElementBless base icons
  if (baseElementKeys.has(normalized)) {
    return defenderBaseElementIconMap[normalized]
  }

  // Physics / Magic for protectors → use protector-specific icons
  if (isProtectorCharacter(character)) {
    const protTypeMap: Record<string, string> = {
      physics: "/type_dmg/prot_phys.webp",
      magic: "/type_dmg/prot_magic.webp",
    }
    if (protTypeMap[normalized]) return protTypeMap[normalized]
  }

  // All, or other non-base-element values → use generic elementIconMap
  return elementIconMap[normalized]
}

function getCharacterElementIcons(character: BrowserCharacter): { icon: string; label: string }[] {
  if (isProtectorCharacter(character)) {
    // Use getDefenderElementValues which returns the correct icon-level keys
    return getDefenderElementValues(character)
      .map((value) => ({
        icon: defenderBlessIconMap[value] ?? elementIconMap[value],
        label: getDisplayElementLabel(value),
      }))
      .filter((e): e is { icon: string; label: string } => !!e.icon)
  }
  const characterElementValue = getCharacterElementValue(character)
  const icon = isAttackerCharacter(character)
    ? getAttackerElementIcon(characterElementValue)
    : getElementIcon(characterElementValue)
  if (!icon) return []
  return [{ icon, label: getDisplayElementLabel(characterElementValue) }]
}

const attackTypeIconMap: Record<string, string> = {
  magic: "/UI/Texture/CommonLotteryInfoPanelAtlas/icAttackTypeMagic.webp",
  physical: "/UI/Texture/CommonLotteryInfoPanelAtlas/icAttackTypePhysical.webp",
}

const weaponIconMap: Record<string, string> = {
  book: "/weapons/book.webp",
  fist: "/weapons/fists.webp",
  fists: "/weapons/fists.webp",
  greatsword: "/weapons/greatsword.webp",
  hammer: "/weapons/hammer.webp",
  largesword: "/weapons/greatsword.webp",
  katana: "/weapons/katana.webp",
  knuckle: "/weapons/fists.webp",
  spear: "/weapons/spear.webp",
  sword: "/weapons/sword.webp",
}

const tacticsIconMap: Record<string, string> = {
  charge: "/L10NAssets/En/Image/Tactics/tactics_004.webp",
  defense: "/L10NAssets/En/Image/Tactics/tactics_003.webp",
  normal: "/L10NAssets/En/Image/Tactics/tactics_001.webp",
  speed: "/L10NAssets/En/Image/Tactics/tactics_002.webp",
}

function fieldBuildingIcon(id: string, ver: string) {
  return `/Image/FieldBuilding/${id}/${ver}/FieldBuilding_${id}_${ver}_icon.webp`
}

const facilityIconMap: Record<string, string> = {
  "Armory": fieldBuildingIcon("1209", "02"),
  "Armor Magicubeite Digsite": fieldBuildingIcon("1333", "01"),
  "Brewery": fieldBuildingIcon("1318", "02"),
  "Café": fieldBuildingIcon("1308", "02"),
  "Churros Stall": fieldBuildingIcon("1338", "01"),
  "Clothing Store": fieldBuildingIcon("1305", "02"),
  "Crystal Hotel": fieldBuildingIcon("1453", "01"),
  "Crystal Restaurant": fieldBuildingIcon("1347", "01"),
  "Dango Shop": fieldBuildingIcon("1551", "01"),
  "Dark Arts Shrine": fieldBuildingIcon("1633", "02"),
  "Dark Magic Device": fieldBuildingIcon("1613", "01"),
  "Decoration Magicubeite Digsite": fieldBuildingIcon("1334", "01"),
  "Digsite for Attack Magigems": fieldBuildingIcon("1324", "01"),
  "Digsite for Attack Magistones": fieldBuildingIcon("1310", "02"),
  "Digsite for Defense Magigems": fieldBuildingIcon("1321", "01"),
  "Digsite for Defense Magistones": fieldBuildingIcon("1315", "02"),
  "Digsite for Stamina Magigems": fieldBuildingIcon("1322", "01"),
  "Digsite for Stamina Magistones": fieldBuildingIcon("1309", "02"),
  "Digsite for Training Magigems": fieldBuildingIcon("1323", "01"),
  "Digsite for Training Magistones": fieldBuildingIcon("1312", "02"),
  "Dojo": fieldBuildingIcon("1360", "01"),
  "Earth Arts Shrine": fieldBuildingIcon("1629", "02"),
  "Earth Magic Device": fieldBuildingIcon("1609", "01"),
  "Elemental Colossus Bay": fieldBuildingIcon("1344", "01"),
  "Encampment": fieldBuildingIcon("1326", "01"),
  "Farm": fieldBuildingIcon("1301", "03"),
  "Feast Hot Pot": fieldBuildingIcon("1422", "02"),
  "Field": fieldBuildingIcon("1313", "03"),
  "Fire Arts Shrine": fieldBuildingIcon("1627", "02"),
  "Fire Magic Device": fieldBuildingIcon("1607", "01"),
  "Forest Supply Corps Base": fieldBuildingIcon("1304", "03"),
  "Fruit Stall": fieldBuildingIcon("1330", "01"),
  "Gift Shop": fieldBuildingIcon("1335", "01"),
  "Geological Survey Station": fieldBuildingIcon("1341", "01"),
  "Hamburger Stall": fieldBuildingIcon("1337", "01"),
  "Honey Café": fieldBuildingIcon("1225", "01"),
  "Hot Dog Stall": fieldBuildingIcon("1336", "01"),
  "Ice Cream Cart": fieldBuildingIcon("1327", "01"),
  "Inn": fieldBuildingIcon("1316", "02"),
  "Japanese Style Tavern": fieldBuildingIcon("1214", "01"),
  "Juice Stand": fieldBuildingIcon("1357", "01"),
  "Laboratory": fieldBuildingIcon("1606", "02"),
  "Light Arts Shrine": fieldBuildingIcon("1632", "02"),
  "Light Magic Device": fieldBuildingIcon("1612", "01"),
  "Magic Fang Atelier": fieldBuildingIcon("1348", "01"),
  "Magic Feather Atelier": fieldBuildingIcon("1350", "01"),
  "Magic Hide Atelier": fieldBuildingIcon("1349", "01"),
  "Mini Coaster": fieldBuildingIcon("1218", "01"),
  "Monster Museum": fieldBuildingIcon("1345", "01"),
  "Mountain Supply Corps Base": fieldBuildingIcon("1302", "03"),
  "Obstacle Course": fieldBuildingIcon("1359", "01"),
  "Ocean Supply Corps Base": fieldBuildingIcon("1303", "03"),
  "Orchard": fieldBuildingIcon("1355", "01"),
  "Paper Mill": fieldBuildingIcon("1354", "01"),
  "Photo Studio": fieldBuildingIcon("1362", "02"),
  "Protection Magistone Digsite": fieldBuildingIcon("1311", "02"),
  "Purple Magicluster Digsite": fieldBuildingIcon("1352", "02"),
  "Ramen Shop": fieldBuildingIcon("1328", "01"),
  "Red Magicluster Digsite": fieldBuildingIcon("1353", "02"),
  "Restaurant": fieldBuildingIcon("1306", "03"),
  "Savory Pancake Stall": fieldBuildingIcon("1329", "01"),
  "Sawmill": fieldBuildingIcon("1317", "02"),
  "Shaved Ice Shop": fieldBuildingIcon("1351", "01"),
  "Shishkabob Stall": fieldBuildingIcon("1331", "01"),
  "Snack Bar Jura": fieldBuildingIcon("1523", "01"),
  "Souvenir Shop": fieldBuildingIcon("1570", "01"),
  "Space Arts Shrine": fieldBuildingIcon("1631", "02"),
  "Space Magic Device": fieldBuildingIcon("1611", "01"),
  "Sweets Shop": fieldBuildingIcon("1339", "01"),
  "Symbol of Protection": fieldBuildingIcon("1614", "01"),
  "Tableware Store": fieldBuildingIcon("1356", "01"),
  "Tavern": fieldBuildingIcon("1307", "02"),
  "Tempest Wheel": fieldBuildingIcon("1216", "01"),
  "Trading Post": fieldBuildingIcon("1206", "02"),
  "Traditional Brewery": fieldBuildingIcon("1325", "01"),
  "Traditional Inn": fieldBuildingIcon("1213", "01"),
  "Traditional Snack Shop": fieldBuildingIcon("1568", "01"),
  "Training Ground": fieldBuildingIcon("1314", "03"),
  "Water Arts Shrine": fieldBuildingIcon("1628", "02"),
  "Water Magic Device": fieldBuildingIcon("1608", "01"),
  "Water Purification Station": fieldBuildingIcon("1346", "01"),
  "Weapon Magicubeite Digsite": fieldBuildingIcon("1332", "01"),
  "Weaving Workshop": fieldBuildingIcon("1320", "02"),
  "Wind Arts Shrine": fieldBuildingIcon("1630", "02"),
  "Wind Magic Device": fieldBuildingIcon("1610", "01"),
  "Flour Mill": fieldBuildingIcon("1365", "01"),
}

const rarityFrameMap: Record<number, string> = {
  3: "UI/Texture/CommonRarityAtlas/frameMemberM3.webp",
  4: "UI/Texture/CommonRarityAtlas/frameMemberM4.webp",
  5: "UI/Texture/CommonRarityAtlas/frameMemberM5.webp",
  6: "UI/Texture/CommonRarityAtlas/frameMemberM6_Special.webp",
  7: "UI/Texture/CommonRarityAtlas/frameMemberM6_SpecialPlus.webp",
  8: "UI/Texture/CommonRarityAtlas/frameMemberM7_Epic.webp",
}

const blessFrameMap: Record<number, string> = {
  3: "UI/Texture/CommonRarityAtlas/frameBlessM3.webp",
  4: "UI/Texture/CommonRarityAtlas/frameBlessM4.webp",
  5: "UI/Texture/CommonRarityAtlas/frameBlessM5.webp",
  6: "UI/Texture/CommonRarityAtlas/frameBlessM6_Special.webp",
  7: "UI/Texture/CommonRarityAtlas/frameBlessM6_SpecialPlus.webp",
  8: "UI/Texture/CommonRarityAtlas/frameBlessM7_Epic.webp",
}

const baseRarityMap: Record<number, string> = {
  3: "UI/Texture/CommonRarityAtlas/baseMemberM3.webp",
  4: "UI/Texture/CommonRarityAtlas/baseMemberM4.webp",
  5: "UI/Texture/CommonRarityAtlas/baseMemberM5.webp",
  6: "UI/Texture/CommonRarityAtlas/baseMemberM6_Special.webp",
  7: "UI/Texture/CommonRarityAtlas/baseMemberM6_SpecialPlus.webp",
  8: "UI/Texture/CommonRarityAtlas/baseMemberM7_Epic.webp",
}

const baseBlessMap: Record<number, string> = {
  3: "UI/Texture/CommonRarityAtlas/baseBlessM3.webp",
  4: "UI/Texture/CommonRarityAtlas/baseBlessM4.webp",
  5: "UI/Texture/CommonRarityAtlas/baseBlessM5.webp",
  6: "UI/Texture/CommonRarityAtlas/baseBlessM6_Special.webp",
  7: "UI/Texture/CommonRarityAtlas/baseBlessM6_SpecialPlus.webp",
  8: "UI/Texture/CommonRarityAtlas/baseBlessM7_Epic.webp",
}

function getCharacterFrame(character: BrowserCharacter): string {
  const visualTier = getCharacterVisualTier(character)
  const frameMap = isProtectorCharacter(character) ? blessFrameMap : rarityFrameMap
  return frameMap[visualTier] ?? frameMap[5]
}

function getCharacterBase(character: BrowserCharacter): string {
  const visualTier = getCharacterVisualTier(character)
  const baseMap = isProtectorCharacter(character) ? baseBlessMap : baseRarityMap
  return baseMap[visualTier] ?? baseMap[5]
}

const starAssetMap: Record<number, string> = {
  3: "/UI/Texture/CommonRarityAtlas/starCharaL3.webp",
  4: "/UI/Texture/CommonRarityAtlas/starCharaL4.webp",
  5: "/UI/Texture/CommonRarityAtlas/starCharaL5.webp",
  6: "/UI/Texture/CommonRarityAtlas/starCharaL6.webp",
  7: "/UI/Texture/CommonRarityAtlas/starCharaL6_SpecialPlus.webp",
  8: "/UI/Texture/CommonRarityAtlas/starCharaL7_Epic.webp",
}

const elementColorMap: Record<string, string> = {
  air: "#22d3ee",
  all: "#cbd5e1",
  dark: "#a855f7",
  earth: "#d97706",
  enhancedair: "#67e8f9",
  enhanceddark: "#c084fc",
  enhancedearth: "#f59e0b",
  enhancedfire: "#fb923c",
  enhancedholy: "#fde047",
  enhancedwater: "#93c5fd",
  enhancedwind: "#5eead4",
  fire: "#f97316",
  holy: "#facc15",
  light: "#facc15",
  magic: "#60a5fa",
  physics: "#f87171",
  special: "#fbbf24",
  space: "#6366f1",
  specialeffectelementair: "#22d3ee",
  specialeffectelementdark: "#a855f7",
  specialeffectelementearth: "#d97706",
  specialeffectelementenhancedair: "#67e8f9",
  specialeffectelementenhanceddark: "#c084fc",
  specialeffectelementenhancedearth: "#f59e0b",
  specialeffectelementenhancedfire: "#fb923c",
  specialeffectelementenhancedholy: "#fde047",
  specialeffectelementenhancedwater: "#93c5fd",
  specialeffectelementenhancedwind: "#5eead4",
  specialeffectelementfire: "#f97316",
  specialeffectelementholy: "#facc15",
  specialeffectelementnone: "#fbbf24",
  specialeffectelementwater: "#60a5fa",
  specialeffectelementwind: "#2dd4bf",
  water: "#60a5fa",
  wind: "#2dd4bf",
}

function colorWithAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "")
  if (value.length !== 6) return `rgba(255, 255, 255, ${alpha})`

  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function buildAllOptions(characters: BrowserCharacter[], wikiCharacters: WikiCharacter[]) {
    return {
    attackerElements: buildElementOptions(characters, "attacker"),
    defenderElements: buildElementOptions(characters, "defender"),
    attackTypes: buildAttackTypeOptions(characters.map((c) => c.attack_type)),
    weapons: buildWeaponOptions(characters.map((c) => c.weapon_type)),
    tactics: buildTacticsOptions(characters.map((c) => c.tactics_type)),
    forces: buildForcesOptions(characters),
    skillGroups: getSkillEffectFilterGroups(wikiCharacters.flatMap((character) => character.skills)),
    traitGroups: getSkillEffectFilterGroups(characters.flatMap((character) => character.traits.filter((trait) => !isValorTrait(trait)))),
    valorTraitGroups: buildValorTraitGroups(characters),
    facilities: buildOptions(characters.flatMap((c) => c.facilities)),
  }
}

type CharacterBrowserOptions = ReturnType<typeof buildAllOptions>

const EMPTY_OPTIONS: CharacterBrowserOptions = {
  attackerElements: [],
  defenderElements: [],
  attackTypes: [],
  weapons: [],
  tactics: [],
  forces: [],
  skillGroups: [],
  traitGroups: [],
  valorTraitGroups: [],
  facilities: [],
}

function buildOptions(values: string[]): FilterOption[] {
  return [...new Set(values.filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ label: value, value }))
}

function buildElementOptions(characters: BrowserCharacter[], role: "attacker" | "defender"): FilterOption[] {
  const filteredCharacters = characters.filter((character) =>
    role === "attacker" ? isAttackerCharacter(character) : isProtectorCharacter(character),
  )
  const orderIndex = role === "attacker" ? attackerElementOrderIndex : defenderElementOrderIndex
  const allowedKeys = role === "attacker" ? attackerElementKeys : defenderElementKeys

  const allValues = role === "defender"
    ? filteredCharacters.flatMap((character) => getDefenderElementValues(character))
    : filteredCharacters.map((character) => getCharacterElementValue(character))

  // Always include 'all' and 'special' in defender filter options even if no characters use them
  if (role === "defender") {
    allValues.push("all", "special")
  }

  return [...new Set(allValues.filter(Boolean))]
    .filter((value) => {
      const normalized = normalizeLabel(value)
      return !hiddenElementKeys.has(normalized) && allowedKeys.has(normalized)
    })
    .sort((left, right) => compareElementValues(left, right, orderIndex))
    .map((value) => ({
      label: getDisplayElementLabel(value),
      value,
      icon: role === "attacker" ? getAttackerElementIcon(value) : getDefenderFilterIcon(value),
    }))
}

/** IcElementBless icons for base element keys in the protector filter bar */
const defenderBlessIconMap: Record<string, string> = {
  air: "/Image/IcElementBless/IcElementBlessAir.webp",
  dark: "/Image/IcElementBless/IcElementBlessDark.webp",
  earth: "/Image/IcElementBless/IcElementBlessEarth.webp",
  fire: "/Image/IcElementBless/IcElementBlessFire.webp",
  holy: "/Image/IcElementBless/IcElementBlessHoly.webp",
  water: "/Image/IcElementBless/IcElementBlessWater.webp",
  wind: "/Image/IcElementBless/IcElementBlessWind.webp",
}

function getDefenderFilterIcon(value: string): string | undefined {
  const normalized = normalizeLabel(value)
  if (hiddenElementKeys.has(normalized)) return undefined
  // Base element keys → IcElementBless icons; all others already in elementIconMap
  return defenderBlessIconMap[normalized] ?? elementIconMap[normalized]
}

function buildAttackTypeOptions(values: string[]): FilterOption[] {
  return [...new Set(values.filter(Boolean).map(normalizeLabel))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      label: formatWikiLabel(value),
      value,
      icon: attackTypeIconMap[value],
    }))
}

function buildTacticsOptions(values: string[]): FilterOption[] {
  return [...new Set(values.filter(Boolean).map(normalizeLabel))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      label: formatWikiLabel(value),
      value,
      icon: tacticsIconMap[value],
    }))
}

function buildWeaponOptions(values: string[]): FilterOption[] {
  return [...new Set(values.filter(Boolean).map(normalizeLabel))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      label: formatWikiLabel(value),
      value,
      icon: weaponIconMap[value],
    }))
}

function buildForcesOptions(characters: BrowserCharacter[]): FilterOption[] {
  const forceMap = new Map<string, string | undefined>()
  for (const char of characters) {
    for (const force of char.force_entries) {
      if (!forceMap.has(force.name)) forceMap.set(force.name, force.icon)
    }
  }

  return [...forceMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, iconPath]) => ({
      label: name,
      value: name,
      icon: iconPath,
    }))
}

function getCharacterUltimateType(character: BrowserCharacter): "aoe" | "single" | null {
  const hasAoE = character.skills.some((skill) =>
    skill.battle_attack_effects?.some((e) => e.target_type === 1)
  )

  const hasSingle = character.skills.some((skill) =>
    skill.battle_attack_effects?.some((e) => e.target_type === 0)
  )

  if (hasAoE && !hasSingle) return "aoe"
  if (hasSingle && !hasAoE) return "single"

  // mixed or unknown
  return hasAoE ? "aoe" : hasSingle ? "single" : null
}

const ROLE_OPTIONS: FilterOption[] = [
  { label: "Attacker", value: "attacker", icon: "/UI/Texture/CommonLotteryInfoPanelAtlas/icCharaTypePc.webp" },
  { label: "Protector", value: "protector", icon: "/UI/Texture/CommonLotteryInfoPanelAtlas/icCharaTypeBless.webp" },
]

const ULTIMATE_TYPE_OPTIONS: FilterOption[] = [
  { label: "AoE", value: "aoe", icon: "/UI/Texture/CharaInfoAtlas/icSpTypeAll.webp" },
  { label: "Single", value: "single", icon: "/UI/Texture/CharaInfoAtlas/icSpTypeSingle.webp" },
]

function ToggleFilter({
  title,
  options,
  selectedValues,
  onToggle,
}: {
  title: string
  options: FilterOption[]
  selectedValues: string[]
  onToggle: (value: string) => void
}) {
  const [dropdownSearch, setDropdownSearch] = useState("")
  const visibleOptions = dropdownSearch.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(dropdownSearch.toLowerCase()))
    : options
  return (
    <Popover onOpenChange={() => setDropdownSearch("")}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 justify-between gap-3 rounded-md border-border bg-card px-4 text-foreground hover:border-primary/55 hover:bg-muted">
          <span className="text-sm">{title}</span>
          <Badge variant="secondary" className="ml-1 shrink-0 border-primary/30 bg-primary/15 text-primary">
            {selectedValues.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="character-filter-popover w-72 border-border bg-popover p-0 text-popover-foreground shadow-2xl shadow-black/40" align="start">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-popover-foreground mb-2">{title}</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
            <Input
              placeholder="Search..."
              value={dropdownSearch}
              onChange={(e) => setDropdownSearch(e.target.value)}
              className="h-8 rounded-md border-border bg-background pl-8 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/45"
            />
          </div>
        </div>
        <ScrollArea className="character-filter-scroll h-72 px-4 py-3">
          <div className="space-y-1">
            {visibleOptions.map((option) => {
              const checked = selectedValues.includes(option.value)
              return (
                <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors ${
                  checked ? "bg-primary/15 text-popover-foreground ring-1 ring-primary/30" : "text-popover-foreground/85 hover:bg-accent/25 hover:text-popover-foreground"
                }`}>
                  <Checkbox checked={checked} onCheckedChange={() => onToggle(option.value)} />
                  {option.icon && <img src={option.icon} alt="" className="h-6 w-auto max-w-[80px] shrink-0 object-contain" />}
                  <span>{option.label}</span>
                </label>
              )
            })}
            {visibleOptions.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">No results</p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function IconToggleBar({
  options,
  selectedValues,
  onToggle,
}: {
  options: FilterOption[]
  selectedValues: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isSelected = selectedValues.includes(opt.value)
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            title={opt.label}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
              isSelected ? "border-white/40 bg-white/10 shadow-[0_0_14px_rgba(255,255,255,0.12)]" : "border-white/5 bg-card hover:border-primary/30 hover:bg-muted"
            }`}
          >
            {opt.icon ? (
              <img
                src={opt.icon}
                alt={opt.label}
                className={`h-7 w-7 object-contain transition-opacity ${isSelected ? "opacity-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]" : "opacity-70 hover:opacity-100"}`}
              />
            ) : (
                <span className={`px-1 text-center text-[11px] font-bold leading-tight ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                {opt.label}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function RarityToggleBar({
  selectedValues,
  onToggle,
  onClear,
}: {
  selectedValues: string[]
  onToggle: (value: string) => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className={`h-8 min-w-10 rounded px-2 text-xs transition-colors ${selectedValues.length === 0 ? "bg-primary/15 text-foreground ring-1 ring-primary/40" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}
        onClick={onClear}
        aria-label="All rarities"
      >
        <span className="select-none">All</span>
      </button>
      {RARITY_OPTIONS.map((option) => {
        const isSelected = selectedValues.includes(option.value)
        return (
          <button
            key={option.value}
            onClick={() => onToggle(option.value)}
            title={option.label}
            className={`flex h-8 w-8 items-center justify-center rounded p-0 transition-colors ${isSelected ? "bg-primary/15 ring-1 ring-primary/40" : "bg-transparent hover:bg-accent/50"}`}
          >
            {option.icon && <img src={option.icon} alt={option.label} className="h-5 w-5 object-contain" />}
          </button>
        )
      })}
    </div>
  )
}

// --- Trait helpers ---

type BrowserTrait = BrowserCharacter["traits"][number]

type ValorTraitOption = {
  label: string
  value: string
}

function isValorTrait(trait: { icon_path?: string | null }): boolean {
  return Boolean(trait.icon_path?.includes("ArenaPassiveSkill") || trait.icon_path?.includes("ArenaPassive"))
}

function isInitialConditionTrait(trait: { unlock?: string | null; name?: string | null }): boolean {
  const unlock = normalizeLabel(trait.unlock ?? "")
  const name = normalizeLabel(trait.name ?? "")

  return unlock === "initialconditions" || name.endsWith("initialconditions")
}

function isSelectableValorTrait(trait: BrowserTrait): boolean {
  return isValorTrait(trait) && !isInitialConditionTrait(trait)
}

function cleanValorTraitName(name: string | null | undefined): string {
  const cleaned = (name ?? "")
    .trim()
    .replace(/\s+Initial Conditions\s*$/i, "")
    .trim()

  // Keep the full Valor Trait name. Do not collapse
  // "Soul Combo - Protection DOWN" and "Charge - Protection DOWN"
  // into the same "Protection DOWN" option.
  return cleaned || "Unknown Valor Trait"
}

function getValorTraitValue(trait: BrowserTrait): string | null {
  if (!isSelectableValorTrait(trait)) return null

  const label = cleanValorTraitName(trait.name)
  if (!label) return null

  return `valor_trait:${normalizeLabel(label)}`
}

function getValorTraitLabel(trait: BrowserTrait): string {
  return cleanValorTraitName(trait.name)
}

function getSelectableValorTraits(characters: BrowserCharacter[]): BrowserTrait[] {
  return characters.flatMap((character) =>
    (character.traits ?? []).filter((trait) => isSelectableValorTrait(trait)),
  )
}

function buildValorTraitGroups(characters: BrowserCharacter[]): CharacterEffectFilterGroup[] {
  const valorTraits = getSelectableValorTraits(characters)

  // Keep the old organization/order for the valor traits that already have
  // effect tags, e.g. GAUGE / SOUL BUFF / etc.
  const taggedGroups = getSkillEffectFilterGroups(valorTraits).map((group) => ({
    ...group,
    options: group.options.map((option) => ({
      ...option,
      label: cleanValorTraitName(option.label),
    })),
  }))
  const taggedValues = new Set(taggedGroups.flatMap((group) => group.options.map((option) => option.value)))

  // Add only the Valor Traits that have no visible tag-backed option. This is
  // what makes entries such as "Switch - Skill Seal" appear without turning
  // Initial Conditions into selectable filters.
  const fallbackOptions = new Map<string, ValorTraitOption>()

  for (const trait of valorTraits) {
    const alreadyCoveredByTag = (trait.effect_tags ?? []).some((tag) => taggedValues.has(tag))
    if (alreadyCoveredByTag) continue

    const value = getValorTraitValue(trait)
    if (!value) continue

    fallbackOptions.set(value, {
      value,
      label: getValorTraitLabel(trait),
    })
  }

  if (fallbackOptions.size === 0) {
    return taggedGroups
  }

  return [
    ...taggedGroups,
    {
      key: "valor_trait_other",
      title: "Other",
      options: [...fallbackOptions.values()].sort((left, right) =>
        left.label.localeCompare(right.label),
      ),
    },
  ]
}

function characterMatchesValorTrait(character: BrowserCharacter, selectedValue: string): boolean {
  return (character.traits ?? []).some((trait) => {
    if (!isSelectableValorTrait(trait)) return false

    if ((trait.effect_tags ?? []).includes(selectedValue)) {
      return true
    }

    return getValorTraitValue(trait) === selectedValue
  })
}

function GroupedToggleFilter({
  title,
  groups,
  selectedValues,
  onToggle,
}: {
  title: string
  groups: CharacterEffectFilterGroup[]
  selectedValues: string[]
  onToggle: (value: string) => void
}) {
  const [dropdownSearch, setDropdownSearch] = useState("")
  const query = dropdownSearch.toLowerCase().trim()
  const filteredGroups = query
    ? groups
        .map((g) => ({ ...g, options: g.options.filter((o) => o.label.toLowerCase().includes(query)) }))
        .filter((g) => g.options.length > 0)
    : groups
  return (
    <Popover onOpenChange={() => setDropdownSearch("")}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 justify-between gap-3 rounded-md border-border bg-card px-4 text-foreground hover:border-primary/55 hover:bg-muted">
          <span>{title}</span>
          <Badge variant="secondary" className="border-primary/30 bg-primary/15 text-primary">
            {selectedValues.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="character-filter-popover w-80 border-border bg-popover p-0 text-popover-foreground shadow-2xl shadow-black/40" align="start">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-popover-foreground mb-2">{title}</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
            <Input
              placeholder="Search..."
              value={dropdownSearch}
              onChange={(e) => setDropdownSearch(e.target.value)}
              className="h-8 rounded-md border-border bg-background pl-8 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/45"
            />
          </div>
        </div>
        <ScrollArea className="character-filter-scroll is-grouped h-96">
          <div className="p-0">
            {filteredGroups.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">No results</p>
            )}
            {filteredGroups.map((group) => (
              <div key={group.key} className="border-b border-border last:border-b-0">
                <div className="bg-muted/40 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-muted-foreground">
                  {group.title}
                </div>
                <div className="space-y-3 px-4 py-3">
                  {group.options.map((option) => {
                    const checked = selectedValues.includes(option.value)

                    return (
                      <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors ${checked ? "bg-primary/15 text-popover-foreground ring-1 ring-primary/30" : "text-popover-foreground hover:bg-accent/25"}`}>
                        <Checkbox checked={checked} onCheckedChange={() => onToggle(option.value)} />
                        <span>{option.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

export function CharacterBrowser({
  initialCharacters,
  wikiCharacters,
}: {
  initialCharacters: BrowserCharacter[]
  wikiCharacters: WikiCharacter[]
}) {
  const characters = initialCharacters
  const wikiById = useMemo(() => new Map(wikiCharacters.map((c) => [c.master_pc_id, c])), [wikiCharacters])

  const router = useRouter()
  const [searchText, setSearchText] = useState("")
  const [selectedAttackerElements, setSelectedAttackerElements] = useState<string[]>([])
  const [selectedDefenderElements, setSelectedDefenderElements] = useState<string[]>([])
  const [selectedAttackTypes, setSelectedAttackTypes] = useState<string[]>([])
  const [selectedTactics, setSelectedTactics] = useState<string[]>([])
  const [selectedForces, setSelectedForces] = useState<string[]>([])
  const [selectedSkillFilters, setSelectedSkillFilters] = useState<string[]>([])
  const [selectedTraitNames, setSelectedTraitNames] = useState<string[]>([])
  const [selectedValorTraitNames, setSelectedValorTraitNames] = useState<string[]>([])
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([])
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedUltimateTypes, setSelectedUltimateTypes] = useState<string[]>([])
  const [selectedRarities, setSelectedRarities] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>("release_date")
  const [sortAsc, setSortAsc] = useState(false)
  const [showStats, setShowStats] = useState(true)
  const [viewMode, setViewMode] = useState<CharacterViewMode>("compact")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterStateLoaded, setFilterStateLoaded] = useState(false)
  const [filterMode, setFilterMode] = useState<FilterMode>("AND")
  const [searchSkills, setSearchSkills] = useState(false)
  const [skillCostMin, setSkillCostMin] = useState<number>(SKILL_COST_MIN)
  const [skillCostMax, setSkillCostMax] = useState<number>(SKILL_COST_MAX)
  const deferredSearchText = useDeferredValue(searchText)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const storedState = readCharacterBrowserState()
    const hasQueryState = hasCharacterBrowserQueryState(sp)

    if (storedState) {
      if (typeof storedState.filtersOpen === "boolean") setFiltersOpen(storedState.filtersOpen)
      if (typeof storedState.showStats === "boolean") setShowStats(storedState.showStats)
      if (storedState.viewMode) setViewMode(storedState.viewMode)
      if (storedState.filterMode) setFilterMode(storedState.filterMode)
      if (typeof storedState.searchSkills === "boolean") setSearchSkills(storedState.searchSkills)
    }

    if (hasQueryState) {
      setSearchText(sp.get("tag") ?? "")
      setSelectedAttackerElements(getQueryList(sp, "attacker"))
      setSelectedDefenderElements(getQueryList(sp, "defender"))
      setSelectedAttackTypes(getQueryList(sp, "type"))
      setSelectedTactics(getQueryList(sp, "tactics"))
      setSelectedWeapons(getQueryList(sp, "weapon"))
      setSelectedRoles(getQueryList(sp, "role"))
      setSelectedUltimateTypes(getQueryList(sp, "ulti"))
      setSelectedRarities(getQueryList(sp, "rarity"))
      setSelectedForces(getQueryList(sp, "force"))
      setSelectedFacilities(getQueryList(sp, "facility"))
      setSelectedSkillFilters(getQueryList(sp, "skill"))
      setSelectedTraitNames(getQueryList(sp, "trait"))
      setSelectedValorTraitNames(getQueryList(sp, "valor"))

      const sort = sp.get("sort")
      setSortKey(isSortKey(sort) ? sort : "release_date")
      setSortAsc(sp.get("asc") === "1")

      const mode = sp.get("mode")?.toUpperCase()
      setFilterMode(isFilterMode(mode) ? mode : "AND")
      setSearchSkills(sp.get("skills") === "1")

      // NB: Number(null) === 0 (finite), so guard on the raw string — an
      // absent cmin/cmax must fall back to the full range, not collapse to 0.
      const cMinRaw = sp.get("cmin")
      const cMaxRaw = sp.get("cmax")
      const cMin = cMinRaw == null ? Number.NaN : Number(cMinRaw)
      const cMax = cMaxRaw == null ? Number.NaN : Number(cMaxRaw)
      setSkillCostMin(Number.isFinite(cMin) ? Math.max(SKILL_COST_MIN, Math.min(SKILL_COST_MAX, cMin)) : SKILL_COST_MIN)
      setSkillCostMax(Number.isFinite(cMax) ? Math.max(SKILL_COST_MIN, Math.min(SKILL_COST_MAX, cMax)) : SKILL_COST_MAX)
    } else if (storedState) {
      setSearchText(storedState.searchText ?? "")
      setSelectedAttackerElements(storedState.selectedAttackerElements ?? [])
      setSelectedDefenderElements(storedState.selectedDefenderElements ?? [])
      setSelectedAttackTypes(storedState.selectedAttackTypes ?? [])
      setSelectedTactics(storedState.selectedTactics ?? [])
      setSelectedForces(storedState.selectedForces ?? [])
      setSelectedSkillFilters(storedState.selectedSkillFilters ?? [])
      setSelectedTraitNames(storedState.selectedTraitNames ?? [])
      setSelectedValorTraitNames(storedState.selectedValorTraitNames ?? [])
      setSelectedFacilities(storedState.selectedFacilities ?? [])
      setSelectedWeapons(storedState.selectedWeapons ?? [])
      setSelectedRoles(storedState.selectedRoles ?? [])
      setSelectedUltimateTypes(storedState.selectedUltimateTypes ?? [])
      setSelectedRarities(storedState.selectedRarities ?? [])
      setSortKey(storedState.sortKey ?? "release_date")
      setSortAsc(storedState.sortAsc ?? false)
      if (typeof storedState.skillCostMin === "number") setSkillCostMin(storedState.skillCostMin)
      if (typeof storedState.skillCostMax === "number") setSkillCostMax(storedState.skillCostMax)
    }

    setFilterStateLoaded(true)
  }, [])

  // Sync filter state back to URL so "Back" button restores filters
  useEffect(() => {
    if (!filterStateLoaded) return

    const params = new URLSearchParams()
    if (searchText) params.set("tag", searchText)
    if (selectedAttackerElements.length) params.set("attacker", selectedAttackerElements.join(","))
    if (selectedDefenderElements.length) params.set("defender", selectedDefenderElements.join(","))
    if (selectedAttackTypes.length) params.set("type", selectedAttackTypes.join(","))
    if (selectedTactics.length) params.set("tactics", selectedTactics.join(","))
    if (selectedWeapons.length) params.set("weapon", selectedWeapons.join(","))
    if (selectedRoles.length) params.set("role", selectedRoles.join(","))
    if (selectedUltimateTypes.length) params.set("ulti", selectedUltimateTypes.join(","))
    if (selectedRarities.length) params.set("rarity", selectedRarities.join(","))
    if (selectedForces.length) params.set("force", selectedForces.join(","))
    if (selectedFacilities.length) params.set("facility", selectedFacilities.join(","))
    if (selectedSkillFilters.length) params.set("skill", selectedSkillFilters.join(","))
    if (selectedTraitNames.length) params.set("trait", selectedTraitNames.join(","))
    if (selectedValorTraitNames.length) params.set("valor", selectedValorTraitNames.join(","))
    if (sortKey !== "release_date") params.set("sort", sortKey)
    if (sortAsc) params.set("asc", "1")
    if (skillCostMin > SKILL_COST_MIN) params.set("cmin", String(skillCostMin))
    if (skillCostMax < SKILL_COST_MAX) params.set("cmax", String(skillCostMax))

    const hasDiscreteFilterState =
      selectedAttackerElements.length > 0 ||
      selectedDefenderElements.length > 0 ||
      selectedAttackTypes.length > 0 ||
      selectedTactics.length > 0 ||
      selectedWeapons.length > 0 ||
      selectedRoles.length > 0 ||
      selectedUltimateTypes.length > 0 ||
      selectedRarities.length > 0 ||
      selectedForces.length > 0 ||
      selectedFacilities.length > 0 ||
      selectedSkillFilters.length > 0 ||
      selectedTraitNames.length > 0 ||
      selectedValorTraitNames.length > 0 ||
      skillCostMin > SKILL_COST_MIN ||
      skillCostMax < SKILL_COST_MAX

    if (hasDiscreteFilterState && filterMode !== "AND") params.set("mode", filterMode.toLowerCase())
    if (searchText && searchSkills) params.set("skills", "1")

    const qs = params.toString()
    router.replace(qs ? `/characters?${qs}` : "/characters", { scroll: false })
  }, [filterStateLoaded, router, searchText, selectedAttackerElements, selectedDefenderElements, selectedAttackTypes, selectedTactics, selectedWeapons, selectedRoles, selectedUltimateTypes, selectedRarities, selectedForces, selectedFacilities, selectedSkillFilters, selectedTraitNames, selectedValorTraitNames, sortKey, sortAsc, filterMode, searchSkills, skillCostMin, skillCostMax])

  useEffect(() => {
    if (!filterStateLoaded) return

    const state: CharacterBrowserStoredState = {
      filtersOpen,
      searchText,
      selectedAttackerElements,
      selectedDefenderElements,
      selectedAttackTypes,
      selectedTactics,
      selectedForces,
      selectedSkillFilters,
      selectedTraitNames,
      selectedValorTraitNames,
      selectedFacilities,
      selectedWeapons,
      selectedRoles,
      selectedUltimateTypes,
      selectedRarities,
      sortKey,
      sortAsc,
      showStats,
      viewMode,
      filterMode,
      searchSkills,
      skillCostMin,
      skillCostMax,
    }

    try {
      window.localStorage.setItem(CHARACTER_BROWSER_STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore storage errors so private-mode/quota restrictions don't break browsing.
    }
  }, [filterStateLoaded, filtersOpen, searchText, selectedAttackerElements, selectedDefenderElements, selectedAttackTypes, selectedTactics, selectedForces, selectedSkillFilters, selectedTraitNames, selectedValorTraitNames, selectedFacilities, selectedWeapons, selectedRoles, selectedUltimateTypes, selectedRarities, sortKey, sortAsc, showStats, viewMode, filterMode, searchSkills, skillCostMin, skillCostMax])

  const [options, setOptions] = useState<CharacterBrowserOptions>(EMPTY_OPTIONS)
  useEffect(() => {
    const id = setTimeout(() => setOptions(buildAllOptions(characters, wikiCharacters)), 0)
    return () => clearTimeout(id)
  }, [characters, wikiCharacters])

  const filteredCharacters = useMemo(() => {
    if (!Array.isArray(characters)) return []

    const query = normalizeLabel(deferredSearchText)
    const isAND = filterMode === "AND"

    const result = characters.filter((character) => {
      const characterForceNames = character.force_names

      // ─────────────────────────────
      // TEXT FILTER
      // ─────────────────────────────
      if (query) {
        if (searchSkills) {
          const skillMatch = character.skills.some(
            (s) =>
              s.slot !== "special_skill" &&
              normalizeLabel(s.description_max_level).includes(query)
          )
          if (!skillMatch) return false
        } else {
          const nameMatch =
            normalizeLabel(character.name).includes(query) ||
            normalizeLabel(character.affiliation_name).includes(query)

          if (!nameMatch) return false
        }
      }

      // ─────────────────────────────
      // ROLE
      // ─────────────────────────────
      const role = isProtectorCharacter(character)
        ? "protector"
        : isAttackerCharacter(character)
          ? "attacker"
          : null

      if (selectedRoles.length) {
        if (!role || !selectedRoles.includes(role)) return false
      }

      // ─────────────────────────────
      // RARITY
      // ─────────────────────────────
      const rarityOk =
        selectedRarities.length === 0 ||
        selectedRarities.includes(String(getCharacterVisualTier(character)))

      if (!rarityOk) return false

      const ultimateTypeOk =
        selectedUltimateTypes.length === 0 ||
        (isAND
          ? selectedUltimateTypes.every((v) =>
              getCharacterUltimateType(character) === v
            )
          : selectedUltimateTypes.some((v) =>
              getCharacterUltimateType(character) === v
            ))

      if (!ultimateTypeOk) return false

      // ─────────────────────────────
      // ELEMENTS
      // ─────────────────────────────
      const elementOk =
        selectedAttackerElements.length === 0 &&
        selectedDefenderElements.length === 0
          ? true
          : (() => {
              // ─────────────────────────────
              // HARD ROLE SCOPING
              // ─────────────────────────────
              if (selectedAttackerElements.length && !isAttackerCharacter(character)) {
                return false
              }

              if (selectedDefenderElements.length && !isProtectorCharacter(character)) {
                return false
              }

              // ─────────────────────────────
              // ATTACKER ELEMENTS (single value)
              // ─────────────────────────────
              if (isAttackerCharacter(character)) {
                const el = getCharacterElementValue(character)

                return selectedAttackerElements.length
                  ? selectedAttackerElements.includes(el)
                  : true
              }

              // ─────────────────────────────
              // PROTECTOR ELEMENTS (MULTI + AND/OR SUPPORT)
              // ─────────────────────────────
              if (isProtectorCharacter(character)) {
                const els = getDefenderElementValues(character)

                if (!selectedDefenderElements.length) return true

                // AND logic: all selected must exist in character
                if (isAND) {
                  return selectedDefenderElements.every((e) =>
                    els.includes(e)
                  )
                }

                // OR logic: any match
                return selectedDefenderElements.some((e) =>
                  els.includes(e)
                )
              }

              return false
            })()

      if (!elementOk) return false

      // ─────────────────────────────
      // WEAPONS
      // ─────────────────────────────
      const weaponOk =
        selectedWeapons.length === 0 ||
        selectedWeapons.includes(normalizeLabel(character.weapon_type))

      if (!weaponOk) return false

      // ─────────────────────────────
      // ATTACK TYPE
      // ─────────────────────────────
      const attackOk =
        selectedAttackTypes.length === 0 ||
        selectedAttackTypes.includes(normalizeLabel(character.attack_type))

      if (!attackOk) return false

      // ─────────────────────────────
      // GROUP FILTERS (AND / OR)
      // ─────────────────────────────

      const tacticsOk =
        selectedTactics.length === 0 ||
        (isAND
          ? selectedTactics.every(
              (v) => normalizeLabel(character.tactics_type) === v
            )
          : selectedTactics.some(
              (v) => normalizeLabel(character.tactics_type) === v
            ))

      if (!tacticsOk) return false

      const forcesOk =
        selectedForces.length === 0 ||
        (isAND
          ? selectedForces.every((v) =>
              characterForceNames.includes(v)
            )
          : selectedForces.some((v) =>
              characterForceNames.includes(v)
            ))

      if (!forcesOk) return false

      const facilityOk =
        selectedFacilities.length === 0 ||
        (isAND
          ? selectedFacilities.every((v) =>
              character.facilities.includes(v)
            )
          : selectedFacilities.some((v) =>
              character.facilities.includes(v)
            ))

      if (!facilityOk) return false

      const traitOk =
        selectedTraitNames.length === 0 ||
        (isAND
          ? selectedTraitNames.every((v) =>
              character.traits.some(
                (trait) =>
                  !isValorTrait(trait) &&
                  trait.effect_tags?.includes(v)
              )
            )
          : selectedTraitNames.some((v) =>
              character.traits.some(
                (trait) =>
                  !isValorTrait(trait) &&
                  trait.effect_tags?.includes(v)
              )
            ))

      if (!traitOk) return false

      const valorTraitOk =
        selectedValorTraitNames.length === 0 ||
        (isAND
          ? selectedValorTraitNames.every((v) =>
              characterMatchesValorTrait(character, v)
            )
          : selectedValorTraitNames.some((v) =>
              characterMatchesValorTrait(character, v)
            ))

      if (!valorTraitOk) return false

      // Combined skill filter: when a cost range is active alongside the
      // effect filters, the SAME skill must satisfy both. When only one is
      // active, the unused side is a no-op.
      const costFilterActive = skillCostMin > SKILL_COST_MIN || skillCostMax < SKILL_COST_MAX
      const characterSkills = wikiById.get(character.master_pc_id)?.skills ?? []
      const skillPasses = (s: typeof characterSkills[number], v: string | null) => {
        const effectsOk = v === null || skillMatchesEffectFilters(s, [v])
        const costOk = !costFilterActive || skillCostInRange(s.cost, skillCostMin, skillCostMax)
        return effectsOk && costOk
      }

      let skillOk: boolean
      if (selectedSkillFilters.length === 0) {
        // Cost-only filter (or neither): at least one skill must pass.
        skillOk = !costFilterActive || characterSkills.some((s) => skillPasses(s, null))
      } else {
        skillOk = isAND
          ? selectedSkillFilters.every((v) => characterSkills.some((s) => skillPasses(s, v)))
          : selectedSkillFilters.some((v) => characterSkills.some((s) => skillPasses(s, v)))
      }

      if (!skillOk) return false

      return true
    })

    // ─────────────────────────────
    // SORTING
    // ─────────────────────────────
    const dir = sortAsc ? -1 : 1

    const maxSkillCost = (c: BrowserCharacter): number => {
      const skills = wikiById.get(c.master_pc_id)?.skills ?? []
      let max = -1
      for (const s of skills) {
        if (typeof s.cost === "number" && s.cost > max) max = s.cost
      }
      return max
    }

    return result.sort((left, right) => {
      switch (sortKey) {
        case "attack":
          return dir * (right.stats.attack - left.stats.attack)
        case "hp":
          return dir * (right.stats.hp - left.stats.hp)
        case "defense":
          return dir * (right.stats.defense - left.stats.defense)
        case "existence":
          return dir * (right.stats.existence - left.stats.existence)
        case "skill_cost":
          return (
            dir * (maxSkillCost(right) - maxSkillCost(left)) ||
            left.name.localeCompare(right.name)
          )
        case "rarity":
          return (
            dir *
            (getCharacterVisualTier(right) -
              getCharacterVisualTier(left) ||
              right.stats.existence - left.stats.existence)
          )
        case "release_date": {
          const l = left.release_date ?? ""
          const r = right.release_date ?? ""

          if (!l && !r) return dir * left.name.localeCompare(right.name)
          if (!l) return 1
          if (!r) return -1

          return dir * r.localeCompare(l)
        }
        case "name":
        default:
          return dir * left.name.localeCompare(right.name)
      }
    })
  }, [
    characters,
    deferredSearchText,
    filterMode,
    searchSkills,
    selectedAttackTypes,
    selectedAttackerElements,
    selectedDefenderElements,
    selectedFacilities,
    selectedForces,
    selectedSkillFilters,
    selectedTactics,
    selectedTraitNames,
    selectedValorTraitNames,
    selectedWeapons,
    selectedRoles,
    selectedRarities,
    sortAsc,
    sortKey,
    skillCostMin,
    skillCostMax,
    wikiById,
  ])

  const skillCostFilterActive = skillCostMin > SKILL_COST_MIN || skillCostMax < SKILL_COST_MAX
  const activeFilterCount =
    selectedAttackerElements.length +
    selectedDefenderElements.length +
    selectedAttackTypes.length +
    selectedWeapons.length +
    selectedTactics.length +
    selectedForces.length +
    selectedSkillFilters.length +
    selectedTraitNames.length +
    selectedValorTraitNames.length +
    selectedFacilities.length +
    selectedRoles.length +
    selectedUltimateTypes.length +
    selectedRarities.length +
    (skillCostFilterActive ? 1 : 0)

  const skillFilterLabelMap = useMemo(() => {
    const map = new Map<string, { groupTitle: string; label: string }>()
    for (const group of options.skillGroups) {
      for (const opt of group.options) {
        map.set(opt.value, { groupTitle: group.title, label: opt.label })
      }
    }
    return map
  }, [options.skillGroups])

  const traitFilterLabelMap = useMemo(() => {
    const map = new Map<string, { groupTitle: string; label: string }>()
    for (const group of options.traitGroups) {
      for (const opt of group.options) {
        map.set(opt.value, { groupTitle: group.title, label: opt.label })
      }
    }
    return map
  }, [options.traitGroups])

  const valorTraitFilterLabelMap = useMemo(() => {
    const map = new Map<string, { groupTitle: string; label: string }>()
    for (const group of options.valorTraitGroups) {
      for (const opt of group.options) {
        map.set(opt.value, { groupTitle: group.title, label: opt.label })
      }
    }
    return map
  }, [options.valorTraitGroups])

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; category: string; label: string; icon?: string; remove: () => void }[] = []
    for (const v of selectedAttackerElements) {
      const opt = options.attackerElements.find((o) => o.value === v)
      chips.push({ key: `ae:${v}`, category: "Attacker", label: opt?.label ?? v, icon: opt?.icon, remove: () => setSelectedAttackerElements((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedDefenderElements) {
      const opt = options.defenderElements.find((o) => o.value === v)
      chips.push({ key: `de:${v}`, category: "Protector", label: opt?.label ?? v, icon: opt?.icon, remove: () => setSelectedDefenderElements((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedAttackTypes) {
      const opt = options.attackTypes.find((o) => o.value === v)
      chips.push({ key: `at:${v}`, category: "Attack Type", label: opt?.label ?? v, icon: opt?.icon, remove: () => setSelectedAttackTypes((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedWeapons) {
      const opt = options.weapons.find((o) => o.value === v)
      chips.push({ key: `wp:${v}`, category: "Weapon", label: opt?.label ?? v, icon: opt?.icon, remove: () => setSelectedWeapons((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedTactics) {
      const opt = options.tactics.find((o) => o.value === v)
      chips.push({ key: `tc:${v}`, category: "Tactics", label: opt?.label ?? v, icon: opt?.icon, remove: () => setSelectedTactics((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedRoles) {
      const opt = ROLE_OPTIONS.find((o) => o.value === v)
      chips.push({ key: `ro:${v}`, category: "Role", label: opt?.label ?? v, icon: opt?.icon, remove: () => setSelectedRoles((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedUltimateTypes) {
      const opt = ULTIMATE_TYPE_OPTIONS.find((o) => o.value === v)
      chips.push({ key: `ut:${v}`, category: "Ultimate", label: opt?.label ?? v, icon: opt?.icon, remove: () => setSelectedUltimateTypes((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedRarities) {
      const opt = RARITY_OPTIONS.find((o) => o.value === v)
      chips.push({ key: `ra:${v}`, category: "Rarity", label: opt?.label ?? v, icon: opt?.icon, remove: () => setSelectedRarities((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedForces) {
      const opt = options.forces.find((o) => o.value === v)
      chips.push({ key: `fo:${v}`, category: "Force", label: v, icon: opt?.icon, remove: () => setSelectedForces((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedFacilities) {
      chips.push({ key: `fa:${v}`, category: "Facility", label: v, remove: () => setSelectedFacilities((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedTraitNames) {
      const info = traitFilterLabelMap.get(v)
      chips.push({ key: `tr:${v}`, category: "Trait", label: info ? `${info.groupTitle} - ${info.label}` : v, remove: () => setSelectedTraitNames((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedValorTraitNames) {
      const info = valorTraitFilterLabelMap.get(v)
      chips.push({ key: `vt:${v}`, category: "Valor Trait", label: info ? `${info.groupTitle} - ${info.label}` : v, remove: () => setSelectedValorTraitNames((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedSkillFilters) {
      const info = skillFilterLabelMap.get(v)
      chips.push({ key: `sk:${v}`, category: "Skills", label: info ? `${info.groupTitle} - ${info.label}` : v, remove: () => setSelectedSkillFilters((prev) => prev.filter((x) => x !== v)) })
    }
    return chips
  }, [selectedAttackerElements, selectedDefenderElements, selectedAttackTypes, selectedWeapons, selectedTactics, selectedRoles, selectedUltimateTypes, selectedRarities, selectedForces, selectedFacilities, selectedTraitNames, selectedValorTraitNames, selectedSkillFilters, options, skillFilterLabelMap, traitFilterLabelMap, valorTraitFilterLabelMap])

  // Virtualization settings
  const gridRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  useLayoutEffect(() => {
    if (!gridRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(gridRef.current)
    // initial measurement
    setContainerWidth(gridRef.current.clientWidth)
    return () => ro.disconnect()
  // Re-run when the filtered list changes so the observer re-attaches
  // after the grid mounts/unmounts (fixes layout when toggling empty filters).
  }, [filteredCharacters.length])

  const DEFAULT_GAP = 6
  const MOBILE_GAP = 8
  const GAP = containerWidth && containerWidth < 640 ? MOBILE_GAP : DEFAULT_GAP
  const DESIRED_CARD_WIDTH = 320
  const DETAIL_CARD_ASPECT = 1544 / 1010
  const GRID_SCROLLBAR_RESERVE = containerWidth && containerWidth < 640 ? 12 : 18
  const gridContentWidth = containerWidth ? Math.max(0, containerWidth - GRID_SCROLLBAR_RESERVE) : 0

  const computedColumnCount = containerWidth
    ? containerWidth >= 980
      ? 3
      : containerWidth >= 640
      ? 2
      : 1
    : 1

  // Treat narrow containers as mobile so layout responds to viewport width.
  const IS_MOBILE = !!(containerWidth && containerWidth < 640)
  const columnCount = IS_MOBILE ? 1 : computedColumnCount

  const [viewportHeight, setViewportHeight] = useState(720)
  useEffect(() => {
    function syncViewportHeight() {
      setViewportHeight(window.innerHeight || 720)
    }

    syncViewportHeight()
    window.addEventListener("resize", syncViewportHeight)
    return () => window.removeEventListener("resize", syncViewportHeight)
  }, [])

  const renderedCharacterCount = filteredCharacters.length
  const columnWidth = gridContentWidth ? gridContentWidth / columnCount : DESIRED_CARD_WIDTH + GAP
  const cardWidth = Math.max(0, columnWidth - GAP)
  const CARD_HEIGHT = Math.max(IS_MOBILE ? 250 : 220, Math.round(cardWidth / DETAIL_CARD_ASPECT))
  const rowCount = Math.ceil(renderedCharacterCount / columnCount)
  // Add vertical gap to row height so spacing between rows is uniform on mobile
  const ROW_HEIGHT = CARD_HEIGHT + GAP
  const gridHeight = rowCount * ROW_HEIGHT + 10
  const galleryChromeReserve = IS_MOBILE ? 520 : 640
  const availableGalleryHeight = Math.max(0, viewportHeight - galleryChromeReserve)
  // Desktop always shows up to 2 card rows in the gallery viewport. Previously
  // this was height-gated (floor((innerHeight - 640) / rowHeight)), which
  // collapsed to a single row on 1080p-tall screens even though 2 rows fit the
  // design intent — a long-standing bug. Mobile keeps the height-gated count.
  const cardVisibleRows = IS_MOBILE
    ? Math.max(1, Math.min(2, Math.floor(availableGalleryHeight / ROW_HEIGHT)))
    : Math.min(2, Math.max(1, rowCount))
  const cardViewportHeight = Math.min(gridHeight, ROW_HEIGHT * cardVisibleRows)

  // For VariableSizeGrid, must provide functions
  const getColumnWidth = () => columnWidth
  const getRowHeight = () => ROW_HEIGHT

  // Compact grid sizing (mirrors the responsive CSS grid breakpoints)
  const COMPACT_GAP = 10
  const compactColumnCount = !containerWidth ? 12
    : containerWidth >= 1100 ? 12
    : containerWidth >= 1024 ? 10
    : containerWidth >= 768 ? 8
    : containerWidth >= 640 ? 6
    : 4
  const compactCellWidth = gridContentWidth ? gridContentWidth / compactColumnCount : 80
  const compactCellHeight = compactCellWidth + COMPACT_GAP
  const compactRowCount = Math.ceil(renderedCharacterCount / compactColumnCount)
  const compactGridHeight = compactRowCount * compactCellHeight + 10
  const compactVisibleRows = Math.max(
    IS_MOBILE ? 3 : 3,
    Math.min(IS_MOBILE ? 4 : 4, Math.floor(availableGalleryHeight / compactCellHeight)),
  )
  const compactViewportHeight = Math.min(compactGridHeight, compactCellHeight * compactVisibleRows)
  const compactTileClass = "character-photo-tile group relative w-full overflow-hidden rounded-md pt-[100%] transition-all duration-200"

  function CompactCard({ character, index }: { character: BrowserCharacter; index: number }) {
    const visualTier = getCharacterVisualTier(character)
    const frameSrc = getCharacterFrame(character)
    const baseSrc = getCharacterBase(character)
    const starsSrc = starAssetMap[visualTier] ?? starAssetMap[5]
    const iconSrc = character.images.icon?.replace(/\.webp$/i, ".webp")
    const elementIcons = getCharacterElementIcons(character)
    const attackTypeIcon = attackTypeIconMap[normalizeLabel(character.attack_type)]
    const attackTypeLabel = formatWikiLabel(character.attack_type)
    const isPriority = index < 6
    const imageLoading = isPriority ? "eager" : "lazy"
    // Same firstIcon/secondIcon logic as forces page:
    // attackers → element + attack type; protectors → up to two element icons
    let firstIcon: string | undefined
    let secondIcon: string | undefined
    if (isAttackerCharacter(character)) {
      firstIcon = elementIcons[0]?.icon
      secondIcon = attackTypeIcon
    } else {
      firstIcon = elementIcons[0]?.icon
      secondIcon = elementIcons[1]?.icon
    }

    return (
      <Link href={`/characters/${character.master_pc_id}`} prefetch={false} className="min-w-0">
        <div className={compactTileClass}>
          {visualTier >= 8
            ? <div className="character-native-base-wrap absolute inset-[7%]"><img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="character-native-base h-full w-full object-fill pointer-events-none" /></div>
            : <img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="character-native-base absolute inset-0 h-full w-full object-fill pointer-events-none" />}
          <div className="character-native-portrait absolute inset-[4%] overflow-hidden rounded-[6%]">
            <img src={iconSrc} alt={character.name} loading={imageLoading} decoding="async" fetchPriority={index < 3 ? "high" : "low"} className="h-full w-full object-cover object-top" />
          </div>
          <img src={frameSrc} alt="" loading={imageLoading} decoding="async" className="character-native-frame absolute inset-0 w-full h-full object-fill pointer-events-none" />
          {/* Name top-left */}
          <div className="character-card-name-label absolute top-1 left-1 z-10 max-w-[72%] rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-tight backdrop-blur-sm line-clamp-2">
            {character.name}
          </div>
          {/* Stars bottom-left */}
          <img src={starsSrc} alt="" loading="lazy" decoding="async" className="absolute bottom-1 left-1 h-5 object-contain z-10" />
          {/* Icons top-right */}
          {(firstIcon || secondIcon) && (
            <div className="absolute top-1 right-1 z-20 flex flex-col items-end gap-0.5">
              {firstIcon && <img src={firstIcon} alt="" className={`${isAttackerCharacter(character) ? "w-6 h-6" : "w-6 h-6"} object-contain`} />}
              {secondIcon && <img src={secondIcon} alt={attackTypeLabel} className={`${isAttackerCharacter(character) ? "w-6 h-6" : "w-6 h-6"} object-contain`} />}
            </div>
          )}
        </div>
      </Link>
    )
  }

  function CompactGridCell({ ariaAttributes, columnIndex, rowIndex, style }: CellComponentProps) {
    const index = rowIndex * compactColumnCount + columnIndex
    if (index >= renderedCharacterCount) return null
    const character = filteredCharacters[index]
    const visualTier = getCharacterVisualTier(character)
    const frameSrc = getCharacterFrame(character)
    const baseSrc = getCharacterBase(character)
    const starsSrc = starAssetMap[visualTier] ?? starAssetMap[5]
    const iconSrc = character.images.icon?.replace(/\.webp$/i, ".webp")
    const elementIcons = getCharacterElementIcons(character)
    const attackTypeIcon = attackTypeIconMap[normalizeLabel(character.attack_type)]
    const attackTypeLabel = formatWikiLabel(character.attack_type)
    const isPriority = index < 24
    const imageLoading = isPriority ? "eager" : "lazy"
    let firstIcon: string | undefined
    let secondIcon: string | undefined
    if (isAttackerCharacter(character)) {
      firstIcon = elementIcons[0]?.icon
      secondIcon = attackTypeIcon
    } else {
      firstIcon = elementIcons[0]?.icon
      secondIcon = elementIcons[1]?.icon
    }
    const rawLeft = (style as any).left ?? 0
    const rawWidth = (style as any).width ?? compactCellWidth
    const adjustedLeft = rawLeft + COMPACT_GAP / 2
    const adjustedWidth = Math.max(0, rawWidth - COMPACT_GAP)
    const adjustedStyle = { ...style, left: adjustedLeft, width: adjustedWidth }
    return (
      <div style={adjustedStyle} aria-colindex={ariaAttributes?.["aria-colindex"]} role={ariaAttributes?.role}>
        {/* paddingBottom creates the row gap; pt-[100%] maintains a 1:1 square aspect ratio */}
        <div style={{ paddingBottom: COMPACT_GAP }}>
          <Link href={`/characters/${character.master_pc_id}`} prefetch={false} className="block w-full min-w-0">
            <div className={compactTileClass}>
              <div className="absolute inset-0">
                {visualTier >= 8
                  ? <div className="character-native-base-wrap absolute inset-[7%]"><img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="character-native-base h-full w-full object-fill pointer-events-none" /></div>
                  : <img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="character-native-base absolute inset-0 h-full w-full object-fill pointer-events-none" />}
                <div className="character-native-portrait absolute inset-[4%] overflow-hidden rounded-[6%]">
                  <img src={iconSrc} alt={character.name} loading={imageLoading} decoding="async" fetchPriority={index < 3 ? "high" : "low"} className="h-full w-full object-cover object-top" />
                </div>
              </div>
              <img src={frameSrc} alt="" loading={imageLoading} decoding="async" className="character-native-frame absolute inset-0 w-full h-full object-fill pointer-events-none" />
              <div className="character-card-name-label absolute top-1 left-1 z-10 max-w-[72%] rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-tight backdrop-blur-sm line-clamp-2">
                {character.name}
              </div>
              <img src={starsSrc} alt="" loading="lazy" decoding="async" className="absolute bottom-1 left-1 h-5 object-contain z-10" />
              {(firstIcon || secondIcon) && (
                <div className="absolute top-1 right-1 z-20 flex flex-col items-end gap-0.5">
                  {firstIcon && <img src={firstIcon} alt="" className={`${isAttackerCharacter(character) ? "w-6 h-6" : "w-6 h-6"} object-contain`} />}
                  {secondIcon && <img src={secondIcon} alt={attackTypeLabel} className={`${isAttackerCharacter(character) ? "w-6 h-6" : "w-6 h-6"} object-contain`} />}
                </div>
              )}
            </div>
          </Link>
        </div>
      </div>
    )
  }

  function CharacterCardSurface({ character, index, fill = false }: { character: BrowserCharacter; index: number; fill?: boolean }) {
    const visualTier = getCharacterVisualTier(character)
    const frameSrc = getCharacterFrame(character)
    const baseSrc = getCharacterBase(character)
    const starsSrc = starAssetMap[visualTier] ?? starAssetMap[5]
    const iconSrc = character.images.icon?.replace(/\.webp$/i, ".webp")
    const characterElementValue = getCharacterElementValue(character)
    const elementIcons = getCharacterElementIcons(character)
    const forceEntries = character.force_entries
    const attackTypeIcon = attackTypeIconMap[normalizeLabel(character.attack_type)]
    const weaponIcon = weaponIconMap[normalizeLabel(character.weapon_type)]
    const tacticsIcon = tacticsIconMap[normalizeLabel(character.tactics_type || "Normal")]
    const attackTypeLabel = formatWikiLabel(character.attack_type)
    const weaponLabel = formatWikiLabel(character.weapon_type)
    const tacticsLabel = character.tactics_type || "Normal"
    const rarityLabel = getCharacterRarityLabel(character)
    const isPriorityCard = index < 6
    const imageLoading = isPriorityCard ? "eager" : "lazy"
    const elementAccentColor = elementColorMap[normalizeLabel(characterElementValue)] ?? "#ff2f5f"
    const facilityIcons = [
      ...new Set(character.facilities.map((f) => f.replace(/ \+\d+%$/, "").trim())),
    ]
      .map((name) => ({ name, icon: facilityIconMap[name] }))
      .filter((entry) => entry.icon)
      .slice(0, 3)

    return (
      <Link href={`/characters/${character.master_pc_id}`} prefetch={false} className={`block w-full min-w-0 ${fill ? "h-full" : ""}`}>
        <div
          className={`character-list-card character-bio-poster group relative w-full min-w-0 overflow-hidden rounded-2xl bg-card transition-all duration-200 hover:-translate-y-0.5 ${fill ? "h-full" : showStats ? "min-h-[300px]" : "min-h-[230px]"}`}
          style={{
            boxShadow: "0 16px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
            contentVisibility: "auto",
            containIntrinsicSize: `${CARD_HEIGHT}px`,
          }}
        >
          {/* Element accent bar on the left edge */}
          <div
            className="character-card-element-accent pointer-events-none absolute inset-y-0 left-0 w-[3px]"
            style={{ background: `linear-gradient(180deg, ${elementAccentColor} 0%, ${colorWithAlpha(elementAccentColor, 0.25)} 100%)` }}
          />
          {/* Top accent line revealed on hover */}
          <div
            className="character-card-hover-line pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: `linear-gradient(90deg, transparent, ${elementAccentColor}, transparent)` }}
          />
          {/* Subtle ambient glow keyed to element */}
          <div
            className="character-card-glow pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full blur-3xl opacity-[0.12] transition-opacity duration-300 group-hover:opacity-25"
            style={{ backgroundColor: elementAccentColor }}
          />

          <div className="relative flex h-full flex-col p-4 pl-5 sm:p-5 sm:pl-6">
            {/* Header: portrait + identity (with meta icons inline under the stars) */}
            <div className="character-card-header flex items-start gap-4">
              <div className="character-card-portrait relative h-[100px] w-[100px] shrink-0">
                {visualTier >= 8
                  ? <div className="absolute inset-[7%]"><img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="h-full w-full object-fill pointer-events-none" /></div>
                  : <img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />}
                <div className="absolute inset-[4%] overflow-hidden rounded-[6%]">
                  <img src={iconSrc} alt={character.name} loading={imageLoading} decoding="async" fetchPriority={isPriorityCard ? "high" : "low"} className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
                </div>
                <img src={frameSrc} alt="" loading={imageLoading} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-fill" />
                <img src={starsSrc} alt={rarityLabel} loading={imageLoading} decoding="async" className="character-card-rarity-stars pointer-events-none absolute bottom-1 left-1 z-10 h-5 w-fit object-contain" />
              </div>

              <div className="character-card-identity flex min-w-0 flex-1 flex-col">
                <h2 className="line-clamp-2 text-[1.55rem] font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-[1.7rem]">
                  {character.name}
                </h2>
                <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                  {character.affiliation_name}
                </p>

                {/* Meta strip: tactics pill + element/type/weapon + facilities */}
                <div className="character-card-meta mt-2 flex flex-wrap items-center gap-1.5">
                  {tacticsIcon && (
                    <img
                      src={tacticsIcon}
                      alt={tacticsLabel}
                      title={tacticsLabel}
                      className="h-6 w-auto max-w-[78px] shrink-0 object-contain drop-shadow"
                    />
                  )}
                  {elementIcons.map((entry) => (
                    <span key={entry.icon} className="grid h-6 w-6 place-items-center rounded bg-white/[0.04] ring-1 ring-white/[0.06]" title={entry.label}>
                      <img src={entry.icon} alt={entry.label} className="h-[18px] w-[18px] object-contain" />
                    </span>
                  ))}
                  {attackTypeIcon && (
                    <span className="grid h-6 w-6 place-items-center rounded bg-white/[0.04] ring-1 ring-white/[0.06]" title={attackTypeLabel}>
                      <img src={attackTypeIcon} alt={attackTypeLabel} className="h-[18px] w-[18px] object-contain" />
                    </span>
                  )}
                  {weaponIcon && (
                    <span className="grid h-6 w-6 place-items-center rounded bg-white/[0.04] ring-1 ring-white/[0.06]" title={weaponLabel}>
                      <img src={weaponIcon} alt={weaponLabel} className="h-[18px] w-[18px] object-contain" />
                    </span>
                  )}
                  {facilityIcons.length > 0 && <span className="mx-0.5 h-4 w-px bg-white/10" />}
                  {facilityIcons.map(({ name, icon }) => (
                    <span key={name} className="grid h-6 w-6 place-items-center rounded bg-white/[0.04] ring-1 ring-white/[0.06]" title={name}>
                      <img src={icon} alt={name} className="h-[18px] w-[18px] object-contain" />
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats: connected bar with dividers */}
            {showStats && (
              <div className="character-card-stats mt-3 grid grid-cols-4 overflow-hidden rounded-lg border border-border bg-background">
                <StatPill label="HP" value={character.stats.hp} />
                <StatPill label="ATK" value={character.stats.attack} accent />
                <StatPill label="DEF" value={character.stats.defense} />
                <StatPill label="EXI" value={character.stats.existence} accent />
              </div>
            )}

            {/* Forces */}
            {forceEntries.length > 0 && (
              <div className="character-card-forces mt-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-muted-foreground">Forces</span>
                  <span className="h-px flex-1 bg-accent/30" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {forceEntries.slice(0, 3).map((force) => (
                    <span
                      key={force.name}
                      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      {force.icon && <img src={force.icon} alt="" className="h-4 w-4 shrink-0 object-contain" />}
                      <span className="truncate">{force.name}</span>
                    </span>
                  ))}
                  {forceEntries.length > 3 && (
                    <span className="inline-flex items-center rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[11px] text-muted-foreground">
                      +{forceEntries.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Link>
    )
  }

  function StatPill({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
    return (
      <div className="character-stat-pill border-r border-white/5 px-2 py-2.5 text-center last:border-r-0">
        <p className={`text-[9px] font-bold uppercase tracking-[0.22em] ${accent ? "text-primary" : "text-muted-foreground"}`}>{label}</p>
        <p className="mt-1 text-[0.95rem] font-black leading-none text-foreground">{value.toLocaleString()}</p>
      </div>
    )
  }

  // Grid cell component for react-window `Grid` (typed as CellComponentProps)
  function GridCell({ ariaAttributes, columnIndex, rowIndex, style }: CellComponentProps) {
    const index = rowIndex * columnCount + columnIndex
    if (index >= renderedCharacterCount) return null
    const character = filteredCharacters[index]
    const rawLeft = (style as any).left ?? 0
    const rawWidth = (style as any).width ?? columnWidth
    const adjustedLeft = rawLeft + GAP / 2
    const adjustedWidth = Math.max(0, rawWidth - GAP)
    const adjustedStyle = { ...style, left: adjustedLeft, width: adjustedWidth }

    return (
      <div style={adjustedStyle} key={character.master_pc_id} aria-colindex={ariaAttributes?.["aria-colindex"]} role={ariaAttributes?.role}>
        <div
          style={{
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            paddingLeft: GAP / 2,
            paddingRight: GAP / 2,
            paddingBottom: GAP,
          }}
        >
          <CharacterCardSurface character={character} index={index} fill />
        </div>
      </div>
    )
  }

  function resetFilters() {
    setSearchText("")
    setSelectedAttackerElements([])
    setSelectedDefenderElements([])
    setSelectedAttackTypes([])
    setSelectedTactics([])
    setSelectedForces([])
    setSelectedSkillFilters([])
    setSelectedTraitNames([])
    setSelectedValorTraitNames([])
    setSelectedFacilities([])
    setSelectedWeapons([])
    setSelectedRoles([])
    setSelectedUltimateTypes([])
    setSelectedRarities([])
    setSortKey("release_date")
    setSortAsc(false)
    setFilterMode("OR")
    setSkillCostMin(SKILL_COST_MIN)
    setSkillCostMax(SKILL_COST_MAX)
  }

  function toggleValue(values: string[], setter: (next: string[]) => void, value: string) {
    setter(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value])
  }

  return (
    <main className="site-page slime-page-characters characters-beach-scene px-4 py-8 text-foreground sm:px-6">
      <style jsx global>{`
        .hide-scrollbar {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
          -webkit-overflow-scrolling: touch;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none; /* Safari and Chrome */
          width: 0; height: 0;
        }

        /* Keep the thin .image-scroll scrollbar visible on small screens */
      `}</style>
      <div className="characters-page-layout mx-auto flex max-w-7xl flex-col gap-7">
        <div className="characters-header-row">
          <div className="characters-title-poster">
            <h1 className="text-4xl font-extrabold italic tracking-normal text-foreground sm:text-5xl">Characters</h1>
          </div>
          <div className="characters-search-sort-panel">
            <div className={`characters-search-row ${filtersOpen ? "is-filtering" : ""} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
              <div className="characters-search-note relative w-full lg:max-w-xl flex items-center">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search characters" className="h-12 flex-1 rounded-full border-border bg-background pl-11 pr-16 text-foreground shadow-inner shadow-white/[0.02] placeholder:text-muted-foreground focus-visible:ring-[#ff2f5f]/40" />
                {/* Skills toggle embedded at right of search bar */}
                <button
                  onClick={() => setSearchSkills((prev) => !prev)}
                  title={searchSkills ? "Also searching skill names & descriptions" : "Click to also search skill names & descriptions"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold transition-all select-none sm:px-3"
                  style={searchSkills
                    ? { background: "linear-gradient(135deg,rgba(255,47,95,0.28),rgba(255,47,95,0.12))", color: "#ffffff", boxShadow: "0 0 12px rgba(255,47,95,0.28)", border: "1px solid rgba(255,47,95,0.42)" }
                    : { background: "rgba(255,255,255,0.07)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {/* mini toggle pill */}
                  <span
                    className="relative inline-flex h-3.5 w-6 shrink-0 rounded-full transition-colors"
                    style={{ background: searchSkills ? "#ff2f5f" : "#374151" }}
                  >
                    <span
                      className="absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-transform"
                      style={{ transform: searchSkills ? "translateX(13px)" : "translateX(2px)" }}
                    />
                  </span>
                  <span className="sr-only">Search Skills</span>
                </button>
              </div>
            </div>
            <div className="characters-sort-note flex flex-wrap items-center gap-3">
              <div className="characters-result-count">
                <strong>{filteredCharacters.length.toLocaleString()}</strong>
                <span>Characters Found</span>
              </div>
              <div className="characters-sort-controls flex items-center gap-2 text-sm text-muted-foreground">
                <button
                  onClick={() => setSortAsc((prev) => !prev)}
                  title={sortAsc ? "Ascending" : "Descending"}
                  aria-label={sortAsc ? "Sort ascending" : "Sort descending"}
                  className="rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:border-primary/55 hover:bg-muted hover:text-foreground"
                >
                  <ArrowDownUp className={`h-4 w-4 transition-transform ${sortAsc ? "rotate-180" : ""}`} />
                </button>
                <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                  <SelectTrigger className="w-[170px] border-border bg-card text-foreground focus:ring-primary/45" aria-label="Sort characters by">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover text-popover-foreground">
                    <SelectItem value="existence">Existence</SelectItem>
                    <SelectItem value="attack">Attack</SelectItem>
                    <SelectItem value="hp">Health</SelectItem>
                    <SelectItem value="defense">Defense</SelectItem>
                    <SelectItem value="skill_cost">Skill cost</SelectItem>
                    <SelectItem value="rarity">Rarity</SelectItem>
                    <SelectItem value="release_date">Release date</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {activeFilterCount > 0 && (
                <Button variant="outline" onClick={resetFilters} className="characters-reset-button border-border bg-card text-foreground hover:border-primary/55 hover:bg-muted">
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>
        <section className={`characters-bulletin-board ${filtersOpen ? "is-filtering" : "is-compact"} rounded-3xl border border-border bg-[#121318] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-6`}>
          <div className="characters-board-content flex flex-col gap-5">
            <div className="characters-control-tags flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <button
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/55 hover:bg-muted hover:text-foreground"
              >
                {filtersOpen ? "Hide Filters" : "Show Filters"}
              </button>
              {activeFilterCount > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-4 py-2 text-foreground">
                  <span>{activeFilterCount} active filters</span>
                </div>
              )}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilterMode((prev) => prev === "AND" ? "OR" : "AND")}
                  title={filterMode === "AND" ? "AND: character must match ALL filters - click for OR" : "OR: character matches ANY filter - click for AND"}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all select-none"
                  style={filterMode === "AND"
                    ? { background: "linear-gradient(135deg,rgba(255,47,95,0.24),rgba(255,47,95,0.1))", color: "#ffffff", boxShadow: "0 0 12px rgba(255,47,95,0.24)", border: "1px solid rgba(255,47,95,0.36)" }
                    : { background: "rgba(255,255,255,0.07)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {/* Switch track */}
                  <span
                    className="relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors"
                    style={{ background: filterMode === "AND" ? "#ff2f5f" : "#374151" }}
                  >
                    <span
                      className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform"
                      style={{ transform: filterMode === "AND" ? "translateX(18px)" : "translateX(2px)" }}
                    />
                  </span>
                  <span className="font-bold tracking-widest" style={{ color: filterMode === "AND" ? "#6b7280" : "#6b7280" }}>
                    {filterMode}
                  </span>
                </button>
              )}
              <button
                onClick={() => setShowStats(!showStats)}
                className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/55 hover:bg-muted hover:text-foreground"
              >
                {showStats ? "Hide Stats" : "Show Stats"}
              </button>
              <button
                onClick={() => {
                  const next = viewMode === "cards" ? "compact" : "cards"
                  setViewMode(next)
                }}
                title={viewMode === "cards" ? "Switch to compact grid view" : "Switch to card view"}
                aria-label={viewMode === "cards" ? "Switch to compact grid view" : "Switch to card view"}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/55 hover:bg-muted hover:text-foreground"
              >
                {viewMode === "cards" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </button>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="characters-chip-line flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    onClick={chip.remove}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground transition-colors hover:border-primary/55 hover:bg-primary/15 hover:text-foreground"
                  >
                    <span className="text-muted-foreground">{chip.category}</span>
                    <span className="text-muted-foreground">-</span>
                    {chip.icon && <img src={chip.icon} alt="" className="h-3.5 w-3.5 object-contain" />}
                    <span>{chip.label}</span>
                    <span className="ml-0.5 text-muted-foreground">x</span>
                  </button>
                ))}
              </div>
            )}

            {filtersOpen && (
            <>
            <div className="characters-dropdown-posters flex flex-wrap gap-3">
              <ToggleFilter title="Tactics" options={options.tactics} selectedValues={selectedTactics} onToggle={(value) => toggleValue(selectedTactics, setSelectedTactics, value)} />
              <ToggleFilter title="Forces" options={options.forces} selectedValues={selectedForces} onToggle={(value) => toggleValue(selectedForces, setSelectedForces, value)} />
              <GroupedToggleFilter title="Skills" groups={options.skillGroups} selectedValues={selectedSkillFilters} onToggle={(value) => toggleValue(selectedSkillFilters, setSelectedSkillFilters, value)} />
              <GroupedToggleFilter title="Traits" groups={options.traitGroups} selectedValues={selectedTraitNames} onToggle={(value) => toggleValue(selectedTraitNames, setSelectedTraitNames, value)} />
              <GroupedToggleFilter title="Valor Traits" groups={options.valorTraitGroups} selectedValues={selectedValorTraitNames} onToggle={(value) => toggleValue(selectedValorTraitNames, setSelectedValorTraitNames, value)} />
              <ToggleFilter title="Facilities" options={options.facilities} selectedValues={selectedFacilities} onToggle={(value) => toggleValue(selectedFacilities, setSelectedFacilities, value)} />
            </div>

            {/* Icon-bar strip: Element, Weapon, Attack Type, Role, Ultimate */}
            <div className="characters-filter-map flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Attacker</span>
                  <IconToggleBar options={options.attackerElements} selectedValues={selectedAttackerElements} onToggle={(value) => toggleValue(selectedAttackerElements, setSelectedAttackerElements, value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Protector</span>
                  <IconToggleBar options={options.defenderElements} selectedValues={selectedDefenderElements} onToggle={(value) => toggleValue(selectedDefenderElements, setSelectedDefenderElements, value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Weapon</span>
                  <IconToggleBar options={options.weapons} selectedValues={selectedWeapons} onToggle={(value) => toggleValue(selectedWeapons, setSelectedWeapons, value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</span>
                  <IconToggleBar options={options.attackTypes} selectedValues={selectedAttackTypes} onToggle={(value) => toggleValue(selectedAttackTypes, setSelectedAttackTypes, value)} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Role</span>
                  <IconToggleBar options={ROLE_OPTIONS} selectedValues={selectedRoles} onToggle={(value) => toggleValue(selectedRoles, setSelectedRoles, value)} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ulti</span>
                  <IconToggleBar options={ULTIMATE_TYPE_OPTIONS} selectedValues={selectedUltimateTypes} onToggle={(value) => toggleValue(selectedUltimateTypes, setSelectedUltimateTypes, value)} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rarity</span>
                  <RarityToggleBar selectedValues={selectedRarities} onToggle={(value) => toggleValue(selectedRarities, setSelectedRarities, value)} onClear={() => setSelectedRarities([])} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex flex-1 items-center gap-3 min-w-[260px]">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SP Cost</span>
                  <RangeSlider
                    min={SKILL_COST_MIN}
                    max={SKILL_COST_MAX}
                    step={1}
                    value={[skillCostMin, skillCostMax]}
                    onValueChange={([lo, hi]) => {
                      setSkillCostMin(lo)
                      setSkillCostMax(hi)
                    }}
                    className="max-w-[420px]"
                  />
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {skillCostMin}
                    <span className="px-1 text-muted-foreground">-</span>
                    {skillCostMax >= SKILL_COST_MAX ? `${SKILL_COST_MAX}+` : skillCostMax}
                  </span>
                  {(skillCostMin > SKILL_COST_MIN || skillCostMax < SKILL_COST_MAX) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSkillCostMin(SKILL_COST_MIN)
                        setSkillCostMax(SKILL_COST_MAX)
                      }}
                      className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-border bg-card px-6 text-[10px] font-semibold uppercase leading-none tracking-wide text-muted-foreground transition hover:border-primary/55 hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        </section>

        <section className="characters-gallery-board min-w-0">
          {Array.isArray(filteredCharacters) && filteredCharacters.length > 0 && (
            <div ref={gridRef} className="w-full">
              {viewMode === "compact" ? (
                containerWidth > 0 ? (
                  <VirtualizedGrid
                    className="image-scroll"
                    columnCount={compactColumnCount}
                    columnWidth={compactCellWidth}
                    rowCount={compactRowCount}
                    rowHeight={compactCellHeight}
                    cellComponent={CompactGridCell}
                    cellProps={{}}
                    defaultHeight={compactViewportHeight}
                    defaultWidth={containerWidth}
                    style={{ height: compactViewportHeight, width: containerWidth, overflowX: "hidden" }}
                  />
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                    {filteredCharacters.slice(0, 48).map((character, index) => (
                      <CompactCard key={character.master_pc_id} character={character} index={index} />
                    ))}
                  </div>
                )
              ) : (
                <VirtualizedGrid
                  className="image-scroll"
                  columnCount={columnCount}
                  columnWidth={columnWidth}
                  rowCount={rowCount}
                  rowHeight={ROW_HEIGHT}
                  cellComponent={GridCell}
                  cellProps={{}}
                  defaultHeight={cardViewportHeight}
                  defaultWidth={containerWidth || columnCount * DESIRED_CARD_WIDTH}
                  style={{ height: cardViewportHeight, width: containerWidth || columnCount * DESIRED_CARD_WIDTH, overflowX: "hidden" }}
                />
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
