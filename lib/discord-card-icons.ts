// Resolves the exact icon paths the characters-page card shows for a character,
// so the Discord bot's header matches the site. Logic mirrors
// components/character-browser.tsx (getCharacterElementIcons + the card's
// first/second icon slots) and getCharacterVisualTier from lib/pc-wiki.
//
// Returns *public icon paths*; the bot maps each path's basename to an uploaded
// app emoji (lib/discord-emojis.json) and falls back to text when none exists.
import maps from "./discord-card-icon-maps.json"
import { normalizeLabel, getCharacterVisualTier, type WikiCharacter } from "./pc-wiki"

type Dict = Record<string, string>
const elementIconMap = maps.elementIconMap as Dict
const defenderBlessIconMap = maps.defenderBlessIconMap as Dict
const attackerElementIconMap = maps.attackerElementIconMap as Dict
const attackTypeIconMap = maps.attackTypeIconMap as Dict
const weaponIconMap = maps.weaponIconMap as Dict
const tacticsIconMap = maps.tacticsIconMap as Dict
const starAssetMap = maps.starAssetMap as Dict

const baseElementKeys = new Set(["air", "dark", "earth", "fire", "holy", "water", "wind"])
const hiddenElementKeys = new Set(["none", "specialeffectelementnone"])
const specialEffectToBase: Dict = {
  all: "Earth", special: "Air",
  specialeffectelementearth: "Earth", specialeffectelementair: "Air", specialeffectelementwind: "Wind",
  specialeffectelementwater: "Water", specialeffectelementfire: "Fire", specialeffectelementholy: "Holy",
  specialeffectelementdark: "Dark", specialeffectelementenhancedearth: "EnhancedEarth",
  specialeffectelementenhancedair: "EnhancedAir", specialeffectelementenhancedwind: "EnhancedWind",
  specialeffectelementenhancedwater: "EnhancedWater", specialeffectelementenhancedfire: "EnhancedFire",
  specialeffectelementenhancedholy: "EnhancedHoly", specialeffectelementenhanceddark: "EnhancedDark",
}
const toEnhanced = (v: string) => `Enhanced${v.charAt(0).toUpperCase()}${v.slice(1)}`

// A character is an "attacker" if it's an Attacker role or has a Secret (special)
// skill; a "protector" is a Supporter without one. (Matches character-browser.)
function hasSpecial(c: WikiCharacter) {
  return (c.skills || []).some((s) => s.slot === "special_skill" && s.kind === "special")
}
function isProtector(c: WikiCharacter) {
  return c.character_role === "Supporter" && !hasSpecial(c)
}
function isAttacker(c: WikiCharacter) {
  return c.character_role === "Attacker" || hasSpecial(c)
}
const isExUnbound = (c: WikiCharacter) => /Enhanced/i.test(c.element || "")

// Defender elements: the character's own element (base / specialeffect key) plus
// the canonical master_leader_skill_element_type_2 (1 or 2 values).
function defenderValues(c: WikiCharacter): string[] {
  if (!isProtector(c)) return [normalizeLabel(c.element)]
  const n = normalizeLabel(c.element)
  const vals: string[] = []
  if (n.startsWith("specialeffectelement")) vals.push(n)
  else if (baseElementKeys.has(n)) vals.push(n)
  else if (n === "physics" || n === "magic") vals.push(n)
  const s2 = (c as unknown as { master_leader_skill_element_type_2?: string }).master_leader_skill_element_type_2
  if (s2) {
    const k = normalizeLabel(s2)
    if (k && k !== "none" && !vals.includes(k)) vals.push(k)
  }
  if (vals.length === 0 && n && n !== "none") vals.push(n)
  return vals
}

function characterElementValue(c: WikiCharacter): string {
  if (isProtector(c)) return defenderValues(c)[0]
  const n = normalizeLabel(c.element)
  const bfs = specialEffectToBase[n]
  if (isAttacker(c) && bfs) {
    const bn = normalizeLabel(bfs)
    if (baseElementKeys.has(bn) && isExUnbound(c)) return toEnhanced(bn)
    return bfs
  }
  if (isAttacker(c) && baseElementKeys.has(n) && isExUnbound(c)) return toEnhanced(n)
  return c.element
}

const elemIcon = (v: string) => (hiddenElementKeys.has(normalizeLabel(v)) ? undefined : elementIconMap[normalizeLabel(v)])
const attackerIcon = (v: string) => (hiddenElementKeys.has(normalizeLabel(v)) ? undefined : attackerElementIconMap[normalizeLabel(v)])

function characterElementIcons(c: WikiCharacter): string[] {
  if (isProtector(c)) {
    return defenderValues(c)
      .map((v) => defenderBlessIconMap[v] ?? elementIconMap[v])
      .filter(Boolean) as string[]
  }
  const v = characterElementValue(c)
  const icon = isAttacker(c) ? attackerIcon(v) : elemIcon(v)
  return icon ? [icon] : []
}

// The 1–2 element/attack icons the card shows: attacker → element + attack-type;
// protector → up to two defender-element icons; otherwise → one element icon; or
// none (hidden element). Mirrors the card's firstIcon/secondIcon slots.
function elementAttackIcons(c: WikiCharacter): string[] {
  const els = characterElementIcons(c)
  if (isAttacker(c)) return [els[0], attackTypeIconMap[normalizeLabel(c.attack_type)]].filter(Boolean) as string[]
  return [els[0], els[1]].filter(Boolean) as string[]
}

export type HeaderIcons = {
  star: string | null
  elementAttack: string[]
  weapon: string | null
  tactics: string | null
}

export function getHeaderIcons(c: WikiCharacter): HeaderIcons {
  return {
    star: starAssetMap[String(getCharacterVisualTier(c))] ?? null,
    elementAttack: elementAttackIcons(c),
    weapon: c.weapon_type ? weaponIconMap[normalizeLabel(c.weapon_type)] ?? null : null,
    tactics: c.tactics_type ? tacticsIconMap[normalizeLabel(c.tactics_type)] ?? null : null,
  }
}

// Every distinct icon path the header can emit (for the emoji uploader).
export function allHeaderIconPaths(): string[] {
  const set = new Set<string>()
  for (const m of [elementIconMap, defenderBlessIconMap, attackerElementIconMap, attackTypeIconMap, weaponIconMap, tacticsIconMap, starAssetMap]) {
    for (const v of Object.values(m)) set.add(v)
  }
  return [...set]
}
