import { WikiCharacter, getAllWikiCharacters } from "@/lib/pc-wiki"

export interface GaugeEntry {
  gaugeType: "protection" | "skillPoint" | "secretSkill"
  amount: string // e.g., "7-11", "3-5", etc.
  timing: string // e.g., "Start of battle", "Every 2 turns", etc.
  awaken?: number
  character: WikiCharacter
}

// Protection gauge
export const GAUGE_ROWS = [
  "Start of battle",
  "Up till turn 3",
  "Every 2 turns",
  "Every 3 turns",
  "Up till turn 2",
] as const

export const GAUGE_COLUMNS = [
  "7-11",
  "3-5",
  "4-6",
  "4-6(116-120)",
  "5-7",
  "6-8",
  "6-8(116-120)",
] as const

export type GaugeRow = typeof GAUGE_ROWS[number]
export type GaugeColumn = typeof GAUGE_COLUMNS[number]

// Skill point gauge
export const SKILL_POINT_GAUGE_ROWS = [
  "Start of battle",
  "Every 2 turns",
  "Every 3 turns",
] as const

export const SKILL_POINT_GAUGE_COLUMNS = [
  "4-6",
  "2-4",
  "3-5",
  "3-5(116/120)",
  "5-8",
  "5-8(116/120)",
] as const

export type SkillPointGaugeRow = typeof SKILL_POINT_GAUGE_ROWS[number]
export type SkillPointGaugeColumn = typeof SKILL_POINT_GAUGE_COLUMNS[number]

// Secret skill gauge
export const SECRET_SKILL_GAUGE_ROWS = [
  "Start of battle",
  "Up till turn 3",
  "Every 2 turns",
  "Every 3 turns",
] as const

export const SECRET_SKILL_GAUGE_COLUMNS = [
  "12-18%",
  "7-11%",
  "10-15%",
  "5-8%",
] as const

export type SecretSkillGaugeRow = typeof SECRET_SKILL_GAUGE_ROWS[number]
export type SecretSkillGaugeColumn = typeof SECRET_SKILL_GAUGE_COLUMNS[number]

export function parseGaugeDescription(description: string): {
  gaugeType: "protection" | "skillPoint" | "secretSkill" | null
  amount: string | null
  timing: string | null
} {
  // Patterns for gauge types
  const protectionMatch = description.match(/protection gauge by (\d+)/i)
  const skillPointMatch = description.match(/increases skill points by (\d+)/i)
  const secretSkillMatch = description.match(/secret skill gauge|secret skill increase/i)

  let gaugeType: "protection" | "skillPoint" | "secretSkill" | null = null
  let amount: string | null = null

  if (protectionMatch) {
    gaugeType = "protection"
    amount = protectionMatch[1]
  } else if (skillPointMatch) {
    gaugeType = "skillPoint"
    amount = skillPointMatch[1]
  } else if (secretSkillMatch) {
    gaugeType = "secretSkill"
    const secretMatch = description.match(/Secret Skill Gauge by (\d+)%/i)
    amount = secretMatch ? secretMatch[1] : null
  }

  // Patterns for timing
  let timing: string | null = null
  // Check "from the start of battle to Turn X" pattern first
  const fromToMatch = description.match(/from the start of battle to turn (\d+)/i)
  if (fromToMatch) {
    const turnNum = parseInt(fromToMatch[1], 10)
    if (turnNum === 2) {
      timing = "Up till turn 2"
    } else if (turnNum === 3) {
      timing = "Up till turn 3"
    }
  } else if (description.match(/start of battle|start of turn/i)) {
    timing = "Start of battle"
  } else if (description.match(/every 2 turns?/i)) {
    timing = "Every 2 turns"
  } else if (description.match(/every 3 turns?/i)) {
    timing = "Every 3 turns"
  } else if (description.match(/up till turn 3/i)) {
    timing = "Up till turn 3"
  } else if (description.match(/up till turn 2/i)) {
    timing = "Up till turn 2"
  }

  return { gaugeType, amount, timing }
}

export function getGaugeRange(
  amount: string | null,
  gaugeType: "protection" | "skillPoint" | "secretSkill",
  awaken?: number,
  timing?: string
): string | null {
  if (!amount) return null

  const num = parseInt(amount, 10)
  if (isNaN(num)) return null
  // ── Secret Skill ─────────────────────────────────────────────────────────
  if (gaugeType === "secretSkill") {
    // Start of battle: 12% → "12-18%"
    if (timing === "Start of battle") {
      if (num >= 12 && num <= 18) return "12-18%"
      return null
    }
    // Every 2 turns: only 10-15% column applies
    if (timing === "Every 2 turns") {
      if (num >= 10 && num <= 15) return "10-15%"
      return null
    }
    // Up till turn 3 / Every 3 turns: pick closest-max among 5-8%, 7-11%, 10-15%
    if (timing === "Up till turn 3" || timing === "Every 3 turns") {
      const ssRanges = [
        { range: "5-8%",   min: 5,  max: 8  },
        { range: "7-11%",  min: 7,  max: 11 },
        { range: "10-15%", min: 10, max: 15 },
      ]
      const matches = ssRanges.filter((r) => num >= r.min && num <= r.max)
      if (matches.length === 0) return null
      return matches.reduce((prev, curr) =>
        Math.abs(curr.max - num) < Math.abs(prev.max - num) ? curr : prev
      ).range
    }
    return null
  }
  // ── Skill Point ──────────────────────────────────────────────────────────
  if (gaugeType === "skillPoint") {
    // Start of battle always maps to the 4-6 column
    if (timing === "Start of battle") return "4-6"

    // Periodic ranges: 2-4, 3-5, 5-8
    const spRanges = [
      { range: "2-4", min: 2, max: 4 },
      { range: "3-5", min: 3, max: 5 },
      { range: "5-8", min: 5, max: 8 },
    ]
    const spMatches = spRanges.filter((r) => num >= r.min && num <= r.max)
    if (spMatches.length === 0) return null
    // Closest upper bound
    const spBest = spMatches.reduce((prev, curr) =>
      Math.abs(curr.max - num) < Math.abs(prev.max - num) ? curr : prev
    )
    // Awaken 5/5 → 116/120 variant (only for 3-5 and 5-8 base ranges)
    if (awaken && awaken >= 5) {
      if (spBest.range === "3-5") return "3-5(116/120)"
      if (spBest.range === "5-8") return "5-8(116/120)"
    }
    return spBest.range
  }

  // ── Protection (default) ─────────────────────────────────────────────────
  const ranges = [
    { range: "3-5", min: 3, max: 5 },
    { range: "4-6", min: 4, max: 6 },
    { range: "5-7", min: 5, max: 7 },
    { range: "6-8", min: 6, max: 8 },
    { range: "7-11", min: 7, max: 11 },
  ]

  const matchingRanges = ranges.filter((r) => num >= r.min && num <= r.max)
  if (matchingRanges.length === 0) return null

  const bestMatch = matchingRanges.reduce((prev, curr) => {
    const prevDist = Math.abs(prev.max - num)
    const currDist = Math.abs(curr.max - num)
    return currDist < prevDist ? curr : prev
  })

  if (awaken && awaken >= 5) {
    if (bestMatch.range === "4-6") return "4-6(116-120)"
    if (bestMatch.range === "6-8") return "6-8(116-120)"
  }

  return bestMatch.range
}

export async function extractGaugeEntries(): Promise<GaugeEntry[]> {
  const characters = await getAllWikiCharacters()
  const entries: GaugeEntry[] = []

  for (const character of characters) {
    if (!character.traits || character.traits.length === 0) continue

    // For each gauge type, keep the trait with the highest awaken level (prefer 5/5 over 3/5)
    const bestByType: Partial<Record<"protection" | "skillPoint" | "secretSkill", { awaken: number; amount: string; timing: string }>> = {}

    for (const trait of character.traits) {
      const unlock = trait.unlock || ""
      const awakenMatch = unlock.match(/Awaken\s*(\d+)/i)
      if (!awakenMatch) continue
      const awakenLevel = parseInt(awakenMatch[1], 10)

      const { gaugeType, amount, timing } = parseGaugeDescription(
        trait.description_max_level || ""
      )

      if (!gaugeType || !amount || !timing) continue

      const existing = bestByType[gaugeType]
      if (!existing || awakenLevel >= existing.awaken) {
        bestByType[gaugeType] = { awaken: awakenLevel, amount, timing }
      }
    }

    // Create entries from the selected best traits per gauge type
    for (const gt of Object.keys(bestByType) as Array<"protection" | "skillPoint" | "secretSkill">) {
      const info = bestByType[gt]
      if (!info) continue
      const range = getGaugeRange(info.amount, gt, info.awaken, info.timing)
      if (range) {
        entries.push({
          gaugeType: gt,
          amount: range,
          timing: info.timing as GaugeRow,
          awaken: info.awaken,
          character,
        })
      }
    }
  }

  return entries
}

export function getCharactersForCell(
  entries: GaugeEntry[],
  gaugeType: "protection" | "skillPoint" | "secretSkill",
  row: string,
  column: string
): WikiCharacter[] {
  return entries
    .filter(
      (e) => e.gaugeType === gaugeType && e.timing === row && e.amount === column
    )
    .map((e) => e.character)
    // Remove duplicates (by master_pc_id to allow same-named characters like alternate versions)
    .filter(
      (char, index, self) =>
        self.findIndex((c) => c.master_pc_id === char.master_pc_id) === index
    )
}
