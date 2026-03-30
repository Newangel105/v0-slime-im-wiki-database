import wikiData from "../pc_wiki.generated.json"

export type WikiForce = {
  label: string
  name: string
  group: string
  icon_path: string
}

export type WikiSkill = {
  slot: string
  label: string
  kind: string
  name: string
  description_max_level: string
  icon_path: string
  is_skill_change?: boolean
  replaces_label?: string
  replaces_slot?: string
}

export type WikiTrait = {
  slot: string
  label: string
  kind: string
  name: string
  description_max_level: string
  icon_path: string
  unlock: string
}

export type WikiExAbility = {
  name: string
  description: string
  effects: string[]
}

export type WikiCharacter = {
  master_pc_id: number
  name: string
  affiliation_name: string
  rarity: number
  element: string
  attack_type: string
  weapon_type: string
  tactics_type: string
  character_role: string
  ultimate_type: string
  stats: {
    hp: number
    attack: number
    defense: number
    existence: number
  }
  images: {
    icon: string
    full: string
  }
  forces: WikiForce[]
  skills: WikiSkill[]
  traits: WikiTrait[]
  ex_abilities: WikiExAbility[]
  release_date: string | null
  facilities: string[]
}

type WikiPayload = {
  characters: WikiCharacter[]
}

const payload = wikiData as WikiPayload
const WEBSITE_EXCLUDED_CHARACTER_IDS = new Set([100001, 100002, 180001, 180002, 180003, 180004])
const WEBSITE_RELEASE_DATE_OVERRIDES: Record<string, string> = {
  "2019/12/31": "2023/02/28",
}

const elementLabelMap: Record<string, string> = {
  all: "All",
  enhancedair: "Air+",
  enhanceddark: "Dark+",
  enhancedearth: "Earth+",
  enhancedfire: "Fire+",
  enhancedholy: "Holy+",
  enhancedwater: "Water+",
  enhancedwind: "Wind+",
  magic: "Magic",
  physics: "Physical",
  special: "Special",
  specialeffectelementair: "Special Air",
  specialeffectelementdark: "Special Dark",
  specialeffectelementearth: "Special Earth",
  specialeffectelementenhancedair: "Special Air+",
  specialeffectelementenhanceddark: "Special Dark+",
  specialeffectelementenhancedearth: "Special Earth+",
  specialeffectelementenhancedfire: "Special Fire+",
  specialeffectelementenhancedholy: "Special Holy+",
  specialeffectelementenhancedwater: "Special Water+",
  specialeffectelementenhancedwind: "Special Wind+",
  specialeffectelementfire: "Special Fire",
  specialeffectelementholy: "Special Holy",
  specialeffectelementnone: "Special",
  specialeffectelementwater: "Special Water",
  specialeffectelementwind: "Special Wind",
}

function getWebsiteReleaseDate(value: string | null): string | null {
  if (!value) {
    return null
  }

  const dateOnly = value.split(" ", 1)[0] ?? value
  const override = WEBSITE_RELEASE_DATE_OVERRIDES[dateOnly]

  if (!override) {
    return value
  }

  return value.startsWith(dateOnly) ? value.replace(dateOnly, override) : override
}

function toWebsiteCharacter(character: WikiCharacter): WikiCharacter {
  return {
    ...character,
    release_date: getWebsiteReleaseDate(character.release_date),
  }
}

export function getAllWikiCharacters(): WikiCharacter[] {
  return payload.characters
    .filter((character) => !WEBSITE_EXCLUDED_CHARACTER_IDS.has(character.master_pc_id))
    .map(toWebsiteCharacter)
}

export function getWikiCharacterById(characterId: number): WikiCharacter | undefined {
  if (WEBSITE_EXCLUDED_CHARACTER_IDS.has(characterId)) {
    return undefined
  }

  const character = payload.characters.find((entry) => entry.master_pc_id === characterId)
  return character ? toWebsiteCharacter(character) : undefined
}

export function toPublicAssetPath(assetPath: string | null | undefined): string {
  if (!assetPath) {
    return "/placeholder.svg"
  }

  const normalized = assetPath.replace(/^\/+/, "")
  if (/\.[a-z0-9]+$/i.test(normalized)) {
    return `/${normalized}`
  }

  return `/${normalized}.png`
}

export function stripColorTags(text: string): string {
  return text.replace(/<color=[^>]+>/gi, "").replace(/<\/color>/gi, "")
}

export function normalizeLabel(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim()
}

export function formatWikiLabel(value: string | null | undefined): string {
  return (value ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").trim()
}

export function getDisplayElementLabel(value: string | null | undefined): string {
  return elementLabelMap[normalizeLabel(value)] ?? formatWikiLabel(value)
}

export function getDisplayReleaseDate(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  return value.split(" ", 1)[0] ?? null
}

export function hasExSpecialSkill(character: WikiCharacter): boolean {
  return character.skills.some(
    (skill) =>
      skill.slot === "special_skill" &&
      /EX Soul of Combos/i.test(stripColorTags(skill.description_max_level)),
  )
}

export function isExUnboundCharacter(character: WikiCharacter): boolean {
  return /Enhanced/i.test(character.element)
}

export function isExAttacker(character: WikiCharacter): boolean {
  return /^(SpecialEffect)/i.test(character.element)
}

export function getCharacterVisualTier(character: WikiCharacter): number {
  if (character.rarity !== 5) {
    return Math.min(Math.max(character.rarity, 3), 7)
  }

  if (isExUnboundCharacter(character)) {
    return 7
  }

  if (hasExSpecialSkill(character)) {
    return 6
  }

  if (isExAttacker(character)) {
    return 6
  }

  return 5
}

export function getCharacterRarityLabel(character: WikiCharacter): string {
  const visualTier = getCharacterVisualTier(character)

  if (visualTier === 7) {
    return "EX Unbound"
  }

  if (visualTier === 6) {
    return "EX"
  }

  return `${character.rarity} Star`
}

export function getDerivedProtectorForceNames(character: WikiCharacter): string[] {
  if (character.character_role !== "Supporter") {
    return []
  }

  const names = new Set<string>()
  for (const skill of character.skills) {
    const description = skill.description_max_level ?? ""
    // Match "Force characters" preceded by one or more <color>Name</color> joined by " and "
    const forceBlockPattern = /((?:<color=[^>]+>[^<]+<\/color>(?:\s+and\s+)?)+)\s+Force characters/gi
    let blockMatch: RegExpExecArray | null
    while ((blockMatch = forceBlockPattern.exec(description)) !== null) {
      const block = blockMatch[1]
      const namePattern = /<color=[^>]+>([^<]+)<\/color>/gi
      let nameMatch: RegExpExecArray | null
      while ((nameMatch = namePattern.exec(block)) !== null) {
        const forceName = nameMatch[1]?.trim()
        if (forceName) {
          names.add(forceName)
        }
      }
    }
  }

  return [...names]
}

export function getCharacterForceNames(character: WikiCharacter): string[] {
  if (character.forces.length > 0) {
    return character.forces.map((force) => force.name)
  }
  return getDerivedProtectorForceNames(character)
}

export type GlobalStatMaxes = {
  hp: number
  attack: number
  defense: number
  existence: number
}

let cachedStatMaxes: GlobalStatMaxes | null = null

export function getGlobalStatMaxes(): GlobalStatMaxes {
  if (cachedStatMaxes) return cachedStatMaxes

  const characters = getAllWikiCharacters()
  cachedStatMaxes = {
    hp: Math.max(...characters.map((c) => c.stats.hp)),
    attack: Math.max(...characters.map((c) => c.stats.attack)),
    defense: Math.max(...characters.map((c) => c.stats.defense)),
    existence: Math.max(...characters.map((c) => c.stats.existence)),
  }
  return cachedStatMaxes
}

let cachedForceIconLookup: Map<string, string> | null = null

export function getForceIconLookup(): Map<string, string> {
  if (cachedForceIconLookup) return cachedForceIconLookup

  const characters = getAllWikiCharacters()
  cachedForceIconLookup = new Map<string, string>()
  for (const char of characters) {
    for (const force of char.forces) {
      if (!cachedForceIconLookup.has(force.name)) {
        cachedForceIconLookup.set(force.name, force.icon_path)
      }
    }
  }
  return cachedForceIconLookup
}

export type CharacterVariant = {
  master_pc_id: number
  name: string
  affiliation_name: string
  rarity: number
  element: string
  attack_type: string
  icon: string
  visual_tier: number
}

export function getCharacterVariants(character: WikiCharacter): CharacterVariant[] {
  const allCharacters = getAllWikiCharacters()
  return allCharacters
    .filter((c) => c.name === character.name && c.master_pc_id !== character.master_pc_id)
    .map((c) => ({
      master_pc_id: c.master_pc_id,
      name: c.name,
      affiliation_name: c.affiliation_name,
      rarity: c.rarity,
      element: c.element,
      attack_type: c.attack_type,
      icon: c.images.icon,
      visual_tier: getCharacterVisualTier(c),
    }))
}

export type ForceEntry = { name: string; icon?: string }

export function getCharacterForceEntries(character: WikiCharacter): ForceEntry[] {
  const forceIconLookup = getForceIconLookup()

  if (character.forces.length > 0) {
    return character.forces.map((force) => ({
      name: force.name,
      icon: toPublicAssetPath(force.icon_path),
    }))
  }

  return getDerivedProtectorForceNames(character).map((name) => ({
    name,
    icon: forceIconLookup.get(name) ? toPublicAssetPath(forceIconLookup.get(name)) : undefined,
  }))
}