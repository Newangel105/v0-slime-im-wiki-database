"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { Search, X, Plus, ChevronDown, Shield, Swords, Zap } from "lucide-react"
import { toPublicAssetPath, stripColorTags, type WikiCharacter, type WikiSkill } from "@/lib/pc-wiki"
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
export type BuffType =
  // ── Base stat multipliers (MasterParameterType: Attack=1, Defense=2) ──────
  | "Attack" | "Defense"
  // ── Attack-type multipliers (300-303) — conditional on attacker attack_type ─
  | "EffectAttackPhysics" | "EffectAttackMagic" | "EffectAttackSingle" | "EffectAttackWhole"
  // ── Attacker-element ATK multipliers (309-316) — only when attacker.element matches ──
  | "EffectElementEarth" | "EffectElementSpace" | "EffectElementWind" | "EffectElementWater"
  | "EffectElementFire" | "EffectElementLight" | "EffectElementDark"
  // ── Proc damage powers (304-319) ─────────────────────────────────────────────
  | "EffectCritical" | "EffectPenetration" | "EffectCooperation" | "EffectDefcritical"
  // ── Proc rates (100-111, 1701, 1808-1809) ────────────────────────────────────
  | "ProbCritical" | "ProbPenetration" | "ProbCooperation" | "ProbDefcritical"
  | "ProbCriticalSuper" | "ProbPenetrationSuper" | "ProbCooperationSuper"
  // ── "X+ damage" buffs (DamageEffect 508-514) — e.g. "space+ damage UP" ──────
  | "DamageEffectElementEarth" | "DamageEffectElementSpace" | "DamageEffectElementWind"
  | "DamageEffectElementWater" | "DamageEffectElementFire" | "DamageEffectElementLight"
  | "DamageEffectElementDark"
  | "DamageEffectAttackPhysics" | "DamageEffectAttackMagic"
  // ── Enemy resists (401-420) ──────────────────────────────────────────────────
  | "ResistCritical" | "ResistPenetration" | "ResistCooperation" | "ResistDefcritical"
  | "ResistAttackPhysics" | "ResistAttackMagic"
  // ── "Damage to X enemies" = SpecialEffectElement* (1300-1306) ────────────────
  | "SpecialEffectElementEarth" | "SpecialEffectElementSpace" | "SpecialEffectElementWind"
  | "SpecialEffectElementWater" | "SpecialEffectElementFire" | "SpecialEffectElementLight"
  | "SpecialEffectElementDark"
  // ── Weakness multipliers (1400-1403) ─────────────────────────────────────────
  | "SpecialEffectWeakness" | "SpecialEffectSuperWeakness"
  // ── Misc ──────────────────────────────────────────────────────────────────────
  | "ComboRate" | "DamageTaken" | "DamageResistSpecial"

export type ElementWeakness = "normal" | "weak" | "super_weak" | "enhanced_weak" | "enhanced_super_weak"
export type SoCoType = "none" | "soco" | "ex_soco" | "ex2_soco"

export interface BuffEntry {
  id: string
  type: BuffType
  value: number   // 10000-basis (10000 = 100%)
  source: string
  skillId?: string
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
  drago: boolean
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

// ─── Element data ─────────────────────────────────────────────────────────────
const ELEM_ICON: Record<string, string> = {
  Fire: "/elements/fire.png", Water: "/elements/water.png",
  Wind: "/elements/wind.png", Earth: "/elements/earth.png",
  Light: "/elements/icElementlight.png", Dark: "/elements/dark.png",
  Space: "/elements/icElementspace.png",
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
const BUFF_META: Record<BuffType, { label: string; group: string }> = {
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
  // Misc
  ComboRate:                     { label: "Combo Rate %",                group: "Combo" },
  DamageTaken:                   { label: "Enemy Dmg Taken %",           group: "Debuff" },
  DamageResistSpecial:           { label: "Enemy Secret Skill Resist %", group: "Debuff" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sumBuff(buffs: BuffEntry[], type: BuffType) {
  return buffs.filter(b => b.type === type).reduce((s, b) => s + b.value, 0)
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
  attackerElement: string,  // e.g. "Fire", "Dark", "Space"
  buffs: BuffEntry[],
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
  // include enemy's built-in attack-type resistance (negative = enemy weak = bonus to attacker)
  const enemyTypeResist = getEnemyBaseResist(enemy, attackType)
  const skillResistBuff = attackType === "Physical" ? sumBuff(buffs, "ResistAttackPhysics") : sumBuff(buffs, "ResistAttackMagic")
  const phMagResistBuff = skillResistBuff + enemyTypeResist
  const singleBuff = sumBuff(buffs, "EffectAttackSingle")
  const wholeBuff  = sumBuff(buffs, "EffectAttackWhole")
  const atkTypeTot = physBuff + magicBuff + singleBuff + wholeBuff - phMagResistBuff
  const atkTypeMult = 1 + atkTypeTot / B
  const effATK2    = effATK1 * atkTypeMult
  if (atkTypeMult !== 1)
    steps.push({ label: attackType === "Physical" ? "P-ATK %" : "M-ATK %",
      mult: atkTypeMult, note: `+${(atkTypeTot/100).toFixed(1)}% (${attackType}${enemyTypeResist !== 0 ? ` incl. enemy ${enemyTypeResist < 0 ? "weak" : "resist"} ${(Math.abs(enemyTypeResist)/100).toFixed(0)}%` : ""})` })

  // ── Step 1c: Attacker-element ATK buff (309-316) + enemy element resist ─────
  const elemKey = `EffectElement${attackerElement}` as BuffType
  const elemATKBuff = (elemKey in BUFF_META) ? sumBuff(buffs, elemKey) : 0
  const enemyElemResist = getEnemyElemResist(enemy, attackerElement)
  const elemTotal = elemATKBuff - enemyElemResist
  const elemATKMult = 1 + elemTotal / B
  const effATK3    = effATK2 * elemATKMult
  if (elemTotal !== 0)
    steps.push({ label: `${attackerElement} ATK %`, mult: elemATKMult,
      note: `ElemBuff +${(elemATKBuff/100).toFixed(1)}%${enemyElemResist !== 0 ? ` / EnemyElemResist ${(enemyElemResist/100).toFixed(1)}%` : ""}` })

  // ── Step 1d: "X+ damage" (DamageEffect 508-514) — separate axis ──────────────
  const dmgEffKey = `DamageEffectElement${attackerElement}` as BuffType
  const dmgEffBuff = (dmgEffKey in BUFF_META) ? sumBuff(buffs, dmgEffKey) : 0
  const dmgEffPhys = attackType === "Physical" ? sumBuff(buffs, "DamageEffectAttackPhysics") : 0
  const dmgEffMagic= attackType === "Magic"    ? sumBuff(buffs, "DamageEffectAttackMagic")   : 0
  const dmgEffTot  = dmgEffBuff + dmgEffPhys + dmgEffMagic
  const dmgEffMult = 1 + dmgEffTot / B
  const effATK     = effATK3 * dmgEffMult
  if (dmgEffTot !== 0)
    steps.push({ label: `${attackerElement}+ DMG %`, mult: dmgEffMult,
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
  const weakBoost      = sumBuff(buffs, "SpecialEffectWeakness")
  const superWeakBoost = sumBuff(buffs, "SpecialEffectSuperWeakness")
  const enhancedBonus  = baseRates.isEnhancedAttacker ? ENHANCE_ELEM_BONUS : 0
  let elemCoeff = 1
  if (rolls.weakness !== "normal") {
    const w = rolls.weakness
    if      (w === "weak")                elemCoeff = 1 + (WEAK_BONUS + weakBoost + enhancedBonus) / B
    else if (w === "super_weak")          elemCoeff = 1 + (WEAK_BONUS + SUPER_WEAK_BONUS + superWeakBoost + weakBoost + enhancedBonus) / B
    else if (w === "enhanced_weak")       elemCoeff = 1 + (WEAK_BONUS + ENHANCE_ELEM_BONUS + weakBoost + enhancedBonus) / B
    else if (w === "enhanced_super_weak") elemCoeff = 1 + (WEAK_BONUS + SUPER_WEAK_BONUS + ENHANCE_ELEM_BONUS + superWeakBoost + weakBoost + enhancedBonus) / B
    steps.push({ label: w.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      mult: elemCoeff, note: `x${elemCoeff.toFixed(3)}` })
  }

  // ── Step 9: "Damage to X enemies" (SpecialEffectElement) ─────────────────────
  const specElemKey = enemyElement ? `SpecialEffectElement${enemyElement}` as BuffType : null
  const specElemBuff = specElemKey && (specElemKey in BUFF_META) ? sumBuff(buffs, specElemKey) : 0
  const specElemMult = 1 + specElemBuff / B
  if (specElemBuff !== 0)
    steps.push({ label: `DMG vs ${enemyElement}`, mult: specElemMult,
      note: `SpecialEffectElement ${enemyElement} +${(specElemBuff/100).toFixed(1)}%` })

  // ── Step 10: Drago condition (x2.0 est.) ─────────────────────────────────────
  const dragoMult = rolls.drago ? 2.0 : 1.0
  if (rolls.drago)
    steps.push({ label: "Drago", mult: dragoMult, note: "Drago condition (x2.0 est.)" })

  // ── Step 11: Enemy Damage Taken (Dread / debuffs) ────────────────────────────
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

  const totalMult = skillMult * socoMult * critMult * coopMult * defCritMult * elemCoeff * specElemMult * dragoMult * damageTakenMult * specialResistMult
  return {
    steps,
    totalMult,
    rawDamage: preMultDamage !== null
      ? preMultDamage * socoMult * critMult * coopMult * defCritMult * elemCoeff * specElemMult * dragoMult * damageTakenMult * specialResistMult
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
    return list.slice(0, 60)
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl bg-gray-900 border border-gray-600 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
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
    if (!lq) return uniqueAvatars.slice(0, 80)
    return uniqueAvatars.filter(e =>
      e.name.toLowerCase().includes(lq) ||
      (e.affiliation_name?.toLowerCase() ?? "").includes(lq) ||
      e.avatar_name.toLowerCase().includes(lq)
    ).slice(0, 80)
  }, [uniqueAvatars, q])

  const tierOptions = useMemo(() =>
    tierAvatar ? enemies.filter(e => e.avatar_name === tierAvatar).sort((a, b) => a.hp - b.hp) : [],
    [enemies, tierAvatar]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
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
  skill, isActive, isDamageSelected, isDisabled = false, slotBadge, tooltipNote, onHoverChange, onToggle, onSelectDamage,
}: {
  skill: WikiSkill; isActive: boolean; isDamageSelected: boolean
  isDisabled?: boolean; slotBadge?: string; tooltipNote?: string
  onHoverChange?: (payload: { skill: WikiSkill; tooltipNote?: string; rect: DOMRect } | null) => void
  onToggle?: () => void; onSelectDamage?: () => void
}) {
  const isDamageSkill = skill.slot === "special_skill" || skill.kind === "special"
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
    </div>
  )
}

// ─── Char Info Panel ──────────────────────────────────────────────────────────
function CharInfoPanel({
  char, activeBuffs, onClose,
}: { char: WikiCharacter; activeBuffs: BuffEntry[]; onClose: () => void }) {
  const charBuffs = activeBuffs.filter(b => b.value !== 0 && b.source.startsWith(`${char.name} - `))
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
        {[{ label: "HP", val: char.stats.hp.toLocaleString() },
          { label: "ATK", val: char.stats.attack.toLocaleString() },
          { label: "DEF", val: char.stats.defense.toLocaleString() }].map(({ label, val }) => (
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
                    {BUFF_META[b.type]?.label} {b.value >= 0 ? "+" : ""}{(b.value/100).toFixed(1)}%
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
                    <span className="font-semibold text-red-200">{BUFF_META[b.type]?.label} {b.value >= 0 ? "+" : ""}{(b.value/100).toFixed(1)}%</span>
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
  slot, slotIdx, onClose, onRatesChange, onAtkChange,
}: {
  slot: { char: WikiCharacter | null; atkOverride: string; rates: BaseRates }
  slotIdx: number
  onClose: () => void
  onRatesChange: (rates: BaseRates) => void
  onAtkChange: (v: string) => void
}) {
  const { char, atkOverride, rates } = slot
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl p-5 shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
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
          <div className="flex items-center gap-2">
            <label className="text-gray-300 text-sm w-32 font-medium">ATK Override</label>
            <input type="number" value={atkOverride}
              onChange={e => onAtkChange(e.target.value)}
              placeholder={char ? String(char.stats.attack) : "0"}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            {atkOverride && <button onClick={() => onAtkChange("")} className="text-gray-600 hover:text-red-400"><X className="w-3 h-3" /></button>}
          </div>
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
export function BattleSim({
  characters, enemies,
}: { characters: WikiCharacter[]; enemies: WikiEnemy[] }) {

  // Team state
  const DEFAULT_RATES: BaseRates = {
    probCritical: 0, probPenetration: 0, probCooperation: 0, probDefcritical: 0,
    probCriticalSuper: 0, probPenetrationSuper: 0, probCooperationSuper: 0,
    isEnhancedAttacker: false,
  }
  const [attackerSlots, setAttackerSlots] = useState<Array<{ char: WikiCharacter | null; atkOverride: string; rates: BaseRates }>>(
    Array.from({ length: 5 }, () => ({ char: null, atkOverride: "", rates: DEFAULT_RATES }))
  )
  const [attackerActiveSkills, setAttackerActiveSkills] = useState<Set<string>[]>(
    Array.from({ length: 5 }, () => new Set<string>())
  )
  const [mainProtector, setMainProtector] = useState<WikiCharacter | null>(null)
  const [subProtector,  setSubProtector]  = useState<WikiCharacter | null>(null)
  const [protSkillToggles, setProtSkillToggles] = useState<Record<string, boolean>>({})

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
  const [rolls, setRolls] = useState<ProcRolls>({
    critical: false, superCritical: false, penetration: false, superPenetration: false,
    cooperation: false, superCooperation: false, defCritical: false,
    drago: false, soco: "none", weakness: "normal",
  })

  // Derived: protector buffs
  const protectorBuffs = useMemo<BuffEntry[]>(() => {
    const result: BuffEntry[] = []
    function add(char: WikiCharacter, slot: string, alwaysOn: boolean) {
      const skill = char.skills.find(s => s.slot === slot)
      if (!skill) return
      const id = `${char.master_pc_id}_${slot}`
      if (!alwaysOn && !(protSkillToggles[id] ?? true)) return
      parseSkillBuffs(skill.description_max_level).forEach((pb, i) =>
        result.push({ id: `${id}_${i}`, type: pb.type, value: pb.value, source: `${char.name} - ${skill.name}`, skillId: id }))
    }
    if (mainProtector) { add(mainProtector, "leader_skill", false); add(mainProtector, "bless_skill", false) }
    if (subProtector)  add(subProtector, "assist_leader_skill", true)
    return result
  }, [mainProtector, subProtector, protSkillToggles])

  // Derived: attacker active-skill buffs
  const attackerBuffs = useMemo<BuffEntry[]>(() => {
    const result: BuffEntry[] = []
    attackerSlots.forEach((slot, si) => {
      if (!slot.char) return
      const active = attackerActiveSkills[si]
      slot.char.skills.forEach(s => {
        if (!["active_skill_1", "active_skill_2", "active_skill_3"].includes(s.slot)) return
        if (!active.has(s.label)) return
        parseSkillBuffs(s.description_max_level).forEach((pb, i) =>
          result.push({ id: `att_${si}_${s.label}_${i}`, type: pb.type, value: pb.value, source: `${slot.char!.name} - ${s.name}`, skillId: s.label }))
      })
    })
    return result
  }, [attackerSlots, attackerActiveSkills])

  const allBuffs = useMemo(() => [...protectorBuffs, ...attackerBuffs], [protectorBuffs, attackerBuffs])

  const enemyDebuffs = useMemo(() => allBuffs.filter(b =>
    (b.type === "DamageTaken" && b.value > 0) ||
    (b.type === "DamageResistSpecial" && b.value < 0) ||
    (b.type === "Defense" && b.value < 0) ||
    (b.type === "ResistAttackPhysics" && b.value < 0) ||
    (b.type === "ResistAttackMagic" && b.value < 0) ||
    (b.type === "ResistCritical" && b.value < 0) ||
    (b.type === "ResistPenetration" && b.value < 0) ||
    (b.type === "ResistCooperation" && b.value < 0) ||
    (b.type === "ResistDefcritical" && b.value < 0)
  ), [allBuffs])

  // Derived calc values
  const calcSlot  = attackerSlots[calcSlotIdx]
  const calcChar  = calcSlot?.char ?? null
  const baseATK   = parseInt(calcSlot?.atkOverride || "") || calcChar?.stats.attack || 0
  const baseDEF   = parseInt(enemyDefOverride || String(selectedEnemy?.defense ?? 0)) || 0
  const baseRates = attackerSlots[calcSlotIdx].rates

  // Auto-detect weakness from enemy element resist vs attacker element
  const autoWeakness = useMemo((): ElementWeakness => {
    if (!selectedEnemy || !calcChar) return "normal"
    const elemResist = getEnemyElemResist(selectedEnemy, calcChar.element)
    if (elemResist >= 0) return "normal"
    return attackerSlots[calcSlotIdx].rates.isEnhancedAttacker ? "enhanced_weak" : "weak"
  }, [selectedEnemy, calcChar, attackerSlots, calcSlotIdx])

  // Auto-detect Drago from any active attacker skill description
  const autoDrago = useMemo(() => {
    return attackerSlots.some((slot, si) => {
      if (!slot.char) return false
      return slot.char.skills.some(s => {
        if (!["active_skill_1","active_skill_2","active_skill_3"].includes(s.slot)) return false
        if (!attackerActiveSkills[si].has(s.label)) return false
        return /drago/i.test(s.description_max_level ?? "")
      })
    })
  }, [attackerSlots, attackerActiveSkills])

  const effectiveRolls = useMemo<ProcRolls>(() => ({
    ...rolls,
    weakness: autoWeakness,
    drago: autoDrago,
  }), [rolls, autoWeakness, autoDrago])

  const calcCharsSkills = useMemo(() => {
    if (!calcChar) return []
    return calcChar.skills.filter(s =>
      ["special_skill", "active_skill_1", "active_skill_2", "active_skill_3"].includes(s.slot))
  }, [calcChar])

  const calcSkill = useMemo(() =>
    calcCharsSkills.find(s => s.label === calcSkillLabel) ??
    calcCharsSkills.find(s => s.slot === "special_skill") ?? null,
    [calcCharsSkills, calcSkillLabel]
  )

  const parsedRate  = calcSkill ? (parseSkillDamageRate(calcSkill.description_max_level) ?? 0) : 0
  const skillRate   = parsedRate || 0
  const attackType: "Physical" | "Magic" = calcChar?.attack_type === "Physical" ? "Physical" : "Magic"

  const calcResult = useMemo(() => {
    if (!skillRate || !baseATK) return null
    const attackerElement = calcChar?.element ?? "Fire"
    return runCalc(baseATK, baseDEF || 1, skillRate, attackType, attackerElement, allBuffs, effectiveRolls, baseRates, selectedEnemy?.element, selectedEnemy)
  }, [baseATK, baseDEF, skillRate, attackType, calcChar?.element, allBuffs, effectiveRolls, baseRates, selectedEnemy?.element, selectedEnemy])

  function rerollProcs() {
    const rates = computeProcRates(allBuffs, baseRates)
    setRolls(prev => rollProcs(rates, prev))
  }

  // Helpers
  function toggleProtSkill(id: string) {
    setProtSkillToggles(prev => ({ ...prev, [id]: !(prev[id] ?? true) }))
  }
  function toggleAttackerSkill(slotIdx: number, label: string) {
    setAttackerActiveSkills(prev => {
      const next = prev.map((s, i) => i === slotIdx ? new Set(s) : s)
      if (next[slotIdx].has(label)) {
        next[slotIdx].delete(label)
        return next
      }
      const char = attackerSlots[slotIdx]?.char
      const skill = char?.skills.find(s => s.label === label)
      if (skill?.slot && skill.slot.startsWith("active_skill_")) {
        char?.skills.forEach(s => {
          if (s.slot === skill.slot) next[slotIdx].delete(s.label)
        })
      }
      next[slotIdx].add(label)
      return next
    })
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
        if (["active_skill_1", "active_skill_2", "active_skill_3", "special_skill"].includes(s.slot)) {
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
    type Item = { skill: WikiSkill; char: WikiCharacter; isAlwaysOn: boolean }
    const items: Item[] = []
    if (mainProtector) {
      mainProtector.skills.forEach(s => {
        if (["leader_skill", "bless_skill"].includes(s.slot))
          items.push({ skill: s, char: mainProtector, isAlwaysOn: false })
      })
    }
    if (subProtector) {
      subProtector.skills.forEach(s => {
        if (s.slot === "assist_leader_skill")
          items.push({ skill: s, char: subProtector, isAlwaysOn: true })
      })
    }
    return items
  }, [mainProtector, subProtector])


  return (
    <div className="min-h-screen bg-[#111827] text-white">
      {/* Header bar */}
      <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-2 flex items-center gap-3">
        <span className="text-gray-400 text-xs font-bold">Battle Simulator</span>
        <span className="text-gray-600 text-xs ml-auto hidden md:block">Configure team, select enemy, then click a special skill to calculate</span>
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
                      onChange={c => setAttackerSlots(prev => prev.map((x, j) => j === i ? { ...x, char: c, atkOverride: "" } : x))}
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
                        onChange={c => { if (side === "main") { setMainProtector(c); setProtSkillToggles({}) } else setSubProtector(c) }}
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
              {parsedRate > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 bg-gray-800 text-gray-300">
                  Skill Rate {parsedRate}%
                </span>
              )}
              {autoDrago && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-700 text-amber-300">⚡ Drago (auto)</span>
              )}
              {autoWeakness !== "normal" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-900/60 border border-orange-700 text-orange-300">▼ {autoWeakness.replace(/_/g, " ")} (auto)</span>
              )}
            </div>
            <div className="text-[10px] text-gray-600 uppercase tracking-wide">
              Active Effects {allBuffs.length > 0 ? `(${allBuffs.length})` : ""}
            </div>
            {allBuffs.length > 0 ? (
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {allBuffs.map(b => (
                  <div key={b.id} className="flex items-center gap-2 text-xs">
                    <span className={`font-mono w-14 text-right shrink-0 ${b.value >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {b.value >= 0 ? "+" : ""}{(b.value/100).toFixed(1)}%
                    </span>
                    <span className="text-gray-300 flex-1 truncate">{BUFF_META[b.type]?.label}</span>
                    <span className="text-gray-600 text-[10px] truncate max-w-[8rem]">{b.source}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-700 italic">No active effects — toggle skills below</p>
            )}
          </div>
          {/* Skill bar */}
          <div className="border-t border-gray-800 bg-gray-900/70 p-3">
            <div className="flex items-end gap-2 overflow-x-auto overflow-y-visible pt-2 pb-3">
              {/* Protector skills */}
              {protSkillItems.map(({ skill, char, isAlwaysOn }) => {
                const id = `${char.master_pc_id}_${skill.slot}`
                const active = isAlwaysOn || (protSkillToggles[id] ?? true)
                return (
                  <SkillBubble key={skill.label} skill={skill} isActive={active} isDamageSelected={false}
                    onHoverChange={payload => setHoveredSkill(payload ? { ...payload, viewportWidth: window.innerWidth } : null)}
                    onToggle={isAlwaysOn ? undefined : () => toggleProtSkill(id)} />
                )
              })}

              {/* Attacker skills */}
              {skillBarItems.map(({ skill, slotIdx, variantCount, slotBadge }) => {
                const isDmg = skill.slot === "special_skill"
                const isSelected = isDmg
                  ? slotIdx === calcSlotIdx && (calcSkillLabel === skill.label || (!calcSkillLabel && skill.slot === "special_skill"))
                  : false
                const isActive = isDmg ? isSelected : attackerActiveSkills[slotIdx].has(skill.label)
                const isVariantLocked = !isDmg && variantCount > 1 && attackerSlots[slotIdx]?.char?.skills.some(s =>
                  s.slot === skill.slot && s.label !== skill.label && attackerActiveSkills[slotIdx].has(s.label)
                )
                return (
                  <SkillBubble key={`${slotIdx}_${skill.label}`} skill={skill}
                    isActive={isActive} isDamageSelected={isDmg && isSelected}
                    isDisabled={isVariantLocked}
                    slotBadge={slotBadge}
                    tooltipNote={isVariantLocked ? `Disabled because another ${skill.slot.replaceAll("_", " ")} variant is active.` : variantCount > 1 ? `This slot has ${variantCount} alternate versions. Only one can be active.` : undefined}
                    onHoverChange={payload => setHoveredSkill(payload ? { ...payload, viewportWidth: window.innerWidth } : null)}
                    onToggle={isDmg ? undefined : () => toggleAttackerSkill(slotIdx, skill.label)}
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
                <CharInfoPanel char={inspectedChar} activeBuffs={allBuffs} onClose={() => setInspecting(null)} />
              )}
              {inspecting.kind === "prot" && inspectedChar && (
                <div className="space-y-3 h-full overflow-y-auto">
                  <CharInfoPanel char={inspectedChar} activeBuffs={allBuffs} onClose={() => setInspecting(null)} />
                  <div className="space-y-2">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide px-1">Skill Toggles</div>
                    {inspectedChar.skills
                      .filter(s => ["leader_skill", "bless_skill", "assist_leader_skill"].includes(s.slot))
                      .map(s => {
                        const id = `${inspectedChar.master_pc_id}_${s.slot}`
                        const isAlwaysOn = s.slot === "assist_leader_skill"
                        const active = isAlwaysOn || (protSkillToggles[id] ?? true)
                        return (
                          <label key={s.label}
                            className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${active ? "border-blue-700 bg-blue-950/30" : "border-gray-800 bg-gray-900/30"}`}>
                            <input type="checkbox" checked={active} onChange={() => !isAlwaysOn && toggleProtSkill(id)}
                              disabled={isAlwaysOn} className="mt-0.5 accent-blue-500 shrink-0" />
                            {s.icon_path && <img src={toPublicAssetPath(s.icon_path)} alt="" className="w-5 h-5 object-contain rounded shrink-0"
                              onError={e => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />}
                            <div>
                              <div className="font-semibold text-white">{s.name}</div>
                              <div className="text-gray-500 text-[10px] mt-0.5">{stripColorTags(s.description_max_level ?? "").slice(0, 120)}</div>
                            </div>
                          </label>
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
          onAtkChange={v => setAttackerSlots(prev => prev.map((x, i) => i === statModalSlot ? { ...x, atkOverride: v } : x))}
          onRatesChange={rates => setAttackerSlots(prev => prev.map((x, i) => i === statModalSlot ? { ...x, rates } : x))}
        />
      )}
    </div>
  )
}
