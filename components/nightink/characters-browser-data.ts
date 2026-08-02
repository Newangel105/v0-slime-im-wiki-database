// Server-side adapter: maps the app's canonical character dataset
// (lib/pc-wiki -> getAllWikiCharacters, the SAME source the existing
// /characters route reads through getAllCharacterBrowserData) into the record
// shape the approved prototype's logic consumes (window.SLIME_CHARACTERS in
// reports/christmas-vision/new-direction-mockup/characters-data.js).
//
// The prototype's ecosystem-live.js filter/sort/render logic is ported verbatim
// in components/nightink/characters-browser.tsx; it expects per-record fields:
//   id, name, title(=affiliation), rarity, element, role, type, weapon,
//   tactics, ultimate, release, stats{hp,attack,defense,existence},
//   thumb, art, forces[], facilities[], skillFilters[], traitFilters[],
//   traits[], exAbilities[], skills[]
//
// Key parity note: the mockup's skillFilters / traitFilters / skills[].filters
// / traits[].filters are exactly the (normalized) `sub_category_label`s of each
// entry's `skill_filter_groups` — confirmed against the baked mockup. We forward
// the raw sub_category_label here and let the client's normalizeEffectFilterLabel
// (a verbatim port of the prototype's) collapse them, so the client logic stays
// byte-for-byte the prototype.

import {
  getAllWikiCharacters,
  getCharMaxStats,
  toPublicAssetPath,
  getDerivedProtectorForceNames,
  getForceIconLookup,
  type WikiCharacter,
  type WikiSkill,
  type WikiTrait,
} from "@/lib/pc-wiki"

export type IndexCharacterForce = {
  name: string
  group: string
  icon: string
}

export type IndexCharacterTrait = {
  slot: string
  kind: string
  name: string
  unlock: string
  desc: string
  icon: string
  filters: string[]
}

export type IndexCharacterExAbility = {
  name: string
  desc: string
  effects: string[]
}

export type IndexCharacterSkill = {
  slot: string
  kind: string
  name: string
  cost: number | null
  desc: string
  icon: string
  filters: string[]
  specialSkillType: string | null
  skillChangeType: string | null
}

export type IndexCharacter = {
  id: number
  name: string
  title: string
  rarity: number
  element: string
  /** canonical secondary leader-skill element for protector dual-element filter */
  master_leader_skill_element_type_2?: string | null
  role: string
  type: string
  weapon: string
  tactics: string
  ultimate: string
  release: string
  stats: { hp: number; attack: number; defense: number; existence: number }
  thumb: string
  art: string
  forces: IndexCharacterForce[]
  facilities: string[]
  skillFilters: string[]
  traitFilters: string[]
  traits: IndexCharacterTrait[]
  exAbilities: IndexCharacterExAbility[]
  skills: IndexCharacterSkill[]
}

// Same PartyL -> PartyM normalization the home/ocean lists apply to thumbs.
function toPartyThumb(icon: string): string {
  return icon
    .replace(/_CharaPartyL\.webp$/i, "_CharaPartyM.webp")
    .replace(/_BlessPartyL\.webp$/i, "_BlessPartyM.webp")
}

// Full-art (CharaInfo / BlessCutin) derived from the party thumb, mirroring the
// home port. Only used by the featured-unit bar's icon, which actually renders
// the thumb; kept for prototype-record parity.
function toFullArt(thumb: string): string {
  return thumb
    .replace(/_CharaPartyM\.webp$/i, "_CharaInfo.webp")
    .replace(/_BlessPartyM\.webp$/i, "_BlessCutin.webp")
}

// The mockup forwards the (lightly normalized) sub_category_label of each
// filter group. The client further normalizes; here we only collapse <br> and
// whitespace so the strings match what the prototype baked.
function filterLabelsFor(groups: WikiSkill["skill_filter_groups"] | WikiTrait["skill_filter_groups"]): string[] {
  if (!groups) return []
  const out: string[] = []
  for (const group of groups) {
    const raw = group.sub_category_label
    if (!raw) continue
    const normalized = raw.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim()
    if (normalized) out.push(normalized)
  }
  return out
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function toIndexSkill(skill: WikiSkill): IndexCharacterSkill {
  return {
    slot: skill.slot,
    kind: skill.kind,
    name: skill.name ?? "",
    cost: typeof skill.cost === "number" ? skill.cost : null,
    desc: skill.description_max_level ?? "",
    icon: skill.icon_path ? toPublicAssetPath(skill.icon_path) : "",
    filters: filterLabelsFor(skill.skill_filter_groups),
    specialSkillType: skill.special_skill_type ?? null,
    skillChangeType: skill.skill_change_type ?? null,
  }
}

function toIndexTrait(trait: WikiTrait): IndexCharacterTrait {
  return {
    slot: trait.slot,
    kind: trait.kind,
    name: trait.name ?? "",
    unlock: trait.unlock ?? "",
    desc: trait.description_max_level ?? "",
    icon: trait.icon_path ? toPublicAssetPath(trait.icon_path) : "",
    filters: filterLabelsFor(trait.skill_filter_groups),
  }
}

function toIndexCharacter(character: WikiCharacter): IndexCharacter {
  const skills = character.skills.map(toIndexSkill)
  const traits = character.traits.map(toIndexTrait)
  const thumb = toPartyThumb(toPublicAssetPath(character.images.icon))

  const forceIconLookup = getForceIconLookup()

  const forces =
    character.forces.length > 0
      ? character.forces.map((force) => ({
          name: force.name,
          group: force.group,
          icon: force.icon_path ? toPublicAssetPath(force.icon_path) : "",
        }))
      : getDerivedProtectorForceNames(character).map((name) => ({
          name,
          group: "force",
          icon: forceIconLookup.get(name) ?? "",
        }))

  return {
    id: character.master_pc_id,
    name: character.name,
    title: character.affiliation_name ?? "",
    rarity: character.rarity,
    element: character.element,
    master_leader_skill_element_type_2: character.master_leader_skill_element_type_2 ?? null,
    role: character.character_role,
    // Supporters carry null weapon/type/ultimate in the source — the baked
    // mockup represents these as empty strings (Boolean() drops them from the
    // filter trays), so coerce to "" here to keep the ported logic identical.
    type: character.attack_type ?? "",
    weapon: character.weapon_type ?? "",
    tactics: character.tactics_type,
    ultimate: character.ultimate_type ?? "",
    release: character.release_date ?? "",
    stats: getCharMaxStats(character.master_pc_id) ?? character.stats,
    thumb,
    art: toFullArt(thumb),
    forces,
    facilities: character.facilities ?? [],
    skillFilters: uniqueStrings(skills.flatMap((skill) => skill.filters)),
    traitFilters: uniqueStrings(traits.flatMap((trait) => trait.filters)),
    traits,
    exAbilities: (character.ex_abilities ?? []).map((ability) => ({
      name: ability.name,
      desc: ability.description,
      effects: ability.effects ?? [],
    })),
    skills,
  }
}

export function getCharacterIndexData(): IndexCharacter[] {
  return getAllWikiCharacters().map(toIndexCharacter)
}
