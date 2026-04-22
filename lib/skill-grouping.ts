import { type WikiSkill } from "@/lib/pc-wiki"

export type SkillGroup = {
  base: WikiSkill
  changed: WikiSkill | null
  changedLabel?: string
  isSecretSkillSwap?: boolean
  attackVariant?: WikiSkill | null
  supportVariant?: WikiSkill | null
}

export function groupSkills(skills: WikiSkill[]): SkillGroup[] {
  const changesByReplaces = new Map<string, WikiSkill>()
  for (const skill of skills) {
    if (skill.is_skill_change && skill.replaces_label) {
      changesByReplaces.set(skill.replaces_label, skill)
    }
  }

  const ultManifest = skills.find((skill) => skill.slot === "active_skill_3") ?? null
  const skill1 = skills.find((skill) => skill.slot === "active_skill_1") ?? null
  const specialSkillSub = skills.find((skill) => skill.slot === "special_skill_sub") ?? null
  const specialSkillAttack = skills.find((skill) => skill.slot === "special_skill_attack") ?? null
  const specialSkillSupport = skills.find((skill) => skill.slot === "special_skill_support") ?? null

  const groups: SkillGroup[] = []
  for (const skill of skills) {
    if (skill.is_skill_change) continue
    if (skill.slot === "active_skill_3") continue
    if (skill.slot === "special_skill_sub") continue
    if (skill.slot === "special_skill_attack") continue
    if (skill.slot === "special_skill_support") continue

    if (ultManifest && skill1 && skill.label === skill1.label) {
      groups.push({
        base: skill,
        changed: ultManifest,
        changedLabel: "Ultimate Manifestation",
      })
      continue
    }

    if (skill.slot === "special_skill" && specialSkillAttack && specialSkillSupport) {
      groups.push({
        base: skill,
        changed: null,
        attackVariant: specialSkillAttack,
        supportVariant: specialSkillSupport,
      })
      continue
    }

    if (skill.slot === "special_skill" && specialSkillSub) {
      groups.push({
        base: skill,
        changed: specialSkillSub,
        changedLabel: specialSkillSub.special_skill_type ?? "Sub",
        isSecretSkillSwap: true,
      })
      continue
    }

    groups.push({
      base: skill,
      changed: changesByReplaces.get(skill.label) ?? null,
    })
  }

  return groups
}