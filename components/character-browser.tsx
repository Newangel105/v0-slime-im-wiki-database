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
  getAllWikiCharacters,
} from "@/lib/pc-wiki"

type SortKey = "name" | "release_date" | "rarity" | "attack" | "hp" | "defense" | "existence"

type FilterOption = {
  label: string
  value: string
  icon?: string
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
  6: "UI/Texture/CommonRarityAtlas/frameMemberM6.webp",
  7: "UI/Texture/CommonRarityAtlas/frameMemberM6_SpecialPlus.webp",
  8: "UI/Texture/CommonRarityAtlas/frameMemberM7_Epic.webp",
}

const blessFrameMap: Record<number, string> = {
  3: "UI/Texture/CommonRarityAtlas/frameBlessM3.webp",
  4: "UI/Texture/CommonRarityAtlas/frameBlessM4.webp",
  5: "UI/Texture/CommonRarityAtlas/frameBlessM5.webp",
  6: "UI/Texture/CommonRarityAtlas/frameBlessM6.webp",
  7: "UI/Texture/CommonRarityAtlas/frameBlessM6_SpecialPlus.webp",
  8: "UI/Texture/CommonRarityAtlas/frameBlessM7_Epic.webp",
}

const baseRarityMap: Record<number, string> = {
  3: "UI/Texture/CommonRarityAtlas/baseMemberM3.webp",
  4: "UI/Texture/CommonRarityAtlas/baseMemberM4.webp",
  5: "UI/Texture/CommonRarityAtlas/baseMemberM5.webp",
  6: "UI/Texture/CommonRarityAtlas/baseMemberM6.webp",
  7: "UI/Texture/CommonRarityAtlas/baseMemberM6_SpecialPlus.webp",
  8: "UI/Texture/CommonRarityAtlas/baseMemberM7_Epic.webp",
}

const baseBlessMap: Record<number, string> = {
  3: "UI/Texture/CommonRarityAtlas/baseBlessM3.webp",
  4: "UI/Texture/CommonRarityAtlas/baseBlessM4.webp",
  5: "UI/Texture/CommonRarityAtlas/baseBlessM5.webp",
  6: "UI/Texture/CommonRarityAtlas/baseBlessM6.webp",
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

function buildAllOptions(characters: BrowserCharacter[]) {
    return {
    attackerElements: buildElementOptions(characters, "attacker"),
    defenderElements: buildElementOptions(characters, "defender"),
    attackTypes: buildAttackTypeOptions(characters.map((c) => c.attack_type)),
    weapons: buildWeaponOptions(characters.map((c) => c.weapon_type)),
    tactics: buildTacticsOptions(characters.map((c) => c.tactics_type)),
    forces: buildForcesOptions(characters),
    skillGroups: getSkillEffectFilterGroups(getAllWikiCharacters().flatMap((character) => character.skills)),
    traitGroups: getSkillEffectFilterGroups(characters.flatMap((character) => character.traits.filter((trait) => !isValorTrait(trait)))),
    valorTraitGroups: getSkillEffectFilterGroups(characters.flatMap((character) => character.traits.filter((trait) => isValorTrait(trait)))),
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
  return character.ultimate_type
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
        <Button variant="outline" className="justify-between gap-2 border-gray-600 bg-gray-700 text-white hover:bg-gray-600">
          <span className="text-sm">{title}</span>
          <Badge variant="secondary" className="ml-1 shrink-0 bg-gray-900 text-white">
            {selectedValues.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 border-gray-600 bg-gray-700 p-0 text-white" align="start">
        <div className="border-b border-gray-600 px-4 py-3">
          <p className="text-sm font-semibold text-white mb-2">{title}</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <Input
              placeholder="Search..."
              value={dropdownSearch}
              onChange={(e) => setDropdownSearch(e.target.value)}
              className="h-7 pl-8 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
            />
          </div>
        </div>
        <ScrollArea className="h-72 px-4 py-3">
          <div className="space-y-1">
            {visibleOptions.map((option) => {
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
            {visibleOptions.length === 0 && (
              <p className="py-2 text-center text-xs text-gray-500">No results</p>
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
        className={`h-8 min-w-10 rounded px-2 text-xs transition-colors ${selectedValues.length === 0 ? "bg-[#2a3444] text-white" : "text-gray-400 hover:bg-gray-600 hover:text-white"}`}
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
            className={`flex h-8 w-8 items-center justify-center rounded p-0 transition-colors ${isSelected ? "bg-[#2a3444]" : "bg-transparent hover:bg-gray-600"}`}
          >
            {option.icon && <img src={option.icon} alt={option.label} className="h-5 w-5 object-contain" />}
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
        <Button variant="outline" className="justify-between gap-2 border-gray-600 bg-gray-700 text-white hover:bg-gray-600">
          <span>{title}</span>
          <Badge variant="secondary" className="bg-gray-900 text-white">
            {selectedValues.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-gray-600 bg-gray-700 p-0 text-white" align="start">
        <div className="border-b border-gray-600 px-4 py-3">
          <p className="text-sm font-semibold text-white mb-2">{title}</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <Input
              placeholder="Search..."
              value={dropdownSearch}
              onChange={(e) => setDropdownSearch(e.target.value)}
              className="h-7 pl-8 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
            />
          </div>
        </div>
        <ScrollArea className="h-96">
          <div className="p-0">
            {filteredGroups.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-500">No results</p>
            )}
            {filteredGroups.map((group) => (
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

export function CharacterBrowser({ initialCharacters }: { initialCharacters: BrowserCharacter[] }) {
  const characters = initialCharacters
  const wikiById = useMemo(() => new Map(getAllWikiCharacters().map((c) => [c.master_pc_id, c])), [])

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
  const [viewMode, setViewMode] = useState<"cards" | "compact">("compact")
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => {
    const saved = sessionStorage.getItem("characterBrowserViewMode")
    if (saved === "cards" || saved === "compact") setViewMode(saved)
    if (sessionStorage.getItem("characterBrowserFiltersOpen") === "1") setFiltersOpen(true)
  }, [])
  const [filterMode, setFilterMode] = useState<"AND" | "OR">("OR")
  const [searchSkills, setSearchSkills] = useState(false)
  const deferredSearchText = useDeferredValue(searchText)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)

    const tag = sp.get("tag")
    if (tag) setSearchText(tag)

    const attacker = sp.get("attacker")
    if (attacker) setSelectedAttackerElements(attacker.split(","))

    const defender = sp.get("defender")
    if (defender) setSelectedDefenderElements(defender.split(","))

    const type = sp.get("type")
    if (type) setSelectedAttackTypes(type.split(","))

    const tactics = sp.get("tactics")
    if (tactics) setSelectedTactics(tactics.split(","))

    const weapon = sp.get("weapon")
    if (weapon) setSelectedWeapons(weapon.split(","))

    const role = sp.get("role")
    if (role) setSelectedRoles(role.split(","))

    const ulti = sp.get("ulti")
    if (ulti) setSelectedUltimateTypes(ulti.split(","))

    const rarity = sp.get("rarity")
    if (rarity) setSelectedRarities(rarity.split(","))

    const force = sp.get("force")
    if (force) setSelectedForces(force.split(","))

    const facility = sp.get("facility")
    if (facility) setSelectedFacilities(facility.split(","))

    const skill = sp.get("skill")
    if (skill) setSelectedSkillFilters(skill.split(","))

    const trait = sp.get("trait")
    if (trait) setSelectedTraitNames(trait.split(","))

    const valor = sp.get("valor")
    if (valor) setSelectedValorTraitNames(valor.split(","))

    const sort = sp.get("sort")
    if (sort) setSortKey(sort as SortKey)

    const asc = sp.get("asc")
    if (asc === "1") setSortAsc(true)
  }, [])

  // Sync filter state back to URL so "Back" button restores filters
  useEffect(() => {
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
    const qs = params.toString()
    router.replace(qs ? `/characters?${qs}` : "/characters", { scroll: false })
  }, [searchText, selectedAttackerElements, selectedDefenderElements, selectedAttackTypes, selectedTactics, selectedWeapons, selectedRoles, selectedUltimateTypes, selectedRarities, selectedForces, selectedFacilities, selectedSkillFilters, selectedTraitNames, selectedValorTraitNames, sortKey, sortAsc])

  const [options, setOptions] = useState<CharacterBrowserOptions>(EMPTY_OPTIONS)
  useEffect(() => {
    const id = setTimeout(() => setOptions(buildAllOptions(characters)), 0)
    return () => clearTimeout(id)
  }, [characters])

  const filteredCharacters = useMemo(() => {
    if (!Array.isArray(characters)) return [];
    const query = normalizeLabel(deferredSearchText)
    // isAND: every selected filter must be satisfied; isOR: any selected filter is enough
    const isAND = filterMode === "AND"

    const filtered = characters.filter((character) => {
      const characterForceNames = character.force_names

      // Text search always narrows (not subject to AND/OR toggle)
      if (query) {
        if (searchSkills) {
          // Toggle ON: search skill descriptions only
          const skillMatch = character.skills.some((s) =>
            s.slot !== "special_skill" && normalizeLabel(s.description_max_level).includes(query)
          )
          if (!skillMatch) return false
        } else {
          // Toggle OFF: search name and affiliation_name
          const nameMatch = normalizeLabel(character.name).includes(query) || normalizeLabel(character.affiliation_name).includes(query)
          if (!nameMatch) return false
        }
      }

      // Each entry is a boolean: does this character satisfy this filter selection?
      const results: boolean[] = []

      // ── Element filters ──
      // Attacker elements: one element per character — each selected element is its own test
      if (selectedAttackerElements.length) {
        if (isProtectorCharacter(character)) {
          // Protectors don't participate in attacker element filters at all
          results.push(false)
        } else if (isAttackerCharacter(character)) {
          const characterElementValue = getCharacterElementValue(character)
          for (const el of selectedAttackerElements) {
            results.push(characterElementValue === el)
          }
        } else {
          results.push(false)
        }
      }
      // Defender elements: protectors can cover multiple elements
      if (selectedDefenderElements.length) {
        if (isAttackerCharacter(character)) {
          results.push(false)
        } else if (isProtectorCharacter(character)) {
          const defenderValues = getDefenderElementValues(character)
          for (const el of selectedDefenderElements) {
            results.push(defenderValues.includes(el))
          }
        } else {
          results.push(false)
        }
      }

      // ── Single-value filters: each selected value is its own test ──
      for (const v of selectedAttackTypes) {
        results.push(normalizeLabel(character.attack_type) === v)
      }
      for (const v of selectedTactics) {
        results.push(normalizeLabel(character.tactics_type) === v)
      }
      for (const v of selectedWeapons) {
        results.push(normalizeLabel(character.weapon_type) === v)
      }
      if (selectedRoles.length) {
        const role = isProtectorCharacter(character) ? "protector" : isAttackerCharacter(character) ? "attacker" : null
        for (const v of selectedRoles) {
          results.push(role === v)
        }
      }
      if (selectedUltimateTypes.length) {
        const ultType = getCharacterUltimateType(character)
        for (const v of selectedUltimateTypes) {
          results.push(!!ultType && ultType === v)
        }
      }
      if (selectedRarities.length) {
        const visualTier = String(getCharacterVisualTier(character))
        for (const v of selectedRarities) {
          results.push(visualTier === v)
        }
      }

      // ── Multi-value filters: character can belong to multiple ──
      for (const v of selectedForces) {
        results.push(characterForceNames.includes(v))
      }
      for (const v of selectedFacilities) {
        results.push(character.facilities.includes(v))
      }
      for (const v of selectedTraitNames) {
        results.push(character.traits.some((trait) => !isValorTrait(trait) && trait.effect_tags?.includes(v)))
      }
      for (const v of selectedValorTraitNames) {
        results.push(character.traits.some((trait) => isValorTrait(trait) && trait.effect_tags?.includes(v)))
      }

      // Skill effect filters — test selected values against full wiki skills only
      for (const v of selectedSkillFilters) {
        const wiki = wikiById.get(character.master_pc_id)
        results.push(Boolean(wiki && wiki.skills.some((s) => skillMatchesEffectFilters(s, [v]))))
      }

      if (results.length === 0) return true
      return isAND ? results.every(Boolean) : results.some(Boolean)
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
          return dir * (getCharacterVisualTier(right) - getCharacterVisualTier(left) || right.stats.existence - left.stats.existence)
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
    selectedUltimateTypes,
    selectedRarities,
    sortAsc,
    sortKey,
    options,
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
    selectedUltimateTypes.length +
    selectedRarities.length

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
      chips.push({ key: `tr:${v}`, category: "Trait", label: info ? `${info.groupTitle} · ${info.label}` : v, remove: () => setSelectedTraitNames((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedValorTraitNames) {
      const info = valorTraitFilterLabelMap.get(v)
      chips.push({ key: `vt:${v}`, category: "Valor Trait", label: info ? `${info.groupTitle} · ${info.label}` : v, remove: () => setSelectedValorTraitNames((prev) => prev.filter((x) => x !== v)) })
    }
    for (const v of selectedSkillFilters) {
      const info = skillFilterLabelMap.get(v)
      chips.push({ key: `sk:${v}`, category: "Skills", label: info ? `${info.groupTitle} · ${info.label}` : v, remove: () => setSelectedSkillFilters((prev) => prev.filter((x) => x !== v)) })
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
  const DESKTOP_CARD_HEIGHT = 340
  const MOBILE_CARD_HEIGHT = 320
  const STATS_HEIGHT = 55 // Height of the stats section (grid + padding)
  const ADJUSTED_DESKTOP_HEIGHT = showStats ? DESKTOP_CARD_HEIGHT : DESKTOP_CARD_HEIGHT - STATS_HEIGHT
  const ADJUSTED_MOBILE_HEIGHT = showStats ? MOBILE_CARD_HEIGHT : MOBILE_CARD_HEIGHT - STATS_HEIGHT
  const CARD_HEIGHT = containerWidth && containerWidth < 640 ? ADJUSTED_MOBILE_HEIGHT : ADJUSTED_DESKTOP_HEIGHT

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

  const COMPACT_PAGE_SIZE = 48
  const CARDS_PAGE_SIZE = 12
  const [visibleCount, setVisibleCount] = useState(COMPACT_PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Reset visible count when the filtered list or view changes
  useEffect(() => {
    setVisibleCount(viewMode === "compact" ? COMPACT_PAGE_SIZE : CARDS_PAGE_SIZE)
  }, [filteredCharacters, viewMode])

  // Load more characters as user scrolls toward the bottom
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => prev + (viewMode === "compact" ? COMPACT_PAGE_SIZE : CARDS_PAGE_SIZE))
        }
      },
      { rootMargin: "400px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [filteredCharacters, viewMode])

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

  // Compact grid sizing (mirrors the responsive CSS grid breakpoints)
  const COMPACT_GAP = 8
  const compactColumnCount = !containerWidth ? 12
    : containerWidth >= 1280 ? 12
    : containerWidth >= 1024 ? 10
    : containerWidth >= 768 ? 8
    : containerWidth >= 640 ? 6
    : 4
  const compactCellWidth = containerWidth ? containerWidth / compactColumnCount : 80
  const compactCellHeight = compactCellWidth + COMPACT_GAP
  const compactRowCount = Math.ceil(filteredCharacters.length / compactColumnCount)
  const compactGridHeight = Math.min(8, compactRowCount) * compactCellHeight + 10

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
        <div className="relative w-full pt-[100%] overflow-hidden rounded cursor-pointer hover:ring-2 hover:ring-white transition-all">
          <img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <img src={iconSrc} alt={character.name} loading={imageLoading} decoding="async" fetchPriority={index < 3 ? "high" : "low"} className="absolute inset-0 w-full h-full object-cover object-top" />
          <img src={frameSrc} alt="" loading={imageLoading} decoding="async" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          {/* Name top-left */}
          <div className="absolute top-1 left-1 bg-black bg-opacity-80 text-white text-[9px] px-1 py-0.5 rounded z-10 leading-tight max-w-[70%] line-clamp-2">
            {character.name}
          </div>
          {/* Stars bottom-left */}
          <img src={starsSrc} alt="" loading="lazy" decoding="async" className="absolute bottom-1 left-1 h-5 object-contain z-10" />
          {/* Icons top-right */}
          {(firstIcon || secondIcon) && (
            <div className="absolute top-1 right-1 z-20 flex flex-col items-end gap-0.5">
              {firstIcon && <img src={firstIcon} alt="" className="w-5 h-5 object-contain" />}
              {secondIcon && <img src={secondIcon} alt={attackTypeLabel} className="w-5 h-5 object-contain" />}
            </div>
          )}
        </div>
      </Link>
    )
  }

  function CompactGridCell({ ariaAttributes, columnIndex, rowIndex, style }: CellComponentProps) {
    const index = rowIndex * compactColumnCount + columnIndex
    if (index >= filteredCharacters.length) return null
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
    const isLastColumn = columnIndex === compactColumnCount - 1
    const adjustedLeft = rawLeft + COMPACT_GAP / 2
    const adjustedWidth = Math.max(0, rawWidth - COMPACT_GAP - (isLastColumn ? 2 : 0))
    const adjustedStyle = { ...style, left: adjustedLeft, width: adjustedWidth }
    return (
      <div style={adjustedStyle} aria-colindex={ariaAttributes?.["aria-colindex"]} role={ariaAttributes?.role}>
        {/* paddingBottom creates the row gap; pt-[100%] maintains a 1:1 square aspect ratio */}
        <div style={{ paddingBottom: COMPACT_GAP }}>
          <Link href={`/characters/${character.master_pc_id}`} prefetch={false} className="block w-full min-w-0">
            <div className="relative w-full pt-[100%] overflow-hidden rounded cursor-pointer hover:ring-2 hover:ring-white transition-all">
              <div className={`absolute overflow-hidden ${visualTier >= 8 ? "inset-[8%] rounded-[12%]" : "inset-0"}`}>
                <img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                <img src={iconSrc} alt={character.name} loading={imageLoading} decoding="async" fetchPriority={index < 3 ? "high" : "low"} className="absolute inset-0 w-full h-full object-cover object-top" />
              </div>
              <img src={frameSrc} alt="" loading={imageLoading} decoding="async" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
              <div className="absolute top-1 left-1 bg-black bg-opacity-80 text-white text-[9px] px-1 py-0.5 rounded z-10 leading-tight max-w-[70%] line-clamp-2">
                {character.name}
              </div>
              <img src={starsSrc} alt="" loading="lazy" decoding="async" className="absolute bottom-1 left-1 h-5 object-contain z-10" />
              {(firstIcon || secondIcon) && (
                <div className="absolute top-1 right-1 z-20 flex flex-col items-end gap-0.5">
                  {firstIcon && <img src={firstIcon} alt="" className="w-5 h-5 object-contain" />}
                  {secondIcon && <img src={secondIcon} alt={attackTypeLabel} className="w-5 h-5 object-contain" />}
                </div>
              )}
            </div>
          </Link>
        </div>
      </div>
    )
  }

  function MobileCard({ character, index }: { character: BrowserCharacter; index: number }) {
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
                  {visualTier >= 8 ? (
                    <div className="absolute inset-[8%] rounded-[12%] overflow-hidden">
                      <img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                      <img src={iconSrc} alt={character.name} loading={imageLoading} decoding="async" fetchPriority={isPriorityCard ? "high" : "low"} className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-110" />
                    </div>
                  ) : (
                    <>
                      <img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                      <div className="absolute inset-[10px] rounded-[18px] overflow-hidden">
                        <img src={iconSrc} alt={character.name} loading={imageLoading} decoding="async" fetchPriority={isPriorityCard ? "high" : "low"} className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-110" />
                      </div>
                    </>
                  )}
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
              {showStats && (
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
              )}
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
    const iconSrc = character.images.icon?.replace(/\.webp$/i, ".webp")
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
          <Link href={`/characters/${character.master_pc_id}`} prefetch={false} className="block w-full h-full min-w-0">
            <div
              className="w-full min-w-0 group h-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#1d2d44] to-[#0f1924] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
              style={{ borderTop: `4px solid ${elementAccentColor}`, contentVisibility: "auto", containIntrinsicSize: `${CARD_HEIGHT}px` }}
            >
              <div>
                {/* Portrait + info row */}
                <div className="flex gap-4 p-4 pb-3">
                  {/* Portrait */}
                  <div className="relative h-24 w-24 md:h-[148px] md:w-[148px] shrink-0">
                    {visualTier >= 8 ? (
                      <div className="absolute inset-[8%] rounded-[12%] overflow-hidden">
                        <img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                        <img src={iconSrc} alt={character.name} loading={imageLoading} decoding="async" fetchPriority={isPriorityCard ? "high" : "low"} className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-110" />
                      </div>
                    ) : (
                      <>
                        <img src={baseSrc} alt="" loading={imageLoading} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                        <div className="absolute inset-[10px] rounded-[18px] overflow-hidden">
                          <img src={iconSrc} alt={character.name} loading={imageLoading} decoding="async" fetchPriority={isPriorityCard ? "high" : "low"} className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-110" />
                        </div>
                      </>
                    )}
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
                {showStats && (
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
                )}
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
    setSelectedRarities([])
    setSortKey("release_date")
    setSortAsc(false)
    setFilterMode("OR")
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
              <div className="relative w-full lg:max-w-xl flex items-center">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search names, affiliations, effects, forces, towns" className="h-12 rounded-full border-gray-600 bg-gray-700 pl-11 pr-36 text-white placeholder:text-gray-400 flex-1" />
                {/* Skills toggle embedded at right of search bar */}
                <button
                  onClick={() => setSearchSkills((prev) => !prev)}
                  title={searchSkills ? "Also searching skill names & descriptions" : "Click to also search skill names & descriptions"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all select-none"
                  style={searchSkills
                    ? { background: "linear-gradient(135deg,#1e40af,#2563eb)", color: "#fff", boxShadow: "0 0 8px rgba(59,130,246,0.5)" }
                    : { background: "rgba(255,255,255,0.07)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {/* mini toggle pill */}
                  <span
                    className="relative inline-flex h-3.5 w-6 shrink-0 rounded-full transition-colors"
                    style={{ background: searchSkills ? "#60a5fa" : "#374151" }}
                  >
                    <span
                      className="absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-transform"
                      style={{ transform: searchSkills ? "translateX(13px)" : "translateX(2px)" }}
                    />
                  </span>
                  Search Skills
                </button>
              </div>
              {filtersOpen && (
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
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
              <button
                onClick={() => {
                  const next = !filtersOpen
                  setFiltersOpen(next)
                  sessionStorage.setItem("characterBrowserFiltersOpen", next ? "1" : "0")
                }}
                className="inline-flex items-center rounded-full bg-gray-700 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-600 hover:text-white transition-all"
              >
                {filtersOpen ? "Hide Filters" : "Show Filters"}
              </button>
              {activeFilterCount > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full bg-gray-700 px-4 py-2 text-white">
                  <span>{activeFilterCount} active filters</span>
                </div>
              )}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilterMode((prev) => prev === "AND" ? "OR" : "AND")}
                  title={filterMode === "AND" ? "AND: character must match ALL filters — click for OR" : "OR: character matches ANY filter — click for AND"}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all select-none"
                  style={filterMode === "AND"
                    ? { background: "linear-gradient(135deg,#14532d,#16a34a)", color: "#fff", boxShadow: "0 0 10px rgba(34,197,94,0.4)", border: "1px solid rgba(74,222,128,0.4)" }
                    : { background: "rgba(255,255,255,0.07)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {/* Switch track */}
                  <span
                    className="relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors"
                    style={{ background: filterMode === "AND" ? "#22c55e" : "#374151" }}
                  >
                    <span
                      className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform"
                      style={{ transform: filterMode === "AND" ? "translateX(18px)" : "translateX(2px)" }}
                    />
                  </span>
                  <span className="font-bold tracking-widest" style={{ color: filterMode === "AND" ? "#bbf7d0" : "#6b7280" }}>
                    {filterMode}
                  </span>
                </button>
              )}
              <button
                onClick={() => setShowStats(!showStats)}
                className="inline-flex items-center rounded-full bg-gray-700 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-600 hover:text-white transition-all"
              >
                {showStats ? "Hide Stats" : "Show Stats"}
              </button>
              <button
                onClick={() => {
                  const next = viewMode === "cards" ? "compact" : "cards"
                  setViewMode(next)
                  sessionStorage.setItem("characterBrowserViewMode", next)
                }}
                title={viewMode === "cards" ? "Switch to compact grid view" : "Switch to card view"}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-700 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-600 hover:text-white transition-all"
              >
                {viewMode === "cards" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </button>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    onClick={chip.remove}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-gray-700 px-3 py-1 text-xs text-gray-200 hover:bg-red-900/40 hover:border-red-500/40 hover:text-white transition-colors"
                  >
                    <span className="text-gray-500">{chip.category}</span>
                    <span className="text-gray-500">·</span>
                    {chip.icon && <img src={chip.icon} alt="" className="h-3.5 w-3.5 object-contain" />}
                    <span>{chip.label}</span>
                    <span className="ml-0.5 text-gray-400">×</span>
                  </button>
                ))}
              </div>
            )}

            {filtersOpen && (
            <>
            <div className="flex flex-wrap gap-3">
              <ToggleFilter title="Tactics" options={options.tactics} selectedValues={selectedTactics} onToggle={(value) => toggleValue(selectedTactics, setSelectedTactics, value)} />
              <ToggleFilter title="Forces" options={options.forces} selectedValues={selectedForces} onToggle={(value) => toggleValue(selectedForces, setSelectedForces, value)} />
              <GroupedToggleFilter title="Skills" groups={options.skillGroups} selectedValues={selectedSkillFilters} onToggle={(value) => toggleValue(selectedSkillFilters, setSelectedSkillFilters, value)} />
              <GroupedToggleFilter title="Traits" groups={options.traitGroups} selectedValues={selectedTraitNames} onToggle={(value) => toggleValue(selectedTraitNames, setSelectedTraitNames, value)} />
              <GroupedToggleFilter title="Valor Traits" groups={options.valorTraitGroups} selectedValues={selectedValorTraitNames} onToggle={(value) => toggleValue(selectedValorTraitNames, setSelectedValorTraitNames, value)} />
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
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Rarity</span>
                  <RarityToggleBar selectedValues={selectedRarities} onToggle={(value) => toggleValue(selectedRarities, setSelectedRarities, value)} onClear={() => setSelectedRarities([])} />
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        </section>

        <section className="min-w-0">
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
                    defaultHeight={compactGridHeight}
                    defaultWidth={containerWidth}
                    style={{ height: compactGridHeight, width: containerWidth, overflowX: "hidden" }}
                  />
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                    {filteredCharacters.slice(0, COMPACT_PAGE_SIZE).map((character, index) => (
                      <CompactCard key={character.master_pc_id} character={character} index={index} />
                    ))}
                  </div>
                )
              ) : showGridOnIphone ? (
                IS_MOBILE ? (
                  <div className="flex flex-col" style={{ gap: `${GAP}px` }}>
                    {filteredCharacters.slice(0, visibleCount).map((ch, idx) => (
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
          {/* Infinite scroll sentinel — becomes visible when user nears the bottom */}
          {visibleCount < filteredCharacters.length && (
            <div ref={sentinelRef} className="h-2" aria-hidden />
          )}
        </section>
      </div>
    </main>
  )
}