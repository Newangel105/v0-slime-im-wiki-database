"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { Search, X, Plus, ChevronDown, Shield, Swords, Zap } from "lucide-react"
import {
  getConditionEffectMetadata,
  getCharMaxStats,
  toPublicAssetPath,
  stripColorTags,
  type WikiBattleAttackEffect,
  type WikiBattleBuffEffect,
  type WikiBattleCardEffect,
  type WikiBattleConditionEffect,
  type WikiBattleSystemEffect,
  type WikiCharacter,
  type WikiSkill,
} from "@/lib/pc-wiki"
import { type WikiEnemy } from "@/lib/enemies"

// ─── Formula constants (from MasterBattleDefineValue + MasterDefineValue) ────
const B               = 10000  // common.basis.point
const CRIT_BASE       = 15000  // battle.rate.critical.common.coefficient
const CRIT_UP_COEF    = 13000  // battle.rate.critical.up.effect.coefficient
const DEFCRIT_BASE    = 4000   // battle.defcritical.revision.value
const SUPER_COOP_EFFECT = 12000 // battle.super.cooperation.effect.up
const SUPER_COOP_ADJ  = 5500   // battle.super.cooperation.adjustment
const SUPER_COOP_COEF = 0      // battle.super.cooperation.coef
const SUPER_PEN_EFFECT = 15000 // battle.super.penetration.effect.up
const SUPER_PEN_ADJ   = 1200   // battle.super.penetration.adjustment
const SUPER_PEN_COEF  = 3000   // battle.super.penetration.coef
const WEAK_BONUS      = 1000   // battle.rate.enhanced.weak.damage
const SUPER_WEAK_BONUS= 1000   // battle.rate.enhanced.super.weak.damage
const ENHANCE_ELEM_BONUS = 1000 // battle.rate.enhanced.element.add.weak.damage
// COOP_BASE_EST removed — base coop multiplier comes from EffectCooperation buff value

// ─── Types ────────────────────────────────────────────────────────────────────
export type BuffType = string

export type ElementWeakness = "normal" | "weak" | "super_weak" | "enhanced_weak" | "enhanced_super_weak"
export type SoCoType = "none" | "soco" | "ex_soco" | "ex2_soco"

export interface BuffEntry {
  id: string
  type: BuffType
  value: number   // 10000-basis (10000 = 100%)
  source: string
  skillId?: string
  uses?: number
  stackingMode?: "limited" | "unlimited"
}

type StatOverrides = {
  hp: string
  atk: string
  def: string
}

// Proc rates come from buffs (ProbCritical etc.) + base character rates
// RNG is rolled on demand; this stores rolled results for the current hit
export interface ProcRolls {
  critical: boolean
  superCritical: boolean
  penetration: boolean
  superPenetration: boolean
  cooperation: boolean
  superCooperation: boolean
  defCritical: boolean
  soco: SoCoType
  weakness: ElementWeakness
}

// Base proc rates (out of 10000) that player sets per attacker
export interface BaseRates {
  probCritical: number        // base crit rate
  probPenetration: number     // base pierce rate
  probCooperation: number     // base synergy rate
  probDefcritical: number     // base aegis rate
  probCriticalSuper: number   // base super crit rate
  probPenetrationSuper: number
  probCooperationSuper: number
  isEnhancedAttacker: boolean
}

type AttackerSlotState = {
  char: WikiCharacter | null
  statOverrides: StatOverrides
  rates: BaseRates
}

// ─── Element data ─────────────────────────────────────────────────────────────
const ELEM_ICON: Record<string, string> = {
  Fire: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementFire.webp", Water: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementWater.webp",
  Wind: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementWind.webp", Earth: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEarth.webp",
  Light: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementHoly.webp", Dark: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementDark.webp",
  Space: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementAir.webp",
}
const ELEM_COLOR: Record<string, string> = {
  Fire: "text-red-400", Water: "text-blue-400",
  Wind: "text-green-400", Earth: "text-yellow-500",
  Light: "text-yellow-200", Dark: "text-purple-400",
  Space: "text-cyan-400",
}
const ELEM_RING: Record<string, string> = {
  Fire: "ring-red-500", Water: "ring-blue-500",
  Wind: "ring-green-500", Earth: "ring-yellow-600",
  Light: "ring-yellow-300", Dark: "ring-purple-500",
  Space: "ring-cyan-500",
}
const ELEM_BORDER: Record<string, string> = {
  Fire: "border-red-800 bg-red-950/40", Water: "border-blue-800 bg-blue-950/40",
  Wind: "border-green-800 bg-green-950/40", Earth: "border-yellow-800 bg-yellow-950/40",
  Light: "border-yellow-600 bg-yellow-950/40", Dark: "border-purple-800 bg-purple-950/40",
  Space: "border-cyan-800 bg-cyan-950/40",
}

// ─── Buff metadata ────────────────────────────────────────────────────────────
const BUFF_META: Record<string, { label: string; group: string }> = {
  // Stat
  Attack:                        { label: "ATK %",                       group: "Stat" },
  Defense:                       { label: "Enemy DEF %",                 group: "Stat" },
  // Attack-type (P-ATK / M-ATK / Single / AoE)
  EffectAttackPhysics:           { label: "P-ATK %",                     group: "ATK Type" },
  EffectAttackMagic:             { label: "M-ATK %",                     group: "ATK Type" },
  EffectAttackSingle:            { label: "Single-target ATK %",         group: "ATK Type" },
  EffectAttackWhole:             { label: "AoE ATK %",                   group: "ATK Type" },
  // Attacker element ATK (only when attacker.element matches)
  EffectElementEarth:            { label: "Earth ATK %",                 group: "Elem ATK" },
  EffectElementSpace:            { label: "Space ATK %",                 group: "Elem ATK" },
  EffectElementWind:             { label: "Wind ATK %",                  group: "Elem ATK" },
  EffectElementWater:            { label: "Water ATK %",                 group: "Elem ATK" },
  EffectElementFire:             { label: "Fire ATK %",                  group: "Elem ATK" },
  EffectElementLight:            { label: "Light ATK %",                 group: "Elem ATK" },
  EffectElementDark:             { label: "Dark ATK %",                  group: "Elem ATK" },
  // Proc damage powers
  EffectCritical:                { label: "Crit Power %",                group: "Proc Power" },
  EffectPenetration:             { label: "Pierce Power %",              group: "Proc Power" },
  EffectCooperation:             { label: "Synergy Power %",             group: "Proc Power" },
  EffectDefcritical:             { label: "Aegis Power %",               group: "Proc Power" },
  // Proc rates
  ProbCritical:                  { label: "Crit Rate %",                 group: "Proc Rate" },
  ProbPenetration:               { label: "Pierce Rate %",               group: "Proc Rate" },
  ProbCooperation:               { label: "Synergy Rate %",              group: "Proc Rate" },
  ProbDefcritical:               { label: "Aegis Rate %",                group: "Proc Rate" },
  ProbCriticalSuper:             { label: "Super Crit Rate %",           group: "Proc Rate" },
  ProbPenetrationSuper:          { label: "Super Pierce Rate %",         group: "Proc Rate" },
  ProbCooperationSuper:          { label: "Super Synergy Rate %",        group: "Proc Rate" },
  // "X+ damage" (DamageEffect type — e.g. "space+ damage UP", separate from elem ATK)
  DamageEffectElementEarth:      { label: "Earth+ DMG %",                group: "Dmg Effect" },
  DamageEffectElementSpace:      { label: "Space+ DMG %",                group: "Dmg Effect" },
  DamageEffectElementWind:       { label: "Wind+ DMG %",                 group: "Dmg Effect" },
  DamageEffectElementWater:      { label: "Water+ DMG %",                group: "Dmg Effect" },
  DamageEffectElementFire:       { label: "Fire+ DMG %",                 group: "Dmg Effect" },
  DamageEffectElementLight:      { label: "Light+ DMG %",                group: "Dmg Effect" },
  DamageEffectElementDark:       { label: "Dark+ DMG %",                 group: "Dmg Effect" },
  DamageEffectAttackPhysics:     { label: "Phys+ DMG %",                 group: "Dmg Effect" },
  DamageEffectAttackMagic:       { label: "Magic+ DMG %",                group: "Dmg Effect" },
  // Enemy resists
  ResistCritical:                { label: "Enemy Crit Resist %",         group: "Enemy Resist" },
  ResistPenetration:             { label: "Enemy Pierce Resist %",       group: "Enemy Resist" },
  ResistCooperation:             { label: "Enemy Synergy Resist %",      group: "Enemy Resist" },
  ResistDefcritical:             { label: "Enemy Aegis Resist %",        group: "Enemy Resist" },
  ResistAttackPhysics:           { label: "Enemy P-ATK Resist %",        group: "Enemy Resist" },
  ResistAttackMagic:             { label: "Enemy M-ATK Resist %",        group: "Enemy Resist" },
  // "Damage to X enemies" = SpecialEffectElement* (vs enemy element)
  SpecialEffectElementEarth:     { label: "DMG vs Earth enemies %",      group: "Elem Bonus" },
  SpecialEffectElementSpace:     { label: "DMG vs Space enemies %",      group: "Elem Bonus" },
  SpecialEffectElementWind:      { label: "DMG vs Wind enemies %",       group: "Elem Bonus" },
  SpecialEffectElementWater:     { label: "DMG vs Water enemies %",      group: "Elem Bonus" },
  SpecialEffectElementFire:      { label: "DMG vs Fire enemies %",       group: "Elem Bonus" },
  SpecialEffectElementLight:     { label: "DMG vs Light enemies %",      group: "Elem Bonus" },
  SpecialEffectElementDark:      { label: "DMG vs Dark enemies %",       group: "Elem Bonus" },
  // Weakness
  SpecialEffectWeakness:         { label: "Weakness Strike %",           group: "Weakness" },
  SpecialEffectSuperWeakness:    { label: "Super Weakness Strike %",     group: "Weakness" },
  ConditionDefenceNotActive:     { label: "Damage vs No Condition %",    group: "Condition Bonus" },
  ConditionDefencePoison:        { label: "Damage vs Poison %",          group: "Condition Bonus" },
  ConditionDefenceFrostbite:     { label: "Damage vs Frostbite %",       group: "Condition Bonus" },
  ConditionDefenceCharmed:       { label: "Damage vs Charmed %",         group: "Condition Bonus" },
  ConditionDefenceDomination:    { label: "Damage vs Domination %",      group: "Condition Bonus" },
  ConditionDefenceShiver:        { label: "Damage vs Shiver %",          group: "Condition Bonus" },
  ConditionDefenceBurn:          { label: "Damage vs Burn %",            group: "Condition Bonus" },
  AttackDamageRate:              { label: "Attack Damage Rate",          group: "System" },
  // Misc
  ComboRate:                     { label: "Combo Rate %",                group: "Combo" },
  DamageTaken:                   { label: "Enemy Dmg Taken %",           group: "Debuff" },
  DamageResistSpecial:           { label: "Enemy Secret Skill Resist %", group: "Debuff" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sumBuff(buffs: BuffEntry[], type: BuffType) {
  const matching = buffs.filter((buff) => buff.type === type)
  if (matching.length === 0) return 0

  let unlimitedTotal = 0
  let strongestLimited: BuffEntry | null = null
  for (const buff of matching) {
    if (buff.stackingMode === "unlimited") {
      unlimitedTotal += buff.value
      continue
    }
    if (!strongestLimited || Math.abs(buff.value) > Math.abs(strongestLimited.value)) {
      strongestLimited = buff
    }
  }

  return unlimitedTotal + (strongestLimited?.value ?? 0)
}

function getBattleStats(char: WikiCharacter | null | undefined) {
  if (!char) return null
  return getCharMaxStats(char.master_pc_id) ?? {
    hp: char.stats.hp,
    attack: char.stats.attack,
    defense: char.stats.defense,
    existence: char.stats.existence,
  }
}

function parsePositiveNumberInput(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function getSlotBattleStats(slot: AttackerSlotState | null | undefined) {
  if (!slot?.char) return null
  const base = getBattleStats(slot.char) ?? slot.char.stats
  return {
    hp: parsePositiveNumberInput(slot.statOverrides.hp) ?? base.hp,
    attack: parsePositiveNumberInput(slot.statOverrides.atk) ?? base.attack,
    defense: parsePositiveNumberInput(slot.statOverrides.def) ?? base.defense,
  }
}

function createEmptyStatOverrides(): StatOverrides {
  return { hp: "", atk: "", def: "" }
}

function inferSkillBuffStackingMode(skill: WikiSkill | null | undefined): "limited" | "unlimited" {
  if (!skill) return "limited"
  if (skill.slot === "leader_skill" || skill.slot === "assist_leader_skill") return "unlimited"

  const text = stripColorTags(skill.description_max_level ?? "")
  if (/(until the end of battle|\bUnlimited\b|\bMax:\b|\bStacks\b|during battle|available in support formation)/i.test(text)) {
    return "unlimited"
  }

  return "limited"
}

function normalizeUseCount(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function getAttackerSkillUseKey(slotIdx: number, skillLabel: string) {
  return `att:${slotIdx}:${skillLabel}`
}

function getProtectorSkillUseKey(masterPcId: number, slot: string) {
  return `prot:${masterPcId}:${slot}`
}

export function parseSkillDamageRate(description: string | null | undefined): number | null {
  if (!description) return null
  const text = stripColorTags(description)
  const m = text.match(/(\d+)%\s*(?:of\s+)?(?:normal|damage)/i) ?? text.match(/(\d+)%/i)
  return m ? parseInt(m[1], 10) : null
}

interface ParsedBuff { type: BuffType; value: number; note: string }

// Element name canonicalization: game text -> BuffType key suffix
const ELEM_NAME_MAP: Record<string, string> = {
  fire: "Fire", water: "Water", wind: "Wind", earth: "Earth",
  light: "Light", dark: "Dark", space: "Space",
  // aliases
  holy: "Light", air: "Space",
}

function canonElem(raw: string): string | null {
  return ELEM_NAME_MAP[raw.toLowerCase()] ?? null
}

type TargetTeam = "enemy" | "ally" | "self"
type AttackScope = "single" | "whole"

type BattleElementInfo = {
  key: string
  baseElement: string
  isEnhanced: boolean
}

const TARGET_TYPE_TEAM: Record<number, TargetTeam> = {
  0: "enemy",
  1: "enemy",
  2: "ally",
  3: "ally",
  4: "ally",
  5: "self",
  6: "enemy",
  7: "enemy",
  8: "ally",
  9: "ally",
  10: "enemy",
  11: "enemy",
  12: "ally",
  13: "ally",
  14: "ally",
  15: "ally",
  16: "ally",
}

const PARAMETER_TYPE_TO_BUFF: Record<number, BuffType> = {
  1: "Attack",
  2: "Defense",
  100: "ProbCritical",
  101: "ProbPenetration",
  110: "ProbCooperation",
  111: "ProbDefcritical",
  300: "EffectAttackPhysics",
  301: "EffectAttackMagic",
  302: "EffectAttackSingle",
  303: "EffectAttackWhole",
  304: "EffectCritical",
  305: "EffectPenetration",
  309: "EffectElementEarth",
  310: "EffectElementSpace",
  311: "EffectElementWind",
  312: "EffectElementWater",
  313: "EffectElementFire",
  314: "EffectElementLight",
  315: "EffectElementDark",
  317: "EffectCooperation",
  318: "EffectEnhancedWeakDamage",
  319: "EffectDefcritical",
  401: "ResistAttackPhysics",
  402: "ResistAttackMagic",
  403: "ResistAttackSingle",
  404: "ResistAttackWhole",
  405: "ResistCritical",
  406: "ResistPenetration",
  410: "ResistElementEarth",
  411: "ResistElementSpace",
  412: "ResistElementWind",
  413: "ResistElementWater",
  414: "ResistElementFire",
  415: "ResistElementLight",
  416: "ResistElementDark",
  418: "ResistCooperation",
  419: "ResistEnhancedWeakDamage",
  420: "ResistDefcritical",
  500: "DamageEffectAttackPhysics",
  501: "DamageEffectAttackMagic",
  502: "DamageEffectAttackSingle",
  503: "DamageEffectAttackWhole",
  508: "DamageEffectElementEarth",
  509: "DamageEffectElementSpace",
  510: "DamageEffectElementWind",
  511: "DamageEffectElementWater",
  512: "DamageEffectElementFire",
  513: "DamageEffectElementLight",
  514: "DamageEffectElementDark",
  600: "DamageResistAttackPhysics",
  601: "DamageResistAttackMagic",
  602: "DamageResistAttackSingle",
  603: "DamageResistAttackWhole",
  608: "DamageResistElementEarth",
  609: "DamageResistElementSpace",
  610: "DamageResistElementWind",
  611: "DamageResistElementWater",
  612: "DamageResistElementFire",
  613: "DamageResistElementLight",
  614: "DamageResistElementDark",
  616: "DamageResistSpecial",
  801: "ComboRate",
  1300: "SpecialEffectElementEarth",
  1301: "SpecialEffectElementSpace",
  1302: "SpecialEffectElementWind",
  1303: "SpecialEffectElementWater",
  1304: "SpecialEffectElementFire",
  1305: "SpecialEffectElementLight",
  1306: "SpecialEffectElementDark",
  1400: "SpecialEffectWeakness",
  1401: "ResistWeakness",
  1402: "SpecialEffectSuperWeakness",
  1403: "ResistSuperWeakness",
  1501: "EffectElementEnhancedFire",
  1502: "EffectElementEnhancedWater",
  1503: "EffectElementEnhancedWind",
  1504: "EffectElementEnhancedSpace",
  1505: "EffectElementEnhancedEarth",
  1506: "EffectElementEnhancedLight",
  1507: "EffectElementEnhancedDark",
  1508: "ResistElementEnhancedFire",
  1509: "ResistElementEnhancedWater",
  1510: "ResistElementEnhancedWind",
  1511: "ResistElementEnhancedSpace",
  1512: "ResistElementEnhancedEarth",
  1513: "ResistElementEnhancedLight",
  1514: "ResistElementEnhancedDark",
  1515: "DamageEffectElementEnhancedFire",
  1516: "DamageEffectElementEnhancedWater",
  1517: "DamageEffectElementEnhancedWind",
  1518: "DamageEffectElementEnhancedSpace",
  1519: "DamageEffectElementEnhancedEarth",
  1520: "DamageEffectElementEnhancedLight",
  1521: "DamageEffectElementEnhancedDark",
  1522: "DamageResistElementEnhancedFire",
  1523: "DamageResistElementEnhancedWater",
  1524: "DamageResistElementEnhancedWind",
  1525: "DamageResistElementEnhancedSpace",
  1526: "DamageResistElementEnhancedEarth",
  1527: "DamageResistElementEnhancedLight",
  1528: "DamageResistElementEnhancedDark",
  1701: "ProbCriticalSuper",
  1801: "ConditionDefenceNotActive",
  1802: "ConditionDefencePoison",
  1803: "ConditionDefenceFrostbite",
  1804: "ConditionDefenceCharmed",
  1805: "ConditionDefenceDomination",
  1806: "ConditionDefenceShiver",
  1807: "ConditionDefenceBurn",
  1808: "ProbPenetrationSuper",
  1809: "ProbCooperationSuper",
}

const CONDITION_EFFECT_NAMES: Record<number, string> = {
  0: "NotActive",
  1: "Poison",
  3: "Burn",
  14: "Frostbite",
  15: "Drago",
  33: "Charmed",
  47: "Domination",
  57: "Dread",
  72: "DivinePunishment",
  73: "DragonEye",
}

const CONDITION_DAMAGE_BUFF_BY_NAME: Record<string, BuffType> = {
  NotActive: "ConditionDefenceNotActive",
  Poison: "ConditionDefencePoison",
  Frostbite: "ConditionDefenceFrostbite",
  Charmed: "ConditionDefenceCharmed",
  Domination: "ConditionDefenceDomination",
  Dread: "ConditionDefenceShiver",
  Shiver: "ConditionDefenceShiver",
  Burn: "ConditionDefenceBurn",
}

const CARD_TARGET_TYPE_NAMES: Record<number, string> = {
  0: "NormalTechnique",
  1: "NormalFriendship",
  2: "NormalBrave",
  3: "NormalAll",
  4: "Special",
  5: "Ultimate",
  6: "Mighty",
  7: "DragonSoul",
  8: "Epic",
}

const CARD_EFFECT_TYPE_NAMES: Record<number, string> = {
  0: "BuffAttack",
  1: "BuffGauge",
  2: "BuffComboAttack",
  3: "BuffComboGauge",
  4: "BuffSkillGauge",
  5: "BuffBlessGauge",
  6: "BuffSpecialGauge",
  7: "BuffPursuit",
  8: "BuffAttackUltimate",
  11: "BuffAttackWhole",
  12: "BuffMultipleHit",
  18: "AddCombo",
  19: "SpecialResonate",
}

const SYSTEM_EFFECT_TYPE_NAMES: Record<number, string> = {
  0: "ChangeHandCardTypeFromTechnique",
  1: "ChangeHandCardTypeFromFriendship",
  2: "ChangeHandCardTypeFromBrave",
  3: "ChangeHandCardTypeAll",
  21: "SkillPoint",
  22: "SkillPointMax",
  23: "BlessLock",
  24: "BlessPoint",
  31: "IncreasedSkillCostDown",
  32: "IncreasedSkillCostDownWithDeck",
  33: "IncreasedSkillCostUp",
  34: "IncreasedSkillCostUpWithDeck",
  40: "ExtraTurn",
  41: "ChangeHandCardTypeFromSpecial",
  44: "ActiveSkillTurnCountLimitRelease",
  47: "SkillPointExceedable",
  50: "HealBlock",
  51: "AttackDamageRate",
  52: "InstantGenerateSpecialSkillHand",
  53: "BurnWeakness",
}

const ATTACKER_SIDE_BUFF_TYPES = new Set<BuffType>([
  "Attack",
  "EffectAttackPhysics",
  "EffectAttackMagic",
  "EffectAttackSingle",
  "EffectAttackWhole",
  "EffectCritical",
  "EffectPenetration",
  "EffectCooperation",
  "EffectDefcritical",
  "ProbCritical",
  "ProbPenetration",
  "ProbCooperation",
  "ProbDefcritical",
  "ProbCriticalSuper",
  "ProbPenetrationSuper",
  "ProbCooperationSuper",
  "ComboRate",
  "SpecialEffectWeakness",
  "SpecialEffectSuperWeakness",
  "EffectEnhancedWeakDamage",
  "EffectElementEarth",
  "EffectElementSpace",
  "EffectElementWind",
  "EffectElementWater",
  "EffectElementFire",
  "EffectElementLight",
  "EffectElementDark",
  "EffectElementEnhancedEarth",
  "EffectElementEnhancedSpace",
  "EffectElementEnhancedWind",
  "EffectElementEnhancedWater",
  "EffectElementEnhancedFire",
  "EffectElementEnhancedLight",
  "EffectElementEnhancedDark",
  "DamageEffectAttackPhysics",
  "DamageEffectAttackMagic",
  "DamageEffectAttackSingle",
  "DamageEffectAttackWhole",
  "DamageEffectElementEarth",
  "DamageEffectElementSpace",
  "DamageEffectElementWind",
  "DamageEffectElementWater",
  "DamageEffectElementFire",
  "DamageEffectElementLight",
  "DamageEffectElementDark",
  "DamageEffectElementEnhancedEarth",
  "DamageEffectElementEnhancedSpace",
  "DamageEffectElementEnhancedWind",
  "DamageEffectElementEnhancedWater",
  "DamageEffectElementEnhancedFire",
  "DamageEffectElementEnhancedLight",
  "DamageEffectElementEnhancedDark",
  "SpecialEffectElementEarth",
  "SpecialEffectElementSpace",
  "SpecialEffectElementWind",
  "SpecialEffectElementWater",
  "SpecialEffectElementFire",
  "SpecialEffectElementLight",
  "SpecialEffectElementDark",
  "ConditionDefenceNotActive",
  "ConditionDefencePoison",
  "ConditionDefenceFrostbite",
  "ConditionDefenceCharmed",
  "ConditionDefenceDomination",
  "ConditionDefenceShiver",
  "ConditionDefenceBurn",
])

const ENEMY_SIDE_BUFF_TYPES = new Set<BuffType>([
  "Defense",
  "ResistAttackPhysics",
  "ResistAttackMagic",
  "ResistAttackSingle",
  "ResistAttackWhole",
  "ResistCritical",
  "ResistPenetration",
  "ResistCooperation",
  "ResistDefcritical",
  "ResistWeakness",
  "ResistSuperWeakness",
  "ResistEnhancedWeakDamage",
  "DamageResistAttackPhysics",
  "DamageResistAttackMagic",
  "DamageResistAttackSingle",
  "DamageResistAttackWhole",
  "DamageResistSpecial",
  "ResistElementEarth",
  "ResistElementSpace",
  "ResistElementWind",
  "ResistElementWater",
  "ResistElementFire",
  "ResistElementLight",
  "ResistElementDark",
  "ResistElementEnhancedEarth",
  "ResistElementEnhancedSpace",
  "ResistElementEnhancedWind",
  "ResistElementEnhancedWater",
  "ResistElementEnhancedFire",
  "ResistElementEnhancedLight",
  "ResistElementEnhancedDark",
  "DamageResistElementEarth",
  "DamageResistElementSpace",
  "DamageResistElementWind",
  "DamageResistElementWater",
  "DamageResistElementFire",
  "DamageResistElementLight",
  "DamageResistElementDark",
  "DamageResistElementEnhancedEarth",
  "DamageResistElementEnhancedSpace",
  "DamageResistElementEnhancedWind",
  "DamageResistElementEnhancedWater",
  "DamageResistElementEnhancedFire",
  "DamageResistElementEnhancedLight",
  "DamageResistElementEnhancedDark",
])

const CONDITION_EFFECT_TYPE_BY_NAME: Record<string, number> = {
  NotActive: 0,
  Poison: 1,
  Burn: 3,
  Frostbite: 14,
  Drago: 15,
  DragonAura: 15,
  Charmed: 33,
  Domination: 47,
  Dread: 57,
  Shiver: 57,
  DivinePunishment: 72,
  DragonEye: 73,
}

const NON_MAGNIFIED_BUFF_TYPES = new Set<BuffType>(["AttackDamageRate"])

function isWeakeningBuff(buff: BuffEntry) {
  return (buff.type === "DamageTaken" && buff.value > 0) || (ENEMY_SIDE_BUFF_TYPES.has(buff.type) && buff.value < 0)
}

function isEnhancementBuff(buff: BuffEntry) {
  return !NON_MAGNIFIED_BUFF_TYPES.has(buff.type) && ATTACKER_SIDE_BUFF_TYPES.has(buff.type) && buff.value > 0
}

function applyConditionMagnificationRate(value: number, magnificationRate: number) {
  if (!magnificationRate) return value
  return Math.trunc((value * (B + magnificationRate)) / B)
}

function getConditionMagnificationRate(conditionName: string, polarity: "enhancement" | "weakening") {
  const conditionEffectType = CONDITION_EFFECT_TYPE_BY_NAME[conditionName]
  if (conditionEffectType == null) return 0

  const metadata = getConditionEffectMetadata(conditionEffectType)
  if (!metadata) return 0

  // Positive condition states such as Drago/Ariel store ally-side enhancement scaling here.
  const masterRate = polarity === "enhancement"
    ? Number(metadata.debuff_magnification_rate ?? 0)
    : Number(metadata.buff_magnification_rate ?? 0)
  if (masterRate) return masterRate

  if (metadata.text_magnification_polarity === polarity) {
    return Number(metadata.text_magnification_rate ?? 0)
  }

  return 0
}

function resolveEffectiveBuffs(
  buffs: BuffEntry[],
  activePartyConditions: string[],
  activeEnemyConditions: string[],
) {
  const enhancementRate = activePartyConditions.reduce(
    (sum, conditionName) => sum + getConditionMagnificationRate(conditionName, "enhancement"),
    0,
  )
  const weakeningRate = activeEnemyConditions.reduce(
    (sum, conditionName) => sum + getConditionMagnificationRate(conditionName, "weakening"),
    0,
  )

  if (!enhancementRate && !weakeningRate) {
    return buffs
  }

  return buffs.map((buff) => {
    if (enhancementRate && isEnhancementBuff(buff)) {
      const nextValue = applyConditionMagnificationRate(buff.value, enhancementRate)
      return nextValue === buff.value ? buff : { ...buff, value: nextValue }
    }
    if (weakeningRate && isWeakeningBuff(buff)) {
      const nextValue = applyConditionMagnificationRate(buff.value, weakeningRate)
      return nextValue === buff.value ? buff : { ...buff, value: nextValue }
    }
    return buff
  })
}

function getBuffLabel(type: BuffType) {
  return BUFF_META[type]?.label ?? type.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
}

function normalizeBattleElementName(raw: string | null | undefined) {
  if (!raw) return null
  if (raw === "Air") return "Space"
  if (raw === "Holy") return "Light"
  if (raw === "EnhancedAir") return "EnhancedSpace"
  if (raw === "EnhancedHoly") return "EnhancedLight"
  return raw
}

function getBattleElementInfo(raw: string | null | undefined, fallback = "Fire"): BattleElementInfo {
  const normalized = normalizeBattleElementName(raw) ?? normalizeBattleElementName(fallback) ?? "Fire"
  const isEnhanced = normalized.startsWith("Enhanced")
  const baseElement = isEnhanced ? normalized.slice("Enhanced".length) : normalized
  return {
    key: normalized,
    baseElement,
    isEnhanced,
  }
}

function normalizeAttackTypeName(raw: string | null | undefined): "Physical" | "Magic" {
  return raw === "Magic" ? "Magic" : "Physical"
}

function getTargetTeam(targetType: number | null | undefined): TargetTeam | null {
  if (targetType == null) return null
  return TARGET_TYPE_TEAM[targetType] ?? null
}

function getAttackScope(attackEffect: WikiBattleAttackEffect | null | undefined): AttackScope {
  return attackEffect?.target_type === 1 ? "whole" : "single"
}

function mapStructuredBattleBuff(row: WikiBattleBuffEffect, rowIndex: number): ParsedBuff | null {
  const parameterType = row.parameter_type ?? null
  const mappedType = parameterType != null ? PARAMETER_TYPE_TO_BUFF[parameterType] : null
  if (!mappedType) return null

  const team = getTargetTeam(row.target_type)
  if (ATTACKER_SIDE_BUFF_TYPES.has(mappedType) && team && team === "enemy") return null
  if (ENEMY_SIDE_BUFF_TYPES.has(mappedType) && team && team !== "enemy") return null

  const rawValue = Math.abs(Number(row.effect_value ?? 0))
  if (!rawValue) return null

  const buffType = Number(row.buff_type ?? 0)
  const sign = buffType === 2 ? -1 : buffType === 1 ? 1 : 0
  if (!sign) return null

  return {
    type: mappedType,
    value: rawValue * sign,
    note: `structured:${rowIndex + 1}`,
  }
}

function getSkillStructuredBuffs(skill: WikiSkill | null | undefined): ParsedBuff[] {
  if (!skill?.battle_buff_effects?.length) return []
  return skill.battle_buff_effects
    .map((row, index) => mapStructuredBattleBuff(row, index))
    .filter((row): row is ParsedBuff => row !== null)
}

function getSkillStructuredConditionEffects(skill: WikiSkill | null | undefined): WikiBattleConditionEffect[] {
  return (skill?.battle_condition_effects ?? []).filter((row) => Number(row.probability ?? 0) !== 0)
}

function getSkillStructuredCardEffects(skill: WikiSkill | null | undefined): WikiBattleCardEffect[] {
  return (skill?.battle_card_effects ?? []).filter(
    (row) => Number(row.effect_value ?? 0) !== 0 || Number(row.effect_max_value ?? 0) !== 0,
  )
}

function getSkillStructuredSystemEffects(skill: WikiSkill | null | undefined): WikiBattleSystemEffect[] {
  return (skill?.battle_system_effects ?? []).filter(
    (row) => Number(row.effect_value ?? 0) !== 0 || Number(row.probability ?? 0) !== 0,
  )
}

function skillHasConditionTarget(skill: WikiSkill | null | undefined, targetTeams: Set<string>) {
  return (skill?.skill_filter_groups ?? []).some(
    (group) => group.effect_family === "condition" && !!group.target_team && targetTeams.has(group.target_team),
  )
}

function skillHasEnemyConditionTarget(skill: WikiSkill | null | undefined) {
  return skillHasConditionTarget(skill, new Set(["enemy"]))
}

function skillHasPartyConditionTarget(skill: WikiSkill | null | undefined) {
  return skillHasConditionTarget(skill, new Set(["ally", "self"]))
}

function getConditionEffectName(row: WikiBattleConditionEffect | null | undefined): string | null {
  const effectType = Number(row?.condition_effect_type ?? -1)
  return CONDITION_EFFECT_NAMES[effectType] ?? null
}

function getSkillStructuredEnemyConditions(skill: WikiSkill | null | undefined) {
  if (!skill || !skillHasEnemyConditionTarget(skill)) return [] as Array<{ name: string; probability: number }>
  return getSkillStructuredConditionEffects(skill)
    .map((row) => {
      const name = getConditionEffectName(row)
      if (!name) return null
      return {
        name,
        probability: Number(row.probability ?? 0),
      }
    })
    .filter((row): row is { name: string; probability: number } => row !== null)
}

function getSkillStructuredPartyConditions(skill: WikiSkill | null | undefined) {
  if (!skill || !skillHasPartyConditionTarget(skill)) return [] as Array<{ name: string; probability: number }>
  return getSkillStructuredConditionEffects(skill)
    .map((row) => {
      const name = getConditionEffectName(row)
      if (!name) return null
      return {
        name,
        probability: Number(row.probability ?? 0),
      }
    })
    .filter((row): row is { name: string; probability: number } => row !== null)
}

function mapStructuredSystemBuff(row: WikiBattleSystemEffect, rowIndex: number): ParsedBuff | null {
  const systemType = Number(row.system_effect_type ?? -1)
  const effectValue = Number(row.effect_value ?? 0)
  if (!effectValue) return null

  if (systemType === 51) {
    return {
      type: "AttackDamageRate",
      value: effectValue,
      note: `structured-system:${rowIndex + 1}`,
    }
  }

  return null
}

function getSkillStructuredSystemBuffs(skill: WikiSkill | null | undefined): ParsedBuff[] {
  if (!skill?.battle_system_effects?.length) return []
  return skill.battle_system_effects
    .map((row, index) => mapStructuredSystemBuff(row, index))
    .filter((row): row is ParsedBuff => row !== null)
}

function getStructuredSkillEffectNotes(skill: WikiSkill | null | undefined): string[] {
  if (!skill) return []

  const notes: string[] = []
  for (const row of getSkillStructuredSystemEffects(skill)) {
    const typeName = SYSTEM_EFFECT_TYPE_NAMES[Number(row.system_effect_type ?? -1)]
    if (typeName === "AttackDamageRate") {
      notes.push(`All damage x${(Number(row.effect_value ?? 0) / B).toFixed(2)}`)
    }
  }
  for (const row of getSkillStructuredCardEffects(skill)) {
    const effectName = CARD_EFFECT_TYPE_NAMES[Number(row.card_effect_type ?? -1)]
    const targetName = CARD_TARGET_TYPE_NAMES[Number(row.card_target_type ?? -1)]
    if (effectName && targetName && Number(row.effect_value ?? 0) !== 0) {
      notes.push(`${effectName} ${targetName} ${(Number(row.effect_value ?? 0) / 100).toFixed(0)}%`)
    }
  }
  return notes
}

function getSkillBuffs(skill: WikiSkill | null | undefined): ParsedBuff[] {
  if (!skill) return []
  const structured = [...getSkillStructuredBuffs(skill), ...getSkillStructuredSystemBuffs(skill)]
  const seenTypes = new Set(structured.map((row) => row.type))
  const fallback = parseSkillBuffs(skill.description_max_level).filter((row) => !seenTypes.has(row.type))
  return [...structured, ...fallback]
}

function getSkillAttackEffects(skill: WikiSkill | null | undefined): WikiBattleAttackEffect[] {
  return (skill?.battle_attack_effects ?? []).filter((row) => Number(row.effect_value ?? 0) !== 0)
}

function getSkillPrimaryAttackEffect(skill: WikiSkill | null | undefined): WikiBattleAttackEffect | null {
  return getSkillAttackEffects(skill)[0] ?? null
}

function getSkillDamageRate(skill: WikiSkill | null | undefined): number {
  const attackEffects = getSkillAttackEffects(skill)
  if (attackEffects.length > 0) {
    return attackEffects.reduce((sum, row) => sum + Number(row.effect_value ?? 0), 0) / 100
  }
  return parseSkillDamageRate(skill?.description_max_level) ?? 0
}

export function parseSkillBuffs(description: string | null | undefined): ParsedBuff[] {
  if (!description) return []
  const text = stripColorTags(description)
  const result: ParsedBuff[] = []

  const tryAdd = (type: BuffType, raw: number, note: string) => {
    const value = Math.round(raw * 100)
    if (value !== 0) result.push({ type, value, note })
  }

  // ── 1. Element ATK UP (EffectElementX) — e.g. "fire ATK", "dark ATK" ────────
  // Must come BEFORE generic ATK patterns to avoid double-matching
  for (const m of text.matchAll(/increas\w*\s+(?:(?:own|all allies'|all)\s+)?(?:(?:[\w,']+\s+)*)(fire|water|wind|earth|light|dark|space)(?:\s+and\s+(fire|water|wind|earth|light|dark|space))?\s+atk\b[^\n]*?by\s+(\d+)%/gi)) {
    const v = parseFloat(m[3])
    const e1 = canonElem(m[1])
    if (e1) tryAdd(`EffectElement${e1}` as BuffType, v, m[0].trim())
    if (m[2]) {
      const e2 = canonElem(m[2])
      if (e2) tryAdd(`EffectElement${e2}` as BuffType, v, m[0].trim())
    }
  }

  // ── 2. "X+ damage UP" (DamageEffectElementX) — e.g. "space+ damage", "dark+ damage" ──
  for (const m of text.matchAll(/increas\w*\s+(?:(?:own|all allies'|all)\s+)?(fire|water|wind|earth|light|dark|space)\+\s+damage[^\n]*?by\s+(\d+)%/gi)) {
    const e = canonElem(m[1])
    if (e) tryAdd(`DamageEffectElement${e}` as BuffType, parseFloat(m[2]), m[0].trim())
  }

  // ── 3. P-ATK / M-ATK ─────────────────────────────────────────────────────────
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?p-?atk\b[^\n]*?by\s+(\d+)%/gi))
    tryAdd("EffectAttackPhysics", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?m-?atk\b[^\n]*?by\s+(\d+)%/gi))
    tryAdd("EffectAttackMagic", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?physical\s+(?:atk|damage)\b[^\n]*?by\s+(\d+)%/gi))
    tryAdd("EffectAttackPhysics", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?magic(?:al)?\s+(?:atk|damage)\b[^\n]*?by\s+(\d+)%/gi))
    tryAdd("EffectAttackMagic", parseFloat(m[1]), m[0].trim())

  // ── 4. Single-target / All-target ATK ────────────────────────────────────────
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?single[-\s]target\s+atk\b[^\n]*?by\s+(\d+)%/gi))
    tryAdd("EffectAttackSingle", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?all[-\s]target\s+atk\b[^\n]*?by\s+(\d+)%/gi))
    tryAdd("EffectAttackWhole", parseFloat(m[1]), m[0].trim())

  // ── 5. Generic ATK (LAST — only after all specific ATK patterns) ─────────────
  // Skip if preceded by element, P-, M-, single-target, all-target keywords
  for (const m of text.matchAll(/increas\w*\s+(?:(?:own|all allies'|all|single|every)[\s,]+)?atk(?:\s+and\s+def)?(?:\s+for[^\n]+?)?\s+by\s+(\d+)%/gi)) {
    const full = m[0].toLowerCase()
    // Skip if element or type-specific keyword found in the match text
    if (/\b(fire|water|wind|earth|light|dark|space|p-atk|m-atk|physical|magic|single.target|all.target)\b/.test(full)) continue
    tryAdd("Attack", parseFloat(m[1]), m[0].trim())
  }
  // "ATK and DEF by N%" — also adds ATK
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']*\s+)?atk\s+and\s+def\s+by\s+(\d+)%/gi))
    tryAdd("Attack", parseFloat(m[1]), m[0].trim())

  // ── 6. Enemy DEF reduction ────────────────────────────────────────────────────
  for (const m of text.matchAll(/(?:reduc\w*|decreas\w*)\s+(?:all\s+)?(?:target(?:s')?\s+)?def(?:ense)?\s+by\s+(-?\d+)%/gi))
    tryAdd("Defense", -Math.abs(parseFloat(m[1])), m[0].trim())
  for (const m of text.matchAll(/decreas\w*\s+(?:[\w\s,']+?\s+)?def(?:ense)?\s+(?:resistance\s+)?by\s+(-?\d+)%/gi))
    tryAdd("Defense", -Math.abs(parseFloat(m[1])), m[0].trim())

  // ── 7. Proc RATES ─────────────────────────────────────────────────────────────
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?super\s+critical\s+rate[^\n]*?by\s+(\d+)%/gi))
    tryAdd("ProbCriticalSuper", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?critical\s+rate[^\n]*?by\s+(\d+)%/gi))
    tryAdd("ProbCritical", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?super\s+pierce\s+rate[^\n]*?by\s+(\d+)%/gi))
    tryAdd("ProbPenetrationSuper", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?pierce\s+rate[^\n]*?by\s+(\d+)%/gi))
    tryAdd("ProbPenetration", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?super\s+synergy\s+rate[^\n]*?by\s+(\d+)%/gi))
    tryAdd("ProbCooperationSuper", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?synergy\s+rate[^\n]*?by\s+(\d+)%/gi))
    tryAdd("ProbCooperation", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?aegis\s+rate[^\n]*?by\s+(\d+)%/gi))
    tryAdd("ProbDefcritical", parseFloat(m[1]), m[0].trim())

  // ── 8. Proc POWERS (EffectCritical / EffectPenetration / etc.) ────────────────
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?critical\s+(?:power|damage|dmg)[^\n]*?by\s+(\d+)%/gi))
    tryAdd("EffectCritical", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?(?:pierce|penetration)\s+(?:power|damage|dmg)[^\n]*?by\s+(\d+)%/gi))
    tryAdd("EffectPenetration", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?synergy\s+(?:power|damage|dmg)[^\n]*?by\s+(\d+)%/gi))
    tryAdd("EffectCooperation", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?aegis\s+(?:power|damage|dmg)[^\n]*?by\s+(\d+)%/gi))
    tryAdd("EffectDefcritical", parseFloat(m[1]), m[0].trim())

  // ── 9. Resist reductions (enemy resists) ──────────────────────────────────────
  for (const m of text.matchAll(/decreas\w*\s+(?:all\s+)?target(?:s')?\s+(?:crit(?:ical)?|critical)\s+resistance\s+by\s+(-?\d+)%/gi))
    tryAdd("ResistCritical", -Math.abs(parseFloat(m[1])), m[0].trim())
  for (const m of text.matchAll(/decreas\w*\s+(?:all\s+)?target(?:s')?\s+(?:pierce|penetration)\s+resistance\s+by\s+(-?\d+)%/gi))
    tryAdd("ResistPenetration", -Math.abs(parseFloat(m[1])), m[0].trim())
  for (const m of text.matchAll(/decreas\w*\s+(?:all\s+)?target(?:s')?\s+synergy\s+resistance\s+by\s+(-?\d+)%/gi))
    tryAdd("ResistCooperation", -Math.abs(parseFloat(m[1])), m[0].trim())
  for (const m of text.matchAll(/decreas\w*\s+(?:all\s+)?target(?:s')?\s+aegis\s+resistance\s+by\s+(-?\d+)%/gi))
    tryAdd("ResistDefcritical", -Math.abs(parseFloat(m[1])), m[0].trim())
  for (const m of text.matchAll(/decreas\w*\s+(?:all\s+)?target(?:s')?\s+(?:physical|p-?atk)\s+resistance\s+by\s+(-?\d+)%/gi))
    tryAdd("ResistAttackPhysics", -Math.abs(parseFloat(m[1])), m[0].trim())
  for (const m of text.matchAll(/decreas\w*\s+(?:all\s+)?target(?:s')?\s+(?:magic|m-?atk)\s+resistance\s+by\s+(-?\d+)%/gi))
    tryAdd("ResistAttackMagic", -Math.abs(parseFloat(m[1])), m[0].trim())
  for (const m of text.matchAll(/decreas\w*\s+(?:all\s+)?target(?:s')?\s+(?:secret|special)\s+skill\s+damage\s+resistance\s+by\s+(-?\d+)%/gi))
    tryAdd("DamageResistSpecial", -Math.abs(parseFloat(m[1])), m[0].trim())

  // ── 9b. Enemy-side damage taken / combo modifiers ────────────────────────────
  for (const m of text.matchAll(/increas\w*\s+(?:all\s+)?target(?:s')?(?:\s+overall)?\s+damage\s+taken\s+by\s+(\d+)%/gi))
    tryAdd("DamageTaken", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+(?:all\s+)?target(?:s')?\s+damage\s+received\s+by\s+(\d+)%/gi))
    tryAdd("DamageTaken", parseFloat(m[1]), m[0].trim())
  for (const m of text.matchAll(/increas\w*\s+combo\s+rate\s+by\s+(\d+)%/gi))
    tryAdd("ComboRate", parseFloat(m[1]), m[0].trim())

  // ── 10. Weakness strike bonus ─────────────────────────────────────────────────
  for (const m of text.matchAll(/increas\w*\s+(?:[\w\s,']+?\s+)?(?:super\s+)?weakness\s+strike[^\n]*?by\s+(\d+)%/gi)) {
    const isSuper = /super/.test(m[0].toLowerCase())
    tryAdd(isSuper ? "SpecialEffectSuperWeakness" : "SpecialEffectWeakness", parseFloat(m[1]), m[0].trim())
  }

  // ── 11. "Damage to X enemies" = SpecialEffectElement* ────────────────────────
  for (const m of text.matchAll(/(?:damage\s+done|increas\w*)\s+(?:[\w\s,']*?)?(?:to|vs\.?)\s+(fire|water|wind|earth|light|dark|space)(?:\s+attribute)?\s+enemies[^\n]*?by\s+(\d+)%/gi)) {
    const e = canonElem(m[1])
    if (e) tryAdd(`SpecialEffectElement${e}` as BuffType, parseFloat(m[2]), m[0].trim())
  }

  return result
}

// ─── Formula ──────────────────────────────────────────────────────────────────
export interface CalcStep { label: string; mult: number; note: string }
export interface CalcResult {
  steps: CalcStep[]
  totalMult: number
  rawDamage: number | null
  procRolls: ProcRolls
  critRate: number
  penRate: number
  coopRate: number
  aegisRate: number
}

export function computeProcRates(
  buffs: BuffEntry[],
  baseRates: BaseRates,
): { crit: number; superCrit: number; pen: number; superPen: number; coop: number; superCoop: number; aegis: number } {
  return {
    crit:      baseRates.probCritical      + sumBuff(buffs, "ProbCritical"),
    superCrit: baseRates.probCriticalSuper + sumBuff(buffs, "ProbCriticalSuper"),
    pen:       baseRates.probPenetration   + sumBuff(buffs, "ProbPenetration"),
    superPen:  baseRates.probPenetrationSuper + sumBuff(buffs, "ProbPenetrationSuper"),
    coop:      baseRates.probCooperation   + sumBuff(buffs, "ProbCooperation"),
    superCoop: baseRates.probCooperationSuper + sumBuff(buffs, "ProbCooperationSuper"),
    aegis:     baseRates.probDefcritical   + sumBuff(buffs, "ProbDefcritical"),
  }
}

export function rollProcs(
  rates: ReturnType<typeof computeProcRates>,
  prevRolls: ProcRolls,
): ProcRolls {
  // Super proc happens independently; if super fires the normal one also fires
  const r = () => Math.floor(Math.random() * B)
  const superCrit  = r() < rates.superCrit
  const crit       = superCrit || r() < rates.crit
  const superPen   = r() < rates.superPen
  const pen        = superPen  || r() < rates.pen
  const superCoop  = r() < rates.superCoop
  const coop       = superCoop || r() < rates.coop
  const aegis      = r() < rates.aegis
  return { ...prevRolls, critical: crit, superCritical: superCrit, penetration: pen, superPenetration: superPen, cooperation: coop, superCooperation: superCoop, defCritical: aegis }
}

// Helper: get enemy's built-in resist for a given attack type / element
export function getEnemyBaseResist(enemy: import("@/lib/enemies").WikiEnemy | null | undefined, attackType: "Physical" | "Magic"): number {
  if (!enemy) return 0
  return attackType === "Physical" ? (enemy.resist_attack_physics ?? 0) : (enemy.resist_attack_magic ?? 0)
}
export function getEnemyElemResist(enemy: import("@/lib/enemies").WikiEnemy | null | undefined, element: string): number {
  if (!enemy) return 0
  const key = element.toLowerCase().replace('space','air').replace('light','holy')
  const r = (enemy as Record<string,number>)[`resist_element_${key}`] ?? 0
  const dr = (enemy as Record<string,number>)[`damage_resist_element_${key}`] ?? 0
  return r + dr
}

export function runCalc(
  baseATK: number,
  enemyDEF: number,
  skillRate: number,
  attackType: "Physical" | "Magic",
  attackElementKey: string,
  attackBaseElement: string,
  attackScope: AttackScope,
  buffs: BuffEntry[],
  activeEnemyConditions: string[],
  rolls: ProcRolls,
  baseRates: BaseRates,
  enemyElement?: string,
  enemy?: import("@/lib/enemies").WikiEnemy | null,
): CalcResult {
  const steps: CalcStep[] = []

  // ── Step 1a: Base ATK buff (param=1) — unconditional ─────────────────────────
  const attackBuff = sumBuff(buffs, "Attack")
  const atkMult    = 1 + attackBuff / B
  const effATK1    = baseATK * atkMult
  if (atkMult !== 1)
    steps.push({ label: "ATK %", mult: atkMult, note: `${attackBuff >= 0 ? "+" : ""}${(attackBuff/100).toFixed(1)}%` })

  // ── Step 1b: Attack-type multiplier (300-303) — conditional on attack_type ───
  const physBuff   = attackType === "Physical" ? sumBuff(buffs, "EffectAttackPhysics") : 0
  const magicBuff  = attackType === "Magic"    ? sumBuff(buffs, "EffectAttackMagic")   : 0
  const enemyTypeResist = getEnemyBaseResist(enemy, attackType)
  const attackTypeResistBuff = attackType === "Physical" ? sumBuff(buffs, "ResistAttackPhysics") : sumBuff(buffs, "ResistAttackMagic")
  const scopeBuff = attackScope === "whole" ? sumBuff(buffs, "EffectAttackWhole") : sumBuff(buffs, "EffectAttackSingle")
  const scopeResistBuff = attackScope === "whole" ? sumBuff(buffs, "ResistAttackWhole") : sumBuff(buffs, "ResistAttackSingle")
  const atkTypeTot = physBuff + magicBuff + scopeBuff - enemyTypeResist - attackTypeResistBuff - scopeResistBuff
  const atkTypeMult = 1 + atkTypeTot / B
  const effATK2    = effATK1 * atkTypeMult
  if (atkTypeMult !== 1)
    steps.push({ label: attackType === "Physical" ? "P-ATK %" : "M-ATK %",
      mult: atkTypeMult, note: `+${(atkTypeTot/100).toFixed(1)}% (${attackType}${enemyTypeResist !== 0 ? ` incl. enemy ${enemyTypeResist < 0 ? "weak" : "resist"} ${(Math.abs(enemyTypeResist)/100).toFixed(0)}%` : ""})` })

  // ── Step 1c: Attacker-element ATK buff (309-316) + enemy element resist ─────
  const elemBuffKey = `EffectElement${attackElementKey}`
  const elemResistKey = `ResistElement${attackElementKey}`
  const dmgResistElemKey = `DamageResistElement${attackElementKey}`
  const elemATKBuff = sumBuff(buffs, elemBuffKey)
  const enemyElemBaseResist = getEnemyElemResist(enemy, attackBaseElement)
  const enemyElemSkillResist = sumBuff(buffs, elemResistKey) + sumBuff(buffs, dmgResistElemKey)
  const elemTotal = elemATKBuff - enemyElemBaseResist - enemyElemSkillResist
  const elemATKMult = 1 + elemTotal / B
  const effATK3    = effATK2 * elemATKMult
  if (elemTotal !== 0)
    steps.push({ label: `${attackElementKey} ATK %`, mult: elemATKMult,
      note: `ElemBuff +${(elemATKBuff/100).toFixed(1)}%${enemyElemBaseResist !== 0 || enemyElemSkillResist !== 0 ? ` / EnemyElemResist ${((enemyElemBaseResist + enemyElemSkillResist)/100).toFixed(1)}%` : ""}` })

  // ── Step 1d: "X+ damage" (DamageEffect 508-514) — separate axis ──────────────
  const dmgEffKey = `DamageEffectElement${attackElementKey}`
  const dmgEffBuff = sumBuff(buffs, dmgEffKey)
  const dmgEffAttack = attackType === "Physical" ? sumBuff(buffs, "DamageEffectAttackPhysics") : sumBuff(buffs, "DamageEffectAttackMagic")
  const dmgEffScope = attackScope === "whole" ? sumBuff(buffs, "DamageEffectAttackWhole") : sumBuff(buffs, "DamageEffectAttackSingle")
  const dmgResistAttack = attackType === "Physical" ? sumBuff(buffs, "DamageResistAttackPhysics") : sumBuff(buffs, "DamageResistAttackMagic")
  const dmgResistScope = attackScope === "whole" ? sumBuff(buffs, "DamageResistAttackWhole") : sumBuff(buffs, "DamageResistAttackSingle")
  const dmgEffTot  = dmgEffBuff + dmgEffAttack + dmgEffScope - dmgResistAttack - dmgResistScope
  const dmgEffMult = 1 + dmgEffTot / B
  const effATK     = effATK3 * dmgEffMult
  if (dmgEffTot !== 0)
    steps.push({ label: `${attackElementKey}+ DMG %`, mult: dmgEffMult,
      note: `DamageEffect +${(dmgEffTot/100).toFixed(1)}%` })

  // ── Step 2: Enemy DEF + Penetration ──────────────────────────────────────────
  const effectPen  = sumBuff(buffs, "EffectPenetration")
  const resistPen  = sumBuff(buffs, "ResistPenetration")
  const enemyDefBuff = sumBuff(buffs, "Defense")
  const startDEF   = Math.max(1, enemyDEF * (1 + enemyDefBuff / B))
  let effDEF = startDEF
  if (rolls.superPenetration) {
    const netPen = effectPen - resistPen
    const rate   = (SUPER_PEN_ADJ + SUPER_PEN_EFFECT + netPen * SUPER_PEN_COEF / B) / B
    effDEF = Math.max(1, startDEF * Math.max(0, 1 - rate))
    steps.push({ label: "Super Pierce", mult: NaN, note: `DEF ${startDEF.toFixed(0)} → ${effDEF.toFixed(0)} (−${(Math.max(0,rate)*100).toFixed(1)}%)` })
  } else if (rolls.penetration) {
    const penRate = (effectPen - resistPen) / B
    effDEF = Math.max(1, startDEF * Math.max(0, 1 - penRate))
    steps.push({ label: "Pierce", mult: NaN, note: `DEF ${startDEF.toFixed(0)} → ${effDEF.toFixed(0)} (−${(Math.max(0,penRate)*100).toFixed(1)}%)` })
  } else if (enemyDefBuff !== 0) {
    steps.push({ label: "Enemy DEF", mult: NaN, note: `${enemyDEF} → ${startDEF.toFixed(0)}` })
  }

  // ── Step 3: Base formula ATK² / (ATK + DEF) × skill_rate ─────────────────────
  const baseDmgRatio  = (effATK * effATK) / (effATK + effDEF)
  const skillMult     = skillRate / 100
  const preMultDamage = baseATK > 0 ? baseDmgRatio * skillMult : null
  steps.push({ label: "Skill Rate", mult: skillMult, note: `${skillRate}% of base` })

  const attackDamageRateValue = sumBuff(buffs, "AttackDamageRate")
  const attackDamageRateMult = attackDamageRateValue !== 0 ? attackDamageRateValue / B : 1
  if (attackDamageRateValue !== 0) {
    steps.push({
      label: "All Damage Rate",
      mult: attackDamageRateMult,
      note: `x${attackDamageRateMult.toFixed(3)}`,
    })
  }

  const activeConditionBonus = activeEnemyConditions.reduce((sum, conditionName) => {
    const buffType = CONDITION_DAMAGE_BUFF_BY_NAME[conditionName]
    return buffType ? sum + sumBuff(buffs, buffType) : sum
  }, 0)
  const inactiveConditionBonus = activeEnemyConditions.length === 0 ? sumBuff(buffs, "ConditionDefenceNotActive") : 0
  const conditionBonus = activeConditionBonus + inactiveConditionBonus
  const conditionMult = 1 + conditionBonus / B
  if (conditionBonus !== 0) {
    steps.push({
      label: "Condition Bonus",
      mult: conditionMult,
      note:
        activeEnemyConditions.length > 0
          ? `${activeEnemyConditions.join(", ")} ${conditionBonus >= 0 ? "+" : ""}${(conditionBonus / 100).toFixed(1)}%`
          : `${conditionBonus >= 0 ? "+" : ""}${(conditionBonus / 100).toFixed(1)}% vs no condition`,
    })
  }

  // ── Step 4: SoCo (ComboRate) ──────────────────────────────────────────────────
  const comboRateBuff = sumBuff(buffs, "ComboRate")
  const socoBase = rolls.soco === "ex2_soco" ? 20000 : rolls.soco === "ex_soco" ? 15000 : rolls.soco === "soco" ? 10000 : 0
  const socoTot  = socoBase + comboRateBuff
  const socoMult = rolls.soco === "none" ? (comboRateBuff !== 0 ? 1 + comboRateBuff / B : 1) : (B + socoTot) / B
  if (socoMult !== 1)
    steps.push({ label: rolls.soco !== "none" ? (rolls.soco === "ex2_soco" ? "EX2 SoCo" : rolls.soco === "ex_soco" ? "EX SoCo" : "SoCo") : "Combo Rate",
      mult: socoMult, note: `x${socoMult.toFixed(3)}` })

  // ── Step 5: Critical ──────────────────────────────────────────────────────────
  const effectCrit = sumBuff(buffs, "EffectCritical")
  const resistCrit = sumBuff(buffs, "ResistCritical")
  let critMult = 1
  if (rolls.superCritical) {
    critMult = (CRIT_BASE * 2 + effectCrit * CRIT_UP_COEF / B - resistCrit * CRIT_UP_COEF / B) / B
    steps.push({ label: "Super Crit", mult: critMult,
      note: `Base x${(CRIT_BASE*2/B).toFixed(2)} + CritPow ${(effectCrit/100).toFixed(1)}%` })
  } else if (rolls.critical) {
    critMult = (CRIT_BASE + effectCrit * CRIT_UP_COEF / B - resistCrit * CRIT_UP_COEF / B) / B
    steps.push({ label: "Crit", mult: critMult,
      note: `Base x1.50 + CritPow ${(effectCrit/100).toFixed(1)}% − Resist ${(resistCrit/100).toFixed(1)}%` })
  }

  // ── Step 6: Cooperation (Synergy) ────────────────────────────────────────────
  const effectCoop = sumBuff(buffs, "EffectCooperation")
  const resistCoop = sumBuff(buffs, "ResistCooperation")
  let coopMult = 1
  if (rolls.superCooperation) {
    coopMult = 1 + (SUPER_COOP_ADJ + SUPER_COOP_EFFECT + effectCoop - resistCoop) / B
    steps.push({ label: "Super Synergy", mult: coopMult,
      note: `Adj ${(SUPER_COOP_ADJ/100).toFixed(0)}%+Eff ${(SUPER_COOP_EFFECT/100).toFixed(0)}%+SynPow ${(effectCoop/100).toFixed(1)}%` })
  } else if (rolls.cooperation) {
    coopMult = 1 + (effectCoop - resistCoop) / B
    steps.push({ label: "Synergy", mult: coopMult,
      note: `SynPow +${(effectCoop/100).toFixed(1)}% − Resist ${(resistCoop/100).toFixed(1)}%` })
  }

  // ── Step 7: Aegis (Defcritical) ──────────────────────────────────────────────
  const effectDC = sumBuff(buffs, "EffectDefcritical")
  const resistDC = sumBuff(buffs, "ResistDefcritical")
  let defCritMult = 1
  if (rolls.defCritical) {
    defCritMult = 1 + (DEFCRIT_BASE + effectDC - resistDC) / B
    steps.push({ label: "Aegis", mult: defCritMult,
      note: `Base +${(DEFCRIT_BASE/B*100).toFixed(0)}% + AegisPow ${(effectDC/100).toFixed(1)}%` })
  }

  // ── Step 8: Element weakness ──────────────────────────────────────────────────
  const weakBoost = sumBuff(buffs, "SpecialEffectWeakness") - sumBuff(buffs, "ResistWeakness")
  const superWeakBoost = sumBuff(buffs, "SpecialEffectSuperWeakness") - sumBuff(buffs, "ResistSuperWeakness")
  const enhancedWeakBoost = baseRates.isEnhancedAttacker
    ? ENHANCE_ELEM_BONUS + sumBuff(buffs, "EffectEnhancedWeakDamage") - sumBuff(buffs, "ResistEnhancedWeakDamage")
    : 0
  let elemCoeff = 1
  if (rolls.weakness !== "normal") {
    const w = rolls.weakness
    if      (w === "weak")                elemCoeff = 1 + (WEAK_BONUS + weakBoost) / B
    else if (w === "super_weak")          elemCoeff = 1 + (WEAK_BONUS + SUPER_WEAK_BONUS + superWeakBoost + weakBoost) / B
    else if (w === "enhanced_weak")       elemCoeff = 1 + (WEAK_BONUS + enhancedWeakBoost + weakBoost) / B
    else if (w === "enhanced_super_weak") elemCoeff = 1 + (WEAK_BONUS + SUPER_WEAK_BONUS + enhancedWeakBoost + superWeakBoost + weakBoost) / B
    steps.push({ label: w.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      mult: elemCoeff, note: `x${elemCoeff.toFixed(3)}` })
  }

  // ── Step 9: "Damage to X enemies" (SpecialEffectElement) ─────────────────────
  const specElemKey = enemyElement ? `SpecialEffectElement${enemyElement}` as BuffType : null
  const specElemBuff = specElemKey ? sumBuff(buffs, specElemKey) : 0
  const specElemMult = 1 + specElemBuff / B
  if (specElemBuff !== 0)
    steps.push({ label: `DMG vs ${enemyElement}`, mult: specElemMult,
      note: `SpecialEffectElement ${enemyElement} +${(specElemBuff/100).toFixed(1)}%` })

  // ── Step 10: Enemy Damage Taken (Dread / debuffs) ────────────────────────────
  const damageTakenBuff = sumBuff(buffs, "DamageTaken")
  const damageTakenMult = 1 + damageTakenBuff / B
  if (damageTakenBuff !== 0)
    steps.push({ label: "Enemy Dmg Taken", mult: damageTakenMult,
      note: `+${(damageTakenBuff/100).toFixed(1)}%` })

  const specialResistBuff = sumBuff(buffs, "DamageResistSpecial")
  const specialResistMult = Math.max(0, 1 - specialResistBuff / B)
  if (specialResistBuff !== 0)
    steps.push({ label: "Enemy Secret Skill Resist", mult: specialResistMult,
      note: `${(specialResistBuff/100).toFixed(1)}% resistance` })

  const rates = computeProcRates(buffs, baseRates)

  const totalMult = skillMult * attackDamageRateMult * conditionMult * socoMult * critMult * coopMult * defCritMult * elemCoeff * specElemMult * damageTakenMult * specialResistMult
  return {
    steps,
    totalMult,
    rawDamage: preMultDamage !== null
      ? preMultDamage * attackDamageRateMult * conditionMult * socoMult * critMult * coopMult * defCritMult * elemCoeff * specElemMult * damageTakenMult * specialResistMult
      : null,
    procRolls: rolls,
    critRate:  rates.crit,
    penRate:   rates.pen,
    coopRate:  rates.coop,
    aegisRate: rates.aegis,
  }
}

// ─── Utility: MultBar ─────────────────────────────────────────────────────────
function MultBar({ mult, max }: { mult: number; max: number }) {
  const pct = Math.min(100, (mult / max) * 100)
  const color = mult >= 3 ? "bg-yellow-500" : mult >= 2 ? "bg-green-500" : mult >= 1.2 ? "bg-blue-500" : "bg-gray-600"
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-white w-14 text-right">x{mult.toFixed(3)}</span>
    </div>
  )
}

// ─── Character picker popout ──────────────────────────────────────────────────
function CharPicker({
  characters, value, onChange, placeholder = "Select...", filterRole,
}: {
  characters: WikiCharacter[]; value: WikiCharacter | null
  onChange: (c: WikiCharacter | null) => void
  placeholder?: string; filterRole?: "protector"
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])
  const filtered = useMemo(() => {
    let list = characters
    if (filterRole === "protector") list = list.filter(c => c.skills.some(s => s.slot === "leader_skill"))
    const lq = q.toLowerCase()
    if (lq) list = list.filter(c => c.name.toLowerCase().includes(lq) || c.element.toLowerCase().includes(lq))
    // show all matching characters (was limited to 60)
    return list
  }, [characters, q, filterRole])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 bg-gray-900/80 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm hover:border-gray-500 transition-colors"
      >
        {value ? (
          <>
            <img src={toPublicAssetPath(value.images.icon)} alt="" className="w-6 h-6 rounded object-cover shrink-0"
              onError={e => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
            <span className="text-white truncate flex-1 text-left text-xs">{value.name}</span>
            <span className={`text-[10px] ${ELEM_COLOR[value.element] ?? "text-gray-400"} shrink-0`}>{value.element}</span>
          </>
        ) : <span className="text-gray-500 text-xs">{placeholder}</span>}
        <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
      </button>
      {value && (
        <button onClick={e => { e.stopPropagation(); onChange(null) }}
          className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300">
          <X className="w-3 h-3" />
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/60 px-4 py-8 overflow-auto" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl bg-gray-900 border border-gray-600 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 p-4 border-b border-gray-800">
              <div className="flex-1 flex items-center gap-2 bg-gray-800 rounded-lg px-3">
                <Search className="w-4 h-4 text-gray-500" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name / element..."
                  className="flex-1 bg-transparent text-sm py-2.5 text-white outline-none placeholder-gray-600" autoFocus />
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="max-h-[70vh] overflow-y-auto">
              {filtered.map(c => (
                <li key={c.master_pc_id}>
                  <button onClick={() => { onChange(c); setOpen(false); setQ("") }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 text-sm">
                    <img src={toPublicAssetPath(c.images.icon)} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0"
                      onError={e => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white truncate font-semibold">{c.name}</div>
                      <div className="text-[11px] text-gray-500 truncate">{c.affiliation_name || c.weapon_type}</div>
                    </div>
                    <span className={`shrink-0 text-xs font-medium ${ELEM_COLOR[c.element] ?? "text-gray-400"}`}>{c.element}</span>
                    <span className="text-gray-500 shrink-0 text-xs">{c.attack_type}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="py-6 text-center text-gray-600 text-sm">No results</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Character portrait card ──────────────────────────────────────────────────
function CharPortrait({
  char, slot, isCalcTarget, isInspected, onClick, onSetCalcTarget, emptyLabel,
}: {
  char: WikiCharacter | null; slot: "attacker" | "protector"
  isCalcTarget?: boolean; isInspected: boolean
  onClick: () => void; onSetCalcTarget?: () => void; emptyLabel?: string
}) {
  const ring = char ? (ELEM_RING[char.element] ?? "ring-gray-600") : "ring-gray-700"
  const isProt = slot === "protector"

  return (
    <div className="flex flex-col items-center gap-1 group">
      <div className="relative">
        <button
          onClick={onClick}
          className={`relative rounded-full overflow-hidden ring-2 transition-all cursor-pointer
            ${isInspected ? `${ring} ring-offset-2 ring-offset-gray-900 scale-105` : `ring-gray-700 hover:${ring} hover:ring-offset-1 hover:ring-offset-gray-900`}
            ${isProt ? "w-12 h-12" : "w-16 h-16"}`}
        >
          {char ? (
            <img src={toPublicAssetPath(char.images.icon)} alt={char.name}
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${isProt ? "bg-purple-950/30 border-2 border-dashed border-purple-800" : "bg-gray-800 border-2 border-dashed border-gray-700"}`}>
              {isProt ? <Shield className="w-5 h-5 text-purple-700" /> : <Plus className="w-5 h-5 text-gray-600" />}
            </div>
          )}
          {isCalcTarget && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-400 rounded-b-full" />
          )}
        </button>
        {/* Element icon badge */}
        {char && ELEM_ICON[char.element] && (
          <img src={ELEM_ICON[char.element]} alt={char.element}
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 object-contain rounded-full bg-gray-900 ring-1 ring-gray-800" />
        )}
        {/* Calc target button */}
        {char && onSetCalcTarget && !isProt && (
          <button onClick={e => { e.stopPropagation(); onSetCalcTarget() }}
            title="Use for damage calculation"
            className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${isCalcTarget ? "bg-yellow-500 text-black" : "bg-gray-700 text-gray-400 opacity-0 group-hover:opacity-100"}`}>
            <Swords className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
      <span className={`text-center leading-tight max-w-[70px] truncate ${isProt ? "text-[9px] text-purple-300" : "text-[9px] text-gray-300"}`}>
        {char ? char.name : (emptyLabel ?? "")}
      </span>
    </div>
  )
}

// ─── Enemy display card ───────────────────────────────────────────────────────
function EnemyCard({
  enemy, isInspected, onInspect, onChangeEnemy,
}: {
  enemy: WikiEnemy | null; isInspected: boolean
  onInspect: () => void; onChangeEnemy: () => void
}) {
  if (!enemy) return (
    <button onClick={onChangeEnemy}
      className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-700 rounded-xl p-6 hover:border-gray-500 transition-colors gap-2">
      <Search className="w-8 h-8 text-gray-600" />
      <span className="text-gray-500 text-sm">Select Enemy</span>
    </button>
  )

  const elemColor = ELEM_COLOR[enemy.element] ?? "text-gray-400"
  const elemBorder = ELEM_BORDER[enemy.element] ?? "border-gray-700 bg-gray-900/50"

  // Compute weakness/resist badges: negative value = weak (shown as W), large positive = resist (R)
  const weakPhys = (enemy.resist_attack_physics ?? 0) < 0
  const weakMagic = (enemy.resist_attack_magic ?? 0) < 0
  const ELEM_RESIST_KEYS: [string, string][] = [
    ["Fire","fire"],["Water","water"],["Wind","wind"],["Earth","earth"],
    ["Light","holy"],["Dark","dark"],["Space","air"],
  ]
  const elemWeaknesses = ELEM_RESIST_KEYS.filter(([,k]) => {
    const r = (enemy[`resist_element_${k}` as keyof typeof enemy] as number ?? 0)
    const dr = (enemy[`damage_resist_element_${k}` as keyof typeof enemy] as number ?? 0)
    return (r + dr) < 0
  }).map(([name]) => name)

  return (
    <div className={`rounded-xl border ${elemBorder} p-3 space-y-2`}>
      <div className="flex items-start gap-3">
        {enemy.thumb && (
          <button onClick={onInspect} className={`shrink-0 rounded-lg overflow-hidden transition-all ${isInspected ? "ring-2 ring-white" : "hover:ring-2 hover:ring-gray-400"}`}>
            <img src={enemy.thumb} alt={enemy.name} className="w-16 h-16 object-contain" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {ELEM_ICON[enemy.element] && <img src={ELEM_ICON[enemy.element]} alt={enemy.element} className="w-4 h-4 object-contain shrink-0" />}
            <span className={`text-xs font-semibold ${elemColor}`}>{enemy.element} Attribute</span>
            <span className="text-xs text-gray-500 ml-1">{enemy.attack_type}</span>
          </div>
          <div className="font-bold text-white text-sm leading-tight truncate">{enemy.name}</div>
          {enemy.affiliation_name && <div className="text-xs text-gray-500 truncate">{enemy.affiliation_name}</div>}
          <div className="grid grid-cols-3 gap-1 mt-2 text-xs">
            {([["HP", enemy.infinity_hp ? "Inf" : enemy.hp.toLocaleString()],
              ["ATK", enemy.attack.toLocaleString()],
              ["DEF", enemy.defense.toLocaleString()]] as [string, string][]).map(([label, val]) => (
              <div key={label} className="flex flex-col">
                <span className="text-gray-500 text-[10px]">{label}</span>
                <span className="text-white font-mono font-semibold">{val}</span>
              </div>
            ))}
          </div>
          {/* Weakness badges */}
          {(weakPhys || weakMagic || elemWeaknesses.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {weakPhys && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-orange-900/60 border border-orange-700 text-orange-300 font-semibold">
                  ⚔ Phys {Math.abs((enemy.resist_attack_physics ?? 0) / 100)}%
                </span>
              )}
              {weakMagic && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-blue-900/60 border border-blue-700 text-blue-300 font-semibold">
                  ✦ Magic {Math.abs((enemy.resist_attack_magic ?? 0) / 100)}%
                </span>
              )}
              {elemWeaknesses.map(el => (
                <span key={el} className={`text-[10px] px-1 py-0.5 rounded border font-semibold ${ELEM_BORDER[el] ?? "border-gray-700 bg-gray-900"} ${ELEM_COLOR[el] ?? "text-gray-300"}`}>
                  {ELEM_ICON[el] && <img src={ELEM_ICON[el]} alt={el} className="inline w-3 h-3 mr-0.5" />}
                  {el}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <button onClick={onChangeEnemy} className="w-full text-center text-[10px] text-gray-600 hover:text-gray-400 transition-colors">
        Change enemy
      </button>
    </div>
  )
}

// ─── Enemy picker overlay ─────────────────────────────────────────────────────
function EnemyPickerOverlay({
  enemies, onSelect, onClose,
}: { enemies: WikiEnemy[]; onSelect: (e: WikiEnemy) => void; onClose: () => void }) {
  const [q, setQ] = useState("")
  const [tierAvatar, setTierAvatar] = useState<string | null>(null)

  const uniqueAvatars = useMemo(() => {
    const seen = new Set<string>()
    return enemies.filter(e => e.avatar_name && !seen.has(e.avatar_name) && seen.add(e.avatar_name))
  }, [enemies])

  const filteredAvatars = useMemo(() => {
    const lq = q.toLowerCase()
    // show all avatars (was limited to 80)
    if (!lq) return uniqueAvatars
    return uniqueAvatars.filter(e =>
      e.name.toLowerCase().includes(lq) ||
      (e.affiliation_name?.toLowerCase() ?? "").includes(lq) ||
      e.avatar_name.toLowerCase().includes(lq)
    )
  }, [uniqueAvatars, q])

  const tierOptions = useMemo(() =>
    tierAvatar ? enemies.filter(e => e.avatar_name === tierAvatar).sort((a, b) => a.hp - b.hp) : [],
    [enemies, tierAvatar]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/70 py-8 overflow-auto" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-3 border-b border-gray-800">
          <div className="flex-1 flex items-center gap-2 bg-gray-800 rounded-lg px-3">
            <Search className="w-4 h-4 text-gray-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search enemies..."
              className="flex-1 bg-transparent text-sm py-2 text-white outline-none placeholder-gray-600" autoFocus />
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {tierAvatar ? (
            <div className="space-y-1">
              <button onClick={() => setTierAvatar(null)} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mb-2">
                Back to all enemies
              </button>
              {tierOptions.map(e => (
                <button key={e.master_enemy_id} onClick={() => { onSelect(e); onClose() }}
                  className="w-full text-left p-2 rounded-lg hover:bg-gray-800 grid grid-cols-4 gap-2 text-xs items-center">
                  <span className="text-white truncate font-semibold">{e.name}</span>
                  <span className="text-gray-400">HP {e.hp.toLocaleString()}</span>
                  <span className="text-red-400">ATK {e.attack.toLocaleString()}</span>
                  <span className="text-blue-400">DEF {e.defense.toLocaleString()}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {filteredAvatars.map(e => (
                <button key={e.avatar_name}
                  onClick={() => {
                    const same = enemies.filter(x => x.avatar_name === e.avatar_name)
                    if (same.length === 1) { onSelect(same[0]); onClose() }
                    else setTierAvatar(e.avatar_name)
                  }}
                  title={e.name} className="flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-gray-800 group">
                  {e.thumb ? <img src={e.thumb} alt={e.name} className="w-12 h-12 object-contain rounded" />
                    : <div className="w-12 h-12 bg-gray-800 rounded flex items-center justify-center text-gray-600 text-xs">?</div>}
                  <span className="text-[9px] text-gray-500 group-hover:text-white text-center leading-tight line-clamp-2 w-full">{e.name}</span>
                </button>
              ))}
              {filteredAvatars.length === 0 && <div className="col-span-full text-center text-gray-600 py-8">No enemies found</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Skill bubble ─────────────────────────────────────────────────────────────
function SkillBubble({
  skill, isActive, isDamageSelected, isDisabled = false, slotBadge, tooltipNote, useCount = 0, showUseCountInput = false, onUseCountChange, onHoverChange, onToggle, onSelectDamage,
}: {
  skill: WikiSkill; isActive: boolean; isDamageSelected: boolean
  isDisabled?: boolean; slotBadge?: string; tooltipNote?: string
  useCount?: number; showUseCountInput?: boolean
  onUseCountChange?: (value: number) => void
  onHoverChange?: (payload: { skill: WikiSkill; tooltipNote?: string; rect: DOMRect } | null) => void
  onToggle?: () => void; onSelectDamage?: () => void
}) {
  const isDamageSkill = skill.slot === "special_skill" || skill.slot === "special_skill_attack" || skill.kind === "special"
  const handleClick = () => {
    if (isDisabled) return
    if (isDamageSkill && onSelectDamage) onSelectDamage()
    else if (onToggle) onToggle()
  }
  return (
    <div className="relative flex flex-col items-center gap-1 w-16">
      <button onClick={handleClick}
        disabled={isDisabled}
        onMouseEnter={e => onHoverChange?.({ skill, tooltipNote, rect: e.currentTarget.getBoundingClientRect() })}
        onMouseLeave={() => onHoverChange?.(null)}
        className={`relative w-12 h-12 rounded-full overflow-hidden ring-2 transition-all
          ${isDamageSelected ? "ring-yellow-400 ring-offset-2 ring-offset-gray-900 scale-110"
            : isActive ? "ring-blue-500 ring-offset-1 ring-offset-gray-900"
            : isDisabled ? "ring-gray-800 opacity-35 grayscale cursor-not-allowed"
            : "ring-gray-700 hover:ring-gray-500"}`}
      >
        <img src={toPublicAssetPath(skill.icon_path ?? "")} alt={skill.name}
          className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
        {slotBadge && !isDamageSkill && (
          <div className="absolute top-0.5 left-0.5 px-1 rounded bg-black/75 text-[8px] font-bold text-white border border-gray-700">
            {slotBadge}
          </div>
        )}
        {isDamageSkill && (
          <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-yellow-400 rounded-full border border-yellow-600" />
        )}
        {!isDamageSkill && useCount > 1 && (
          <div className="absolute top-0.5 right-0.5 min-w-[18px] px-1 rounded bg-blue-950/90 text-[8px] font-bold text-blue-200 border border-blue-700 text-center">
            x{useCount}
          </div>
        )}
        {!isDamageSkill && isActive && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
        )}
        {!isDamageSkill && isDisabled && (
          <div className="absolute inset-0 bg-black/35" />
        )}
      </button>
      <span className={`text-[9px] text-center leading-tight max-w-[64px] ${isDisabled ? "text-gray-700" : isActive || isDamageSelected ? "text-gray-200" : "text-gray-500"}`}>
        {skill.name}
      </span>
      {showUseCountInput && !isDamageSkill && (
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-gray-500">x</span>
          <input
            type="number"
            min="0"
            value={useCount}
            disabled={isDisabled}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onUseCountChange?.(normalizeUseCount(Number.parseInt(event.target.value || "0", 10)))}
            className={`w-10 rounded border px-1 py-0.5 text-center text-[9px] font-mono ${isDisabled ? "border-gray-800 bg-gray-900 text-gray-700" : "border-gray-700 bg-gray-800 text-white"}`}
          />
        </div>
      )}
    </div>
  )
}

// ─── Char Info Panel ──────────────────────────────────────────────────────────
function CharInfoPanel({
  char, activeBuffs, displayStats, onClose,
}: { char: WikiCharacter; activeBuffs: BuffEntry[]; displayStats?: { hp: number; attack: number; defense: number } | null; onClose: () => void }) {
  const charBuffs = activeBuffs.filter(b => b.value !== 0 && b.source.startsWith(`${char.name} - `))
  const stats = displayStats ?? getBattleStats(char)
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="relative h-20 bg-gradient-to-br from-gray-800 to-gray-900">
        <img src={toPublicAssetPath(char.images.icon)} alt={char.name}
          className="absolute right-2 bottom-0 h-24 object-contain opacity-40"
          onError={e => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
        <div className="absolute inset-0 p-3 flex flex-col justify-end">
          <div className="flex items-center gap-1.5">
            {ELEM_ICON[char.element] && <img src={ELEM_ICON[char.element]} alt="" className="w-5 h-5 object-contain" />}
            <span className={`text-xs font-semibold ${ELEM_COLOR[char.element] ?? "text-gray-300"}`}>{char.element} Attribute</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-white font-bold text-lg leading-tight">{char.name}</span>
            <span className="text-gray-400 text-xs truncate max-w-[100px]">{char.affiliation_name}</span>
          </div>
        </div>
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-white bg-gray-900/60 rounded-full p-0.5">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="divide-y divide-gray-800 text-sm">
        <div className="grid grid-cols-2 px-3 py-2 gap-y-1.5 text-xs">
          <div className="text-gray-400">Attack Type<span className="ml-2 font-semibold text-white">{char.attack_type}</span></div>
          <div className="text-gray-400">Weapon<span className="ml-2 text-gray-300">{char.weapon_type}</span></div>
        </div>
        {[{ label: "HP", val: (stats?.hp ?? char.stats.hp).toLocaleString() },
          { label: "ATK", val: (stats?.attack ?? char.stats.attack).toLocaleString() },
          { label: "DEF", val: (stats?.defense ?? char.stats.defense).toLocaleString() }].map(({ label, val }) => (
          <div key={label} className="flex items-center px-3 py-1.5 text-xs">
            <span className="text-gray-400 flex-1">{label}</span>
            <span className="font-mono font-semibold text-white">{val}</span>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 border-t border-gray-800">
        <div className="text-xs font-semibold text-gray-400 mb-2">Effect List</div>
        {charBuffs.length === 0 ? (
          <p className="text-xs text-gray-700 italic">No active effects</p>
        ) : (
          <div className="space-y-1.5">
            {charBuffs.map(b => (
              <div key={b.id} className="flex items-start gap-2 text-xs">
                <div className={`w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center text-[10px] ${b.value >= 0 ? "bg-blue-900 text-blue-300" : "bg-red-900 text-red-300"}`}>
                  {b.value >= 0 ? "+" : "-"}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`font-semibold ${b.value >= 0 ? "text-white" : "text-red-300"}`}>
                    {getBuffLabel(b.type)} {b.value >= 0 ? "+" : ""}{(b.value/100).toFixed(1)}%
                  </span>
                  <span className="text-gray-600 text-[10px] ml-1">({b.source})</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Enemy Info Panel ─────────────────────────────────────────────────────────
function EnemyInfoPanel({
  enemy, defOverride, hpOverride, atkOverride, onDefChange, onHpChange, onAtkChange, activeDebuffs, onClose,
}: {
  enemy: WikiEnemy; defOverride: string; hpOverride: string; atkOverride: string
  onDefChange: (v: string) => void; onHpChange: (v: string) => void; onAtkChange: (v: string) => void
  activeDebuffs: BuffEntry[]; onClose: () => void
}) {
  const elemBorder = ELEM_BORDER[enemy.element] ?? "border-gray-700 bg-gray-900"
  const baseResists = [
    ["Physical", enemy.resist_attack_physics ?? 0],
    ["Magic", enemy.resist_attack_magic ?? 0],
    ["Fire", (enemy.resist_element_fire ?? 0) + (enemy.damage_resist_element_fire ?? 0)],
    ["Water", (enemy.resist_element_water ?? 0) + (enemy.damage_resist_element_water ?? 0)],
    ["Wind", (enemy.resist_element_wind ?? 0) + (enemy.damage_resist_element_wind ?? 0)],
    ["Earth", (enemy.resist_element_earth ?? 0) + (enemy.damage_resist_element_earth ?? 0)],
    ["Light", (enemy.resist_element_holy ?? 0) + (enemy.damage_resist_element_holy ?? 0)],
    ["Dark", (enemy.resist_element_dark ?? 0) + (enemy.damage_resist_element_dark ?? 0)],
    ["Space", (enemy.resist_element_air ?? 0) + (enemy.damage_resist_element_air ?? 0)],
  ].filter(([, val]) => val !== 0) as [string, number][]
  return (
    <div className={`rounded-xl border ${elemBorder} overflow-hidden flex flex-col h-full`}>
      <div className="relative bg-gray-900/80 p-3">
        {enemy.thumb && (
          <img src={enemy.thumb} alt="" className="absolute right-2 top-1 h-20 object-contain opacity-30" />
        )}
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-0.5">
            {ELEM_ICON[enemy.element] && <img src={ELEM_ICON[enemy.element]} alt="" className="w-5 h-5 object-contain" />}
            <span className={`text-xs ${ELEM_COLOR[enemy.element] ?? "text-gray-400"}`}>{enemy.element} Attribute</span>
            <span className="text-gray-500 text-xs ml-1">{enemy.attack_type}</span>
          </div>
          {enemy.affiliation_name && <div className="text-gray-400 text-xs italic">{enemy.affiliation_name}</div>}
          <div className="text-white font-bold text-lg leading-tight">{enemy.name}</div>
        </div>
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="divide-y divide-gray-800 text-xs flex-1 overflow-y-auto">
        {([
          { label: "HP",  base: enemy.hp,      state: hpOverride,  onChange: onHpChange,  inf: enemy.infinity_hp },
          { label: "ATK", base: enemy.attack,  state: atkOverride, onChange: onAtkChange, inf: false },
          { label: "DEF", base: enemy.defense, state: defOverride, onChange: onDefChange,  inf: false },
        ]).map(({ label, base, state, onChange, inf }) => (
          <div key={label} className="flex items-center px-3 py-1.5 gap-2">
            <span className="text-gray-400 w-8">{label}</span>
            <input type="number" value={state} onChange={e => onChange(e.target.value)}
              placeholder={inf ? "Inf" : base.toLocaleString()}
              className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 font-mono text-white text-xs" />
            {!state && <span className="text-gray-600 text-[10px]">base: {base.toLocaleString()}</span>}
          </div>
        ))}
        {baseResists.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 mb-2">Base Resistances</div>
            <div className="flex flex-wrap gap-1.5">
              {baseResists.map(([label, value]) => (
                <span key={label} className={`text-[10px] px-1.5 py-0.5 rounded border ${value < 0 ? "border-orange-700 bg-orange-900/50 text-orange-300" : "border-gray-700 bg-gray-800 text-gray-300"}`}>
                  {label} {value < 0 ? "Weak" : "Resist"} {Math.abs(value / 100)}%
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="px-3 py-2">
          <div className="text-xs font-semibold text-gray-400 mb-2">Effect List</div>
          {activeDebuffs.length === 0 ? (
            <p className="text-xs text-gray-700 italic">No active debuffs</p>
          ) : (
            <div className="space-y-1.5">
              {activeDebuffs.map(b => (
                <div key={b.id} className="flex items-start gap-2 text-xs">
                  <div className="w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center text-[10px] bg-red-900 text-red-300">-</div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-red-200">{getBuffLabel(b.type)} {b.value >= 0 ? "+" : ""}{(b.value/100).toFixed(1)}%</span>
                    <span className="text-gray-600 text-[10px] ml-1">({b.source})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Damage result panel ──────────────────────────────────────────────────────
function DamageResultPanel({ result, onReroll, onClose }: { result: CalcResult; onReroll: () => void; onClose: () => void }) {
  const max = Math.max(4, ...result.steps.filter(s => !isNaN(s.mult)).map(s => s.mult))
  const { procRolls: r, critRate, penRate, coopRate, aegisRate } = result
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-bold text-blue-300 uppercase tracking-wide">Damage Result</span>
        <div className="flex items-center gap-1.5">
          <button onClick={onReroll}
            className="text-[10px] text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded px-1.5 py-0.5 transition-colors">
            Re-roll
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Proc rate indicators */}
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          {([
            ["Crit",    r.critical,         r.superCritical,  critRate],
            ["Pierce",  r.penetration,      r.superPenetration, penRate],
            ["Synergy", r.cooperation,      r.superCooperation, coopRate],
            ["Aegis",   r.defCritical,      false,              aegisRate],
          ] as [string, boolean, boolean, number][]).map(([label, fired, superFired, rate]) => (
            <div key={label} className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
              superFired ? "bg-yellow-900/50 border border-yellow-700" :
              fired      ? "bg-blue-900/50  border border-blue-700" :
                           "bg-gray-800/50  border border-gray-700"
            }`}>
              <span className={superFired ? "text-yellow-300" : fired ? "text-blue-300" : "text-gray-500"}>
                {superFired ? "★" : fired ? "✔" : "×"}
              </span>
              <span className={fired ? "text-white" : "text-gray-600"}>{label}</span>
              <span className="ml-auto text-gray-500">{(rate/100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        {result.rawDamage !== null && (
          <div className="text-center py-2">
            <div className="text-3xl font-bold text-yellow-300 font-mono">{Math.round(result.rawDamage).toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">estimated damage</div>
          </div>
        )}
        <div className="space-y-2">
          {result.steps.map((step, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-200">{step.label}</span>
                <span className="text-gray-500 text-[10px] max-w-[55%] text-right truncate" title={step.note}>{step.note}</span>
              </div>
              {!isNaN(step.mult) && <MultBar mult={step.mult} max={max} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm border-t border-gray-800 pt-2">
          <span className="text-gray-400">Total multiplier</span>
          <span className="font-mono text-white font-bold">x{result.totalMult.toFixed(4)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Stat override modal ─────────────────────────────────────────────────────
function StatModal({
  slot, slotIdx, onClose, onRatesChange, onStatOverridesChange,
}: {
  slot: AttackerSlotState
  slotIdx: number
  onClose: () => void
  onRatesChange: (rates: BaseRates) => void
  onStatOverridesChange: (overrides: StatOverrides) => void
}) {
  const { char, statOverrides, rates } = slot
  const stats = getSlotBattleStats(slot)
  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/70 py-8 overflow-auto" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl p-5 shadow-2xl mx-4 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {char && (
              <img src={toPublicAssetPath(char.images.icon)} alt="" className="w-10 h-10 rounded-lg object-cover"
                onError={e => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
            )}
            <div>
              <div className="text-white font-bold text-lg">{char?.name ?? `Attacker ${slotIdx + 1}`}</div>
              {char && <div className={`text-sm ${ELEM_COLOR[char.element] ?? "text-gray-400"}`}>{char.element} · {char.attack_type}</div>}
            </div>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-white" /></button>
        </div>
        <div className="space-y-4">
          {([
            ["HP Override", "hp", stats?.hp ?? char?.stats.hp ?? 0],
            ["ATK Override", "atk", stats?.attack ?? char?.stats.attack ?? 0],
            ["DEF Override", "def", stats?.defense ?? char?.stats.defense ?? 0],
          ] as const).map(([label, key, fallback]) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-gray-300 text-sm w-32 font-medium">{label}</label>
              <input
                type="number"
                value={statOverrides[key]}
                onChange={e => onStatOverridesChange({ ...statOverrides, [key]: e.target.value })}
                placeholder={String(fallback)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
              {statOverrides[key] && (
                <button onClick={() => onStatOverridesChange({ ...statOverrides, [key]: "" })} className="text-gray-600 hover:text-red-400"><X className="w-3 h-3" /></button>
              )}
            </div>
          ))}
          <div className="border-t border-gray-800 pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {([
              ["Crit %", "probCritical"],
              ["Super Crit %", "probCriticalSuper"],
              ["Pierce %", "probPenetration"],
              ["Super Pierce %", "probPenetrationSuper"],
              ["Synergy %", "probCooperation"],
              ["Super Syn %", "probCooperationSuper"],
              ["Aegis %", "probDefcritical"],
            ] as [string, keyof BaseRates][]).map(([label, key]) => (
              <div key={key} className="flex items-center gap-2">
                <label className="text-gray-400 text-sm w-28">{label}</label>
                <input type="number" value={(rates[key] as number) / 100}
                  onChange={e => onRatesChange({ ...rates, [key]: Math.round(parseFloat(e.target.value || "0") * 100) })}
                  placeholder="0"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
            <input type="checkbox" checked={rates.isEnhancedAttacker}
              onChange={e => onRatesChange({ ...rates, isEnhancedAttacker: e.target.checked })}
              className="accent-blue-500" />
            <span className="text-gray-300">Enhanced Element Bonus</span>
          </label>
          <p className="text-xs text-gray-500 -mt-1">
            Applies the extra +10% bonus when the attacker has enhanced elemental advantage.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main BattleSim ───────────────────────────────────────────────────────────
export function BattleSim({ characters, enemies }: { characters: WikiCharacter[]; enemies: WikiEnemy[] }) {

  // Team state
  const DEFAULT_RATES: BaseRates = {
    probCritical: 0, probPenetration: 0, probCooperation: 0, probDefcritical: 0,
    probCriticalSuper: 0, probPenetrationSuper: 0, probCooperationSuper: 0,
    isEnhancedAttacker: false,
  }
  const [attackerSlots, setAttackerSlots] = useState<AttackerSlotState[]>(
    Array.from({ length: 5 }, () => ({ char: null, statOverrides: createEmptyStatOverrides(), rates: { ...DEFAULT_RATES } }))
  )
  const [attackerSkillUses, setAttackerSkillUses] = useState<Record<string, number>>({})
  const [mainProtector, setMainProtector] = useState<WikiCharacter | null>(null)
  const [subProtector,  setSubProtector]  = useState<WikiCharacter | null>(null)
  const [protectorSkillUses, setProtectorSkillUses] = useState<Record<string, number>>({})

  // Enemy state
  const [selectedEnemy, setSelectedEnemy] = useState<WikiEnemy | null>(null)
  const [showEnemyPicker, setShowEnemyPicker] = useState(false)
  const [enemyDefOverride, setEnemyDefOverride] = useState("")
  const [enemyHpOverride,  setEnemyHpOverride]  = useState("")
  const [enemyAtkOverride, setEnemyAtkOverride] = useState("")

  // Inspection / UI state
  type InspectTarget =
    | { kind: "char"; slotIdx: number }
    | { kind: "prot"; side: "main" | "sub" }
    | { kind: "enemy" }
    | { kind: "result" }
    | null
  const [inspecting, setInspecting] = useState<InspectTarget>(null)
  const [calcSlotIdx, setCalcSlotIdx] = useState(0)
  const [calcSkillLabel, setCalcSkillLabel] = useState<string | null>(null)
  const [statModalSlot, setStatModalSlot] = useState<number | null>(null)
  const [hoveredSkill, setHoveredSkill] = useState<{ skill: WikiSkill; tooltipNote?: string; rect: DOMRect; viewportWidth: number } | null>(null)
  const [enemyConditionToggles, setEnemyConditionToggles] = useState<Record<string, boolean>>({})
  const [rolls, setRolls] = useState<ProcRolls>({
    critical: false, superCritical: false, penetration: false, superPenetration: false,
    cooperation: false, superCooperation: false, defCritical: false,
    soco: "none", weakness: "normal",
  })

  // Derived: protector buffs
  const protectorBuffs = useMemo<BuffEntry[]>(() => {
    const result: BuffEntry[] = []
    function add(char: WikiCharacter, slot: string, uses: number) {
      const skill = char.skills.find(s => s.slot === slot)
      const count = normalizeUseCount(uses)
      if (!skill || count <= 0) return
      const id = `${char.master_pc_id}_${slot}`
      const stackingMode = inferSkillBuffStackingMode(skill)
      getSkillBuffs(skill).forEach((pb, i) =>
        result.push({
          id: `${id}_${i}`,
          type: pb.type,
          value: pb.value * (stackingMode === "unlimited" ? count : 1),
          source: `${char.name} - ${skill.name}${count > 1 ? ` x${count}` : ""}`,
          skillId: id,
          uses: count,
          stackingMode,
        }))
    }
    if (mainProtector) {
      add(mainProtector, "leader_skill", 1)
      add(mainProtector, "bless_skill", protectorSkillUses[getProtectorSkillUseKey(mainProtector.master_pc_id, "bless_skill")] ?? 0)
    }
    if (subProtector) add(subProtector, "assist_leader_skill", 1)
    return result
  }, [mainProtector, subProtector, protectorSkillUses])

  // Derived: attacker active-skill buffs
  const attackerBuffs = useMemo<BuffEntry[]>(() => {
    const result: BuffEntry[] = []
    attackerSlots.forEach((slot, si) => {
      if (!slot.char) return
      slot.char.skills.forEach(s => {
        if (!["active_skill_1", "active_skill_2", "active_skill_3"].includes(s.slot)) return
        const uses = attackerSkillUses[getAttackerSkillUseKey(si, s.label)] ?? 0
        if (uses <= 0) return
        const stackingMode = inferSkillBuffStackingMode(s)
        getSkillBuffs(s).forEach((pb, i) =>
          result.push({
            id: `att_${si}_${s.label}_${i}`,
            type: pb.type,
            value: pb.value * (stackingMode === "unlimited" ? uses : 1),
            source: `${slot.char!.name} - ${s.name}${uses > 1 ? ` x${uses}` : ""}`,
            skillId: s.label,
            uses,
            stackingMode,
          }))
      })
    })
    return result
  }, [attackerSlots, attackerSkillUses])

  const allBuffs = useMemo(() => [...protectorBuffs, ...attackerBuffs], [protectorBuffs, attackerBuffs])

  const activeSupportSkills = useMemo(() => {
    const result: Array<{ skill: WikiSkill; source: string }> = []

    if (mainProtector) {
      const leaderSkill = mainProtector.skills.find((entry) => entry.slot === "leader_skill")
      if (leaderSkill) result.push({ skill: leaderSkill, source: `${mainProtector.name} - ${leaderSkill.name}` })

      const blessSkill = mainProtector.skills.find((entry) => entry.slot === "bless_skill")
      const blessUses = protectorSkillUses[getProtectorSkillUseKey(mainProtector.master_pc_id, "bless_skill")] ?? 0
      if (blessSkill && blessUses > 0) {
        result.push({ skill: blessSkill, source: `${mainProtector.name} - ${blessSkill.name}${blessUses > 1 ? ` x${blessUses}` : ""}` })
      }
    }

    if (subProtector) {
      const skill = subProtector.skills.find((entry) => entry.slot === "assist_leader_skill")
      if (skill) result.push({ skill, source: `${subProtector.name} - ${skill.name}` })
    }

    attackerSlots.forEach((slot, slotIdx) => {
      if (!slot.char) return
      slot.char.skills.forEach((skill) => {
        if (!skill.slot.startsWith("active_skill_")) return
        const uses = attackerSkillUses[getAttackerSkillUseKey(slotIdx, skill.label)] ?? 0
        if (uses <= 0) return
        result.push({ skill, source: `${slot.char!.name} - ${skill.name}${uses > 1 ? ` x${uses}` : ""}` })
      })
    })

    return result
  }, [mainProtector, subProtector, protectorSkillUses, attackerSlots, attackerSkillUses])

  const activePartyConditions = useMemo(() => {
    const names = new Set<string>()

    activeSupportSkills.forEach(({ skill }) => {
      getSkillStructuredPartyConditions(skill).forEach(({ name, probability }) => {
        if (probability >= B) {
          names.add(name)
        }
      })
    })

    return Array.from(names).sort((left, right) => left.localeCompare(right))
  }, [activeSupportSkills])

  const enemyConditionOptions = useMemo(() => {
    const options = new Map<string, { name: string; defaultActive: boolean; notes: string[] }>()

    const upsert = (name: string, defaultActive: boolean, note: string) => {
      const existing = options.get(name)
      if (existing) {
        existing.defaultActive = existing.defaultActive || defaultActive
        if (note && !existing.notes.includes(note)) existing.notes.push(note)
        return
      }
      options.set(name, { name, defaultActive, notes: note ? [note] : [] })
    }

    activeSupportSkills.forEach(({ skill, source }) => {
      getSkillStructuredEnemyConditions(skill).forEach(({ name, probability }) => {
        upsert(name, probability >= B, `${source}${probability && probability !== B ? ` (${(probability / 100).toFixed(1)}%)` : ""}`)
      })
    })

    allBuffs.forEach((buff) => {
      for (const [conditionName, buffType] of Object.entries(CONDITION_DAMAGE_BUFF_BY_NAME)) {
        if (buff.type === buffType) {
          upsert(conditionName, false, getBuffLabel(buff.type))
        }
      }
    })

    return Array.from(options.values()).sort((left, right) => left.name.localeCompare(right.name))
  }, [activeSupportSkills, allBuffs])

  const activeEnemyConditions = useMemo(
    () => enemyConditionOptions
      .filter((option) => enemyConditionToggles[option.name] ?? option.defaultActive)
      .map((option) => option.name),
    [enemyConditionOptions, enemyConditionToggles],
  )

  const effectiveBuffs = useMemo(
    () => resolveEffectiveBuffs(allBuffs, activePartyConditions, activeEnemyConditions),
    [allBuffs, activePartyConditions, activeEnemyConditions],
  )

  const effectiveBuffSummary = useMemo(() => {
    const grouped = new Map<BuffType, BuffEntry[]>()
    for (const buff of effectiveBuffs) {
      const existing = grouped.get(buff.type)
      if (existing) existing.push(buff)
      else grouped.set(buff.type, [buff])
    }

    return Array.from(grouped.entries())
      .map(([type, entries]) => {
        const value = sumBuff(effectiveBuffs, type)
        if (value === 0) return null

        let strongestLimited: BuffEntry | null = null
        const sources: string[] = []
        for (const entry of entries) {
          if (entry.stackingMode === "unlimited") {
            sources.push(entry.source)
            continue
          }
          if (!strongestLimited || Math.abs(entry.value) > Math.abs(strongestLimited.value)) {
            strongestLimited = entry
          }
        }
        if (strongestLimited) {
          sources.push(strongestLimited.source)
        }

        return {
          type,
          value,
          source: Array.from(new Set(sources)).join(", "),
        }
      })
      .filter((entry): entry is { type: BuffType; value: number; source: string } => entry !== null)
  }, [effectiveBuffs])

  const enemyDebuffs = useMemo(() => effectiveBuffs.filter((b) =>
    (b.type === "DamageTaken" && b.value > 0) ||
    (ENEMY_SIDE_BUFF_TYPES.has(b.type) && b.value < 0)
  ), [effectiveBuffs])

  // Derived calc values
  const calcSlot  = attackerSlots[calcSlotIdx]
  const calcChar  = calcSlot?.char ?? null
  const calcCharStats = getSlotBattleStats(calcSlot)
  const baseATK   = calcCharStats?.attack || calcChar?.stats.attack || 0
  const baseDEF   = parseInt(enemyDefOverride || String(selectedEnemy?.defense ?? 0)) || 0
  const baseRates = attackerSlots[calcSlotIdx].rates

  const calcCharsSkills = useMemo(() => {
    if (!calcChar) return []
    return calcChar.skills.filter(s =>
      ["special_skill", "special_skill_attack", "active_skill_1", "active_skill_2", "active_skill_3"].includes(s.slot))
  }, [calcChar])

  const calcSkill = useMemo(() =>
    calcCharsSkills.find(s => s.label === calcSkillLabel) ??
    calcCharsSkills.find(s => s.slot === "special_skill_attack") ??
    calcCharsSkills.find(s => getSkillDamageRate(s) > 0) ??
    calcCharsSkills.find(s => s.slot === "special_skill") ?? null,
    [calcCharsSkills, calcSkillLabel]
  )

  const skillRate = getSkillDamageRate(calcSkill)
  const calcAttackEffect = getSkillPrimaryAttackEffect(calcSkill)
  const calcAttackType = normalizeAttackTypeName(calcAttackEffect?.attack_type ?? calcChar?.attack_type)
  const calcAttackElement = getBattleElementInfo(calcAttackEffect?.element_type ?? calcChar?.element ?? "Fire")
  const calcAttackScope = getAttackScope(calcAttackEffect)
  const effectiveBaseRates = useMemo(() => ({
    ...baseRates,
    isEnhancedAttacker: baseRates.isEnhancedAttacker || calcAttackElement.isEnhanced,
  }), [baseRates, calcAttackElement.isEnhanced])

  // Auto-detect weakness from enemy element resist vs attacker element
  const autoWeakness = useMemo((): ElementWeakness => {
    if (!selectedEnemy) return "normal"
    const elemResist = getEnemyElemResist(selectedEnemy, calcAttackElement.baseElement)
    if (elemResist >= 0) return "normal"
    return effectiveBaseRates.isEnhancedAttacker ? "enhanced_weak" : "weak"
  }, [selectedEnemy, calcAttackElement.baseElement, effectiveBaseRates.isEnhancedAttacker])

  const effectiveRolls = useMemo<ProcRolls>(() => ({
    ...rolls,
    weakness: autoWeakness,
  }), [rolls, autoWeakness])

  const calcResult = useMemo(() => {
    if (!skillRate || !baseATK) return null
    return runCalc(
      baseATK,
      baseDEF || 1,
      skillRate,
      calcAttackType,
      calcAttackElement.key,
      calcAttackElement.baseElement,
      calcAttackScope,
      effectiveBuffs,
      activeEnemyConditions,
      effectiveRolls,
      effectiveBaseRates,
      selectedEnemy?.element,
      selectedEnemy,
    )
  }, [baseATK, baseDEF, skillRate, calcAttackType, calcAttackElement, calcAttackScope, effectiveBuffs, activeEnemyConditions, effectiveRolls, effectiveBaseRates, selectedEnemy?.element, selectedEnemy])

  function rerollProcs() {
    const rates = computeProcRates(effectiveBuffs, baseRates)
    setRolls(prev => rollProcs(rates, prev))
  }

  // Helpers
  function setProtectorSkillUseCount(masterPcId: number, slot: string, count: number) {
    const key = getProtectorSkillUseKey(masterPcId, slot)
    setProtectorSkillUses((prev) => {
      const next = { ...prev }
      const normalized = normalizeUseCount(count)
      if (normalized > 0) next[key] = normalized
      else delete next[key]
      return next
    })
  }

  function toggleAttackerSkill(slotIdx: number, label: string) {
    const currentCount = attackerSkillUses[getAttackerSkillUseKey(slotIdx, label)] ?? 0
    setAttackerSkillUseCount(slotIdx, label, currentCount > 0 ? 0 : 1)
  }

  function setAttackerSkillUseCount(slotIdx: number, label: string, count: number) {
    setAttackerSkillUses(prev => {
      const next = { ...prev }
      const char = attackerSlots[slotIdx]?.char
      const skill = char?.skills.find(s => s.label === label)
      const normalized = normalizeUseCount(count)
      if (skill?.slot && skill.slot.startsWith("active_skill_") && normalized > 0) {
        char?.skills.forEach(s => {
          if (s.slot === skill.slot && s.label !== label) {
            delete next[getAttackerSkillUseKey(slotIdx, s.label)]
          }
        })
      }
      const key = getAttackerSkillUseKey(slotIdx, label)
      if (normalized > 0) next[key] = normalized
      else delete next[key]
      return next
    })
  }

  function toggleEnemyCondition(name: string, nextActive: boolean) {
    setEnemyConditionToggles((prev) => ({ ...prev, [name]: nextActive }))
  }

  const inspectedChar = useMemo((): WikiCharacter | null => {
    if (!inspecting) return null
    if (inspecting.kind === "char") return attackerSlots[(inspecting as { kind: "char"; slotIdx: number }).slotIdx]?.char ?? null
    if (inspecting.kind === "prot") return (inspecting as { kind: "prot"; side: "main" | "sub" }).side === "main" ? mainProtector : subProtector
    return null
  }, [inspecting, attackerSlots, mainProtector, subProtector])

  // Skill bar content: unique attacker buff skills + each attacker's special skill
  const skillBarItems = useMemo(() => {
    type Item = { skill: WikiSkill; char: WikiCharacter; slotIdx: number; variantCount: number; slotBadge?: string }
    const items: Item[] = []
    const seen = new Set<string>()
    attackerSlots.forEach((slot, i) => {
      if (!slot.char) return
      const slotCounts = slot.char.skills.reduce<Record<string, number>>((acc, skill) => {
        if (["active_skill_1", "active_skill_2", "active_skill_3"].includes(skill.slot)) {
          acc[skill.slot] = (acc[skill.slot] ?? 0) + 1
        }
        return acc
      }, {})
      slot.char.skills.forEach(s => {
        const key = `${i}_${s.label}`
        if (seen.has(key)) return
        if (["active_skill_1", "active_skill_2", "active_skill_3", "special_skill", "special_skill_attack"].includes(s.slot)) {
          seen.add(key)
          items.push({
            skill: s,
            char: slot.char!,
            slotIdx: i,
            variantCount: slotCounts[s.slot] ?? 1,
            slotBadge: s.slot.startsWith("active_skill_") ? s.slot.replace("active_skill_", "A") : undefined,
          })
        }
      })
    })
    return items
  }, [attackerSlots])

  const protSkillItems = useMemo(() => {
    type Item = { skill: WikiSkill; char: WikiCharacter; useCount: number; showUseCountInput: boolean }
    const items: Item[] = []
    if (mainProtector) {
      mainProtector.skills.forEach(s => {
        if (["leader_skill", "bless_skill"].includes(s.slot))
          items.push({
            skill: s,
            char: mainProtector,
            useCount: s.slot === "bless_skill" ? (protectorSkillUses[getProtectorSkillUseKey(mainProtector.master_pc_id, "bless_skill")] ?? 0) : 1,
            showUseCountInput: s.slot === "bless_skill",
          })
      })
    }
    if (subProtector) {
      subProtector.skills.forEach(s => {
        if (s.slot === "assist_leader_skill")
          items.push({ skill: s, char: subProtector, useCount: 1, showUseCountInput: false })
      })
    }
    return items
  }, [mainProtector, subProtector, protectorSkillUses])

  return (
    <div className="site-page text-white">
      {/* Header bar */}
      <div className="border-b border-white/10 bg-[#050811]/80 px-4 py-2 flex items-center gap-3 backdrop-blur-xl">
        <span className="text-gray-300 text-xs font-bold">Battle Sim WIP</span>
        <span className="text-amber-300/90 text-xs ml-auto hidden md:block">Work in progress: calculation flow is usable, but there are still bugs and missing edge cases to fix.</span>
      </div>

      {/* Main layout */}
      <div className="flex flex-col xl:flex-row min-h-[calc(100vh-8rem)]">

        {/* LEFT: Battlefield */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Enemy section */}
          <div className="p-4 border-b border-gray-800 bg-gray-900/30">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <EnemyCard
                  enemy={selectedEnemy}
                  isInspected={inspecting?.kind === "enemy"}
                  onInspect={() => setInspecting(prev => prev?.kind === "enemy" ? null : { kind: "enemy" })}
                  onChangeEnemy={() => setShowEnemyPicker(true)}
                />
              </div>
              {selectedEnemy && inspecting?.kind !== "enemy" && (
                <div className="shrink-0 flex flex-col gap-1 text-xs w-28">
                  {([["DEF", enemyDefOverride, setEnemyDefOverride, selectedEnemy.defense],
                     ["ATK", enemyAtkOverride, setEnemyAtkOverride, selectedEnemy.attack]] as [string, string, (v: string) => void, number][]).map(([label, val, setter, base]) => (
                    <div key={label}>
                      <label className="text-gray-600 text-[10px]">Override {label}</label>
                      <input type="number" value={val} onChange={e => setter(e.target.value)} placeholder={String(base)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-white" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Team formation */}
          <div className="p-4 flex-1">
            <div className="flex items-start gap-2 mb-4 flex-wrap">
              {/* Attacker portaits */}
              <div className="flex gap-3 flex-wrap flex-1">
                {attackerSlots.map((slot, i) => (
                  <div key={i} className="flex flex-col gap-1.5 w-24">
                    <CharPortrait
                      char={slot.char}
                      slot="attacker"
                      isCalcTarget={calcSlotIdx === i}
                      isInspected={inspecting?.kind === "char" && (inspecting as { kind: "char"; slotIdx: number }).slotIdx === i}
                      onClick={() => setInspecting(prev => prev?.kind === "char" && (prev as { kind: "char"; slotIdx: number }).slotIdx === i ? null : { kind: "char", slotIdx: i })}
                      onSetCalcTarget={() => { setCalcSlotIdx(i); setCalcSkillLabel(null) }}
                      emptyLabel={`Attacker ${i+1}`}
                    />
                    <CharPicker
                      characters={characters}
                      value={slot.char}
                      onChange={c => {
                        setAttackerSlots(prev => prev.map((x, j) => j === i ? { ...x, char: c, statOverrides: createEmptyStatOverrides() } : x))
                        setAttackerSkillUses(prev => {
                          const next = { ...prev }
                          Object.keys(next).forEach((key) => {
                            if (key.startsWith(`att:${i}:`)) delete next[key]
                          })
                          return next
                        })
                      }}
                      placeholder="+"
                    />
                    {slot.char && (
                      <button onClick={() => setStatModalSlot(i)}
                        className="text-[10px] font-semibold text-blue-200 bg-blue-950/70 border border-blue-700 rounded-md px-2 py-1 hover:bg-blue-900/70 hover:text-white text-center transition-colors shadow-sm">
                        Edit Stats
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {/* Protector column */}
              <div className="border-l border-gray-700 pl-3 flex flex-col gap-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide text-center">Protectors</div>
                {(["main", "sub"] as const).map(side => {
                  const prot = side === "main" ? mainProtector : subProtector
                  return (
                    <div key={side} className="flex flex-col gap-1.5 w-20">
                      <CharPortrait
                        char={prot}
                        slot="protector"
                        isInspected={inspecting?.kind === "prot" && (inspecting as { kind: "prot"; side: "main" | "sub" }).side === side}
                        onClick={() => setInspecting(prev => prev?.kind === "prot" && (prev as { kind: "prot"; side: "main" | "sub" }).side === side ? null : { kind: "prot", side })}
                        emptyLabel={side === "main" ? "Main" : "Sub"}
                      />
                      <CharPicker
                        characters={characters}
                        value={prot}
                        onChange={c => {
                          if (side === "main") {
                            setMainProtector(c)
                            setProtectorSkillUses({})
                          } else {
                            setSubProtector(c)
                          }
                        }}
                        placeholder="+"
                        filterRole="protector"
                      />
                    </div>
                  )
                })}
              </div>
            </div>

          </div>

          {/* Active effects panel — always visible */}
          <div className="border-t border-gray-800 p-3 bg-gray-900/40 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              {skillRate > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 bg-gray-800 text-gray-300">
                  Skill Rate {skillRate}%
                </span>
              )}
              {autoWeakness !== "normal" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-900/60 border border-orange-700 text-orange-300">▼ {autoWeakness.replace(/_/g, " ")} (auto)</span>
              )}
              {getStructuredSkillEffectNotes(calcSkill).map((note) => (
                <span key={note} className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-700 bg-cyan-950/40 text-cyan-300">
                  {note}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide">Ultimate Soul</span>
              {([
                ["none", "None"],
                ["soco", "SoCo"],
                ["ex_soco", "EX SoCo"],
                ["ex2_soco", "EX2 SoCo"],
              ] as const).map(([value, label]) => {
                const active = rolls.soco === value
                return (
                  <button
                    key={value}
                    onClick={() => setRolls((prev) => ({ ...prev, soco: value }))}
                    className={`rounded-md border px-2 py-1 text-[10px] transition-colors ${active ? "border-blue-600 bg-blue-900/60 text-blue-200" : "border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200"}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {enemyConditionOptions.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Enemy Conditions</div>
                <div className="flex flex-wrap gap-1.5">
                  {enemyConditionOptions.map((option) => {
                    const active = enemyConditionToggles[option.name] ?? option.defaultActive
                    const title = option.notes.join(" | ")
                    return (
                      <button
                        key={option.name}
                        type="button"
                        title={title || option.name}
                        onClick={() => toggleEnemyCondition(option.name, !active)}
                        className={`rounded-full border px-2 py-1 text-[10px] transition-colors ${active ? "border-emerald-700 bg-emerald-950/50 text-emerald-300" : "border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200"}`}
                      >
                        {option.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {activePartyConditions.length > 0 && (
              <div className="text-[10px] text-sky-300">Attacker Conditions: {activePartyConditions.join(", ")}</div>
            )}
            {activeEnemyConditions.length > 0 && (
              <div className="text-[10px] text-emerald-300">Active: {activeEnemyConditions.join(", ")}</div>
            )}
            <div className="text-[10px] text-gray-600 uppercase tracking-wide">
              Active Effects {effectiveBuffSummary.length > 0 ? `(${effectiveBuffSummary.length})` : ""}
            </div>
            {effectiveBuffSummary.length > 0 ? (
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {effectiveBuffSummary.map((buff) => (
                  <div key={buff.type} className="flex items-center gap-2 text-xs">
                    <span className={`font-mono w-14 text-right shrink-0 ${buff.value >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {buff.value >= 0 ? "+" : ""}{(buff.value/100).toFixed(1)}%
                    </span>
                    <span className="text-gray-300 flex-1 truncate">{getBuffLabel(buff.type)}</span>
                    <span className="text-gray-600 text-[10px] truncate max-w-[8rem]">{buff.source}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-700 italic">No active effects — set skill uses below</p>
            )}
          </div>
          {/* Skill bar */}
          <div className="border-t border-gray-800 bg-gray-900/70 p-3">
            <div className="flex items-end gap-2 overflow-x-auto overflow-y-visible pt-2 pb-3">
              {/* Protector skills */}
              {protSkillItems.map(({ skill, char, useCount, showUseCountInput }) => {
                const active = useCount > 0
                return (
                  <SkillBubble key={skill.label} skill={skill} isActive={active} isDamageSelected={false}
                    useCount={useCount}
                    showUseCountInput={showUseCountInput}
                    onHoverChange={payload => setHoveredSkill(payload ? { ...payload, viewportWidth: window.innerWidth } : null)}
                    onToggle={showUseCountInput ? () => setProtectorSkillUseCount(char.master_pc_id, skill.slot, useCount > 0 ? 0 : 1) : undefined}
                    onUseCountChange={showUseCountInput ? (value) => setProtectorSkillUseCount(char.master_pc_id, skill.slot, value) : undefined} />
                )
              })}

              {/* Attacker skills */}
              {skillBarItems.map(({ skill, slotIdx, variantCount, slotBadge }) => {
                const isDmg = skill.slot === "special_skill" || skill.slot === "special_skill_attack"
                const useCount = isDmg ? 0 : (attackerSkillUses[getAttackerSkillUseKey(slotIdx, skill.label)] ?? 0)
                const isSelected = isDmg
                  ? slotIdx === calcSlotIdx && (calcSkillLabel === skill.label || (!calcSkillLabel && (skill.slot === "special_skill_attack" || skill.slot === "special_skill")))
                  : false
                const isActive = isDmg ? isSelected : useCount > 0
                const isVariantLocked = !isDmg && variantCount > 1 && attackerSlots[slotIdx]?.char?.skills.some(s =>
                  s.slot === skill.slot && s.label !== skill.label && (attackerSkillUses[getAttackerSkillUseKey(slotIdx, s.label)] ?? 0) > 0
                )
                return (
                  <SkillBubble key={`${slotIdx}_${skill.label}`} skill={skill}
                    isActive={isActive} isDamageSelected={isDmg && isSelected}
                    isDisabled={isVariantLocked}
                    slotBadge={slotBadge}
                    useCount={useCount}
                    showUseCountInput={!isDmg}
                    tooltipNote={isVariantLocked ? `Disabled because another ${skill.slot.replaceAll("_", " ")} variant is active.` : variantCount > 1 ? `This slot has ${variantCount} alternate versions. Only one can be active.` : undefined}
                    onHoverChange={payload => setHoveredSkill(payload ? { ...payload, viewportWidth: window.innerWidth } : null)}
                    onToggle={isDmg ? undefined : () => toggleAttackerSkill(slotIdx, skill.label)}
                    onUseCountChange={isDmg ? undefined : (value) => setAttackerSkillUseCount(slotIdx, skill.label, value)}
                    onSelectDamage={isDmg ? () => { setCalcSlotIdx(slotIdx); setCalcSkillLabel(skill.label) } : undefined}
                  />
                )
              })}

              {/* Roll + Calculate button */}
              <button onClick={() => { rerollProcs(); setInspecting({ kind: "result" }) }}
                disabled={!calcResult}
                className="shrink-0 ml-auto flex flex-col items-center justify-center bg-gradient-to-b from-gray-600 to-gray-800 disabled:from-gray-800 disabled:to-gray-900 border border-gray-600 disabled:border-gray-800 rounded-xl px-4 py-2 gap-1 hover:from-gray-500 hover:to-gray-700 disabled:cursor-not-allowed transition-all min-w-[80px]">
                <span className="text-[10px] text-gray-400">Activate</span>
                {calcResult?.rawDamage != null ? (
                  <span className="text-sm font-bold text-yellow-300 font-mono">{Math.round(calcResult.rawDamage).toLocaleString()}</span>
                ) : (
                  <Zap className="w-5 h-5 text-gray-500" />
                )}
              </button>
            </div>
          </div>
        </div>

        {hoveredSkill && (() => {
          const skillMeta = hoveredSkill.skill as WikiSkill & { is_skill_change?: boolean; replaces_slot?: string }
          const tooltipWidth = 288
          const left = Math.min(hoveredSkill.viewportWidth - tooltipWidth / 2 - 16, Math.max(tooltipWidth / 2 + 16, hoveredSkill.rect.left + hoveredSkill.rect.width / 2))
          return (
            <div
              className="pointer-events-none fixed z-[70] w-72 rounded-xl border border-gray-600 bg-[#0b1220] p-3 text-left shadow-[0_20px_50px_rgba(0,0,0,0.7)]"
              style={{ left, top: hoveredSkill.rect.top - 12, transform: "translate(-50%, -100%)" }}
            >
              <div className="text-sm font-semibold text-white leading-tight">{hoveredSkill.skill.name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-gray-400">
                <span className="rounded border border-gray-700 bg-gray-900 px-1.5 py-0.5">{hoveredSkill.skill.slot.replaceAll("_", " ")}</span>
                {hoveredSkill.skill.cost != null && <span className="rounded border border-gray-700 bg-gray-900 px-1.5 py-0.5">Cost {hoveredSkill.skill.cost}</span>}
                {skillMeta.is_skill_change && <span className="rounded border border-blue-700 bg-blue-950/60 px-1.5 py-0.5 text-blue-300">Changed Skill</span>}
              </div>
              {skillMeta.is_skill_change && (
                <div className="mt-2 text-[11px] text-blue-300">
                  Replaces {skillMeta.replaces_slot?.replaceAll("_", " ") ?? "another skill"}
                </div>
              )}
              {hoveredSkill.tooltipNote && (
                <div className="mt-2 text-[11px] text-amber-300">{hoveredSkill.tooltipNote}</div>
              )}
              <div className="mt-2 whitespace-pre-line text-xs leading-5 text-gray-200">
                {stripColorTags(hoveredSkill.skill.description_max_level ?? "No description available")}
              </div>
            </div>
          )
        })()}

        {/* RIGHT: Info panel */}
        {inspecting && (
          <div className="xl:w-80 xl:border-l border-t xl:border-t-0 border-gray-800 bg-gray-950/60 flex flex-col" style={{ minHeight: 400 }}>
            <div className="flex-1 p-3">
              {inspecting.kind === "char" && inspectedChar && (
                <CharInfoPanel
                  char={inspectedChar}
                  activeBuffs={effectiveBuffs}
                  displayStats={getSlotBattleStats(attackerSlots[(inspecting as { kind: "char"; slotIdx: number }).slotIdx])}
                  onClose={() => setInspecting(null)}
                />
              )}
              {inspecting.kind === "prot" && inspectedChar && (
                <div className="space-y-3 h-full overflow-y-auto">
                  <CharInfoPanel char={inspectedChar} activeBuffs={effectiveBuffs} onClose={() => setInspecting(null)} />
                  <div className="space-y-2">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide px-1">Skill Uses</div>
                    {inspectedChar.skills
                      .filter(s => ["leader_skill", "bless_skill", "assist_leader_skill"].includes(s.slot))
                      .map(s => {
                        const isFixed = s.slot !== "bless_skill"
                        const useCount = s.slot === "bless_skill"
                          ? (protectorSkillUses[getProtectorSkillUseKey(inspectedChar.master_pc_id, "bless_skill")] ?? 0)
                          : 1
                        const active = useCount > 0
                        return (
                          <div key={s.label}
                            className={`flex items-start gap-2 p-2 rounded-lg border text-xs transition-colors ${active ? "border-blue-700 bg-blue-950/30" : "border-gray-800 bg-gray-900/30"}`}>
                            {s.icon_path && <img src={toPublicAssetPath(s.icon_path)} alt="" className="w-5 h-5 object-contain rounded shrink-0"
                              onError={e => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-white">{s.name}</div>
                              <div className="text-gray-500 text-[10px] mt-0.5">{stripColorTags(s.description_max_level ?? "").slice(0, 120)}</div>
                            </div>
                            {isFixed ? (
                              <div className="shrink-0 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-[10px] text-gray-300">x1</div>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                value={useCount}
                                onChange={(event) => setProtectorSkillUseCount(inspectedChar.master_pc_id, s.slot, normalizeUseCount(Number.parseInt(event.target.value || "0", 10)))}
                                className="w-14 shrink-0 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[10px] font-mono text-white"
                              />
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
              {inspecting.kind === "enemy" && selectedEnemy && (
                <EnemyInfoPanel
                  enemy={selectedEnemy}
                  defOverride={enemyDefOverride} hpOverride={enemyHpOverride} atkOverride={enemyAtkOverride}
                  onDefChange={setEnemyDefOverride} onHpChange={setEnemyHpOverride} onAtkChange={setEnemyAtkOverride}
                  activeDebuffs={enemyDebuffs}
                  onClose={() => setInspecting(null)}
                />
              )}
              {inspecting.kind === "result" && calcResult && (
                <DamageResultPanel result={calcResult} onReroll={rerollProcs} onClose={() => setInspecting(null)} />
              )}
            </div>
          </div>
        )}
      </div>

      {showEnemyPicker && (
        <EnemyPickerOverlay
          enemies={enemies}
          onSelect={e => { setSelectedEnemy(e); setEnemyDefOverride(""); setEnemyHpOverride(""); setEnemyAtkOverride("") }}
          onClose={() => setShowEnemyPicker(false)}
        />
      )}

      {statModalSlot !== null && attackerSlots[statModalSlot] && (
        <StatModal
          slot={attackerSlots[statModalSlot]}
          slotIdx={statModalSlot}
          onClose={() => setStatModalSlot(null)}
          onStatOverridesChange={statOverrides => setAttackerSlots(prev => prev.map((x, i) => i === statModalSlot ? { ...x, statOverrides } : x))}
          onRatesChange={rates => setAttackerSlots(prev => prev.map((x, i) => i === statModalSlot ? { ...x, rates } : x))}
        />
      )}
    </div>
  )
}
