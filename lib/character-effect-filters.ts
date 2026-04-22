import { normalizeLabel, stripColorTags } from "@/lib/pc-wiki"

export type CharacterEffectFilterSkill = {
  name?: string | null
  slot?: string | null
  description_max_level?: string | null
  skill_filter_groups?: Array<{
    category_name?: string | null
    sub_category_label?: string | null
    effect_family?: string | null
    raw_effect_polarity?: string | null
    target_type_name?: string | null
    target_team?: string | null
    target_scope?: string | null
    change_source_label?: string | null
    change_target_label?: string | null
  }> | null
}

export type CharacterEffectFilterCharacter = {
  master_pc_id: number
  skills: CharacterEffectFilterSkill[]
  traits: Array<{
    name: string
    description_max_level?: string | null
    skill_filter_groups?: CharacterEffectFilterSkill["skill_filter_groups"]
  }>
  ex_abilities?: Array<{
    name?: string | null
    description?: string | null
  }>
  effect_tags?: string[]
}

export type CharacterEffectFilterOption = {
  label: string
  value: string
}

export type CharacterEffectFilterGroup = {
  key: string
  title: string
  options: CharacterEffectFilterOption[]
}

type EntryDefinition = {
  label: string
  aliases: string[]
}

type GroupDefinition = {
  key: string
  title: string
  entries: EntryDefinition[]
}

const effectTagCache = new Map<number, Set<string>>()
const effectTagLabelRegistry = new Map<string, { groupKey: string; label: string }>()
const learnedEntriesByGroup = new Map<string, EntryDefinition[]>()
const LEARNED_GROUP_KEYS = new Set(["buff_all", "soul_buff", "debuff_all", "buff_self", "debuff_single"])

const soulAmountEntries: EntryDefinition[] = [
  { label: "x2", aliases: ["x2"] },
  { label: "x1", aliases: ["x1"] },
  { label: "All", aliases: ["changes all souls", "all souls", "changes all allies souls", "changes all allies' souls"] },
  { label: "x3", aliases: ["x3"] },
]

const toSoulEntries: EntryDefinition[] = [
  { label: "Soul of Secrets", aliases: ["into soul of secrets"] },
  { label: "Soul of Skills", aliases: ["into soul of skills"] },
  { label: "Soul of Divine Protection", aliases: ["into soul of divine protection"] },
  { label: "Self", aliases: ["into own souls", "changes own souls"] },
  { label: "Another Vanguard Character", aliases: ["into another vanguard character"] },
  { label: "Soul of Unity", aliases: ["into soul of unity"] },
  { label: "Dragon Soul", aliases: ["into dragon soul"] },
  { label: "1 Type (No DOWN Effects)", aliases: ["1 type no down effects"] },
]

const gaugeEntries: EntryDefinition[] = [
  { label: "Skill Points", aliases: ["skill point", "skill points"] },
  { label: "Secret Skill Gauge", aliases: ["secret skill gauge"] },
]

const buffAllEntries: EntryDefinition[] = [
  { label: "Damage", aliases: ["damage"] },
  { label: "Pierce Rate", aliases: ["pierce rate"] },
  { label: "Pierce Power", aliases: ["pierce power"] },
  { label: "Critical Rate", aliases: ["critical rate"] },
  { label: "Soul of Combos", aliases: ["soul of combos"] },
  { label: "P-ATK", aliases: ["p atk", "physical atk"] },
  { label: "ATK", aliases: [" atk"] },
  { label: "Guard Rate", aliases: ["guard rate"] },
  { label: "Critical Damage", aliases: ["critical damage"] },
  { label: "M-ATK", aliases: ["m atk", "magic atk"] },
  { label: "All Attribute Resistance", aliases: ["all attribute resistance"] },
  { label: "Dark ATK", aliases: ["dark atk"] },
  { label: "DEF", aliases: [" def"] },
  { label: "Critical Resistance", aliases: ["critical resistance"] },
  { label: "Wind ATK", aliases: ["wind atk"] },
  { label: "Space ATK", aliases: ["space atk"] },
  { label: "Light ATK", aliases: ["light atk"] },
  { label: "Fire ATK", aliases: ["fire atk"] },
  { label: "Counterattack Rate", aliases: ["counterattack rate"] },
  { label: "Earth ATK", aliases: ["earth atk"] },
  { label: "Max HP", aliases: ["max hp"] },
  { label: "Water ATK", aliases: ["water atk"] },
  { label: "Stun Evasion Rate", aliases: ["stun evasion rate"] },
  { label: "Guard Power", aliases: ["guard power"] },
  { label: "Pierce Resistance", aliases: ["pierce resistance"] },
  { label: "Guard Penetration", aliases: ["guard penetration"] },
  { label: "Poison Evasion Rate", aliases: ["poison evasion rate"] },
  { label: "Counter Power", aliases: ["counter power"] },
  { label: "Weakness Strike", aliases: ["weakness strike", "weakeness strike"] },
  { label: "Drago", aliases: ["drago"] },
  { label: "Synergy Rate", aliases: ["synergy rate"] },
  { label: "Synergy Power", aliases: ["synergy power"] },
  { label: "Critical Power", aliases: ["critical power"] },
  { label: "Charge-Type M-ATK", aliases: ["charge type m atk"] },
  { label: "Defense-Type P-ATK", aliases: ["defense type p atk"] },
  { label: "EX Soul of Combos", aliases: ["ex soul of combos"] },
  { label: "All Attribute ATK", aliases: ["all attribute atk"] },
  { label: "Speed-Type P-ATK", aliases: ["speed type p atk"] },
  { label: "Defense-Type M-ATK", aliases: ["defense type m atk"] },
  { label: "Physical/Magic Attack Damage", aliases: ["physical attack damage", "magic attack damage"] },
  { label: "Aegis Rate", aliases: ["aegis rate"] },
  { label: "Stun Strike", aliases: ["stun strike"] },
  { label: "Aegis Power", aliases: ["aegis power"] },
]

const buffSingleEntries: EntryDefinition[] = []

const soulBuffEntries: EntryDefinition[] = [
  { label: "Soul of Secrets Gauge", aliases: ["soul of secrets gauge", "soul of secrets guage"] },
  { label: "Soul of Skills Gauges", aliases: ["soul of skills gauges"] },
  { label: "Soul of Divine Protection Gauge", aliases: ["soul of divine protection gauge"] },
  { label: "Soul of Divine Protection Skill Point", aliases: ["soul of divine protection skill point"] },
  { label: "Soul of Divine Protection Damage", aliases: ["soul of divine protection damage"] },
  { label: "Soul of Skills Secret Gauge", aliases: ["soul of skills secret gauge"] },
  { label: "Soul of Skills Skill Point", aliases: ["soul of skills skill point"] },
  { label: "Soul of Skills Damage", aliases: ["soul of skills damage"] },
  { label: "Soul of Secrets Damage", aliases: ["soul of secrets damage"] },
  { label: "All Souls Protection Gauge", aliases: ["all souls protection gauge"] },
  { label: "Soul of Secrets Secret Gauges", aliases: ["soul of secrets secret gauges"] },
  { label: "All Souls Secret Gauge", aliases: ["all souls secret gauge"] },
  { label: "Divine Protection Skill Point", aliases: ["divine protection skill point"] },
  { label: "Soul of Secrets Skill Point", aliases: ["soul of secrets skill point"] },
  { label: "Soul of Secrets Protection Gauge", aliases: ["soul of secrets protection gauge"] },
  { label: "All Souls Gauges", aliases: ["all souls gauges"] },
  { label: "All Souls Skill Point", aliases: ["all souls skill point"] },
  { label: "Soul of Skill Protection Gauge", aliases: ["soul of skill protection gauge"] },
  { label: "Soul of Divine Protection Secret Skill Gauge", aliases: ["soul of divine protection secret skill gauge"] },
]

const debuffAllEntries: EntryDefinition[] = [
  { label: "Pierce Resistance", aliases: ["pierce resistance"] },
  { label: "Critical Resistance", aliases: ["critical resistance"] },
  { label: "DEF", aliases: [" def"] },
  { label: "Space Resistance", aliases: ["space resistance"] },
  { label: "Seal DEF UP", aliases: ["seal def up"] },
  { label: "Fire Resistance", aliases: ["fire resistance"] },
  { label: "ATK", aliases: [" atk"] },
  { label: "Light Resistance", aliases: ["light resistance"] },
  { label: "Dark Resistance", aliases: ["dark resistance"] },
  { label: "Critical Damage", aliases: ["critical damage"] },
  { label: "Wind Resistance", aliases: ["wind resistance"] },
  { label: "Earth Resistance", aliases: ["earth resistance"] },
  { label: "Water Resistance", aliases: ["water resistance"] },
  { label: "Counterattack Rate", aliases: ["counterattack rate"] },
  { label: "Guard Power", aliases: ["guard power"] },
  { label: "Seal Critical Resistance UP", aliases: ["seal critical resistance up"] },
  { label: "Pierce Power", aliases: ["pierce power"] },
  { label: "Counterattack Resistance", aliases: ["counterattack resistance"] },
  { label: "Magic Attack Resistance", aliases: ["magic attack resistance"] },
  { label: "Secret Skill Damage Resistance", aliases: ["secret skill damage resistance"] },
  { label: "Seal Pierce Resistance UP", aliases: ["seal pierce resistance up"] },
  { label: "Seal Synergy Resistance UP", aliases: ["seal synergy resistance up"] },
  { label: "All Atribute Resistance", aliases: ["all atribute resistance", "all attribute resistance"] },
  { label: "Weakness Resistance", aliases: ["weakness resistance"] },
  { label: "Physical Attack Damage Resistance", aliases: ["physical attack damage resistance"] },
  { label: "Aegis Resistance", aliases: ["aegis resistance"] },
  { label: "Synergy Resistance", aliases: ["synergy resistance"] },
  { label: "Synergy Power", aliases: ["synergy power"] },
  { label: "Enamor", aliases: ["enamor"] },
  { label: "Frostbite", aliases: ["frostbite"] },
  { label: "Vengeance", aliases: ["vengeance"] },
  { label: "Despair", aliases: ["despair"] },
  { label: "Dread", aliases: ["dread"] },
  { label: "Chaos", aliases: ["chaos"] },
]

const fromSoulEntries: EntryDefinition[] = [
  { label: "All", aliases: ["all"] },
  { label: "Soul of Divine Protection", aliases: ["changes soul of divine protection", "from soul of divine protection"] },
  { label: "Soul of Skills", aliases: ["changes soul of skills", "from soul of skills"] },
  { label: "Soul of Combos", aliases: ["changes soul of combos", "from soul of combos"] },
  { label: "Soul of Secrets", aliases: ["changes soul of secrets", "from soul of secrets"] },
  { label: "Soul of Unity", aliases: ["changes soul of unity", "from soul of unity"] },
  { label: "Dragon Soul", aliases: ["changes dragon soul", "from dragon soul"] },
  { label: "Another Random Character", aliases: ["another random character"] },
  { label: "Change Own Souls", aliases: ["changes own souls"] },
  { label: "Transfer Own Souls", aliases: ["transfer own souls"] },
  { label: "Non-Divine Protection Soul", aliases: ["non divine protection soul"] },
  { label: "Non-Secrets", aliases: ["non secrets"] },
]

const buffSelfEntries: EntryDefinition[] = [
  { label: "Critical Damage", aliases: ["critical damage"] },
  { label: "Water ATK", aliases: ["water atk"] },
  { label: "Soul of Combos", aliases: ["soul of combos"] },
  { label: "EX Soul of Combos", aliases: ["ex soul of combos"] },
  { label: "M-ATK", aliases: ["m atk", "magic atk"] },
  { label: "Fire ATK", aliases: ["fire atk"] },
  { label: "ATK", aliases: [" atk"] },
  { label: "Pierce Power", aliases: ["pierce power"] },
  { label: "Wind ATK", aliases: ["wind atk"] },
  { label: "Dark ATK", aliases: ["dark atk"] },
  { label: "DEF", aliases: [" def"] },
  { label: "Light ATK", aliases: ["light atk"] },
  { label: "Pierce Rate", aliases: ["pierce rate"] },
  { label: "Critical Rate", aliases: ["critical rate"] },
  { label: "Max HP", aliases: ["max hp"] },
  { label: "P-ATK", aliases: ["p atk", "physical atk"] },
  { label: "Counter Power", aliases: ["counter power"] },
  { label: "Counterattack Rate", aliases: ["counterattack rate"] },
  { label: "Guard Penetration", aliases: ["guard penetration"] },
  { label: "Drago", aliases: ["drago"] },
  { label: "All Attribute Resistance", aliases: ["all attribute resistance"] },
  { label: "Poison Evasion Rate", aliases: ["poison evasion rate"] },
  { label: "Stun Evasion Rate", aliases: ["stun evasion rate"] },
  { label: "Synergy Rate", aliases: ["synergy rate"] },
  { label: "Physical Damage", aliases: ["physical damage"] },
]

const specialEntries: EntryDefinition[] = [
  { label: "Skill Cost Reset", aliases: ["skill cost reset"] },
  { label: "Self Taunt", aliases: ["self taunt", "taunt"] },
  { label: "Burn", aliases: ["burn"] },
  { label: "Deals Damage", aliases: ["deals damage"] },
  { label: "Absorb Secret Skill", aliases: ["absorb secret skill"] },
  { label: "Make Another Move", aliases: ["make another move", "second move"] },
  { label: "Redraw", aliases: ["redraw"] },
  { label: "Barrier", aliases: ["barrier"] },
  { label: "Multi-hit Soul", aliases: ["multi hit soul of divine protection", "multi hit soul"] },
  { label: "Inspire", aliases: ["inspire"] },
  { label: "Grit", aliases: ["grit"] },
  { label: "Invincible", aliases: ["invincible"] },
  { label: "Resurrection", aliases: ["resurrection"] },
  { label: "Continuous Heal", aliases: ["continuous heal"] },
  { label: "Secret Skill Vitalization", aliases: ["secret skill vitalization"] },
  { label: "Reckoning", aliases: ["reckoning"] },
  { label: "Damage Absorption", aliases: ["damage absorption"] },
  { label: "Unlimited Skill Use", aliases: ["unlimited skill use"] },
  { label: "Live Mode", aliases: ["live mode"] },
  { label: "Status Effects Nullified", aliases: ["status effects nullified", "nullifies status effects"] },
  { label: "Seeking Soul", aliases: ["seeking soul"] },
  { label: "Lord's Ambition", aliases: ["lord's ambition", "lords ambition"] },
]

const debuffSingleEntries: EntryDefinition[] = [
  { label: "Stun", aliases: ["stun"] },
  { label: "DEF", aliases: [" def"] },
  { label: "ATK", aliases: [" atk"] },
  { label: "Critical Resistance", aliases: ["critical resistance"] },
  { label: "Magic Attack Resistance", aliases: ["magic attack resistance"] },
  { label: "Critical Damage", aliases: ["critical damage"] },
  { label: "Guard Power", aliases: ["guard power"] },
  { label: "Counterattack Rate", aliases: ["counterattack rate"] },
  { label: "Pierce Resistance", aliases: ["pierce resistance"] },
  { label: "Guard Rate", aliases: ["guard rate"] },
  { label: "Poison", aliases: ["poison"] },
  { label: "All Attribute Resistance", aliases: ["all attribute resistance"] },
  { label: "Weakness Resistance", aliases: ["weakness resistance"] },
  { label: "Freeze", aliases: ["freeze"] },
  { label: "Enamor", aliases: ["enamor"] },
  { label: "Frostbite", aliases: ["frostbite"] },
  { label: "Vengeance", aliases: ["vengeance"] },
  { label: "Despair", aliases: ["despair"] },
  { label: "Dread", aliases: ["dread"] },
  { label: "Chaos", aliases: ["chaos"] },
]

const healEntries: EntryDefinition[] = [
  { label: "Lowest Ally Heal", aliases: ["lowest ally", "lowest hp ally"] },
  { label: "All Heal", aliases: ["all allies hp", "recovers all allies", "heals all allies", "all allies recover"] },
  { label: "Heal Self", aliases: ["own hp", "recovers own hp", "heals self"] },
  { label: "All Recover Poison", aliases: ["recover poison"] },
  { label: "All Recover Stun", aliases: ["recover stun"] },
  { label: "Traits Buff All ATK", aliases: ["traits buff all atk"] },
]

const groupDefinitions: GroupDefinition[] = [
  { key: "soul_amount", title: "SOUL AMOUNT", entries: soulAmountEntries },
  { key: "to_soul", title: "TO SOUL", entries: toSoulEntries },
  { key: "gauge", title: "GAUGE", entries: gaugeEntries },
  { key: "buff_all", title: "BUFF ALL", entries: buffAllEntries },
  { key: "buff_single", title: "BUFF SINGLE", entries: buffSingleEntries },
  { key: "soul_buff", title: "SOUL BUFF", entries: soulBuffEntries },
  { key: "debuff_all", title: "DEBUFF ALL", entries: debuffAllEntries },
  { key: "from_soul", title: "FROM SOUL", entries: fromSoulEntries },
  { key: "buff_self", title: "BUFF SELF", entries: buffSelfEntries },
  { key: "special", title: "SPECIAL", entries: specialEntries },
  { key: "debuff_single", title: "DEBUFF SINGLE", entries: debuffSingleEntries },
  { key: "heal", title: "HEAL", entries: healEntries },
]

const groupDefinitionsByKey = new Map(groupDefinitions.map((group) => [group.key, group]))
const scopeClassificationGroupKeys = new Set(["buff_all", "buff_single", "buff_self", "debuff_all", "debuff_single"])

function makeValue(groupKey: string, label: string): string {
  return `${groupKey}:${normalizeLabel(label)}`
}

function addTag(tagSet: Set<string>, groupKey: string, label: string) {
  const value = makeValue(groupKey, label)
  effectTagLabelRegistry.set(value, { groupKey, label })
  tagSet.add(value)
}

function getGroupDefinition(key: string): GroupDefinition {
  const group = groupDefinitionsByKey.get(key)
  if (!group) {
    throw new Error(`Unknown effect filter group: ${key}`)
  }

  return group
}

function normalizeText(value: string): string {
  return normalizeLabel(stripColorTags(value))
    .replace(/[%％]/g, "%")
    .replace(/[-/]/g, " ")
    .replace(/[^a-z0-9+%\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function splitEffectClauses(value: string): string[] {
  return value
    .split(/\r?\n|\.(?:\s+|$)/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function isSoulConversionSegment(segment: string): boolean {
  return /(change|changes|convert|converts|into|from|transfer)\b/.test(segment) && /(soul|souls|dragon soul)/.test(segment)
}

function buildSegmentsFromSkills(skills: CharacterEffectFilterSkill[]): string[] {
  return [
    ...skills.flatMap((skill) => [skill.name ?? "", skill.description_max_level ?? ""]),
  ]
    .flatMap(splitEffectClauses)
    .map(normalizeText)
    .filter(Boolean)
}

function normalizeMetadataValue(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function mapChangeSourceToFilterLabel(value: string | null | undefined): string | null {
  switch (normalizeMetadataValue(value)) {
    case "All":
      return "All"
    case "Divine Protection":
      return "Soul of Divine Protection"
    case "Skills":
      return "Soul of Skills"
    case "Secrets":
      return "Soul of Secrets"
    case "Combos":
      return "Soul of Combos"
    case "Own":
      return "Change Own Souls"
    case "Unity":
      return "Soul of Unity"
    case "Dragon Soul":
      return "Dragon Soul"
    default:
      return normalizeMetadataValue(value)
  }
}

function mapChangeTargetToFilterLabel(value: string | null | undefined): string | null {
  switch (normalizeMetadataValue(value)) {
    case "Divine Protection":
      return "Soul of Divine Protection"
    case "Skills":
      return "Soul of Skills"
    case "Secrets":
      return "Soul of Secrets"
    case "Own":
      return "Self"
    case "Unity":
      return "Soul of Unity"
    case "Dragon Soul":
      return "Dragon Soul"
    case "1 Type (No DOWN Effects)":
      return "1 Type (No DOWN Effects)"
    default:
      return normalizeMetadataValue(value)
  }
}

function buildOrbLineAliases(value: string | null | undefined, mode: "source" | "target"): string[] {
  switch (normalizeMetadataValue(value)) {
    case "All":
      return ["all souls", "all allies souls", "all allies' souls"]
    case "Divine Protection":
      return ["soul of divine protection"]
    case "Skills":
      return ["soul of skills"]
    case "Secrets":
      return ["soul of secrets"]
    case "Combos":
      return ["soul of combos"]
    case "Own":
      return mode === "source" ? ["own souls", "own soul"] : ["into own souls", "to self", "to own"]
    case "Unity":
      return ["soul of unity"]
    case "Dragon Soul":
      return ["dragon soul"]
    case "1 Type (No DOWN Effects)":
      return ["1 type", "one type", "no down effects"]
    default:
      return value ? [value] : []
  }
}

function hasAnyAlias(text: string, aliases: string[]): boolean {
  return aliases.some((alias) => text.includes(normalizeText(alias)))
}

function extractOrbChangeAmountLabel(
  description: string | null | undefined,
  sourceLabel: string | null | undefined,
  targetLabel: string | null | undefined,
): string | null {
  const sourceAliases = buildOrbLineAliases(sourceLabel, "source")
  const targetAliases = buildOrbLineAliases(targetLabel, "target")
  const lines = splitEffectClauses(stripColorTags(description ?? ""))
    .map(normalizeText)
    .filter(Boolean)

  for (const line of lines) {
    if (targetAliases.length > 0 && !hasAnyAlias(line, targetAliases)) {
      continue
    }
    if (sourceAliases.length > 0 && !hasAnyAlias(line, sourceAliases)) {
      continue
    }

    const amountMatch = line.match(/\bx(\d+)\b/i)
    if (amountMatch) {
      const amount = Number.parseInt(amountMatch[1] ?? "", 10)
      if (amount === 1) return "x1"
      if (amount === 2) return "x2"
      if (amount === 3) return "x3"
      return "All"
    }

    if (/\ball\b/.test(line) || line.includes("newly added")) {
      return "All"
    }

    if (/\bsouls\b/.test(line) && !/soul of/.test(line)) {
      return "All"
    }

    if (normalizeMetadataValue(sourceLabel) && !/\bx\d+\b/i.test(line)) {
      return "All"
    }

    return "x1"
  }

  return null
}

function addMetadataDerivedTags(entry: CharacterEffectFilterSkill, tagSet: Set<string>) {
  for (const filterGroup of entry.skill_filter_groups ?? []) {
    const normalizedLabel = normalizeSkillFilterGroupLabel(filterGroup.sub_category_label)
    if (!normalizedLabel) {
      continue
    }

    const categoryName = filterGroup.category_name ?? null
    const rawLabel = filterGroup.sub_category_label ?? ""
    const isLeaderStyleSkill = entry.slot === "leader_skill" || entry.slot === "assist_leader_skill"
    const targetTeam = normalizeMetadataValue(filterGroup.target_team) ?? (isLeaderStyleSkill ? "ally" : null)
    const targetScope = normalizeMetadataValue(filterGroup.target_scope) ?? (isLeaderStyleSkill ? "all" : null)

    if (categoryName === "BuffChangeAct") {
      const fromLabel = mapChangeSourceToFilterLabel(filterGroup.change_source_label)
      const toLabel = mapChangeTargetToFilterLabel(filterGroup.change_target_label)
      const amountLabel = extractOrbChangeAmountLabel(
        entry.description_max_level,
        filterGroup.change_source_label,
        filterGroup.change_target_label,
      )

      if (fromLabel) {
        addTag(tagSet, "from_soul", fromLabel)
      }
      if (toLabel) {
        addTag(tagSet, "to_soul", toLabel)
      }
      if (amountLabel) {
        addTag(tagSet, "soul_amount", amountLabel)
      }
      continue
    }

    if (categoryName === "Special") {
      addTag(tagSet, "special", normalizedLabel)
    }

    if (/(gauge|skill point)/i.test(normalizedLabel)) {
      if (/(soul of|all souls)/i.test(normalizedLabel)) {
        addTag(tagSet, "soul_buff", normalizedLabel)
      } else {
        addTag(tagSet, "gauge", normalizedLabel)
      }
    }

    if (/(all souls|soul of)/i.test(rawLabel) && /damage/i.test(rawLabel) && !/^EX? Soul of Combos Damage(?:\s+UP|\s+DOWN)?$/i.test(rawLabel)) {
      addTag(tagSet, "soul_buff", normalizedLabel)
    }

    if (/(recover|heal)/i.test(normalizedLabel)) {
      addTag(tagSet, "heal", normalizedLabel)
    }

    if (!["DamageUP", "DamageDown", "AbnormalCondition", "ConditionChange"].includes(categoryName ?? "")) {
      continue
    }

    if (targetTeam === "enemy") {
      addTag(tagSet, targetScope === "all" ? "debuff_all" : "debuff_single", normalizedLabel)
      continue
    }

    if (targetTeam === "self") {
      addTag(tagSet, "buff_self", normalizedLabel)
      continue
    }

    if (targetTeam === "ally") {
      if (targetScope === "all") {
        addTag(tagSet, "buff_all", normalizedLabel)
      } else {
        addTag(tagSet, "buff_single", normalizedLabel)
      }
    }
  }
}

function mergeHeuristicTags(metadataTagSet: Set<string>, heuristicTagSet: Set<string>): Set<string> {
  const merged = new Set(metadataTagSet)

  for (const value of heuristicTagSet) {
    const separatorIndex = value.indexOf(":")
    const groupKey = separatorIndex > 0 ? value.slice(0, separatorIndex) : value
    const labelEntry = effectTagLabelRegistry.get(value)

    if (labelEntry && scopeClassificationGroupKeys.has(groupKey)) {
      for (const existingValue of [...merged]) {
        if (existingValue === value) {
          continue
        }

        const existingSeparatorIndex = existingValue.indexOf(":")
        if (existingSeparatorIndex <= 0) {
          continue
        }

        const existingGroupKey = existingValue.slice(0, existingSeparatorIndex)
        if (!scopeClassificationGroupKeys.has(existingGroupKey)) {
          continue
        }

        const existingLabelEntry = effectTagLabelRegistry.get(existingValue)
        if (existingLabelEntry?.label === labelEntry.label) {
          merged.delete(existingValue)
        }
      }
    }

    merged.add(value)
  }

  return merged
}

function hasAlias(text: string, aliases: string[]): boolean {
  return aliases.some((alias) => text.includes(normalizeText(alias)))
}

function hasBuffAllContext(text: string): boolean {
  return /(increases all(?: [a-z0-9-]+){0,4} allies|for all(?: [a-z0-9-]+){0,4} allies|including rearguard|force characters|all troop members|all vanguard allies)/.test(text)
}

function hasBuffSelfContext(text: string): boolean {
  return /(increases own|increases self|own following status|own hp|own atk|own def|own counter)/.test(text)
}

function hasDebuffAllContext(text: string): boolean {
  return /(decreases all targets|decreases all enemies|all enemies|all targets|enemy is afflicted)/.test(text)
}

function hasDebuffSingleContext(text: string): boolean {
  return /(decreases a single target|single target|single enemy|inflicts .* on a single target)/.test(text)
}

function hasSoulBuffContext(text: string): boolean {
  return /soul of|all souls|skill point|secret gauge|protection gauge/.test(text)
}

function hasHealContext(text: string): boolean {
  return /(recover|heal|restores|restores hp)/.test(text)
}

function hasSpecialContext(text: string): boolean {
  return /(barrier|redraw|taunt|burn|absorb secret skill|make another move|second move|skill cost reset|multi hit soul|deals damage|inspire|grit|invincible|resurrection|continuous heal|secret skill vitalization|reckoning|damage absorption|unlimited skill use|live mode|status effects nullified|seeking soul|lords ambition|lord.s ambition)/.test(text)
}

function normalizeSkillFilterGroupLabel(label: string | null | undefined): string | null {
  if (!label) {
    return null
  }

  let normalized = label
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) {
    return null
  }

  if (/^EX Soul of Combos Damage(?:\s+UP|\s+DOWN)?$/i.test(normalized)) {
    return "EX Soul of Combos"
  }

  if (/^Soul of Combos Damage(?:\s+UP|\s+DOWN)?$/i.test(normalized)) {
    return "Soul of Combos"
  }

  if (!/^Seal\b/i.test(normalized)) {
    normalized = normalized.replace(/\s+(UP|DOWN)$/i, "")
  }

  if (/^Skill Points?$/i.test(normalized)) {
    return "Skill Points"
  }

  return normalized.trim() || null
}

function buildAliasesForLearnedLabel(label: string): string[] {
  const aliases = new Set<string>([label])

  aliases.add(label.replace(/\bP-ATK\b/gi, "Physical ATK"))
  aliases.add(label.replace(/\bM-ATK\b/gi, "Magic ATK"))
  aliases.add(label.replace(/\bP-ATK\b/gi, "P ATK"))
  aliases.add(label.replace(/\bM-ATK\b/gi, "M ATK"))

  return [...aliases].filter(Boolean)
}

function inferLearnedGroupKeys(label: string, aliases: string[], segments: string[]): Set<string> {
  const matchedGroups = new Set<string>()
  const blocksSoulBuffLearning = label === "Soul of Combos" || label === "EX Soul of Combos"

  for (const segment of segments) {
    if (label === "EX Soul of Combos") {
      if (/\bincreases own ex soul of combos damage\b/.test(segment)) {
        matchedGroups.add("buff_self")
      }
      if (/\bincreases ex soul of combos damage\b/.test(segment) && !/\bincreases own ex soul of combos damage\b/.test(segment)) {
        matchedGroups.add("buff_all")
      }
    }

    if (label === "Soul of Combos") {
      if (/\bincreases own soul of combos damage\b/.test(segment)) {
        matchedGroups.add("buff_self")
      }
      if (/\bincreases soul of combos damage\b/.test(segment) && !/\bincreases own soul of combos damage\b/.test(segment)) {
        matchedGroups.add("buff_all")
      }
    }

    if (!hasAlias(segment, aliases)) {
      continue
    }

    if (hasBuffAllContext(segment)) {
      matchedGroups.add("buff_all")
    }
    if (!blocksSoulBuffLearning && hasSoulBuffContext(segment)) {
      matchedGroups.add("soul_buff")
    }
    if (hasDebuffAllContext(segment)) {
      matchedGroups.add("debuff_all")
    }
    if (hasBuffSelfContext(segment)) {
      matchedGroups.add("buff_self")
    }
    if (hasDebuffSingleContext(segment)) {
      matchedGroups.add("debuff_single")
    }
  }

  return matchedGroups
}

function getGroupEntries(group: GroupDefinition): EntryDefinition[] {
  const learnedEntries = learnedEntriesByGroup.get(group.key) ?? []
  if (!learnedEntries.length) {
    return group.entries
  }

  const merged = new Map<string, EntryDefinition>()
  for (const entry of learnedEntries) {
    merged.set(makeValue(group.key, entry.label), entry)
  }
  for (const entry of group.entries) {
    const key = makeValue(group.key, entry.label)
    if (!merged.has(key)) {
      merged.set(key, entry)
    }
  }

  return [...merged.values()]
}

export function primeCharacterEffectFilterHeuristics(skills: CharacterEffectFilterSkill[]) {
  learnedEntriesByGroup.clear()
  effectTagCache.clear()
  effectTagLabelRegistry.clear()

  const groupedEntries = new Map<string, Map<string, EntryDefinition>>()

  for (const skill of skills) {
    const segments = buildSegmentsFromSkills([skill])
    if (!segments.length || !skill.skill_filter_groups?.length) {
      continue
    }

    for (const filterGroup of skill.skill_filter_groups) {
      const normalizedLabel = normalizeSkillFilterGroupLabel(filterGroup.sub_category_label)
      if (!normalizedLabel) {
        continue
      }

      const aliases = buildAliasesForLearnedLabel(normalizedLabel)
      const matchedGroups = inferLearnedGroupKeys(normalizedLabel, aliases, segments)
      for (const groupKey of matchedGroups) {
        if (!LEARNED_GROUP_KEYS.has(groupKey)) {
          continue
        }

        const entries = groupedEntries.get(groupKey) ?? new Map<string, EntryDefinition>()
        const value = makeValue(groupKey, normalizedLabel)
        const existing = entries.get(value)
        if (existing) {
          existing.aliases = [...new Set([...existing.aliases, ...aliases])]
        } else {
          entries.set(value, { label: normalizedLabel, aliases })
        }
        groupedEntries.set(groupKey, entries)
      }
    }
  }

  for (const [groupKey, entries] of groupedEntries.entries()) {
    learnedEntriesByGroup.set(
      groupKey,
      [...entries.values()].sort((left, right) => left.label.localeCompare(right.label)),
    )
  }
}

function addContextualMatches(tagSet: Set<string>, segments: string[], group: GroupDefinition, predicate: (text: string) => boolean) {
  const requiresDedicatedSoulDamageRule =
    group.key === "buff_all" || group.key === "buff_self"

  for (const segment of segments) {
    if (!predicate(segment)) {
      continue
    }

    for (const entry of getGroupEntries(group)) {
      if (requiresDedicatedSoulDamageRule && (entry.label === "Soul of Combos" || entry.label === "EX Soul of Combos")) {
        continue
      }

      if (hasAlias(segment, entry.aliases)) {
        addTag(tagSet, group.key, entry.label)
      }
    }
  }
}

function addImplicitSoulDamageBuffMatches(tagSet: Set<string>, segments: string[]) {
  for (const segment of segments) {
    if (/\bincreases ex soul of combos damage\b/.test(segment)) {
      addTag(tagSet, "buff_all", "EX Soul of Combos")
    }

    if (/\bincreases soul of combos damage\b/.test(segment)) {
      addTag(tagSet, "buff_all", "Soul of Combos")
    }

    if (/\bincreases own soul of combos damage\b/.test(segment)) {
      addTag(tagSet, "buff_self", "Soul of Combos")
    }

    if (/\bincreases own ex soul of combos damage\b/.test(segment)) {
      addTag(tagSet, "buff_self", "EX Soul of Combos")
    }
  }
}

function getEffectTagsForSegments(segments: string[]): Set<string> {
  const tagSet = new Set<string>()

  for (const segment of segments) {
    if (isSoulConversionSegment(segment)) {
      for (const entry of soulAmountEntries) {
        if (hasAlias(segment, entry.aliases)) {
          addTag(tagSet, "soul_amount", entry.label)
        }
      }

      for (const entry of toSoulEntries) {
        if (hasAlias(segment, entry.aliases)) {
          addTag(tagSet, "to_soul", entry.label)
        }
      }

      for (const entry of fromSoulEntries) {
        if (hasAlias(segment, entry.aliases)) {
          addTag(tagSet, "from_soul", entry.label)
        }
      }
    }

    for (const entry of gaugeEntries) {
      if (hasAlias(segment, entry.aliases)) {
        addTag(tagSet, "gauge", entry.label)
      }
    }
  }

  addImplicitSoulDamageBuffMatches(tagSet, segments)
  addContextualMatches(tagSet, segments, getGroupDefinition("buff_all"), hasBuffAllContext)
  addContextualMatches(tagSet, segments, getGroupDefinition("soul_buff"), hasSoulBuffContext)
  addContextualMatches(tagSet, segments, getGroupDefinition("debuff_all"), hasDebuffAllContext)
  addContextualMatches(tagSet, segments, getGroupDefinition("buff_self"), hasBuffSelfContext)
  addContextualMatches(tagSet, segments, getGroupDefinition("special"), hasSpecialContext)
  addContextualMatches(tagSet, segments, getGroupDefinition("debuff_single"), hasDebuffSingleContext)
  addContextualMatches(tagSet, segments, getGroupDefinition("heal"), hasHealContext)

  return tagSet
}

function getEffectTagsForEntry(entry: CharacterEffectFilterSkill): Set<string> {
  const segments = buildSegmentsFromSkills([entry])
  const metadataTagSet = new Set<string>()
  addMetadataDerivedTags(entry, metadataTagSet)
  const heuristicTags = getEffectTagsForSegments(segments)

  return mergeHeuristicTags(metadataTagSet, heuristicTags)
}

function getEffectTagsForSkills(skills: CharacterEffectFilterSkill[]): Set<string> {
  const tagSet = new Set<string>()
  for (const skill of skills) {
    for (const value of getEffectTagsForEntry(skill)) {
      tagSet.add(value)
    }
  }
  return tagSet
}

function buildFilterGroupsFromTagSets(tagSets: Iterable<Set<string>>): CharacterEffectFilterGroup[] {
  const available = new Map<string, Map<string, CharacterEffectFilterOption>>()
  const groupTitleMap = new Map(groupDefinitions.map((group) => [group.key, group.title]))

  for (const tagSet of tagSets) {
    for (const value of tagSet) {
      const separatorIndex = value.indexOf(":")
      if (separatorIndex <= 0) {
        continue
      }

      const groupKey = value.slice(0, separatorIndex)
      const labelEntry = effectTagLabelRegistry.get(value)
      if (!labelEntry) {
        continue
      }

      const options = available.get(groupKey) ?? new Map<string, CharacterEffectFilterOption>()
      options.set(value, { label: labelEntry.label, value })
      available.set(groupKey, options)
    }
  }

  return [...available.entries()]
    .map(([groupKey, options]) => ({
      key: groupKey,
      title: groupTitleMap.get(groupKey) ?? groupKey.replace(/_/g, " ").toUpperCase(),
      options: [...options.values()].sort((left, right) => left.label.localeCompare(right.label)),
    }))
    .sort((left, right) => {
      const leftIndex = groupDefinitions.findIndex((group) => group.key === left.key)
      const rightIndex = groupDefinitions.findIndex((group) => group.key === right.key)
      return leftIndex - rightIndex
    })
}

export function getSkillEffectTags(skill: CharacterEffectFilterSkill): Set<string> {
  return getEffectTagsForEntry(skill)
}

export function skillMatchesEffectFilters(skill: CharacterEffectFilterSkill, selectedValues: string[]): boolean {
  if (!selectedValues.length) {
    return true
  }

  const tagSet = getSkillEffectTags(skill)
  return selectedValues.every((value) => tagSet.has(value))
}

export function getSkillEffectFilterGroups(skills: CharacterEffectFilterSkill[]): CharacterEffectFilterGroup[] {
  return buildFilterGroupsFromTagSets(skills.map((skill) => getSkillEffectTags(skill)))
}

export function getCharacterEffectTags(character: CharacterEffectFilterCharacter): Set<string> {
  const cached = effectTagCache.get(character.master_pc_id)
  if (cached) {
    return cached
  }

  if (character.effect_tags?.length) {
    const precomputed = new Set(character.effect_tags)
    effectTagCache.set(character.master_pc_id, precomputed)
    return precomputed
  }

  const tagSet = getEffectTagsForSkills([
    ...character.skills,
    ...character.traits.map((trait) => ({
      name: trait.name,
      description_max_level: trait.description_max_level,
      skill_filter_groups: trait.skill_filter_groups,
    })),
  ])

  effectTagCache.set(character.master_pc_id, tagSet)
  return tagSet
}

export function characterMatchesEffectFilters(character: CharacterEffectFilterCharacter, selectedValues: string[]): boolean {
  if (!selectedValues.length) {
    return true
  }

  const tagSet = getCharacterEffectTags(character)
  return selectedValues.every((value) => tagSet.has(value))
}

export function getCharacterEffectFilterGroups(characters: CharacterEffectFilterCharacter[]): CharacterEffectFilterGroup[] {
  return buildFilterGroupsFromTagSets(characters.map((character) => getCharacterEffectTags(character)))
}