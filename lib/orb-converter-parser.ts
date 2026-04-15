import { getAllWikiCharacters, type WikiCharacter } from "./pc-wiki"

// ── Tab types ────────────────────────────────────────────────────────────────

export type OrbTarget = "blue" | "green" | "orange" | "unity" | "steal" | "give" | "reset"

export const ORB_TARGET_CONFIG: Record<OrbTarget, { label: string; tabClass: string }> = {
  blue:   { label: "To Blue Orbs",   tabClass: "data-[state=active]:bg-blue-600 data-[state=active]:text-white" },
  green:  { label: "To Green Orbs",  tabClass: "data-[state=active]:bg-green-600 data-[state=active]:text-white" },
  orange: { label: "To Orange Orbs", tabClass: "data-[state=active]:bg-orange-600 data-[state=active]:text-white" },
  unity:  { label: "To Unity Orbs",  tabClass: "data-[state=active]:bg-purple-600 data-[state=active]:text-white" },
  steal:  { label: "Steal",          tabClass: "data-[state=active]:bg-pink-600 data-[state=active]:text-white" },
  give:   { label: "Give",           tabClass: "data-[state=active]:bg-emerald-600 data-[state=active]:text-white" },
  reset:  { label: "Reset",          tabClass: "data-[state=active]:bg-cyan-600 data-[state=active]:text-white" },
}

// ── Row (fromType) types ──────────────────────────────────────────────────────

export const FROM_TYPE_CONFIG: Record<string, { label: string; bgClass: string }> = {
  fromBlue:     { label: "From Blue Orbs",          bgClass: "bg-blue-900 text-blue-100" },
  fromGreen:    { label: "From Green Orbs",          bgClass: "bg-green-900 text-green-100" },
  fromOrange:   { label: "From Orange Orbs",         bgClass: "bg-orange-900 text-orange-100" },
  ult:          { label: "Ult Convert",              bgClass: "bg-purple-900 text-purple-100" },
  special:      { label: "Special Convert",          bgClass: "bg-gray-600 text-gray-100" },
  setUlt:       { label: "Set Ult Gauge",             bgClass: "bg-violet-900 text-violet-100" },
  own:          { label: "Own Orb Convert",          bgClass: "bg-emerald-900 text-emerald-100" },
  force:        { label: "Force-limited Convert",    bgClass: "bg-amber-900 text-amber-100" },
  element:      { label: "Element-limited Convert",  bgClass: "bg-cyan-900 text-cyan-100" },
  future:       { label: "Future Orb Convert",       bgClass: "bg-slate-700 text-slate-100" },
  nextTurn:     { label: "Next Turn Convert",        bgClass: "bg-pink-900 text-pink-100" },
  stealBlue:    { label: "From Blue Orbs",           bgClass: "bg-blue-900 text-blue-100" },
  stealOrange:  { label: "From Orange Orbs",         bgClass: "bg-orange-900 text-orange-100" },
  stolenOrange: { label: "Stolen Orbs",               bgClass: "bg-orange-800 text-orange-100" },
  stealOther:   { label: "Other Units' Orbs",        bgClass: "bg-gray-600 text-gray-100" },
  stealElement: { label: "Element-limited Steal",    bgClass: "bg-cyan-900 text-cyan-100" },
  stealSpecific:{ label: "Stolen Orbs",              bgClass: "bg-violet-900 text-violet-100" },
  giveBlue:     { label: "From Blue Orbs",           bgClass: "bg-blue-900 text-blue-100" },
  giveOrange:   { label: "From Orange Orbs",         bgClass: "bg-orange-900 text-orange-100" },
  giveOwn:      { label: "Own Orbs",                 bgClass: "bg-emerald-900 text-emerald-100" },
  giveForce:    { label: "Force-limited Give",       bgClass: "bg-amber-900 text-amber-100" },
  resetAll:     { label: "All Orbs",                 bgClass: "bg-teal-900 text-teal-100" },
}

export const FROM_TYPE_ORDER: Record<OrbTarget, string[]> = {
  blue:   ["fromGreen", "fromOrange", "special", "ult", "setUlt", "own", "force", "element", "future", "nextTurn"],
  green:  ["fromBlue", "fromOrange", "special", "ult", "setUlt", "own", "force", "element", "future", "nextTurn"],
  orange: ["fromBlue", "fromGreen", "stolenOrange", "special", "ult", "setUlt", "own", "force", "element", "future", "nextTurn"],
  unity:  ["fromBlue", "fromGreen", "fromOrange", "special", "ult", "setUlt", "own", "force", "element", "future", "nextTurn"],
  steal:  ["stealBlue", "stealOrange", "stealOther", "stealElement", "stealSpecific"],
  give:   ["giveBlue", "giveOrange", "giveOwn", "giveForce"],
  reset:  ["resetAll"],
}

export const ORB_AMOUNTS = ["x1", "x2", "x3", "x6"] as const
export type OrbAmount = (typeof ORB_AMOUNTS)[number]

// ── Entry type ────────────────────────────────────────────────────────────────

export interface OrbConvertEntry {
  character: WikiCharacter
  skillSlot: string
  isSkillChange: boolean
  toOrb: OrbTarget
  fromType: string
  spCostLabel: string
  spCostValue: number
  amount: OrbAmount
  conversionLine: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSpCostLabel(cost: number | null): { label: string; value: number } {
  if (cost == null) return { label: "?", value: 999 }
  if (cost === 0) return { label: "10/0", value: 0 }
  return { label: `${cost + 10}/${cost}`, value: cost }
}

function extractAmount(line: string, beforeTarget: string): OrbAmount {
  const m = line.match(/\bx(\d+)\b/i)
  if (m) {
    const n = parseInt(m[1])
    if (n === 1) return "x1"
    if (n === 2) return "x2"
    if (n === 3) return "x3"
    return "x6"
  }
  const low = line.toLowerCase()
  if (/\ball\b/.test(low)) return "x6"
  if (low.includes("newly added")) return "x6"
  // plural "souls" (not "soul of") in source portion → all of that type
  if (/\bsouls\b/.test(beforeTarget.toLowerCase()) && !/soul of/.test(beforeTarget.toLowerCase())) return "x6"
  // named orb with no quantity → convert all of that type
  if (/soul of (divine protection|skills|secrets|unity|combos)/.test(beforeTarget.toLowerCase())) return "x6"
  return "x1"
}

// For multi-source specials: sum all x amounts, or count orb types × per-orb amount
function extractSpecialAmount(beforeTarget: string): OrbAmount {
  const low = beforeTarget.toLowerCase()
  // "x1 each" style: count distinct named orbs × per-orb amount
  const eachMatch = low.match(/\bx(\d+)\s+each/)
  if (eachMatch) {
    const perOrb = parseInt(eachMatch[1])
    let count = 0
    if (low.includes("soul of divine protection")) count++
    if (low.includes("soul of skills")) count++
    if (low.includes("soul of secrets")) count++
    if (low.includes("soul of unity")) count++
    if (low.includes("soul of combos")) count++
    const total = perOrb * Math.max(count, 1)
    if (total >= 6) return "x6"
    if (total === 3) return "x3"
    if (total === 2) return "x2"
    return "x1"
  }
  // compound "x2 and ... x1": sum all amounts
  const allAmounts = [...low.matchAll(/\bx(\d+)\b/g)].map(m => parseInt(m[1]))
  if (allAmounts.length > 1) {
    const total = allAmounts.reduce((a, b) => a + b, 0)
    if (total >= 6) return "x6"
    if (total === 3) return "x3"
    if (total === 2) return "x2"
    return "x1"
  }
  return extractAmount(beforeTarget, beforeTarget)
}

function classifyLine(line: string, cost: number | null): Array<{
  toOrb: OrbTarget
  fromType: string
  amount: OrbAmount
}> {
  const low = line.toLowerCase()

  // Must be an action line
  const isAction =
    low.includes("changes") ||
    low.includes("transfers") ||
    low.includes("redraw") ||
    low.includes("converted to soul") ||
    low.includes("ultimate manifestation") ||
    low.includes("sets soul of combos")
  if (!isAction) return []

  // ── SET ULT GAUGE ─────────────────────────────────────────────────────────
  if (low.includes("sets soul of combos")) {
    let toOrb: OrbTarget = "blue"
    if (low.includes("soul of unity")) toOrb = "unity"
    else if (low.includes("soul of divine protection")) toOrb = "blue"
    else if (low.includes("soul of skills")) toOrb = "green"
    else if (low.includes("soul of secrets")) toOrb = "orange"
    else return [] // unmapped target — skip
    return [{ toOrb, fromType: "setUlt", amount: "x3" }]
  }

  // ── RESET ────────────────────────────────────────────────────────────────
  if (low.includes("redraw")) {
    return [{ toOrb: "reset", fromType: "resetAll", amount: "x6" }]
  }

  // ── GIVE (transfers FROM self TO another) ─────────────────────────────────
  if (
    low.includes("transfers") &&
    (low.includes("to another") ||
      (low.includes("to the character") && !low.includes("to self")) ||
      (low.includes("to a vanguard") && !low.includes("to self")))
  ) {
    let fromType = "giveOwn"
    if (low.includes("soul of divine protection") || low.includes("soul of protection")) fromType = "giveBlue"
    else if (low.includes("soul of secrets")) fromType = "giveOrange"
    else if (low.includes("force characters") || low.includes("force character")) fromType = "giveForce"
    return [{ toOrb: "give", fromType, amount: extractAmount(line, line) }]
  }

  // ── STEAL (transfers TO self FROM others) ─────────────────────────────────
  if (
    low.includes("transfers") &&
    (low.includes("to self") ||
      low.includes("into own") ||
      low.includes("to own") ||
      low.includes("another random"))
  ) {
    let fromType = "stealOther"
    if (low.includes("soul of divine protection") && (low.includes("to self") || low.includes("all soul"))) {
      fromType = "stealBlue"
    } else if (low.includes("soul of secrets") && (low.includes("to self") || low.includes("x2") || low.includes("x3"))) {
      fromType = "stealOrange"
    } else if (low.includes("soul of skills") && low.includes("to self")) {
      fromType = "stealSpecific"
    } else if (/\b(fire|water|wind|earth|dark|light|space|holy|air)\b/.test(low) || low.includes("non-")) {
      fromType = "stealElement"
    }
    // "into own Soul of Secrets" conversions → still steal but also appears in orange tab
    const stealAmt = extractAmount(line, line)
    const stealResults: Array<{ toOrb: OrbTarget; fromType: string; amount: OrbAmount }> = [
      { toOrb: "steal", fromType, amount: stealAmt },
    ]
    if (fromType === "stealOrange") stealResults.push({ toOrb: "orange", fromType: "stolenOrange", amount: stealAmt })
    return stealResults
  }

  // ── CONVERT (changes X into Y) ────────────────────────────────────────────

  // Determine target orb — look at the text after the last "into" or "to soul of"
  const intoIdx = low.lastIndexOf(" into ")
  const toSoulIdx = low.lastIndexOf(" to soul of")
  const refIdx = Math.max(intoIdx, toSoulIdx)
  const afterTarget = refIdx >= 0 ? low.slice(refIdx) : low
  const beforeTarget = refIdx >= 0 ? low.slice(0, refIdx) : low

  let toOrb: OrbTarget | null = null
  if (afterTarget.includes("soul of divine protection") || low.includes("converted to soul of divine protection")) {
    toOrb = "blue"
  } else if (afterTarget.includes("soul of skills") || low.includes("converted to soul of skills")) {
    toOrb = "green"
  } else if (afterTarget.includes("soul of secrets") || low.includes("converted to soul of secrets")) {
    toOrb = "orange"
  } else if (
    afterTarget.includes("soul of unity") ||
    low.includes("converted to soul of unity") ||
    low.includes("ultimate manifestation")
  ) {
    toOrb = "unity"
  }

  if (!toOrb) return []

  const amount = extractAmount(line, beforeTarget)

  // ── Classify fromType ──────────────────────────────────────────────────────
  const bLow = beforeTarget

  // Future orb
  if (low.includes("newly added to hand")) {
    return [{ toOrb, fromType: "future", amount }]
  }

  // Next turn
  if (low.includes("start of the next turn") || (low.includes("next turn") && !low.includes("this turn"))) {
    return [{ toOrb, fromType: "nextTurn", amount }]
  }

  // Ultimate Manifestation → own → unity
  if (low.includes("ultimate manifestation")) {
    return [{ toOrb: "unity", fromType: "own", amount: "x6" }]
  }

  // Own souls
  if (low.includes("own souls") || (low.includes("own soul") && !low.includes("soul of"))) {
    return [{ toOrb, fromType: "own", amount: /\ball\b/.test(low) || !low.match(/\bx\d/) ? "x6" : amount }]
  }

  // Source orb type (soul of combos = ult gauge, capped at x3)
  if (bLow.includes("soul of combos")) return [{ toOrb, fromType: "ult", amount: amount === "x6" ? "x3" : amount }]

  // Force-limited (check element first for force+element combos)
  const hasElement = /\b(fire|water|wind|earth|dark|light|space|holy|air|attribute)\b/.test(bLow)
  const hasForce = /force characters|force character/.test(bLow) || bLow.includes(" force")

  if (hasElement && hasForce) return [
    { toOrb, fromType: "force", amount },
    { toOrb, fromType: "element", amount },
  ]
  if (hasForce) return [{ toOrb, fromType: "force", amount }]
  if (hasElement) return [{ toOrb, fromType: "element", amount }]

  // Mixed sources — check before individual source orbs so "Soul of X and Soul of Y" sums correctly
  if (bLow.includes(" and ") || bLow.includes(" each ")) return [{ toOrb, fromType: "special", amount: extractSpecialAmount(bLow) }]

  if (bLow.includes("soul of divine protection")) return [{ toOrb, fromType: "fromBlue", amount }]
  if (bLow.includes("soul of skills")) return [{ toOrb, fromType: "fromGreen", amount }]
  if (bLow.includes("soul of secrets")) return [{ toOrb, fromType: "fromOrange", amount }]

  // non-X conversions (converts anything that's NOT the target type)
  if (bLow.includes("non-")) return [{ toOrb, fromType: "special", amount }]

  return [{ toOrb, fromType: "special", amount }]
}

// ── Main extraction ───────────────────────────────────────────────────────────

export function extractOrbConvertEntries(): OrbConvertEntry[] {
  const characters = getAllWikiCharacters()
  const entries: OrbConvertEntry[] = []

  for (const character of characters) {
    for (const skill of character.skills ?? []) {
      const slot = skill.slot ?? ""
      if (!slot.startsWith("active_skill")) continue

      const desc = skill.description_max_level ?? ""
      const cost = skill.cost ?? null

      const clean = desc.replace(/<[^>]+>/g, "")
      for (const rawLine of clean.split("\n")) {
        const line = rawLine.trim()
        if (!line) continue

        const results = classifyLine(line, cost)
        if (results.length === 0) continue

        const { label: spCostLabel, value: spCostValue } = getSpCostLabel(cost)

        for (const result of results) {
          entries.push({
            character,
            skillSlot: slot,
            isSkillChange: skill.is_skill_change ?? false,
            toOrb: result.toOrb,
            fromType: result.fromType,
            spCostLabel,
            spCostValue,
            amount: result.amount,
            conversionLine: line,
          })
        }
      }
    }
  }

  return entries
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getOrbCellEntries(
  entries: OrbConvertEntry[],
  toOrb: OrbTarget,
  fromType: string,
  spCostLabel: string,
  amount: OrbAmount
): OrbConvertEntry[] {
  const seen = new Set<string>()
  return entries.filter((e) => {
    if (e.toOrb !== toOrb || e.fromType !== fromType || e.spCostLabel !== spCostLabel || e.amount !== amount)
      return false
    const key = `${e.character.master_pc_id}-${e.skillSlot}-${e.isSkillChange}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Returns ordered list of (fromType, spCostLabel) rows that have ≥1 entry. */
export function getOrbTableRows(
  entries: OrbConvertEntry[],
  toOrb: OrbTarget
): Array<{ fromType: string; spCostLabel: string; spCostValue: number }> {
  const order = FROM_TYPE_ORDER[toOrb]
  const rowSet = new Map<string, { fromType: string; spCostLabel: string; spCostValue: number }>()

  for (const e of entries) {
    if (e.toOrb !== toOrb) continue
    const key = `${e.fromType}|${e.spCostLabel}`
    if (!rowSet.has(key)) rowSet.set(key, { fromType: e.fromType, spCostLabel: e.spCostLabel, spCostValue: e.spCostValue })
  }

  return Array.from(rowSet.values()).sort((a, b) => {
    const ai = order.indexOf(a.fromType)
    const bi = order.indexOf(b.fromType)
    const orderDiff = (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    if (orderDiff !== 0) return orderDiff
    return a.spCostValue - b.spCostValue
  })
}

/** Groups flat rows into (fromType, subRows[]) for rowspan rendering. */
export function groupOrbTableRows(
  rows: Array<{ fromType: string; spCostLabel: string; spCostValue: number }>
): Array<{ fromType: string; subRows: Array<{ spCostLabel: string }> }> {
  const groups: Array<{ fromType: string; subRows: Array<{ spCostLabel: string }> }> = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.fromType === row.fromType) {
      last.subRows.push({ spCostLabel: row.spCostLabel })
    } else {
      groups.push({ fromType: row.fromType, subRows: [{ spCostLabel: row.spCostLabel }] })
    }
  }
  return groups
}
