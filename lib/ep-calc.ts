import type { WikiCharacter, Equipment } from "./pc-wiki"
import teamStatsData from "../pc_wiki_team_stats.json"

// ── Types ──────────────────────────────────────────────────────────────────

type TeamStats = typeof teamStatsData

type FacilityBonus = {
  elem_name: string
  hp_pct: number
  atk_pct: number
  def_pct: number
  battle_only_atk_pct: number
  battle_only_def_pct: number
}

type EquipFacilityBonus = {
  equip_atk_pct: number
  equip_def_pct: number
  equip_hp_pct: number
}

export type SlotStats = {
  hp: number
  attack: number
  defense: number
  ep: number
  /** Breakdown: EP from character status (base+level+statusboard+esb) */
  statusEp: number
  /** Breakdown: EP from bond */
  bondEp: number
  /** Breakdown: EP from facility effect */
  facilityEp: number
  /** Breakdown: EP from equipment */
  equipmentEp: number
}

export type TeamEP = {
  slots: (SlotStats | null)[]
  total: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const ELEMENT_KEY_MAP: Record<string, string> = {
  Earth: "1", Air: "2", Wind: "3", Water: "4", Fire: "5", Holy: "6", Dark: "7",
  EnhancedEarth: "1", EnhancedAir: "2", EnhancedWind: "3", EnhancedWater: "4",
  EnhancedFire: "5", EnhancedHoly: "6", EnhancedDark: "7",
  SpecialEffectElementEarth: "1", SpecialEffectElementAir: "2",
  SpecialEffectElementWind: "3", SpecialEffectElementWater: "4",
  SpecialEffectElementFire: "5", SpecialEffectElementHoly: "6",
  SpecialEffectElementDark: "7",
  SpecialEffectElementEnhancedEarth: "1", SpecialEffectElementEnhancedAir: "2",
  SpecialEffectElementEnhancedWind: "3", SpecialEffectElementEnhancedWater: "4",
  SpecialEffectElementEnhancedFire: "5", SpecialEffectElementEnhancedHoly: "6",
  SpecialEffectElementEnhancedDark: "7",
  None: "0", Physics: "0", Magic: "0",
}

// Sub-slot contribution rates from MasterDefineValue (per 10000)
const SUB_BASE_RATE_R5 = 3000
const SUB_SAME_ELEM_BONUS = 1000
// Bless PC (protector) assist rate used for party parameter
const BLESS_ASSIST_BASE_RATE_R5 = 3000
const BLESS_ASSIST_SAME_ELEM_BONUS = 1000

const ts: TeamStats = teamStatsData

// ── Helpers ────────────────────────────────────────────────────────────────

function elemKey(char: WikiCharacter): string {
  return ELEMENT_KEY_MAP[char.element] ?? "0"
}

function baseElement(char: WikiCharacter): string {
  // Return the base element string (e.g. "Earth") from possibly enhanced/special names
  const key = elemKey(char)
  const fac = ts.facility_bonuses[key as keyof typeof ts.facility_bonuses] as FacilityBonus | undefined
  return fac?.elem_name ?? "None"
}

function sameElement(a: WikiCharacter, b: WikiCharacter): boolean {
  return elemKey(a) === elemKey(b) && elemKey(a) !== "0"
}

function getStatusboardBonus(char: WikiCharacter): { hp: number; attack: number; defense: number } {
  const sbId = char.master_statusboard_id
  if (!sbId) return { hp: 0, attack: 0, defense: 0 }
  const sb = ts.statusboard_totals[String(sbId) as keyof typeof ts.statusboard_totals] as
    { hp: number; attack: number; defense: number } | undefined
  return sb ?? { hp: 0, attack: 0, defense: 0 }
}

function getEnhancedStatusboardBonus(char: WikiCharacter): { hp: number; attack: number; defense: number } {
  const esbId = char.master_enhanced_statusboard_id
  if (!esbId) return { hp: 0, attack: 0, defense: 0 }
  const esb = ts.enhanced_statusboard_totals[String(esbId) as keyof typeof ts.enhanced_statusboard_totals] as
    { hp: number; attack: number; defense: number } | undefined
  return esb ?? { hp: 0, attack: 0, defense: 0 }
}

function getLevelMaxAdd(char: WikiCharacter): { add_hp: number; add_attack: number; add_defense: number } {
  const gid = char.master_pc_level_group_id
  if (!gid) return { add_hp: 0, add_attack: 0, add_defense: 0 }
  const lma = ts.level_max_add[String(gid) as keyof typeof ts.level_max_add] as
    { level: number; add_hp: number; add_attack: number; add_defense: number } | undefined
  return lma ?? { add_hp: 0, add_attack: 0, add_defense: 0 }
}

function getBondRatios(): { hp_ratio: number; attack_ratio: number; defense_ratio: number } {
  // All chars use group "1"
  const bond = ts.bond_max_ratios["1" as keyof typeof ts.bond_max_ratios] as
    { hp_ratio: number; attack_ratio: number; defense_ratio: number } | undefined
  return bond ?? { hp_ratio: 0, attack_ratio: 0, defense_ratio: 0 }
}

function getFacilityBonus(char: WikiCharacter): FacilityBonus {
  const key = elemKey(char)
  const fac = ts.facility_bonuses[key as keyof typeof ts.facility_bonuses] as FacilityBonus | undefined
  if (fac) return fac
  // Fallback to "0" (All) for unknown elements
  return ts.facility_bonuses["0" as keyof typeof ts.facility_bonuses] as FacilityBonus
}

function getEquipFacilityBonus(char: WikiCharacter): { atk_pct: number; def_pct: number; hp_pct: number } {
  const ek = elemKey(char)
  // All chars get ATK from key "9" (all-char ATK building)
  const allAtk = ts.equipment_facility_bonuses["9" as keyof typeof ts.equipment_facility_bonuses] as EquipFacilityBonus | undefined
  // Element-specific DEF from keys "1"-"7"
  const elemDef = ts.equipment_facility_bonuses[ek as keyof typeof ts.equipment_facility_bonuses] as EquipFacilityBonus | undefined

  return {
    atk_pct: allAtk?.equip_atk_pct ?? 0,
    def_pct: elemDef?.equip_def_pct ?? 0,
    hp_pct: (allAtk?.equip_hp_pct ?? 0) + (elemDef?.equip_hp_pct ?? 0),
  }
}

// ── EP Formula ─────────────────────────────────────────────────────────────
// EP = HP×1 + ATK×5 + floor(DEF×5/2)
// Confirmed: Bond EP matches exactly with this formula.
// Status/Facility/Heartprint EP have small additional contributions from
// combat stats (crit/pierce/synergy/etc) which we omit (~1% of total).

function computeEP(hp: number, atk: number, def: number): number {
  return hp + atk * 5 + Math.floor(def * 5 / 2)
}

// ── Main EP Calculation ────────────────────────────────────────────────────

export function calcSlotStats(
  mainChar: WikiCharacter,
  subChar: WikiCharacter | null,
  equipWeapon: Equipment | null,
  equipArmor: Equipment | null,
  equipAccessory: Equipment | null,
): SlotStats {
  const baseHp = mainChar.stats.hp
  const baseAtk = mainChar.stats.attack
  const baseDef = mainChar.stats.defense

  // 1. Level max additions
  const lma = getLevelMaxAdd(mainChar)

  // 2. Statusboard bonuses
  const sb = getStatusboardBonus(mainChar)
  const esb = getEnhancedStatusboardBonus(mainChar)

  // 3. Bond bonus (uses base stats × ratio / 10000, rounded up)
  const bond = getBondRatios()
  const bondHp = Math.ceil(baseHp * bond.hp_ratio / 10000)
  const bondAtk = Math.ceil(baseAtk * bond.attack_ratio / 10000)
  const bondDef = Math.ceil(baseDef * bond.defense_ratio / 10000)

  // 4. Sub-slot contribution
  let subHp = 0, subAtk = 0, subDef = 0
  if (subChar) {
    const subLma = getLevelMaxAdd(subChar)
    const subSb = getStatusboardBonus(subChar)
    const subEsb = getEnhancedStatusboardBonus(subChar)
    const subBaseHp = subChar.stats.hp + subLma.add_hp + subSb.hp + subEsb.hp
    const subBaseAtk = subChar.stats.attack + subLma.add_attack + subSb.attack + subEsb.attack
    const subBaseDef = subChar.stats.defense + subLma.add_defense + subSb.defense + subEsb.defense
    const rate = SUB_BASE_RATE_R5 + (sameElement(mainChar, subChar) ? SUB_SAME_ELEM_BONUS : 0)
    subHp = Math.floor(subBaseHp * rate / 10000)
    subAtk = Math.floor(subBaseAtk * rate / 10000)
    subDef = Math.floor(subBaseDef * rate / 10000)
  }

  // 5. Equipment raw stats (max stats)
  const eqHp = (equipWeapon?.max_hp ?? 0) + (equipArmor?.max_hp ?? 0) + (equipAccessory?.max_hp ?? 0)
  const eqAtk = (equipWeapon?.max_atk ?? 0) + (equipArmor?.max_atk ?? 0) + (equipAccessory?.max_atk ?? 0)
  const eqDef = (equipWeapon?.max_def ?? 0) + (equipArmor?.max_def ?? 0) + (equipAccessory?.max_def ?? 0)

  // 6. Equipment facility bonus (% on top of equipment stats)
  const equipFac = getEquipFacilityBonus(mainChar)
  const eqBonusHp = Math.floor(eqHp * equipFac.hp_pct / 100)
  const eqBonusAtk = Math.floor(eqAtk * equipFac.atk_pct / 100)
  const eqBonusDef = Math.floor(eqDef * equipFac.def_pct / 100)

  // 7. Facility character bonus (% on char stats before equipment)
  const fac = getFacilityBonus(mainChar)
  const charHp = baseHp + lma.add_hp + sb.hp + esb.hp + bondHp + subHp
  const charAtk = baseAtk + lma.add_attack + sb.attack + esb.attack + bondAtk + subAtk
  const charDef = baseDef + lma.add_defense + sb.defense + esb.defense + bondDef + subDef

  const facBonusHp = Math.floor(charHp * fac.hp_pct / 100)
  const facBonusAtk = Math.floor(charAtk * fac.atk_pct / 100)
  const facBonusDef = Math.floor(charDef * fac.def_pct / 100)

  // 8. Total stats
  const totalHp = charHp + facBonusHp + eqHp + eqBonusHp
  const totalAtk = charAtk + facBonusAtk + eqAtk + eqBonusAtk
  const totalDef = charDef + facBonusDef + eqDef + eqBonusDef

  // 9. EP per source (game computes EP separately per source then sums)
  //    Character Status = base + level + statusboard + enhanced statusboard
  const statusHp = baseHp + lma.add_hp + sb.hp + esb.hp
  const statusAtk = baseAtk + lma.add_attack + sb.attack + esb.attack
  const statusDef = baseDef + lma.add_defense + sb.defense + esb.defense
  const statusEp = computeEP(statusHp, statusAtk, statusDef)

  const bondEp = computeEP(bondHp, bondAtk, bondDef)

  const facilityEp = computeEP(facBonusHp, facBonusAtk, facBonusDef)

  //    Equipment EP: raw equip stats + equip facility bonus
  const totalEqHp = eqHp + eqBonusHp
  const totalEqAtk = eqAtk + eqBonusAtk
  const totalEqDef = eqDef + eqBonusDef
  const equipmentEp = computeEP(totalEqHp, totalEqAtk, totalEqDef)

  //    Sub-slot EP is included in status EP in the game,
  //    but we track it for the total
  const subEp = computeEP(subHp, subAtk, subDef)

  const ep = statusEp + bondEp + facilityEp + equipmentEp + subEp

  return { hp: totalHp, attack: totalAtk, defense: totalDef, ep, statusEp, bondEp, facilityEp, equipmentEp }
}

// ── Team EP ────────────────────────────────────────────────────────────────

export type TeamSlotInput = {
  mainChar: WikiCharacter | null
  subChar: WikiCharacter | null
  weapon: Equipment | null
  armor: Equipment | null
  accessory: Equipment | null
}

export function calcTeamEP(slots: TeamSlotInput[]): TeamEP {
  const results = slots.map((slot) => {
    if (!slot.mainChar) return null
    return calcSlotStats(slot.mainChar, slot.subChar, slot.weapon, slot.armor, slot.accessory)
  })
  const total = results.reduce((sum, s) => sum + (s?.ep ?? 0), 0)
  return { slots: results, total }
}

// ── EP Rank icon helper ────────────────────────────────────────────────────
// IcRank folders: 01-05, files: IcRank_XX_YY.png
// Rank tiers based on total EP thresholds (approximate game brackets):
//  01 = < 50,000   02 = 50k-100k   03 = 100k-200k   04 = 200k-400k   05 = 400k+
// Sub-rank within each tier: 01-03 (or more) based on finer thresholds

export function getEPRankIcon(totalEP: number): string {
  let tier: string
  let sub: string
  if (totalEP >= 400000) {
    tier = "05"
    sub = totalEP >= 600000 ? "03" : totalEP >= 500000 ? "02" : "01"
  } else if (totalEP >= 200000) {
    tier = "04"
    sub = totalEP >= 300000 ? "03" : totalEP >= 250000 ? "02" : "01"
  } else if (totalEP >= 100000) {
    tier = "03"
    sub = totalEP >= 150000 ? "03" : totalEP >= 125000 ? "02" : "01"
  } else if (totalEP >= 50000) {
    tier = "02"
    sub = totalEP >= 75000 ? "03" : totalEP >= 62500 ? "02" : "01"
  } else {
    tier = "01"
    sub = totalEP >= 25000 ? "03" : totalEP >= 12500 ? "02" : "01"
  }
  return `/Image/IcRank/${tier}/IcRank_${tier}_${sub}.png`
}

export { baseElement }
