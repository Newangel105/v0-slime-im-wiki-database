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
  release_date: string
  facilities: string[]
}

type WikiPayload = {
  characters: WikiCharacter[]
}

const payload = wikiData as WikiPayload

const enhancedElementLabelMap: Record<string, string> = {
  enhancedair: "Air+",
  enhanceddark: "Dark+",
  enhancedearth: "Earth+",
  enhancedfire: "Fire+",
  enhancedholy: "Holy+",
  enhancedwater: "Water+",
  enhancedwind: "Wind+",
}

export function getAllWikiCharacters(): WikiCharacter[] {
  return payload.characters
}

export function getWikiCharacterById(characterId: number): WikiCharacter | undefined {
  return payload.characters.find((character) => character.master_pc_id === characterId)
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

export function normalizeLabel(value: string): string {
  return value.toLowerCase().trim()
}

export function formatWikiLabel(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").trim()
}

export function getDisplayElementLabel(value: string): string {
  return enhancedElementLabelMap[normalizeLabel(value)] ?? formatWikiLabel(value)
}

export function hasExSpecialSkill(character: WikiCharacter): boolean {
  return character.skills.some(
    (skill) =>
      skill.slot === "special_skill" &&
      /Use 200[%％] of secret skill gauge/i.test(stripColorTags(skill.description_max_level)),
  )
}

export function isExUnboundCharacter(character: WikiCharacter): boolean {
  return /^enhanced/i.test(character.element)
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