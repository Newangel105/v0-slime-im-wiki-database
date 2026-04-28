import {
  getAllWikiCharacters,
  getDerivedProtectorForceNames,
  getCharacterVisualTier,
  hasExSpecialSkill,
  isExAttacker,
  isExUnboundCharacter,
  normalizeLabel,
  stripColorTags,
  toPublicAssetPath,
  type SkillFilterGroup,
  type WikiCharacter,
} from "@/lib/pc-wiki"

export type TeamBuilderForce = {
  name: string
  group: string
  icon_path: string
}

export type TeamBuilderSkill = {
  slot: string
  kind: string
  name: string
  description_max_level: string
  icon_path: string
  cost: number | null
  skill_filter_groups?: SkillFilterGroup[]
  is_skill_change?: boolean
  replaces_slot?: string
}

export type TeamBuilderTrait = {
  name: string
  icon_path: string
  skill_filter_groups?: SkillFilterGroup[]
}

export type TeamBuilderForceEntry = {
  name: string
  icon?: string
}

export type TeamBuilderCharacter = {
  master_pc_id: number
  name: string
  affiliation_name: string
  rarity: number
  element: string
  attack_type: string
  weapon_type: string
  tactics_type: string
  master_character_tactics_type?: string
  master_pc_level_group_id?: number
  master_statusboard_id?: number
  master_enhanced_statusboard_id?: number
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
  forces: TeamBuilderForce[]
  skills: TeamBuilderSkill[]
  traits: TeamBuilderTrait[]
  force_names: string[]
  force_entries: TeamBuilderForceEntry[]
  search_text: string
  master_leader_skill_element_type_2?: string | null
}

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

function getForceEntries(character: WikiCharacter, forceIconLookup: Map<string, string>): TeamBuilderForceEntry[] {
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

function buildSearchText(character: WikiCharacter, forceNames: string[]): string {
  return normalizeLabel(
    [
      character.name,
      character.affiliation_name,
      character.element,
      character.attack_type,
      character.weapon_type,
      character.tactics_type,
      character.master_character_tactics_type,
      character.ultimate_type,
      ...forceNames,
      ...character.skills.map((skill) => skill.name),
      ...character.traits.map((trait) => trait.name),
    ].join(" "),
  )
}

function toTeamBuilderCharacter(character: WikiCharacter, forceIconLookup: Map<string, string>): TeamBuilderCharacter {
  const forceEntries = getForceEntries(character, forceIconLookup)
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
    master_character_tactics_type: character.master_character_tactics_type,
    master_pc_level_group_id: character.master_pc_level_group_id,
    master_statusboard_id: character.master_statusboard_id,
    master_enhanced_statusboard_id: character.master_enhanced_statusboard_id,
    character_role: character.character_role,
    ultimate_type: character.ultimate_type,
    stats: character.stats,
    images: character.images,
    forces: character.forces.map((force) => ({
      name: force.name,
      group: force.group,
      icon_path: force.icon_path,
    })),
    skills: character.skills.map((skill) => ({
      slot: skill.slot,
      kind: skill.kind,
      name: skill.name,
      description_max_level: skill.description_max_level,
      icon_path: skill.icon_path,
      cost: skill.cost,
      skill_filter_groups: skill.skill_filter_groups,
      is_skill_change: skill.is_skill_change,
      replaces_slot: skill.replaces_slot,
    })),
    traits: character.traits.map((trait) => ({
      name: trait.name,
      icon_path: trait.icon_path,
      skill_filter_groups: (trait as typeof trait & { skill_filter_groups?: SkillFilterGroup[] }).skill_filter_groups,
    })),
    master_leader_skill_element_type_2: (character as any).master_leader_skill_element_type_2 ?? null,
    force_names: forceNames,
    force_entries: forceEntries,
    search_text: buildSearchText(character, forceNames),
  }
}

const wikiCharacters = getAllWikiCharacters()
const forceIconLookup = buildForceIconLookup(wikiCharacters)
const teamBuilderCharacters = wikiCharacters.map((character) => toTeamBuilderCharacter(character, forceIconLookup))

export function getAllTeamBuilderCharacters(): TeamBuilderCharacter[] {
  return teamBuilderCharacters
}