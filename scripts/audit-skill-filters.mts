import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import data from "../pc_wiki.generated.json" with { type: "json" }

import {
  getSkillEffectFilterGroups,
  getSkillEffectTags,
  primeCharacterEffectFilterHeuristics,
} from "../lib/character-effect-filters"
import { groupSkills } from "../lib/skill-grouping"

const workspaceRoot = path.resolve(import.meta.dirname, "..")
const reportsDir = path.join(workspaceRoot, "reports")
const auditPath = path.join(reportsDir, "skill-filter-audit.json")
const unmatchedPath = path.join(reportsDir, "skill-filter-unmatched.json")

const characters = data.characters

type GroupedVariantRecord = {
  key: string
  slot: string
  name: string
  tags: string[]
  description: string
}

type GroupedEntryRecord = {
  master_pc_id: number
  character: string
  affiliation: string
  base_slot: string
  base_name: string
  variants: GroupedVariantRecord[]
  all_tags: string[]
}

function getPossibleReason(skill: (typeof characters)[number]["skills"][number], tags: string[]): string {
  if (tags.length > 0) {
    return "Tagged"
  }

  if ((skill.skill_filter_groups?.length ?? 0) === 0) {
    return "No skill_filter_groups metadata on this skill"
  }

  if (skill.is_skill_change) {
    return "Skill-change variant has metadata but no supported filter tags"
  }

  const plainDescription = skill.description_max_level?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? ""
  if (/deals? .*damage/i.test(plainDescription) && !/(increase|decrease|raise|lower|convert|restore|recover|steal|poison|stun|seal|enamor|bind)/i.test(plainDescription)) {
    return "Pure damage effect outside the current filter taxonomy"
  }

  return "Has skill_filter_groups metadata, but the current classifier produced no supported tags"
}

primeCharacterEffectFilterHeuristics(characters.flatMap((character) => character.skills))

const groupedEntries: GroupedEntryRecord[] = characters.flatMap((character) =>
  groupSkills(character.skills).map((group) => {
    const variants = [
      { key: "base", skill: group.base },
      group.changed ? { key: "changed", skill: group.changed } : null,
      group.attackVariant ? { key: "attack", skill: group.attackVariant } : null,
      group.supportVariant ? { key: "support", skill: group.supportVariant } : null,
    ]
      .filter((variant): variant is { key: string; skill: (typeof characters)[number]["skills"][number] } => Boolean(variant))
      .map((variant) => ({
        key: variant.key,
        slot: variant.skill.slot,
        name: variant.skill.name,
        tags: [...getSkillEffectTags(variant.skill)].sort(),
        description: variant.skill.description_max_level ?? "",
      }))

    return {
      master_pc_id: character.master_pc_id,
      character: character.name,
      affiliation: character.affiliation_name,
      base_slot: group.base.slot,
      base_name: group.base.name,
      variants,
      all_tags: [...new Set(variants.flatMap((variant) => variant.tags))].sort(),
    }
  }),
)

const audit = getSkillEffectFilterGroups(characters.flatMap((character) => character.skills)).map((group) => ({
  key: group.key,
  title: group.title,
  options: group.options.map((option) => {
    const matches = groupedEntries.flatMap((entry) => {
      const matchingVariants = entry.variants.filter((variant) => variant.tags.includes(option.value))
      if (matchingVariants.length === 0) {
        return []
      }

      return [{
        master_pc_id: entry.master_pc_id,
        character: entry.character,
        affiliation: entry.affiliation,
        base_slot: entry.base_slot,
        base_name: entry.base_name,
        matching_variants: matchingVariants,
      }]
    })

    return {
      value: option.value,
      label: option.label,
      match_count: matches.length,
      matches,
    }
  }),
}))

const unmatchedSkills = characters.flatMap((character) =>
  character.skills.flatMap((skill) => {
    const tags = [...getSkillEffectTags(skill)].sort()
    if (tags.length > 0) {
      return []
    }

    return [{
      master_pc_id: character.master_pc_id,
      character: character.name,
      affiliation: character.affiliation_name,
      slot: skill.slot,
      name: skill.name,
      kind: skill.kind,
      is_skill_change: !!skill.is_skill_change,
      skill_filter_group_count: skill.skill_filter_groups?.length ?? 0,
      skill_filter_groups: (skill.skill_filter_groups ?? []).map((group) => ({
        master_skill_filter_group_id: group.master_skill_filter_group_id,
        category_name: group.category_name,
        sub_category_label: group.sub_category_label,
        effect_family: group.effect_family,
        raw_effect_polarity: group.raw_effect_polarity,
        target_team: group.target_team,
        target_scope: group.target_scope,
      })),
      possible_reason: getPossibleReason(skill, tags),
      description: skill.description_max_level ?? "",
    }]
  }),
)

const unmatchedGroupedEntries = groupedEntries
  .filter((entry) => entry.all_tags.length === 0)
  .map((entry) => ({
    master_pc_id: entry.master_pc_id,
    character: entry.character,
    affiliation: entry.affiliation,
    base_slot: entry.base_slot,
    base_name: entry.base_name,
    possible_reason: entry.variants.every((variant) => variant.description.trim().length === 0)
      ? "No variant descriptions"
      : "No variant in this grouped skill entry maps to any current filter tag",
    variants: entry.variants,
  }))

const unmatchedSummary = {
  total_raw_skills: characters.reduce((total, character) => total + character.skills.length, 0),
  unmatched_raw_skill_count: unmatchedSkills.length,
  total_grouped_entries: groupedEntries.length,
  unmatched_grouped_entry_count: unmatchedGroupedEntries.length,
  unmatched_reason_counts: Object.entries(
    unmatchedSkills.reduce<Record<string, number>>((counts, skill) => {
      counts[skill.possible_reason] = (counts[skill.possible_reason] ?? 0) + 1
      return counts
    }, {}),
  )
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => ({ reason, count })),
}

await mkdir(reportsDir, { recursive: true })
await writeFile(auditPath, `${JSON.stringify({ generated_at: new Date().toISOString(), filters: audit }, null, 2)}\n`)
await writeFile(unmatchedPath, `${JSON.stringify({ generated_at: new Date().toISOString(), summary: unmatchedSummary, unmatched_raw_skills: unmatchedSkills, unmatched_grouped_entries: unmatchedGroupedEntries }, null, 2)}\n`)

console.log(JSON.stringify({
  auditPath,
  unmatchedPath,
  totalFilters: audit.reduce((total, group) => total + group.options.length, 0),
  unmatchedRawSkills: unmatchedSkills.length,
  unmatchedGroupedEntries: unmatchedGroupedEntries.length,
  topReasons: unmatchedSummary.unmatched_reason_counts.slice(0, 5),
}, null, 2))