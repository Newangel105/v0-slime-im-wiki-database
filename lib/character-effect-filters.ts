import { normalizeLabel, stripColorTags } from "@/lib/pc-wiki"

export type CharacterEffectFilterSkill = {
  name?: string | null
  description_max_level?: string | null
}

export type CharacterEffectFilterCharacter = {
  master_pc_id: number
  skills: CharacterEffectFilterSkill[]
  traits: Array<{
    name: string
    description_max_level?: string | null
  }>
  ex_abilities?: Array<{
    name?: string | null
    description?: string | null
    effects?: string[] | null
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
  { label: "Soul of Divine Protection", aliases: ["changes soul of divine protection", "from soul of divine protection"] },
  { label: "Soul of Skills", aliases: ["changes soul of skills", "from soul of skills"] },
  { label: "Soul of Combos", aliases: ["changes soul of combos", "from soul of combos"] },
  { label: "Soul of Secrets", aliases: ["changes soul of secrets", "from soul of secrets"] },
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
  { key: "soul_buff", title: "SOUL BUFF", entries: soulBuffEntries },
  { key: "debuff_all", title: "DEBUFF ALL", entries: debuffAllEntries },
  { key: "from_soul", title: "FROM SOUL", entries: fromSoulEntries },
  { key: "buff_self", title: "BUFF SELF", entries: buffSelfEntries },
  { key: "special", title: "SPECIAL", entries: specialEntries },
  { key: "debuff_single", title: "DEBUFF SINGLE", entries: debuffSingleEntries },
  { key: "heal", title: "HEAL", entries: healEntries },
]

function makeValue(groupKey: string, label: string): string {
  return `${groupKey}:${normalizeLabel(label)}`
}

function normalizeText(value: string): string {
  return normalizeLabel(stripColorTags(value))
    .replace(/[%％]/g, "%")
    .replace(/[^a-z0-9+%\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function splitEffectClauses(value: string): string[] {
  return value
    .split(/\r?\n|[.;]+\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function buildSegmentsFromSkills(skills: CharacterEffectFilterSkill[]): string[] {
  return [
    ...skills.flatMap((skill) => [skill.name ?? "", skill.description_max_level ?? ""]),
  ]
    .flatMap(splitEffectClauses)
    .map(normalizeText)
    .filter(Boolean)
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

function addContextualMatches(tagSet: Set<string>, segments: string[], group: GroupDefinition, predicate: (text: string) => boolean) {
  for (const segment of segments) {
    if (!predicate(segment)) {
      continue
    }

    for (const entry of group.entries) {
      if (hasAlias(segment, entry.aliases)) {
        tagSet.add(makeValue(group.key, entry.label))
      }
    }
  }
}

function getEffectTagsForSegments(segments: string[]): Set<string> {
  const tagSet = new Set<string>()

  for (const segment of segments) {
    for (const entry of soulAmountEntries) {
      if (hasAlias(segment, entry.aliases)) {
        tagSet.add(makeValue("soul_amount", entry.label))
      }
    }

    for (const entry of toSoulEntries) {
      if (hasAlias(segment, entry.aliases)) {
        tagSet.add(makeValue("to_soul", entry.label))
      }
    }

    for (const entry of gaugeEntries) {
      if (hasAlias(segment, entry.aliases)) {
        tagSet.add(makeValue("gauge", entry.label))
      }
    }

    for (const entry of fromSoulEntries) {
      if (hasAlias(segment, entry.aliases)) {
        tagSet.add(makeValue("from_soul", entry.label))
      }
    }
  }

  addContextualMatches(tagSet, segments, groupDefinitions[3], hasBuffAllContext)
  addContextualMatches(tagSet, segments, groupDefinitions[4], hasSoulBuffContext)
  addContextualMatches(tagSet, segments, groupDefinitions[5], hasDebuffAllContext)
  addContextualMatches(tagSet, segments, groupDefinitions[7], hasBuffSelfContext)
  addContextualMatches(tagSet, segments, groupDefinitions[8], hasSpecialContext)
  addContextualMatches(tagSet, segments, groupDefinitions[9], hasDebuffSingleContext)
  addContextualMatches(tagSet, segments, groupDefinitions[10], hasHealContext)

  return tagSet
}

function getEffectTagsForSkills(skills: CharacterEffectFilterSkill[]): Set<string> {
  return getEffectTagsForSegments(buildSegmentsFromSkills(skills))
}

function buildFilterGroupsFromTagSets(tagSets: Iterable<Set<string>>): CharacterEffectFilterGroup[] {
  const available = new Set<string>()

  for (const tagSet of tagSets) {
    for (const value of tagSet) {
      available.add(value)
    }
  }

  return groupDefinitions
    .map((group) => ({
      key: group.key,
      title: group.title,
      options: group.entries
        .map((entry) => ({ label: entry.label, value: makeValue(group.key, entry.label) }))
        .filter((option) => available.has(option.value)),
    }))
    .filter((group) => group.options.length > 0)
}

export function getSkillEffectTags(skill: CharacterEffectFilterSkill): Set<string> {
  return getEffectTagsForSkills([skill])
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

  const tagSet = getEffectTagsForSkills(character.skills)

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