import { getCharacterEffectTags } from "@/lib/character-effect-filters"
import { getAllWikiCharacters, getCharMaxStats, normalizeLabel, stripColorTags, toPublicAssetPath, type WikiCharacter } from "@/lib/pc-wiki"

export type BrowserForceEntry = {
  name: string
  icon?: string
}

export type BrowserCharacterSkill = {
  slot: string
  kind: string
  name: string
  description_max_level: string
}

export type BrowserCharacterTrait = {
  name: string
  icon_path: string
}

export type BrowserCharacterUltimateType = "aoe" | "single" | null

export type BrowserCharacter = {
  master_pc_id: number
  name: string
  affiliation_name: string
  rarity: number
  element: string
  attack_type: string
  weapon_type: string
  tactics_type: string
  character_role: string
  release_date: string | null
  stats: {
    hp: number
    attack: number
    defense: number
    existence: number
  }
  images: {
    icon: string
  }
  force_names: string[]
  force_entries: BrowserForceEntry[]
  skills: BrowserCharacterSkill[]
  traits: BrowserCharacterTrait[]
  facilities: string[]
  effect_tags: string[]
  search_text: string
  ultimate_type: BrowserCharacterUltimateType
  master_leader_skill_element_type_2?: string | null
}

const AOE_KEYWORDS = ["all-target", "all target", "all enemies", "all characters"]
const SINGLE_KEYWORDS = ["single-target", "single target"]

function buildForceIconLookup(characters: WikiCharacter[]): Map<string, string> {
  const forceMap = new Map<string, string>()

  for (const character of characters) {
    for (const force of character.forces) {
      if (!forceMap.has(force.name)) {
        forceMap.set(force.name, force.icon_path)
      }
    }
  }

  return forceMap
}

function getDerivedProtectorForceNames(character: WikiCharacter): string[] {
  if (character.character_role !== "Supporter") {
    return []
  }

  const names = new Set<string>()
  for (const skill of character.skills) {
    const description = skill.description_max_level ?? ""
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

function getCharacterForceEntries(character: WikiCharacter, forceIconLookup: Map<string, string>): BrowserForceEntry[] {
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

function getCharacterUltimateType(character: WikiCharacter): BrowserCharacterUltimateType {
  if (character.character_role === "Supporter") {
    return null
  }

  const specialSkill = character.skills.find((skill) => skill.slot === "special_skill" && skill.kind === "special")
  if (!specialSkill?.description_max_level) {
    return null
  }

  const description = stripColorTags(specialSkill.description_max_level).toLowerCase()
  if (AOE_KEYWORDS.some((keyword) => description.includes(keyword))) {
    return "aoe"
  }
  if (SINGLE_KEYWORDS.some((keyword) => description.includes(keyword))) {
    return "single"
  }

  return null
}

function buildSearchText(character: WikiCharacter, forceNames: string[]): string {
  return normalizeLabel(
    [
      character.name,
      character.affiliation_name,
      character.element,
      character.attack_type,
      character.weapon_type,
      character.tactics_type,
      ...forceNames,
      ...character.skills.map((skill) => skill.name),
      ...character.traits.map((trait) => trait.name),
      ...character.facilities,
    ].join(" "),
  )
}

function toBrowserCharacter(character: WikiCharacter, forceIconLookup: Map<string, string>): BrowserCharacter {
  const forceEntries = getCharacterForceEntries(character, forceIconLookup)
  const forceNames = forceEntries.map((entry) => entry.name)

  return {
    master_pc_id: character.master_pc_id,
    name: character.name,
    affiliation_name: character.affiliation_name,
    rarity: character.rarity,
    element: character.element,
    attack_type: character.attack_type,
    weapon_type: character.weapon_type,
    tactics_type: character.tactics_type,
    character_role: character.character_role,
    release_date: character.release_date,
    stats: getCharMaxStats(character.master_pc_id) ?? character.stats,
    images: {
      icon: toPublicAssetPath(character.images.icon),
    },
    force_names: forceNames,
    force_entries: forceEntries,
    skills: character.skills
      .filter((skill) => skill.slot === "leader_skill" || skill.slot === "special_skill" || skill.slot === "active_skill" || skill.slot === "bless_skill")
      .map((skill) => ({
        slot: skill.slot,
        kind: skill.kind,
        name: skill.name ?? "",
        description_max_level: skill.description_max_level ?? "",
      })),
    traits: character.traits.map((trait) => ({
      name: trait.name,
      icon_path: trait.icon_path,
    })),
    facilities: character.facilities,
    effect_tags: [...getCharacterEffectTags(character)],
    search_text: buildSearchText(character, forceNames),
    ultimate_type: getCharacterUltimateType(character),
    master_leader_skill_element_type_2: (character as any).master_leader_skill_element_type_2 ?? null,
  }
}

const allWikiCharacters = getAllWikiCharacters()
const forceIconLookup = buildForceIconLookup(allWikiCharacters)
const browserCharacters = allWikiCharacters.map((character) => toBrowserCharacter(character, forceIconLookup))

export function getAllCharacterBrowserData(): BrowserCharacter[] {
  return browserCharacters
}