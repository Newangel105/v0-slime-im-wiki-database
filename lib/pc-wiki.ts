import wikiData from "../pc_wiki.generated.json"
import heartprintData from "../pc_wiki.heartprints.json"
import equipmentData from "../pc_wiki.equipment.json"
import fallbackEquipmentData from "../pc_wiki.equipment.json"
import charmData from "../pc_wiki.charms.json"
import fallbackCharmData from "../pc_wiki.charms.json"
import charStatsRaw from "../pc_wiki_char_stats.json"
import teamStatsRaw from "../pc_wiki_team_stats.json"

export type WikiForce = {
  label: string
  name: string
  group: string
  icon_path: string
}

export type SkillFilterGroup = {
  master_skill_filter_group_id: number
  category_name: string
  sub_category_label: string
  effect_family?: string
  raw_effect_polarity?: string
  target_type_name?: string
  target_team?: string
  target_scope?: string
  change_source_label?: string
  change_target_label?: string
}

export type WikiBattleAttackEffect = {
  target_type?: number | null
  attack_type?: string | null
  element_type?: string | null
  attack_calc_type?: number | null
  attack_base_type?: number | null
  attack_base_value?: number | null
  base_effect_value?: number | null
  level_add_effect_value?: number | null
  effect_value?: number | null
}

export type WikiBattleBuffEffect = {
  target_type?: number | null
  parameter_type?: number | null
  value_type?: number | null
  buff_type?: number | null
  base_effect_value?: number | null
  level_add_effect_value?: number | null
  effect_value?: number | null
}

export type WikiBattleConditionEffect = {
  condition_effect_type?: number | null
  base_probability?: number | null
  level_add_probability?: number | null
  probability?: number | null
  base_value1?: number | null
  base_value2?: number | null
  base_value3?: number | null
  level_add_value?: number | null
  effect_value?: number | null
}

export type WikiBattleCardEffect = {
  card_target_type?: number | null
  card_effect_type?: number | null
  base_effect_value?: number | null
  level_add_effect_value?: number | null
  effect_value?: number | null
  base_effect_max_value?: number | null
  level_add_effect_max_value?: number | null
  effect_max_value?: number | null
}

export type WikiBattleSystemEffect = {
  system_effect_type?: number | null
  normal_card_type?: number | null
  base_effect_value?: number | null
  level_add_effect_value?: number | null
  effect_value?: number | null
  base_probability?: number | null
  level_add_probability?: number | null
  probability?: number | null
}

export type WikiConditionEffectMetadata = {
  condition_effect_type: number
  is_positive?: boolean | null
  buff_magnification_rate?: number | null
  debuff_magnification_rate?: number | null
  text_magnification_rate?: number | null
  text_magnification_polarity?: "enhancement" | "weakening" | null
}

export type WikiSkill = {
  slot: string
  label: string
  kind: string
  name: string
  description_max_level: string
  icon_path: string
  cost: number | null
  skill_level_group_id?: number | null
  special_skill_type?: string
  is_skill_change?: boolean
  replaces_label?: string
  replaces_slot?: string
  skill_filter_groups?: SkillFilterGroup[]
  skill_change_type?: string | null
  battle_attack_effects?: WikiBattleAttackEffect[]
  battle_buff_effects?: WikiBattleBuffEffect[]
  battle_condition_effects?: WikiBattleConditionEffect[]
  battle_card_effects?: WikiBattleCardEffect[]
  battle_system_effects?: WikiBattleSystemEffect[]
}

export type WikiTrait = {
  slot: string
  label: string
  kind: string
  name: string
  description_max_level: string
  icon_path: string
  unlock: string
  skill_filter_groups?: SkillFilterGroup[]
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
  master_leader_skill_element_type_2?: string | null
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
  forces: WikiForce[]
  skills: WikiSkill[]
  traits: WikiTrait[]
  ex_abilities: WikiExAbility[]
  release_date: string | null
  facilities: string[]
}

type WikiPayload = {
  characters: WikiCharacter[]
  condition_effect_metadata?: Record<string, WikiConditionEffectMetadata>
  meta?: Record<string, unknown>
}

const payload = wikiData as WikiPayload
const WEBSITE_EXCLUDED_CHARACTER_IDS = new Set([100001, 100002, 100003, 180001, 180002, 180003, 180004])
const WEBSITE_RELEASE_DATE_OVERRIDES: Record<string, string> = {
  "2019/12/31": "2023/02/28",
}
const CONDITION_TEXT_MAGNIFICATION_RE = /increases(?:\s+(?:own|applied))?\s+(enhancement|weakening)\s+effects?\s*(?:by\s*)?x?(\d+(?:\.\d+)?)\s*(?:times?)?/i

// Display labels for element keys. NOTE the two game-data corrections: the key
// "air" is really the Space element, and "holy" is really Light — so those (and
// their enhanced/special variants) are relabelled Space / Light here. Enhanced
// elements read as "<element>+" (the corrected base name + "+").
const elementLabelMap: Record<string, string> = {
  all: "All",
  air: "Space",
  holy: "Light",
  enhancedair: "Space+",
  enhanceddark: "Dark+",
  enhancedearth: "Earth+",
  enhancedfire: "Fire+",
  enhancedholy: "Light+",
  enhancedwater: "Water+",
  enhancedwind: "Wind+",
  magic: "Magic",
  physics: "Physical",
  special: "Special",
  specialeffectelementair: "Special Space",
  specialeffectelementdark: "Special Dark",
  specialeffectelementearth: "Special Earth",
  specialeffectelementenhancedair: "Special Space+",
  specialeffectelementenhanceddark: "Special Dark+",
  specialeffectelementenhancedearth: "Special Earth+",
  specialeffectelementenhancedfire: "Special Fire+",
  specialeffectelementenhancedholy: "Special Light+",
  specialeffectelementenhancedwater: "Special Water+",
  specialeffectelementenhancedwind: "Special Wind+",
  specialeffectelementfire: "Special Fire",
  specialeffectelementholy: "Special Light",
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

const websiteCharacters = payload.characters
  .filter((character) => !WEBSITE_EXCLUDED_CHARACTER_IDS.has(character.master_pc_id))
  .map(toWebsiteCharacter)

const websiteCharacterById = new Map(websiteCharacters.map((character) => [character.master_pc_id, character]))
const rawConditionEffectMetadata = payload.condition_effect_metadata ?? {}

function stripBattleTextMarkup(text: string | null | undefined): string {
  if (!text) {
    return ""
  }

  return text.replace(/<color=[^>]+>/gi, "").replace(/<\/color>/gi, "")
}

const inferredConditionTextMagnification = (() => {
  const candidates = new Map<number, Array<{ polarity: "enhancement" | "weakening"; rate: number }>>()

  for (const character of websiteCharacters) {
    for (const skill of character.skills) {
      const conditionTypes = Array.from(
        new Set(
          (skill.battle_condition_effects ?? [])
            .map((row) => Number(row.condition_effect_type))
            .filter((value) => Number.isFinite(value) && value >= 0),
        ),
      )
      if (conditionTypes.length !== 1) {
        continue
      }

      const match = stripBattleTextMarkup(skill.description_max_level).match(CONDITION_TEXT_MAGNIFICATION_RE)
      if (!match) {
        continue
      }

      const polarity = match[1]?.toLowerCase() === "weakening" ? "weakening" : "enhancement"
      const multiplier = Number.parseFloat(match[2] ?? "0")
      if (!Number.isFinite(multiplier) || multiplier <= 1) {
        continue
      }

      const rate = Math.round((multiplier - 1) * 10000)
      const conditionType = conditionTypes[0]
      const existing = candidates.get(conditionType) ?? []
      existing.push({ polarity, rate })
      candidates.set(conditionType, existing)
    }
  }

  const resolved = new Map<number, { polarity: "enhancement" | "weakening"; rate: number }>()
  for (const [conditionType, entries] of candidates.entries()) {
    if (entries.length === 0) {
      continue
    }

    const [first] = entries
    if (entries.every((entry) => entry.polarity === first.polarity && entry.rate === first.rate)) {
      resolved.set(conditionType, first)
    }
  }
  return resolved
})()

export function getAllWikiCharacters(): WikiCharacter[] {
  return websiteCharacters
}

export function getConditionEffectMetadata(conditionEffectType: number): WikiConditionEffectMetadata | null {
  const base = rawConditionEffectMetadata[String(conditionEffectType)] ?? null
  const inferred = inferredConditionTextMagnification.get(conditionEffectType)

  if (!base && !inferred) {
    return null
  }

  return {
    condition_effect_type: conditionEffectType,
    ...(base ?? {}),
    text_magnification_rate: inferred?.rate ?? null,
    text_magnification_polarity: inferred?.polarity ?? null,
  }
}

// ---------------------------------------------------------------------------
// Heartprint types and loader
// ---------------------------------------------------------------------------

export type HeartprintRareLevel = {
  level: number
  active_skill_label: string
  skill_description: string | null
  rare_levelup_item_group_id: number
}

export type HeartprintPassiveLevel = {
  level: number
  hp: number
  attack: number
  defense: number
  show_hp: boolean
  show_attack: boolean
  show_defense: boolean
}

export type HeartprintExEffect = {
  level: number
  critical: number
  penetration: number
  cooperation: number
  defcritical: number
  element: number
}

export type HeartprintPassiveSkill = {
  passive_skill_id: number
  target_type: number
  levels: HeartprintPassiveLevel[]
  bless_levels: HeartprintPassiveLevel[]
  ex_effects: HeartprintExEffect[]
}

export type HeartprintUnlockCondition = {
  type: number           // 1 = complete quest, 3 = own heartprint, 6 = collect N heartprints
  target_count: number
  quest_id: number | null
  quest_name: string | null
  target_season: number | null
  required_still_id: number | null
  required_still_title: string | null
  required_still_season: string | null
}

export type Heartprint = {
  heartprint_id: number
  still_type: "normal" | "rare"
  master_still_id?: number
  master_still_rare_id?: number
  tab_type: number
  order: number
  picture_path: string
  release_label: string
  title: string
  skill_description: string | null
  passive_skill_level?: number
  display_character_id: number
  episode_id?: number | null
  season?: string | null          // e.g. "#17" (prefix "Season " for display)
  unlock_conditions?: HeartprintUnlockCondition[]
  facility_source?: {
    area_name?: string | null
    area_id?: number | null
    growth_value?: number | null
  } | null
  arena_rank_source?: {
    rank_name?: string | null
    arena_group?: number | null
  } | null
  event_source?: {
    quest_name?: string | null
    event_id?: number | null
    is_missable?: boolean
    source_type?: string | null
  } | null
  // normal only
  passive_skill?: HeartprintPassiveSkill
  // rare only
  effect_type?: number
  rare_level_group_id?: number
  rare_levels?: HeartprintRareLevel[]
}

type HeartprintPayload = { heartprints: Heartprint[] }
const hpPayload = heartprintData as HeartprintPayload

export type Equipment = {
  id: number
  type: "weapon" | "armor" | "accessory"
  name: string
  rarity: number
  base_rarity: number
  weapon_type: string | null
  image: string | null
  max_level: number | null
  max_atk: number
  max_def: number
  max_hp: number
  level_group_id: number | null
  release_label: string
  effect1: string | null
  effect2: string | null
}

export type CharmSkill = {
  skill_id: number
  name: string | null
  description: string | null
  image_path: string | null
  label: string | null
  effect_type: number | null
  is_quest_skill: boolean
  skill_level_group_id: number | null
  gain: Record<string, number | null> | null
  scale: Record<string, number | null> | null
}

export type Charm = {
  id: number
  rarity: number
  name: string | null
  evolution_group_id: number | null
  init_hp: number | null
  init_attack: number | null
  init_defense: number | null
  max_hp: number | null
  max_attack: number | null
  max_defense: number | null
  possible_skills: CharmSkill[]
  release_label: string
}

const eqPayload = ((equipmentData as Equipment[]).length > 0
  ? equipmentData
  : fallbackEquipmentData) as Equipment[]
const chPayload = ((charmData as Charm[]).length > 0
  ? charmData
  : fallbackCharmData) as Charm[]

export function getAllEquipment(): Equipment[] {
  return eqPayload
}

export function getAllCharms(): Charm[] {
  return chPayload
}

export function getAllHeartprints(): Heartprint[] {
  return hpPayload.heartprints
}

export function getWikiCharacterById(characterId: number): WikiCharacter | undefined {
  return websiteCharacterById.get(characterId)
}

// ---------------------------------------------------------------------------
// Max-level stats (base stats + level growth to character max level)
// ---------------------------------------------------------------------------
type CharStatsEntry = {
  max_hp: number
  max_atk: number
  max_def: number
  sb_hp: number
  sb_atk: number
  sb_def: number
  esb_hp?: number
  esb_atk?: number
  esb_def?: number
  level_group_id: number
  statusboard_id: number
  enhanced_statusboard_id?: number
}
type CharStatsPayload = { char_stats: Record<string, CharStatsEntry>; bond_max: { hp_pct: number; atk_pct: number; def_pct: number } }
const charStatsMap = (charStatsRaw as CharStatsPayload).char_stats
const bondMax = (charStatsRaw as CharStatsPayload).bond_max

type LevelMaxAddEntry = { level: number; add_hp: number; add_attack: number; add_defense: number }
type StatBonusEntry = { hp: number; attack: number; defense: number }
type TeamStatsPayload = {
  level_max_add: Record<string, LevelMaxAddEntry>
  statusboard_totals?: Record<string, StatBonusEntry>
  enhanced_statusboard_totals?: Record<string, StatBonusEntry>
}
const teamStatsPayload = teamStatsRaw as TeamStatsPayload
const levelMaxAddMap = teamStatsPayload.level_max_add
const statusboardTotalsMap = teamStatsPayload.statusboard_totals ?? {}
const enhancedStatusboardTotalsMap = teamStatsPayload.enhanced_statusboard_totals ?? {}

export function getCharMaxStats(characterId: number): { hp: number; attack: number; defense: number; existence: number } | null {
  const entry = charStatsMap[String(characterId)]
  if (entry) {
    const baseWithBoardHp = entry.max_hp + (entry.sb_hp ?? 0) + (entry.esb_hp ?? 0)
    const baseWithBoardAtk = entry.max_atk + (entry.sb_atk ?? 0) + (entry.esb_atk ?? 0)
    const baseWithBoardDef = entry.max_def + (entry.sb_def ?? 0) + (entry.esb_def ?? 0)
    const hp = Math.floor(baseWithBoardHp)
    const attack = Math.floor(baseWithBoardAtk)
    const defense = Math.floor(baseWithBoardDef)
    return { hp, attack, defense, existence: hp + attack + defense }
  }
  // Fallback: compute from base stats + level_max_add for characters missing from char_stats
  const character = websiteCharacterById.get(characterId)
  if (!character?.master_pc_level_group_id) return null
  const add = levelMaxAddMap[String(character.master_pc_level_group_id)]
  if (!add) return null
  const board = statusboardTotalsMap[String(character.master_statusboard_id ?? 0)]
  const enhancedBoard = enhancedStatusboardTotalsMap[String(character.master_enhanced_statusboard_id ?? 0)]
  const hp = Math.floor((character.stats.hp + add.add_hp + (board?.hp ?? 0) + (enhancedBoard?.hp ?? 0)))
  const attack = Math.floor((character.stats.attack + add.add_attack + (board?.attack ?? 0) + (enhancedBoard?.attack ?? 0)))
  const defense = Math.floor((character.stats.defense + add.add_defense + (board?.defense ?? 0) + (enhancedBoard?.defense ?? 0)))
  return { hp, attack, defense, existence: hp + attack + defense }
}

export function toPublicAssetPath(assetPath: string | null | undefined): string {
  if (!assetPath) {
    return "/placeholder.svg"
  }

  // Strip leading slashes and expand generator templates commonly used
  // in asset paths: {1} -> '3' (family variant) and {0} -> 'L' (size suffix)
  const normalized = assetPath.replace(/^\/+/, "")
  const expanded = normalized.replace(/\{1\}/g, "3").replace(/\{0\}/g, "L")

  if (/\.[a-z0-9]+$/i.test(expanded)) {
    // If path already has an extension, normalize webp casing and keep it
    return `/${expanded.replace(/\.webp$/i, ".webp")}`
  }

  return `/${expanded}.webp`
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

type CharacterVisualInfo = Pick<WikiCharacter, "rarity" | "element" | "character_role"> & {
  skills: Array<Pick<WikiSkill, "slot" | "kind"> & { description_max_level?: string }>
}

export function hasExSpecialSkill(character: Pick<WikiCharacter, "rarity" | "element" | "character_role"> & { skills: Array<Pick<WikiSkill, "slot" | "kind"> & { description_max_level?: string }> }): boolean {
  return character.skills.some(
    (skill) =>
      skill.slot === "special_skill" &&
      /EX Soul of Combos/i.test(stripColorTags(skill.description_max_level ?? "")),
  )
}

export function isExUnboundCharacter(character: Pick<WikiCharacter, "element">): boolean {
  return /Enhanced/i.test(character.element)
}

export function isExAttacker(character: Pick<WikiCharacter, "element">): boolean {
  return /^(SpecialEffect)/i.test(character.element)
}

export function getCharacterVisualTier(character: CharacterVisualInfo): number {
  if (character.rarity === 6) {
    return 8 // Epic tier
  }

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

export function getCharacterRarityLabel(character: CharacterVisualInfo): string {
  const visualTier = getCharacterVisualTier(character)

  if (visualTier === 8) {
    return "Epic"
  }

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
  const resolved = characters.map((c) => getCharMaxStats(c.master_pc_id) ?? c.stats)
  cachedStatMaxes = {
    hp: Math.max(...resolved.map((s) => s.hp)),
    attack: Math.max(...resolved.map((s) => s.attack)),
    defense: Math.max(...resolved.map((s) => s.defense)),
    existence: Math.max(...resolved.map((s) => s.existence)),
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
