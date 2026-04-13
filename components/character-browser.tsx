"use client"

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useState, useRef } from "react"
import { Grid as VirtualizedGrid, type CellComponentProps } from "react-window"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowDownUp, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  characterMatchesEffectFilters,
  getCharacterEffectFilterGroups,
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
} from "@/lib/pc-wiki"

type SortKey = "name" | "release_date" | "rarity" | "attack" | "hp" | "defense" | "existence"

type FilterOption = {
  label: string
  value: string
  icon?: string
}

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
  special: "/type_dmg/IcElementBlessSpecial.png",
  
  specialeffectelementair: "/Image/IcElementBless/IcElementBlessSpecialEffectElementAir.png",
  specialeffectelementdark: "/Image/IcElementBless/IcElementBlessSpecialEffectElementDark.png",
  specialeffectelementearth: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEarth.png",
  specialeffectelementenhancedair: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedAir.png",
  specialeffectelementenhanceddark: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedDark.png",
  specialeffectelementenhancedearth: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedEarth.png",
  specialeffectelementenhancedfire: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedFire.png",
  specialeffectelementenhancedholy: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedHoly.png",
  specialeffectelementenhancedwater: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWater.png",
  specialeffectelementenhancedwind: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWind.png",
  specialeffectelementfire: "/Image/IcElementBless/IcElementBlessSpecialEffectElementFire.png",
  specialeffectelementholy: "/Image/IcElementBless/IcElementBlessSpecialEffectElementHoly.png",
  specialeffectelementnone: "/Image/IcElementBless/IcElementBlessSpecialEffectElementNone.png",
  specialeffectelementwater: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWater.png",
  specialeffectelementwind: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWind.png",
  water: "/elements/water.png",
  wind: "/elements/wind.png",
}

// "Increases <element> ATK by" → base element icon (e.g. wind.png)
const defenderBaseElementIconMap: Record<string, string> = {
  air: "/elements/space.png",
  dark: "/elements/dark.png",
  earth: "/elements/earth.png",
  fire: "/elements/fire.png",
  holy: "/elements/light.png",
  water: "/elements/water.png",
  wind: "/elements/wind.png",
}

// "damage done by ... to <element> attribute enemies" → Anti icon (e.g. Anti-Wind.png)
const defenderAntiElementIconMap: Record<string, string> = {
  air: "/elements/Anti-Space.png",
  dark: "/elements/Anti-Dark.png",
  earth: "/elements/Anti-Earth.png",
  fire: "/elements/Anti-Fire.png",
  holy: "/elements/Anti-Light.png",
  water: "/elements/Anti-Water.png",
  wind: "/elements/Anti-Wind.png",
}

// Same as Anti but for EX Unbound protectors → unbound icon (e.g. anti_wind_attribute_unbound.png)
const defenderAntiExElementIconMap: Record<string, string> = {
  air: "/elements/anti_space_attribute_unbound.png",
  dark: "/elements/anti_dark_attribute_unbound.png",
  earth: "/elements/anti_earth_attribute_unbound.png",
  fire: "/elements/anti_fire_attribute_unbound.png",
  holy: "/elements/anti_light_attribute_unbound.png",
  water: "/elements/anti_water_attribute_unbound.png",
  wind: "/elements/anti_wind_attribute_unbound.png",
}

const attackerElementIconMap: Record<string, string> = {
  air: "/elements/icElementspace.png",
  dark: "/elements/icElementDark.png",
  earth: "/elements/icElementEarth.png",
  enhancedair: "/elements/Enhancedspace.png",
  enhanceddark: "/elements/Enhanceddark.png",
  enhancedearth: "/elements/Enhancedearth.png",
  enhancedfire: "/elements/Enhancedfire.png",
  enhancedholy: "/elements/Enhancedlight.png",
  enhancedwater: "/elements/Enhancedwater.png",
  enhancedwind: "/elements/Enhancedwind.png",
  fire: "/elements/icElementFire.png",
  holy: "/elements/icElementlight.png",
  water: "/elements/icElementWater.png",
  wind: "/elements/icElementWind.png",
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
      physics: "/type_dmg/prot_phys.png",
      magic: "/type_dmg/prot_magic.png",
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
  magic: "/type_dmg/icAttackTypeMagic.png",
  physical: "/type_dmg/icAttackTypePhysics.png",
}

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

const tacticsIconMap: Record<string, string> = {
  charge: "/Image/Tactics/charge.png",
  defense: "/Image/Tactics/defense.png",
  normal: "/Image/Tactics/normal.png",
  speed: "/Image/Tactics/speed.png",
}

function fieldBuildingIcon(id: string, ver: string) {
  return `/Image/FieldBuilding/${id}/${ver}/FieldBuilding_${id}_${ver}_icon.png`
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
  3: "/frame/frameMemberM3.png",
  4: "/frame/frameMemberM4.png",
  5: "/frame/frameMemberM5.png",
  6: "/frame/frameMemberM6.png",
  7: "/frame/frameMemberM7.png",
}

const blessFrameMap: Record<number, string> = {
  3: "/frame/frameBlessM3.png",
  4: "/frame/frameBlessM4.png",
  5: "/frame/frameBlessM5.png",
  6: "/frame/frameBlessM6.png",
  7: "/frame/frameBlessM7.png",
}

const baseRarityMap: Record<number, string> = {
  3: "/frame/baseMemberM3.png",
  4: "/frame/baseMemberM4.png",
  5: "/frame/baseMemberM5.png",
  6: "/frame/baseMemberM6.png",
  7: "/frame/baseMemberM7.png",
}

const baseBlessMap: Record<number, string> = {
  3: "/frame/baseBlessM3.png",
  4: "/frame/baseBlessM4.png",
  5: "/frame/baseBlessM5.png",
  6: "/frame/baseBlessM6.png",
  7: "/frame/baseBlessM7.png",
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
  3: "/stars/starCharaL3A.png",
  4: "/stars/starCharaL4A.png",
  5: "/stars/starCharaL5A.png",
  6: "/stars/starCharaL6A.png",
  7: "/stars/starCharaL7A.png",
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
  air: "/Image/IcElementBless/IcElementBlessAir.png",
  dark: "/Image/IcElementBless/IcElementBlessDark.png",
  earth: "/Image/IcElementBless/IcElementBlessEarth.png",
  fire: "/Image/IcElementBless/IcElementBlessFire.png",
  holy: "/Image/IcElementBless/IcElementBlessHoly.png",
  water: "/Image/IcElementBless/IcElementBlessWater.png",
  wind: "/Image/IcElementBless/IcElementBlessWind.png",
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
  return character.ultimate_type
}

const ROLE_OPTIONS: FilterOption[] = [
  { label: "Attacker", value: "attacker", icon: "/UI/Texture/CharaInfoAtlas/icSkillAttacker.png" },
  { label: "Protector", value: "protector", icon: "/UI/Texture/CharaInfoAtlas/icSkillBlessLeader.png" },
]

const ULTIMATE_TYPE_OPTIONS: FilterOption[] = [
  { label: "AoE", value: "aoe", icon: "/UI/Texture/CharaInfoAtlas/icSpTypeAll.png" },
  { label: "Single", value: "single", icon: "/UI/Texture/CharaInfoAtlas/icSpTypeSingle.png" },
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
                <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors ${
                  checked ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5"
                }`}>
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
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const isSelected = selectedValues.includes(opt.value)
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            title={opt.label}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
              isSelected ? "bg-white/20 ring-2 ring-white/70" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            {opt.icon ? (
              <img
                src={opt.icon}
                alt={opt.label}
                className={`h-7 w-7 object-contain transition-opacity ${isSelected ? "opacity-100" : "opacity-50"}`}
              />
            ) : (
              <span className={`px-1 text-center text-[11px] font-bold leading-tight ${isSelected ? "text-white" : "text-gray-400"}`}>
                {opt.label}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// --- Trait helpers ---

function isValorTrait(trait: { icon_path: string }): boolean {
  return trait.icon_path.includes("ArenaPassive")
}

// Strip trigger prefix so "HP - ATK UP" and "Soul Combo - ATK UP" both become "ATK UP"
function getRegularTraitDisplay(rawName: string): string {
  return rawName.replace(/^(HP|Soul Combo |Soul Combo|Troop|Effect|Switch)\s*[-–]\s*/i, "").trim()
}

// Explicit display names for valor traits
const VALOR_DISPLAY_MAP: Record<string, string> = {
  "Charge - Protection DOWN":                          "Protection DOWN",
  "Late Battle - Protection DOWN":                     "Protection DOWN",
  "Soul Combo - Protection DOWN":                      "Soul Combo Protection DOWN",
  "Soul Combo - Skill DOWN":                           "Soul Combo Skill DOWN",
  "Soul Combo - Secret DOWN":                          "Soul Combo Secret DOWN",
  "Charge - Secret DOWN":                              "Charge Secret DOWN",
  "Late Battle - Skill DOWN":                          "Skill DOWN",
  "Switch - Bind":                                     "Bind",
  "Switch - Skill Seal":                               "Skill Seal",
  "Soul Combo - Soul of Skills Damage DOWN":           "Soul of Skills Damage DOWN",
  "Soul Combo - Secret Damage DOWN":                   "Soul of Secret Damage DOWN",
  "Soul Combo - Secret Soul Damage DOWN":              "Soul of Secret Damage DOWN",
  "Soul Combo - Soul of Divine Protection Damage DOWN": "Soul of Divine Protection Damage DOWN",
  "Soul Combo  - Counter Power DOWN":                  "Counterattack Resistance",
  "Soul Combo - Guard Rate DOWN":                      "Guard Rate DOWN",
}

type TraitEffectMap = Map<string, string[]> // displayName → rawNames[]

function buildTraitEffectMap(characters: BrowserCharacter[], valor: boolean): TraitEffectMap {
  const map: TraitEffectMap = new Map()
  for (const character of characters) {
    for (const trait of character.traits) {
      if (isValorTrait(trait) !== valor) continue
      const display = valor
        ? (VALOR_DISPLAY_MAP[trait.name] ?? getRegularTraitDisplay(trait.name))
        : getRegularTraitDisplay(trait.name)
      if (!map.has(display)) map.set(display, [])
      const raws = map.get(display)!
      if (!raws.includes(trait.name)) raws.push(trait.name)
    }
  }
  return map
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
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between gap-2 border-gray-600 bg-gray-700 text-white hover:bg-gray-600">
          <span>{title}</span>
          <Badge variant="secondary" className="bg-gray-900 text-white">
            {selectedValues.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-gray-600 bg-gray-700 p-0 text-white" align="start">
        <ScrollArea className="h-96">
          <div className="p-0">
            {groups.map((group) => (
              <div key={group.key} className="border-b border-gray-600 last:border-b-0">
                <div className="bg-gray-600/70 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-gray-100">
                  {group.title}
                </div>
                <div className="space-y-3 px-4 py-3">
                  {group.options.map((option) => {
                    const checked = selectedValues.includes(option.value)

                    return (
                      <label key={option.value} className="flex cursor-pointer items-center gap-3 text-sm text-gray-200">
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

export function CharacterBrowser({ characters }: { characters: BrowserCharacter[] }) {
  const searchParams = useSearchParams()
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
  const [sortKey, setSortKey] = useState<SortKey>("release_date")
  const [sortAsc, setSortAsc] = useState(false)
  const deferredSearchText = useDeferredValue(searchText)

  useEffect(() => {
    const tag = searchParams.get("tag")
    if (tag) {
      setSearchText(tag)
    }

    const attacker = searchParams.get("attacker")
    if (attacker) setSelectedAttackerElements(attacker.split(","))

    const defender = searchParams.get("defender")
    if (defender) setSelectedDefenderElements(defender.split(","))

    const type = searchParams.get("type")
    if (type) setSelectedAttackTypes(type.split(","))

    const tactics = searchParams.get("tactics")
    if (tactics) setSelectedTactics(tactics.split(","))

    const weapon = searchParams.get("weapon")
    if (weapon) setSelectedWeapons(weapon.split(","))

    const role = searchParams.get("role")
    if (role) setSelectedRoles(role.split(","))

    const ulti = searchParams.get("ulti")
    if (ulti) setSelectedUltimateTypes(ulti.split(","))

    const force = searchParams.get("force")
    if (force) setSelectedForces(force.split(","))

    const facility = searchParams.get("facility")
    if (facility) setSelectedFacilities(facility.split(","))
  }, [searchParams])

  const options = useMemo(
    () => ({
      attackerElements: buildElementOptions(characters, "attacker"),
      defenderElements: buildElementOptions(characters, "defender"),
      attackTypes: buildAttackTypeOptions(characters.map((character) => character.attack_type)),
      weapons: buildWeaponOptions(characters.map((character) => character.weapon_type)),
      tactics: buildTacticsOptions(characters.map((character) => character.tactics_type)),
      forces: buildForcesOptions(characters),
      skillGroups: getCharacterEffectFilterGroups(characters),
      traitEffectMap: buildTraitEffectMap(characters, false),
      valorTraitEffectMap: buildTraitEffectMap(characters, true),
      facilities: buildOptions(characters.flatMap((character) => character.facilities)),
    }),
    [characters],
  )

  const filteredCharacters = useMemo(() => {
    if (!Array.isArray(characters)) return [];
    const query = normalizeLabel(deferredSearchText)
    const filtered = characters.filter((character) => {
      const characterForceNames = character.force_names

      if (query && !character.search_text.includes(query)) {
        return false
      }
      const characterElementValue = getCharacterElementValue(character)
      if (isProtectorCharacter(character)) {
        if (selectedAttackerElements.length) {
          return false
        }
        if (selectedDefenderElements.length) {
          const defenderValues = getDefenderElementValues(character)
          if (!selectedDefenderElements.some((sel) => defenderValues.includes(sel))) {
            return false
          }
        }
      } else if (isAttackerCharacter(character)) {
        if (selectedDefenderElements.length) {
          return false
        }
        if (selectedAttackerElements.length && !selectedAttackerElements.includes(characterElementValue)) {
          return false
        }
      } else if (selectedAttackerElements.length || selectedDefenderElements.length) {
        return false
      }
      if (selectedAttackTypes.length && !selectedAttackTypes.includes(normalizeLabel(character.attack_type))) {
        return false
      }
      if (selectedTactics.length && !selectedTactics.includes(normalizeLabel(character.tactics_type))) {
        return false
      }
      if (selectedForces.length && !selectedForces.every((value) => characterForceNames.includes(value))) {
        return false
      }
      if (!characterMatchesEffectFilters(character, selectedSkillFilters)) {
        return false
      }
      if (selectedTraitNames.length && !selectedTraitNames.every((effect) =>
        character.traits.some((trait) => !isValorTrait(trait) && (options.traitEffectMap.get(effect) ?? []).includes(trait.name))
      )) {
        return false
      }
      if (selectedValorTraitNames.length && !selectedValorTraitNames.every((effect) =>
        character.traits.some((trait) => isValorTrait(trait) && (options.valorTraitEffectMap.get(effect) ?? []).includes(trait.name))
      )) {
        return false
      }
      if (selectedFacilities.length && !selectedFacilities.every((value) => character.facilities.includes(value))) {
        return false
      }
      if (selectedWeapons.length && !selectedWeapons.includes(normalizeLabel(character.weapon_type))) {
        return false
      }
      if (selectedRoles.length) {
        const role = isProtectorCharacter(character) ? "protector" : isAttackerCharacter(character) ? "attacker" : null
        if (!role) return false
        if (!selectedRoles.includes(role)) return false
      }
      if (selectedUltimateTypes.length) {
        const ultType = getCharacterUltimateType(character)
        if (!ultType || !selectedUltimateTypes.includes(ultType)) return false
      }

      return true
    })

    return filtered.sort((left, right) => {
      const dir = sortAsc ? -1 : 1
      switch (sortKey) {
        case "attack":
          return dir * (right.stats.attack - left.stats.attack)
        case "hp":
          return dir * (right.stats.hp - left.stats.hp)
        case "defense":
          return dir * (right.stats.defense - left.stats.defense)
        case "existence":
          return dir * (right.stats.existence - left.stats.existence)
        case "rarity":
          return dir * (right.rarity - left.rarity || right.stats.existence - left.stats.existence)
        case "release_date": {
          const leftReleaseDate = left.release_date ?? ""
          const rightReleaseDate = right.release_date ?? ""

          if (!leftReleaseDate && !rightReleaseDate) {
            return dir * left.name.localeCompare(right.name)
          }
          if (!leftReleaseDate) {
            return 1
          }
          if (!rightReleaseDate) {
            return -1
          }

          return dir * rightReleaseDate.localeCompare(leftReleaseDate)
        }
        case "name":
        default:
          return dir * left.name.localeCompare(right.name)
      }
    })
  }, [
    characters,
    deferredSearchText,
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
    selectedUltimateTypes,
    sortAsc,
    sortKey,
  ]) || []

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
    selectedUltimateTypes.length

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
  const DESKTOP_CARD_HEIGHT = 340
  const MOBILE_CARD_HEIGHT = 320
  const CARD_HEIGHT = containerWidth && containerWidth < 640 ? MOBILE_CARD_HEIGHT : DESKTOP_CARD_HEIGHT

  const computedColumnCount = containerWidth
    ? containerWidth >= 1280
      ? 3
      : containerWidth >= 640
      ? 2
      : 1
    : 1

  // Treat narrow containers as mobile so layout responds to viewport width.
  const IS_MOBILE = !!(containerWidth && containerWidth < 640)
  const columnCount = IS_MOBILE ? 1 : computedColumnCount

  const [isIphone, setIsIphone] = useState(false)
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsIphone(/iPhone/i.test(navigator.userAgent))
    }
  }, [])

  const MIN_IPHONE_INITIAL_ITEMS = 12
  const showGridOnIphone = !isIphone || filteredCharacters.length >= MIN_IPHONE_INITIAL_ITEMS

  const columnWidth = containerWidth ? containerWidth / columnCount : DESIRED_CARD_WIDTH + GAP
  const cardWidth = Math.max(0, columnWidth - GAP)
  const rowCount = Math.ceil(filteredCharacters.length / columnCount)
  // Add vertical gap to row height so spacing between rows is uniform on mobile
  const ROW_HEIGHT = IS_MOBILE ? CARD_HEIGHT + GAP : CARD_HEIGHT
  const gridHeight = Math.min(6, rowCount) * ROW_HEIGHT + 10 // Show up to 6 rows at once

  // For VariableSizeGrid, must provide functions
  const getColumnWidth = () => columnWidth
  const getRowHeight = () => ROW_HEIGHT

  function MobileCard({ character, index }: { character: BrowserCharacter; index: number }) {
    const visualTier = getCharacterVisualTier(character)
    const frameSrc = getCharacterFrame(character)
    const baseSrc = getCharacterBase(character)
    const starsSrc = starAssetMap[visualTier] ?? starAssetMap[5]
    const iconSrc = character.images.icon
    const characterElementValue = getCharacterElementValue(character)
    const elementIcons = getCharacterElementIcons(character)
    const forceEntries = character.force_entries
    const attackTypeIcon = attackTypeIconMap[normalizeLabel(character.attack_type)]
    const weaponIcon = weaponIconMap[normalizeLabel(character.weapon_type)]
    const tacticsIcon = tacticsIconMap[normalizeLabel(character.tactics_type || "Normal")]
    const attackTypeLabel = formatWikiLabel(character.attack_type)
    const weaponLabel = formatWikiLabel(character.weapon_type)
    const rarityLabel = getCharacterRarityLabel(character)
    const isPriorityCard = index < 6
    const imageLoading = isPriorityCard ? "eager" : "lazy"
    const elementAccentColor = elementColorMap[normalizeLabel(characterElementValue)] ?? "#4b5563"
    const facilityIcons = [
      ...new Set(character.facilities.map((f) => f.replace(/ \+\d+%$/, "").trim())),
    ]
      .map((name) => ({ name, icon: facilityIconMap[name] }))
      .filter((entry) => entry.icon)
      .slice(0, 5)

    return (
      <div style={{ paddingLeft: GAP / 2, paddingRight: GAP / 2, boxSizing: "border-box" }} key={character.master_pc_id}>
        <Link href={`/characters/${character.master_pc_id}`} prefetch={false} className="block w-full min-w-0">
          <div
            className="w-full min-w-0 group h-auto overflow-hidden rounded-2xl bg-gradient-to-b from-[#1d2d44] to-[#0f1924] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
            style={{ borderTop: `4px solid ${elementAccentColor}`, contentVisibility: "auto", containIntrinsicSize: `${CARD_HEIGHT}px` }}
          >
            <div>
              <div className="flex gap-4 p-4 pb-3">
                <div className="relative h-24 w-24 md:h-[148px] md:w-[148px] shrink-0">
                  <img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                  <div className="absolute inset-[10px] overflow-hidden rounded-[18px]">
                    <img
                      src={iconSrc}
                      alt={character.name}
                      loading={imageLoading}
                      decoding="async"
                      fetchPriority={isPriorityCard ? "high" : "low"}
                      className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                  <img src={frameSrc} alt="" loading={imageLoading} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col md:min-h-[148px]">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="line-clamp-2 text-[1rem] font-bold leading-snug text-white">{character.name}</h2>
                    <img src={starsSrc} alt={rarityLabel} loading={imageLoading} decoding="async" className="mt-0.5 h-6 shrink-0 object-contain drop-shadow" />
                  </div>
                  <p className="mt-1 truncate text-[10px] uppercase tracking-[0.18em] text-gray-500">{character.affiliation_name}</p>
                  {(tacticsIcon || facilityIcons.length > 0) && (
                    <div className="mt-2 flex items-center gap-2">
                      {tacticsIcon && (
                        <img
                          src={tacticsIcon}
                          alt={character.tactics_type || "Normal"}
                          title={character.tactics_type || "Normal"}
                          className="h-10 w-auto max-w-[110px] shrink-0 object-contain drop-shadow"
                        />
                      )}
                      {facilityIcons.map(({ name, icon }) => (
                        <img key={name} src={icon} alt={name} title={name} className="h-8 w-8 object-contain" />
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {elementIcons.map((entry) => (
                      <img key={entry.icon} src={entry.icon} alt={entry.label} title={entry.label} className="h-8 w-8 object-contain" />
                    ))}
                    {attackTypeIcon && (
                      <img src={attackTypeIcon} alt={attackTypeLabel} title={attackTypeLabel} className="h-8 w-8 object-contain" />
                    )}
                    {weaponIcon && (
                      <img src={weaponIcon} alt={weaponLabel} title={weaponLabel} className="h-8 w-8 object-contain" />
                    )}
                  </div>
                </div>
              </div>
              <div className="px-4 grid grid-cols-4 divide-x divide-white/5 rounded-xl bg-white/10 py-2.5 w-full min-w-0">
                <div className="px-2 text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-white">HP</p>
                  <p className="mt-1 text-[1.1rem] font-bold leading-none text-emerald-300">{character.stats.hp}</p>
                </div>
                <div className="px-2 text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-white">ATK</p>
                  <p className="mt-1 text-[1.1rem] font-bold leading-none text-rose-300">{character.stats.attack}</p>
                </div>
                <div className="px-2 text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-white">DEF</p>
                  <p className="mt-1 text-[1.1rem] font-bold leading-none text-sky-300">{character.stats.defense}</p>
                </div>
                <div className="px-2 text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-white">EXI</p>
                  <p className="mt-1 text-[1.1rem] font-bold leading-none text-amber-200">{character.stats.existence}</p>
                </div>
              </div>
              {forceEntries.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-4 py-3">
                  {forceEntries.slice(0, 4).map((force) => (
                    <span
                      key={force.name}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-gray-400 ring-1 ring-white/10"
                    >
                      {force.icon && <img src={force.icon} alt={force.name} className="h-5 w-5 shrink-0 object-contain" />}
                      {force.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Link>
      </div>
    )
  }

  // Grid cell component for react-window `Grid` (typed as CellComponentProps)
  function GridCell({ ariaAttributes, columnIndex, rowIndex, style }: CellComponentProps) {
    const index = rowIndex * columnCount + columnIndex
    if (index >= filteredCharacters.length) return null
    const character = filteredCharacters[index]
    const visualTier = getCharacterVisualTier(character)
    const frameSrc = getCharacterFrame(character)
    const baseSrc = getCharacterBase(character)
    const starsSrc = starAssetMap[visualTier] ?? starAssetMap[5]
    const iconSrc = character.images.icon
    const characterElementValue = getCharacterElementValue(character)
    const elementIcons = getCharacterElementIcons(character)
    const forceEntries = character.force_entries
    const attackTypeIcon = attackTypeIconMap[normalizeLabel(character.attack_type)]
    const weaponIcon = weaponIconMap[normalizeLabel(character.weapon_type)]
    const tacticsIcon = tacticsIconMap[normalizeLabel(character.tactics_type || "Normal")]
    const attackTypeLabel = formatWikiLabel(character.attack_type)
    const weaponLabel = formatWikiLabel(character.weapon_type)
    const rarityLabel = getCharacterRarityLabel(character)
    const isPriorityCard = index < 6
    const imageLoading = isPriorityCard ? "eager" : "lazy"
    const elementAccentColor = elementColorMap[normalizeLabel(characterElementValue)] ?? "#4b5563"
    const facilityIcons = [
      ...new Set(character.facilities.map((f) => f.replace(/ \+\d+%$/, "").trim())),
    ]
      .map((name) => ({ name, icon: facilityIconMap[name] }))
      .filter((entry) => entry.icon)
      .slice(0, 5)
    const rawLeft = (style as any).left ?? 0
    const rawWidth = (style as any).width ?? columnWidth
    const adjustedLeft = rawLeft + GAP / 2
    const isLastColumn = columnIndex === columnCount - 1
    const EXTRA_LAST_COLUMN_SPACE = 4 // px breathing room to avoid corner clipping at small gaps
    const adjustedWidth = Math.max(0, rawWidth - GAP - (isLastColumn ? EXTRA_LAST_COLUMN_SPACE : 0))
    const adjustedStyle = { ...style, left: adjustedLeft, width: adjustedWidth }

    return (
      <div style={adjustedStyle} key={character.master_pc_id} aria-colindex={ariaAttributes?.["aria-colindex"]} role={ariaAttributes?.role}>
        <div
          style={{
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            paddingLeft: GAP / 2,
            paddingRight: isLastColumn ? GAP / 2 + EXTRA_LAST_COLUMN_SPACE : GAP / 2,
          }}
        >
          <Link href={`/characters/${character.master_pc_id}`} prefetch={false} className="block w-full min-w-0">
            <div
              className="w-full min-w-0 group h-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#1d2d44] to-[#0f1924] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
              style={{ borderTop: `4px solid ${elementAccentColor}`, contentVisibility: "auto", containIntrinsicSize: `${CARD_HEIGHT}px` }}
            >
              <div>
                {/* Portrait + info row */}
                <div className="flex gap-4 p-4 pb-3">
                  {/* Portrait */}
                  <div className="relative h-24 w-24 md:h-[148px] md:w-[148px] shrink-0">
                    <img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                    <div className="absolute inset-[10px] overflow-hidden rounded-[18px]">
                      <img
                        src={iconSrc}
                        alt={character.name}
                        loading={imageLoading}
                        decoding="async"
                        fetchPriority={isPriorityCard ? "high" : "low"}
                        className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-110"
                      />
                    </div>
                    <img src={frameSrc} alt="" loading={imageLoading} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                  </div>
                  {/* Info column */}
                  <div className="flex min-w-0 flex-1 flex-col md:min-h-[148px]">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="line-clamp-2 text-[1rem] font-bold leading-snug text-white">{character.name}</h2>
                      <img src={starsSrc} alt={rarityLabel} loading={imageLoading} decoding="async" className="mt-0.5 h-6 shrink-0 object-contain drop-shadow" />
                    </div>
                    <p className="mt-1 truncate text-[10px] uppercase tracking-[0.18em] text-gray-500">{character.affiliation_name}</p>
                    {/* Tactics badge + facility icons on same row */}
                    {(tacticsIcon || facilityIcons.length > 0) && (
                      <div className="mt-2 flex items-center gap-2">
                        {tacticsIcon && (
                          <img
                            src={tacticsIcon}
                            alt={character.tactics_type || "Normal"}
                            title={character.tactics_type || "Normal"}
                            className="h-10 w-auto max-w-[110px] shrink-0 object-contain drop-shadow"
                          />
                        )}
                        {facilityIcons.map(({ name, icon }) => (
                          <img key={name} src={icon} alt={name} title={name} className="h-8 w-8 object-contain" />
                        ))}
                      </div>
                    )}
                    {/* Element / attack type / weapon icons */}
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      {elementIcons.map((entry) => (
                        <img key={entry.icon} src={entry.icon} alt={entry.label} title={entry.label} className="h-8 w-8 object-contain" />
                      ))}
                      {attackTypeIcon && (
                        <img src={attackTypeIcon} alt={attackTypeLabel} title={attackTypeLabel} className="h-8 w-8 object-contain" />
                      )}
                      {weaponIcon && (
                        <img src={weaponIcon} alt={weaponLabel} title={weaponLabel} className="h-8 w-8 object-contain" />
                      )}
                    </div>
                  </div>
                </div>
                {/* Stats bar */}
                <div className="px-4 grid grid-cols-4 divide-x divide-white/5 rounded-xl bg-white/10 py-2.5 w-full min-w-0">
                  <div className="px-2 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-white">HP</p>
                    <p className="mt-1 text-[1.1rem] font-bold leading-none text-emerald-300">{character.stats.hp}</p>
                  </div>
                  <div className="px-2 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-white">ATK</p>
                    <p className="mt-1 text-[1.1rem] font-bold leading-none text-rose-300">{character.stats.attack}</p>
                  </div>
                  <div className="px-2 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-white">DEF</p>
                    <p className="mt-1 text-[1.1rem] font-bold leading-none text-sky-300">{character.stats.defense}</p>
                  </div>
                  <div className="px-2 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-white">EXI</p>
                    <p className="mt-1 text-[1.1rem] font-bold leading-none text-amber-200">{character.stats.existence}</p>
                  </div>
                </div>
                {/* Forces */}
                {forceEntries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-4 py-3">
                    {forceEntries.slice(0, 4).map((force) => (
                      <span
                        key={force.name}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-gray-400 ring-1 ring-white/10"
                      >
                        {force.icon && <img src={force.icon} alt={force.name} className="h-5 w-5 shrink-0 object-contain" />}
                        {force.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Link>
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
    setSortKey("release_date")
    setSortAsc(false)
  }

  function toggleValue(values: string[], setter: (next: string[]) => void, value: string) {
    setter(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value])
  }

  return (
    <main className="min-h-screen bg-[#111827] px-4 py-8 text-white sm:px-6">
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
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rounded-2xl border border-gray-700 bg-gray-800 p-5 shadow-[0_0_24px_rgba(255,255,255,0.08)]">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">Characters</h1>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search names, affiliations, effects, forces, towns" className="h-12 rounded-full border-gray-600 bg-gray-700 pl-11 text-white placeholder:text-gray-400" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <button
                    onClick={() => setSortAsc((prev) => !prev)}
                    title={sortAsc ? "Ascending" : "Descending"}
                    className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-600 hover:text-white"
                  >
                    <ArrowDownUp className={`h-4 w-4 transition-transform ${sortAsc ? "rotate-180" : ""}`} />
                  </button>
                  <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                    <SelectTrigger className="w-[170px] border-gray-600 bg-gray-700 text-white">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent className="border-gray-600 bg-gray-700 text-white">
                      <SelectItem value="existence">Existence</SelectItem>
                      <SelectItem value="attack">Attack</SelectItem>
                      <SelectItem value="hp">Health</SelectItem>
                      <SelectItem value="defense">Defense</SelectItem>
                      <SelectItem value="rarity">Rarity</SelectItem>
                      <SelectItem value="release_date">Release date</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={resetFilters} className="border-gray-600 bg-gray-700 text-white hover:bg-gray-600">
                  Reset
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <ToggleFilter title="Tactics" options={options.tactics} selectedValues={selectedTactics} onToggle={(value) => toggleValue(selectedTactics, setSelectedTactics, value)} />
              <ToggleFilter title="Forces" options={options.forces} selectedValues={selectedForces} onToggle={(value) => toggleValue(selectedForces, setSelectedForces, value)} />
              <GroupedToggleFilter title="Skills" groups={options.skillGroups} selectedValues={selectedSkillFilters} onToggle={(value) => toggleValue(selectedSkillFilters, setSelectedSkillFilters, value)} />
              <ToggleFilter title="Traits" options={[...options.traitEffectMap.keys()].sort().map((k) => ({ label: k, value: k }))} selectedValues={selectedTraitNames} onToggle={(value) => toggleValue(selectedTraitNames, setSelectedTraitNames, value)} />
              <ToggleFilter title="Valor Traits" options={[...options.valorTraitEffectMap.keys()].sort().map((k) => ({ label: k, value: k }))} selectedValues={selectedValorTraitNames} onToggle={(value) => toggleValue(selectedValorTraitNames, setSelectedValorTraitNames, value)} />
              <ToggleFilter title="Facilities" options={options.facilities} selectedValues={selectedFacilities} onToggle={(value) => toggleValue(selectedFacilities, setSelectedFacilities, value)} />
            </div>

            {/* Icon-bar strip: Element, Weapon, Attack Type, Role, Ultimate */}
            <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/3 p-3">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Attacker</span>
                  <IconToggleBar options={options.attackerElements} selectedValues={selectedAttackerElements} onToggle={(value) => toggleValue(selectedAttackerElements, setSelectedAttackerElements, value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Protector</span>
                  <IconToggleBar options={options.defenderElements} selectedValues={selectedDefenderElements} onToggle={(value) => toggleValue(selectedDefenderElements, setSelectedDefenderElements, value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Weapon</span>
                  <IconToggleBar options={options.weapons} selectedValues={selectedWeapons} onToggle={(value) => toggleValue(selectedWeapons, setSelectedWeapons, value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Type</span>
                  <IconToggleBar options={options.attackTypes} selectedValues={selectedAttackTypes} onToggle={(value) => toggleValue(selectedAttackTypes, setSelectedAttackTypes, value)} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Role</span>
                  <IconToggleBar options={ROLE_OPTIONS} selectedValues={selectedRoles} onToggle={(value) => toggleValue(selectedRoles, setSelectedRoles, value)} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Ulti</span>
                  <IconToggleBar options={ULTIMATE_TYPE_OPTIONS} selectedValues={selectedUltimateTypes} onToggle={(value) => toggleValue(selectedUltimateTypes, setSelectedUltimateTypes, value)} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-700 px-4 py-2 text-white">
                <span>{activeFilterCount} active filters</span>
              </div>
            </div>
          </div>
        </section>

        <section className="min-w-0">
          {Array.isArray(filteredCharacters) && filteredCharacters.length > 0 && (
            <div ref={gridRef} className="w-full">
              {showGridOnIphone ? (
                IS_MOBILE ? (
                  <div className="flex flex-col" style={{ gap: `${GAP}px` }}>
                    {filteredCharacters.map((ch, idx) => (
                      <MobileCard key={ch.master_pc_id} character={ch} index={idx} />
                    ))}
                  </div>
                ) : (
                  <VirtualizedGrid
                    className="image-scroll"
                    columnCount={columnCount}
                    columnWidth={columnWidth}
                    rowCount={rowCount}
                    rowHeight={ROW_HEIGHT}
                    cellComponent={GridCell}
                    cellProps={{}}
                    defaultHeight={gridHeight}
                    defaultWidth={containerWidth || columnCount * DESIRED_CARD_WIDTH}
                    style={{ height: gridHeight, width: containerWidth || columnCount * DESIRED_CARD_WIDTH, overflowX: "hidden" }}
                  />
                )
              ) : (
                <div className="py-20 text-center text-gray-400">Loading characters…</div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}