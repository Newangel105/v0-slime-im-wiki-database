// Night-ink character detail — server side. Resolves a single character from
// the same data source the /characters route uses (lib/pc-wiki) and maps the
// app's WikiCharacter onto the flat record shape the approved prototype expects
// (reports/christmas-vision/my_vision/character-live.html + .css + .js), then
// hands a plain payload to the client component which renders it and runs the
// combat-tab / variant-toggle interactions.
//
// Deviations from the prototype (deliberate, see phase report):
// - The brand/nav mastrow (.chr-mastrow > .v2-navsq) is NOT rendered: the app
//   has a global night-ink masthead (components/nightink/site-nav.tsx via
//   app/layout.tsx). The "Archive" back link is kept (as a next/link).
// - window.SLIME_CHARACTERS is replaced by lib/pc-wiki; prev/next ordering and
//   the global stat maxes are computed here over getAllWikiCharacters().
// - Internal links use the real app routes (/characters?... and /characters/{id}).
import { notFound } from "next/navigation"
import {
  getCharMaxStats,
  toPublicAssetPath,
  getDerivedProtectorForceNames,
  getForceIconLookupOf,
  type WikiCharacter,
} from "@/lib/pc-wiki"
import {
  NightInkCharacterDetailClient,
  type DetailCharacter,
  type DetailSkill,
  type DetailTrait,
  type DetailExAbility,
  type DetailForce,
  type DetailVariant,
  type DockLink,
  type StatMaxes,
} from "./character-detail-client"

const NAME_ALIAS_GROUPS: string[][] = [
  ["jaune", "carrera"],
  ["ultimata", "violet"],
  ["testarossa", "blanc"],
]

/* Same PartyL -> PartyM normalization the home/ocean ports apply to images.icon. */
function toPartyThumb(icon: string): string {
  return icon
    .replace(/_CharaPartyL\.webp$/i, "_CharaPartyM.webp")
    .replace(/_BlessPartyL\.webp$/i, "_BlessPartyM.webp")
}

/* The prototype's `art` is the CharaInfo path. The app stores it on
   images.full (…_CharaInfo / …_BlessInfo). Keep it as an asset path so the
   client's `cutinArtFor` can swap CharaInfo -> CharaCutin exactly as the
   prototype does. */
function toInfoArt(fullPath: string): string {
  return toPublicAssetPath(fullPath)
}

/* WikiSkill -> the flat skill object character-live.js renders. */
function toDetailSkill(skill: WikiCharacter["skills"][number]): DetailSkill {
  return {
    slot: skill.slot,
    kind: skill.kind,
    name: skill.name ?? "",
    cost: skill.cost ?? null,
    desc: skill.description_max_level ?? "",
    icon: skill.icon_path ?? "",
    specialSkillType: skill.special_skill_type ?? null,
    skillChangeType: skill.skill_change_type ?? null,
  }
}

function toDetailTrait(trait: WikiCharacter["traits"][number]): DetailTrait {
  return {
    name: trait.name ?? "",
    desc: trait.description_max_level ?? "",
    icon: trait.icon_path ?? "",
    unlock: trait.unlock ?? "",
  }
}

function toDetailExAbility(ability: WikiCharacter["ex_abilities"][number]): DetailExAbility {
  return {
    name: ability.name ?? "",
    desc: ability.description ?? "",
    effects: Array.isArray(ability.effects) ? ability.effects : [],
    icon: "",
  }
}

function toDetailForce(force: WikiCharacter["forces"][number]): DetailForce {
  return {
    name: force.name,
    group: force.group ?? "force",
    icon: force.icon_path ?? "",
  }
}

/* Protectors don't carry a populated `forces` array in the raw data — their
   forces are only expressed as "<color>Name</color> Force characters" text
   inside a skill's description_max_level. Fall back to the same regex-based
   derivation used by the team builder and character browser so protector
   pages show their forces instead of nothing. */
function getCharacterForces(c: WikiCharacter, characters: WikiCharacter[]): DetailForce[] {
  if (c.forces && c.forces.length > 0) {
    return c.forces.map(toDetailForce)
  }
  const forceIconLookup = getForceIconLookupOf(characters)
  return getDerivedProtectorForceNames(c).map((name) => ({
    name,
    group: "force",
    icon: forceIconLookup.get(name) ?? "",
  }))
}

function toDetailCharacter(c: WikiCharacter, characters: WikiCharacter[]): DetailCharacter {
  const stats = getCharMaxStats(c.master_pc_id, c) ?? c.stats
  return {
    id: c.master_pc_id,
    name: c.name,
    title: c.affiliation_name ?? "",
    rarity: c.rarity,
    element: c.element ?? "",
    role: c.character_role ?? "",
    type: c.attack_type ?? "",
    weapon: c.weapon_type ?? "",
    tactics: c.tactics_type ?? "",
    ultimate: c.ultimate_type ?? "",
    release: (c.release_date ?? "").split(" ", 1)[0] ?? "",
    stats: {
      hp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      existence: stats.existence,
    },
    thumb: toPartyThumb(toPublicAssetPath(c.images.icon)),
    art: toInfoArt(c.images.full),
    forces: getCharacterForces(c, characters),
    facilities: c.facilities ?? [],
    traits: (c.traits ?? []).map(toDetailTrait),
    exAbilities: (c.ex_abilities ?? []).map(toDetailExAbility),
    skills: (c.skills ?? []).map(toDetailSkill),
  }
}

export function NightInkCharacterDetail({ characterId, characters }: { characterId: string; characters: WikiCharacter[] }) {
  const resolved = characters.find((c) => c.master_pc_id === Number(characterId))
  if (!resolved) {
    notFound()
    return null
  }

  // newest first — release date desc, then id desc (prototype character-live.js §pick)
  const ordered = [...characters].sort((a, b) => {
    const byRelease = String(b.release_date ?? "").localeCompare(String(a.release_date ?? ""))
    return byRelease !== 0 ? byRelease : b.master_pc_id - a.master_pc_id
  })
  const index = Math.max(
    0,
    ordered.findIndex((c) => c.master_pc_id === resolved.master_pc_id),
  )
  const prev = ordered[index - 1]
  const next = ordered[index + 1]

  // Global stat maxes computed over the same (max-level) stats the bars use.
  const statsList = ordered.map((c) => getCharMaxStats(c.master_pc_id, c) ?? c.stats)
  const statMaxes: StatMaxes = {
    hp: Math.max(...statsList.map((s) => Number(s.hp) || 0), 1),
    attack: Math.max(...statsList.map((s) => Number(s.attack) || 0), 1),
    defense: Math.max(...statsList.map((s) => Number(s.defense) || 0), 1),
    existence: Math.max(...statsList.map((s) => Number(s.existence) || 0), 1),
  }

  const toDock = (c: WikiCharacter | undefined): DockLink | null =>
    c ? { id: c.master_pc_id, name: c.name, title: c.affiliation_name ?? "" } : null

  function stripHtml(value: unknown): string {
    return String(value ?? "").replace(/<[^>]*>/g, " ")
  }

  function normalizeLabel(value: unknown): string {
    return stripHtml(value)
      .toLowerCase()
      .replace(/&nbsp;/g, " ")
      .replace(/[^a-z0-9]+/g, "")
      .trim()
  }

  // Variants: the OTHER records that share this character's name (e.g. every
  // "Rimuru Tempest"), newest first (ordered is release-desc), excluding self.
  const variantNames =
    NAME_ALIAS_GROUPS.find((group) =>
      group.includes(normalizeLabel(resolved.name)),
    ) ?? [normalizeLabel(resolved.name)]

  const variants: DetailVariant[] = ordered
    .filter((c) => {
      if (c.master_pc_id === resolved.master_pc_id) return false

      return variantNames.includes(normalizeLabel(c.name))
    })
    .map((c) => ({
      id: c.master_pc_id,
      name: c.name,
      title: c.affiliation_name ?? "",
      thumb: toPartyThumb(toPublicAssetPath(c.images.icon)),
      rarity: c.rarity,
    }))

  return (
    <NightInkCharacterDetailClient
      character={toDetailCharacter(resolved, characters)}
      statMaxes={statMaxes}
      prev={toDock(prev)}
      next={toDock(next)}
      recordIndex={index + 1}
      recordTotal={ordered.length}
      variants={variants}
    />
  )
}
