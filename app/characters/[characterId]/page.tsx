import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TraitList } from "@/components/trait-list"
import { SkillList } from "@/components/skill-list"
import {
  type WikiCharacter,
  type CharacterVariant,
  formatWikiLabel,
  getCharacterForceEntries,
  getCharacterRarityLabel,
  getCharacterVariants,
  getCharacterVisualTier,
  getDisplayElementLabel,
  getDisplayReleaseDate,
  getForceIconLookup,
  getGlobalStatMaxes,
  getWikiCharacterById,
  isExUnboundCharacter,
  normalizeLabel,
  stripColorTags,
  toPublicAssetPath,
} from "@/lib/pc-wiki"

/* ── Attacker element icons (same as character-browser attackerElementIconMap) ── */
const attackerElementIconMap: Record<string, string> = {
  air: "/elements/icElementspace.png",
  dark: "/elements/icElementDark.png",
  earth: "/elements/icElementEarth.png",
  enhancedair: "/elements/Enhancedspace.png",
  enhanceddark: "/elements/Enhanceddark.png",
  enhancedearth: "/elements/Enhancedearth.png",
  enhancedfire: "/elements/Enhancedfire.png",
  enhancedholy: "/elements/Enhancedlight.png",
  enhancedwater: "/elements/Enhancedwater.png",
  enhancedwind: "/elements/Enhancedwind.png",
  fire: "/elements/icElementFire.png",
  holy: "/elements/icElementlight.png",
  water: "/elements/icElementWater.png",
  wind: "/elements/icElementWind.png",
}

/* ── Protector / defender element icons ── */
const defenderBaseElementIconMap: Record<string, string> = {
  air: "/Image/IcElementBless/IcElementBlessAir.png",
  dark: "/Image/IcElementBless/IcElementBlessDark.png",
  earth: "/Image/IcElementBless/IcElementBlessEarth.png",
  fire: "/Image/IcElementBless/IcElementBlessFire.png",
  holy: "/Image/IcElementBless/IcElementBlessHoly.png",
  water: "/Image/IcElementBless/IcElementBlessWater.png",
  wind: "/Image/IcElementBless/IcElementBlessWind.png",
}

const defenderAntiElementIconMap: Record<string, string> = {
  fire: "/elements/Anti-Fire.png",
  water: "/elements/Anti-Water.png",
  earth: "/elements/Anti-Earth.png",
  air: "/elements/Anti-Space.png",
  wind: "/elements/Anti-Wind.png",
  dark: "/elements/Anti-Dark.png",
  holy: "/elements/Anti-Light.png",
}

const defenderAntiExElementIconMap: Record<string, string> = {
  fire: "/elements/anti_fire_attribute_unbound.png",
  water: "/elements/anti_water_attribute_unbound.png",
  earth: "/elements/anti_earth_attribute_unbound.png",
  air: "/elements/anti_space_attribute_unbound.png",
  wind: "/elements/anti_wind_attribute_unbound.png",
  dark: "/elements/anti_dark_attribute_unbound.png",
  holy: "/elements/anti_light_attribute_unbound.png",
}

const defenderGenericIconMap: Record<string, string> = {
  all: "/Image/IcElementBless/IcElementBlessAll.png",
  physics: "/Image/IcElementBless/IcElementBlessPhysics.png",
  magic: "/Image/IcElementBless/IcElementBlessMagic.png",
  specialeffectelementair: "/Image/IcElementBless/IcElementBlessSpecialEffectElementAir.png",
  specialeffectelementdark: "/Image/IcElementBless/IcElementBlessSpecialEffectElementDark.png",
  specialeffectelementearth: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEarth.png",
  specialeffectelementfire: "/Image/IcElementBless/IcElementBlessSpecialEffectElementFire.png",
  specialeffectelementholy: "/Image/IcElementBless/IcElementBlessSpecialEffectElementHoly.png",
  specialeffectelementwater: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWater.png",
  specialeffectelementwind: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWind.png",
  specialeffectelementenhancedair: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedAir.png",
  specialeffectelementenhanceddark: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedDark.png",
  specialeffectelementenhancedearth: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedEarth.png",
  specialeffectelementenhancedfire: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedFire.png",
  specialeffectelementenhancedholy: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedHoly.png",
  specialeffectelementenhancedwater: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWater.png",
  specialeffectelementenhancedwind: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWind.png",
}

const attackTypeIconMap: Record<string, string> = {
  magic: "/type_dmg/icAttackTypeMagic.png",
  physical: "/type_dmg/icAttackTypePhysics.png",
}

const tacticsIconMap: Record<string, string> = {
  charge: "/Image/Tactics/charge.png",
  defense: "/Image/Tactics/defense.png",
  normal: "/Image/Tactics/normal.png",
  speed: "/Image/Tactics/speed.png",
}

const weaponIconMap: Record<string, string> = {
  book: "/weapons/book.png",
  fist: "/weapons/fists.png",
  fists: "/weapons/fists.png",
  greatsword: "/weapons/greatsword.png",
  hammer: "/weapons/hammer.png",
  largesword: "/weapons/greatsword.png",
  katana: "/weapons/katana.png",
  knuckle: "/weapons/fists.png",
  spear: "/weapons/spear.png",
  sword: "/weapons/sword.png",
}

/* ── Map from SpecialEffectElement* → base element key ── */
const specialEffectToBase: Record<string, string> = {
  specialeffectelementearth: "earth",
  specialeffectelementair: "air",
  specialeffectelementwind: "wind",
  specialeffectelementwater: "water",
  specialeffectelementfire: "fire",
  specialeffectelementholy: "holy",
  specialeffectelementdark: "dark",
  specialeffectelementenhancedearth: "enhancedearth",
  specialeffectelementenhancedair: "enhancedair",
  specialeffectelementenhancedwind: "enhancedwind",
  specialeffectelementenhancedwater: "enhancedwater",
  specialeffectelementenhancedfire: "enhancedfire",
  specialeffectelementenhancedholy: "enhancedholy",
  specialeffectelementenhanceddark: "enhanceddark",
}

const baseElementKeys = new Set(["air", "dark", "earth", "fire", "holy", "water", "wind"])

const damageToAttributeElementMap: Record<string, string> = {
  fire: "fire", water: "water", earth: "earth", space: "air",
  wind: "wind", dark: "dark", light: "holy",
}

const leaderSkillDamageToAttributePattern = /to\s+(?:fire|water|earth|space|wind|dark|light)\s+attribute(?:\s+and\s+(?:fire|water|earth|space|wind|dark|light)\s+attribute)*\s+enemies/i

const leaderSkillElementPatterns: [RegExp, string][] = [
  [/increases?\s+fire\s+atk/i, "fire"],
  [/increases?\s+water\s+atk/i, "water"],
  [/increases?\s+earth\s+atk/i, "earth"],
  [/increases?\s+space\s+atk/i, "air"],
  [/increases?\s+wind\s+atk/i, "wind"],
  [/increases?\s+dark\s+atk/i, "dark"],
  [/increases?\s+light\s+atk/i, "holy"],
  [/increases?\s+p-atk/i, "physics"],
  [/physical characters'/i, "physics"],
  [/increases?\s+m-atk/i, "magic"],
  [/magic characters'/i, "magic"],
  [/all allies' atk/i, "all"],
]

/* ── Element icon for inline description rendering ── */
const inlineElementIconMap: Record<string, string> = {
  fire: "/elements/icElementFire.png",
  water: "/elements/icElementWater.png",
  earth: "/elements/icElementEarth.png",
  wind: "/elements/icElementWind.png",
  dark: "/elements/icElementDark.png",
  light: "/elements/icElementlight.png",
  holy: "/elements/icElementlight.png",
  space: "/elements/icElementspace.png",
  air: "/elements/icElementspace.png",
}

/* ── Star asset map (same as character-browser) ── */
const starAssetMap: Record<number, string> = {
  3: "/stars/starCharaL3A.png",
  4: "/stars/starCharaL4A.png",
  5: "/stars/starCharaL5A.png",
  6: "/stars/starCharaL6A.png",
  7: "/stars/starCharaL7A.png",
}

/* ── Helpers ── */

function isProtectorCharacter(character: WikiCharacter): boolean {
  return character.character_role === "Supporter" &&
    !character.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}

function isAttackerCharacter(character: WikiCharacter): boolean {
  if (character.character_role === "Attacker") return true
  return character.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}

type IconTag = { icon: string; label: string; href: string }

/** Build icon tags for an ATTACKER character → uses attacker element row */
function getAttackerIconTags(character: WikiCharacter): IconTag[] {
  const tags: IconTag[] = []
  const rawNorm = normalizeLabel(character.element)
  const baseKey = specialEffectToBase[rawNorm] ?? rawNorm
  const icon = attackerElementIconMap[baseKey]
  if (icon) {
    tags.push({ icon, label: getDisplayElementLabel(character.element), href: `/characters?attacker=${encodeURIComponent(baseKey)}` })
  }
  // Attack type
  const atkKey = normalizeLabel(character.attack_type)
  const atkIcon = attackTypeIconMap[atkKey]
  if (atkIcon) {
    tags.push({ icon: atkIcon, label: formatWikiLabel(character.attack_type), href: `/characters?type=${encodeURIComponent(atkKey)}` })
  }
  // Weapon
  const weapKey = normalizeLabel(character.weapon_type)
  const weapIcon = weaponIconMap[weapKey]
  if (weapIcon) {
    tags.push({ icon: weapIcon, label: formatWikiLabel(character.weapon_type), href: `/characters?weapon=${encodeURIComponent(weapKey)}` })
  }
  return tags
}

/* ── Protector type icons (physics / magic) ── */
const protectorTypeIconMap: Record<string, string> = {
  physics: "/type_dmg/prot_phys.png",
  magic: "/type_dmg/prot_magic.png",
}

/** Build icon tags for a PROTECTOR character — uses element field + leader skill */
function getProtectorIconTags(character: WikiCharacter): IconTag[] {
  const tags: IconTag[] = []
  const normalized = normalizeLabel(character.element)
  const seenDefenderKeys = new Set<string>()

  const leaderSkill = character.skills.find((s) => s.slot === "leader_skill")
  const desc = leaderSkill ? stripColorTags(leaderSkill.description_max_level ?? "") : ""

  // Categories 2 & 3: "to <element> attribute enemies"
  // Build one key per target element while preserving the category family.
  if (leaderSkillDamageToAttributePattern.test(desc)) {
    const dmgTargets = [...desc.matchAll(/(?:to|and)\s+(fire|water|earth|space|wind|dark|light)\s+attribute/gi)]
      .map((m) => normalizeLabel(damageToAttributeElementMap[m[1].toLowerCase()]))

    const isEnhancedSpecial = normalized.startsWith("specialeffectelementenhanced")
    const isSpecial = normalized.startsWith("specialeffectelement")

    for (const baseKey of dmgTargets) {
      const key = isEnhancedSpecial
        ? `specialeffectelementenhanced${baseKey}`
        : isSpecial
          ? `specialeffectelement${baseKey}`
          : baseKey

      const icon = defenderGenericIconMap[key] ?? defenderBaseElementIconMap[key]
      if (icon && !seenDefenderKeys.has(key)) {
        seenDefenderKeys.add(key)
        tags.push({
          icon,
          label: getDisplayElementLabel(key),
          href: `/characters?defender=${encodeURIComponent(key)}`,
        })
      }
    }
  } else {
    // Category 1: "increases <element> ATK" → IcElementBless base icons (can have multiple)
    for (const [pattern, value] of leaderSkillElementPatterns) {
      const key = normalizeLabel(value)
      if (pattern.test(desc) && baseElementKeys.has(key)) {
        const icon = defenderBaseElementIconMap[key]
        if (icon && !seenDefenderKeys.has(key)) {
          seenDefenderKeys.add(key)
          tags.push({
            icon,
            label: getDisplayElementLabel(value),
            href: `/characters?defender=${encodeURIComponent(key)}`,
          })
        }
      }
    }
  }

  // Non-element qualifiers (physics, magic, all, etc.) — always shown alongside
  for (const [pattern, value] of leaderSkillElementPatterns) {
    const key = normalizeLabel(value)
    if (pattern.test(desc) && !baseElementKeys.has(key)) {
      const icon = defenderGenericIconMap[key]
      if (icon && !seenDefenderKeys.has(key)) {
        seenDefenderKeys.add(key)
        tags.push({
          icon,
          label: getDisplayElementLabel(value),
          href: `/characters?defender=${encodeURIComponent(key)}`,
        })
      }
    }
  }

  // Fallback: raw element if nothing matched
  if (tags.length === 0) {
    const icon = defenderGenericIconMap[normalized] ?? defenderBaseElementIconMap[normalized]
    if (icon) {
      tags.push({
        icon,
        label: getDisplayElementLabel(character.element),
        href: `/characters?defender=${encodeURIComponent(normalized)}`,
      })
    }
  }

  return tags
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-[0_0_24px_rgba(255,255,255,0.08)]">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-gray-400">{title}</p>
      </div>
      {children}
    </section>
  )
}

function StatBar({ label, value, max, icon, color }: { label: string; value: number; max: number; icon: string; color: string }) {
  const percent = Math.round((value / max) * 100)
  return (
    <div className="flex items-center gap-3">
      <img src={icon} alt={label} className="h-7 w-7 shrink-0 object-contain" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</span>
          <span className="text-sm font-bold text-white">{value}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-gray-700/60">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}
          />
        </div>
      </div>
    </div>
  )
}

function FilterTag({ label, href, icon }: { label: string; href: string; icon?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white"
    >
      {icon && <img src={icon} alt="" className="h-4 w-4 shrink-0 object-contain" />}
      {label}
    </Link>
  )
}

function IconFilterTag({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      title={label}
      className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-2 transition-all hover:border-white/25 hover:bg-white/10"
    >
      <img src={icon} alt={label} className="h-7 w-auto object-contain" />
    </Link>
  )
}

/* ── Skill description rendering ── */

/** Stat-keyword → icon path mapping for inline rendering */
const statIconMap: Record<string, string> = {
  hp: "/stats/hp.png",
  atk: "/stats/attack.png",
  def: "/stats/defense.png",
}

const atkTypeIconMap: Record<string, string> = {
  "p-": "/type_dmg/icAttackTypePhysics.png",
  "m-": "/type_dmg/icAttackTypeMagic.png",
}

type DescSegment =
  | { type: "text"; text: string }
  | { type: "value"; text: string }
  | { type: "force"; text: string; icon?: string }
  | { type: "element"; element: string; icon: string }
  | { type: "stat"; text: string; icon: string }
  | { type: "atktype"; prefix: string; prefixIcon: string; stat: string; statIcon: string }
  | { type: "badge"; text: string }
  | { type: "note"; text: string }

/** Build a force icon lookup once per render */
function getForceIconMap(): Map<string, string> {
  const lookup = getForceIconLookup()
  const result = new Map<string, string>()
  for (const [name, iconPath] of lookup) {
    result.set(name, toPublicAssetPath(iconPath))
  }
  return result
}

let cachedForceIcons: Map<string, string> | null = null
function forceIcons(): Map<string, string> {
  if (!cachedForceIcons) cachedForceIcons = getForceIconMap()
  return cachedForceIcons
}

/** Parse plain text for stat terms (P-ATK, M-ATK, ATK, DEF, HP) and element names */
function parseStatAndElementTokens(text: string): DescSegment[] {
  const segments: DescSegment[] = []
  // Combined regex: P-ATK, M-ATK, ATK, DEF, HP, element names.
  // Elements only match when followed by "attribute" or a stat keyword (ATK/DEF),
  // so standalone uses like "Water Dragon Resonance" or "water Seeking Souls" are ignored.
  const tokenPattern = /\b([PM]-)?(ATK|DEF|HP)\b|\b(fire|water|earth|wind|dark|light|holy|space)(?=\s+(?:attribute\b|(?:[PM]-)?(?:ATK|DEF)\b))/gi
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = tokenPattern.exec(text)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ type: "text", text: text.slice(lastIdx, m.index) })
    }
    if (m[2]) {
      // Stat term: ATK, DEF, HP (possibly with P- or M- prefix)
      const prefix = m[1]?.toUpperCase() ?? null
      const stat = m[2].toUpperCase()
      const statIcon = statIconMap[stat.toLowerCase()]
      if (prefix && atkTypeIconMap[prefix.toLowerCase()]) {
        segments.push({
          type: "atktype",
          prefix,
          prefixIcon: atkTypeIconMap[prefix.toLowerCase()],
          stat,
          statIcon: statIcon ?? "/stats/attack.png",
        })
      } else if (statIcon) {
        segments.push({ type: "stat", text: stat, icon: statIcon })
      } else {
        segments.push({ type: "text", text: m[0] })
      }
    } else if (m[3]) {
      // Element name
      const elKey = m[3].toLowerCase()
      const icon = inlineElementIconMap[elKey]
      if (icon) {
        segments.push({ type: "element", element: m[3], icon })
      } else {
        segments.push({ type: "text", text: m[3] })
      }
    }
    lastIdx = tokenPattern.lastIndex
  }
  if (lastIdx < text.length) {
    segments.push({ type: "text", text: text.slice(lastIdx) })
  }
  return segments
}

/** Parse plain text for badges and notes, then delegate to stat/element parsing */
function parseInlineTokens(text: string): DescSegment[] {
  const segments: DescSegment[] = []
  // Match: (Turns: N; ...), (Uses by this character per battle: N), Unlimited, (parenthetical notes)
  const badgePattern = /(\(Turns:\s*\d+[^)]*\)|\(Uses by this character per battle:\s*\d+\)|\bUnlimited\b|\([^)]{10,}\))/gi
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = badgePattern.exec(text)) !== null) {
    if (m.index > lastIdx) {
      segments.push(...parseStatAndElementTokens(text.slice(lastIdx, m.index)))
    }
    let badgeText = m[1]
    const isParenthetical = badgeText.startsWith("(") && badgeText.endsWith(")")
    if (isParenthetical) {
      badgeText = badgeText.slice(1, -1)
    }
    if (/^Turns:/i.test(badgeText) || /^Uses by/i.test(badgeText) || /^Unlimited$/i.test(badgeText)) {
      // Clean up "Turns: N" → "Turns N"
      badgeText = badgeText.replace(/^Turns:\s*/i, "Turns ")
      segments.push({ type: "badge", text: badgeText })
    } else if (isParenthetical) {
      // Parenthetical note like "(Cannot go below each skill's initial cost)"
      segments.push({ type: "note", text: badgeText })
    } else {
      segments.push({ type: "badge", text: badgeText })
    }
    lastIdx = badgePattern.lastIndex
  }
  if (lastIdx < text.length) {
    segments.push(...parseStatAndElementTokens(text.slice(lastIdx)))
  }
  return segments
}

/** Process a raw slice through color tags and inline tokens (no badge pre-extraction). */
function processColorText(raw: string): DescSegment[] {
  const segments: DescSegment[] = []
  const colorRegex = /<color=([^>]+)>(.*?)<\/color>/gi
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = colorRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...parseInlineTokens(raw.slice(lastIndex, match.index)))
    }
    const color = match[1].toLowerCase()
    const innerText = match[2]
    if (color === "#ffff00" || color === "yellow") {
      const icon = forceIcons().get(innerText)
      segments.push({ type: "force", text: innerText, icon })
    } else {
      segments.push({ type: "value", text: innerText })
    }
    lastIndex = colorRegex.lastIndex
  }
  if (lastIndex < raw.length) {
    segments.push(...parseInlineTokens(raw.slice(lastIndex)))
  }
  return segments
}

/** Parse a single line of description into rich segments */
function parseDescriptionLine(raw: string): DescSegment[] {
  const segments: DescSegment[] = []
  // Pre-extract badge regions before color tag processing so that badges like
  // "(Turns: 1; Damage Scaling: <color=...>100%</color>)" are handled correctly.
  // [^)]* safely spans color tags because <, > and = are not ).
  const badgePrePattern = /\((Turns:\s*\d+[^)]*|Uses by this character per battle:[^)]*?)\)/gi
  const badgeRegions: Array<{ start: number; end: number; text: string }> = []
  let bm: RegExpExecArray | null
  while ((bm = badgePrePattern.exec(raw)) !== null) {
    let inner = bm[1]
    inner = inner.replace(/<color=[^>]+>(.*?)<\/color>/gi, "$1")
    inner = inner.replace(/^Turns:\s*/i, "Turns ")
    badgeRegions.push({ start: bm.index, end: badgePrePattern.lastIndex, text: inner.trim() })
  }
  let pos = 0
  for (const region of badgeRegions) {
    if (region.start > pos) segments.push(...processColorText(raw.slice(pos, region.start)))
    segments.push({ type: "badge", text: region.text })
    pos = region.end
  }
  if (pos < raw.length) segments.push(...processColorText(raw.slice(pos)))
  return segments
}

function BadgeContent({ text }: { text: string }) {
  // Split "Turns 3" or "Turns 3; Uses by this character per battle: 2" into label + number(s)
  const turnsMatch = text.match(/^(Turns)\s+(\d+)(.*)$/)
  if (turnsMatch) {
    const remainder = turnsMatch[3] // e.g. "; Uses by this character per battle: 1"
    const usesInRemainder = remainder ? remainder.match(/^(.*?:\s*)(\d+%?)$/) : null
    return (
      <>
        <span className="px-2 py-0.5 text-gray-800">{turnsMatch[1]} </span>
        <span className="flex self-stretch items-center bg-gray-900 px-1.5 text-white">{turnsMatch[2]}</span>
        {remainder && usesInRemainder ? (
          <>
            <span className="px-2 py-0.5 text-gray-800">{usesInRemainder[1]}</span>
            <span className="flex self-stretch items-center bg-gray-900 px-1.5 text-white">{usesInRemainder[2]}</span>
          </>
        ) : remainder ? (
          <span className="px-2 py-0.5 text-gray-800">{remainder}</span>
        ) : null}
      </>
    )
  }
  const usesMatch = text.match(/^(Uses by this character per battle:\s*)(\d+)$/)
  if (usesMatch) {
    return (
      <>
        <span className="px-2 py-0.5 text-gray-800">{usesMatch[1]}</span>
        <span className="flex self-stretch items-center bg-gray-900 px-1.5 text-white">{usesMatch[2]}</span>
      </>
    )
  }
  return <span className="px-2 py-0.5 text-gray-800">{text}</span>
}

function RichDescription({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1.5 text-sm leading-7 text-gray-300 text-left">
      {lines.map((line, lineIndex) => {
        const segments = parseDescriptionLine(line)
        return (
          <p key={lineIndex}>
            {segments.map((seg, i) => {
              switch (seg.type) {
                case "value":
                  return (
                    <span key={i} className="font-bold text-white">
                      {seg.text}
                    </span>
                  )
                case "force":
                  return (
                    <Link key={i} href={`/characters?force=${encodeURIComponent(seg.text)}`}
                      className="mx-0.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-gray-300 align-middle transition-all hover:border-white/25 hover:bg-white/10 hover:text-white">
                      {seg.icon && <img src={seg.icon} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />}
                      {seg.text}
                    </Link>
                  )
                case "element":
                  return (
                    <span key={i} className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white align-middle shadow-[0_0_6px_rgba(255,255,255,0.15)]">
                      <img src={seg.icon} alt={seg.element} className="inline h-4 w-4 object-contain" />
                      {seg.element}
                    </span>
                  )
                case "stat":
                  return (
                    <span key={i} className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white align-middle shadow-[0_0_6px_rgba(255,255,255,0.15)]">
                      <img src={seg.icon} alt={seg.text} className="inline h-4 w-4 object-contain" />
                      {seg.text}
                    </span>
                  )
                case "atktype":
                  return (
                    <span key={i} className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white align-middle shadow-[0_0_6px_rgba(255,255,255,0.15)]">
                      <img src={seg.prefixIcon} alt={seg.prefix} className="inline h-4 w-4 object-contain" />
                      <span>{seg.prefix}</span>
                      <img src={seg.statIcon} alt={seg.stat} className="inline h-4 w-4 object-contain" />
                      <span>{seg.stat}</span>
                    </span>
                  )
                case "badge":
                  return (
                    <span key={i} className="mx-1 inline-flex items-center overflow-hidden rounded-full bg-gray-200 text-xs font-semibold align-middle">
                      <BadgeContent text={seg.text} />
                    </span>
                  )
                case "note":
                  return (
                    <span key={i} className="mx-1 inline-flex items-center rounded-md border border-gray-500 px-2 py-0.5 text-xs text-gray-400 align-middle">
                      {seg.text}
                    </span>
                  )
                default:
                  return <span key={i}>{seg.text}</span>
              }
            })}
          </p>
        )
      })}
    </div>
  )
}

export default async function CharacterDetailPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params
  const resolvedCharacter = getWikiCharacterById(Number(characterId))

  if (!resolvedCharacter) {
    notFound()
    return null
  }

  const character = resolvedCharacter
  const releaseDateLabel = getDisplayReleaseDate(character.release_date)
  const statMaxes = getGlobalStatMaxes()
  const forceEntries = getCharacterForceEntries(character)
  const isProtector = isProtectorCharacter(character)
  const hasExAbilities = character.ex_abilities.length > 0
  const tabCount = isProtector && !hasExAbilities ? 2 : 3
  const variants = getCharacterVariants(character)

  // Build the correct icon tags based on role
  const elementTags = isProtector ? getProtectorIconTags(character) : getAttackerIconTags(character)

  // Tactics icon — always present
  const tacticsKey = normalizeLabel(character.tactics_type || "Normal")
  const tacticsIcon = tacticsIconMap[tacticsKey]

  return (
    <main className="min-h-screen bg-[#111827] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/characters" className="inline-flex items-center gap-2 rounded-full border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700">
            <ArrowLeft className="h-4 w-4" />
            Back to characters
          </Link>
          <Badge className="bg-gray-700 text-white hover:bg-gray-700">#{character.master_pc_id}</Badge>
        </div>

        <section className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-[0_0_24px_rgba(255,255,255,0.08)]">
          <div className="grid gap-8 px-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
            <div className="space-y-5">
              <Badge className="bg-gray-700 text-white hover:bg-gray-700">{character.affiliation_name}</Badge>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{character.name}</h1>

              {/* Icon row: role-specific element icons + tactics — all clickable, selecting actual filter icons */}
              <div className="flex flex-wrap items-center gap-2">
                {elementTags.map((tag) => (
                  <IconFilterTag key={tag.label} href={tag.href} icon={tag.icon} label={tag.label} />
                ))}
                {tacticsIcon && (
                  <IconFilterTag href={`/characters?tactics=${encodeURIComponent(tacticsKey)}`} icon={tacticsIcon} label={character.tactics_type || "Normal"} />
                )}
              </div>

              {/* Stats with progress bars */}
              <div className="space-y-3 rounded-xl border border-gray-700 bg-gray-900/50 p-4">
                <StatBar label="Health" value={character.stats.hp} max={statMaxes.hp} icon="/stats/hp.png" color="#34d399" />
                <StatBar label="Attack" value={character.stats.attack} max={statMaxes.attack} icon="/stats/attack.png" color="#f87171" />
                <StatBar label="Defense" value={character.stats.defense} max={statMaxes.defense} icon="/stats/defense.png" color="#60a5fa" />
                <StatBar label="Existence" value={character.stats.existence} max={statMaxes.existence} icon="/stats/existence.png" color="#fbbf24" />
              </div>

              {/* Tags: facilities (select in Facilities dropdown), forces (select in Forces dropdown) */}
              <div className="flex flex-wrap gap-2">
                {character.facilities.map((facility) => (
                  <FilterTag key={facility} label={facility} href={`/characters?facility=${encodeURIComponent(facility)}`} />
                ))}
                {forceEntries.map((force) => (
                  <FilterTag key={force.name} label={force.name} href={`/characters?force=${encodeURIComponent(force.name)}`} icon={force.icon} />
                ))}
              </div>

              {releaseDateLabel ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-gray-700 px-4 py-2 text-sm text-white">
                  <CalendarDays className="h-4 w-4" />
                  <span>Released {releaseDateLabel}</span>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl bg-gray-900 p-4 shadow-inner">
              <img src={toPublicAssetPath(character.images.full)} alt={character.name} className="mx-auto h-full max-h-[480px] w-full object-contain" />
            </div>
          </div>
        </section>

        <DetailSection title="Combat Data">
          <Tabs defaultValue="skills" className="w-full">
            <TabsList className={`grid w-full ${tabCount === 2 ? "grid-cols-2" : "grid-cols-3"} bg-gray-900 text-white`}>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="traits">Traits</TabsTrigger>
              {tabCount === 3 && <TabsTrigger value="ex">EX Abilities</TabsTrigger>}
            </TabsList>
            <TabsContent value="skills" className="mt-6">
              <SkillList skills={character.skills} />
            </TabsContent>
            <TabsContent value="traits" className="mt-6">
              <TraitList traits={character.traits} />
            </TabsContent>
            {tabCount === 3 && (
              <TabsContent value="ex" className="mt-6">
                <div className="grid gap-4 lg:grid-cols-2">
                  {character.ex_abilities.map((ability) => (
                    <Card key={ability.name} className="rounded-2xl border-gray-600 bg-gray-700 shadow-none">
                          <CardContent className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 p-5 items-start">
                            {/* Mobile header: icon + title inline */}
                            <div className="flex items-center gap-4 sm:hidden">
                              {ability.name === "Individual Mercy" && (
                                <img src="/skills/e1.png" alt={ability.name} className="h-14 w-14 shrink-0 rounded-xl bg-gray-900 p-1.5 object-contain" />
                              )}
                              <div className="min-w-0">
                                <h3 className="text-base font-bold text-white">{ability.name}</h3>
                              </div>
                            </div>

                            {/* Desktop image column */}
                            {ability.name === "Individual Mercy" && (
                              <img src="/skills/e1.png" alt={ability.name} className="hidden sm:block h-14 w-14 shrink-0 rounded-xl bg-gray-900 p-1.5 object-contain" />
                            )}

                            {/* Desktop content column */}
                            <div className="hidden sm:block min-w-0 space-y-3">
                              <h3 className="text-base font-bold text-white">{ability.name}</h3>
                              <div className="mt-1 sm:mt-2">
                                <RichDescription text={ability.description} />
                              </div>
                              <ul className="space-y-2 text-sm text-gray-300">
                                {ability.effects.map((effect) => (
                                  <li key={effect} className="rounded-xl bg-gray-900 px-4 py-3">
                                    <RichDescription text={stripColorTags(effect)} />
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Mobile description: full width */}
                            <div className="sm:hidden mt-1">
                              <RichDescription text={ability.description} />
                              <ul className="space-y-2 text-sm text-gray-300 mt-3">
                                {ability.effects.map((effect) => (
                                  <li key={effect} className="rounded-xl bg-gray-900 px-4 py-3">
                                    <RichDescription text={stripColorTags(effect)} />
                                  </li>
                                ))}
                              </ul>
                            </div>
                        </CardContent>
                      </Card>
                  ))}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </DetailSection>

        {variants.length > 0 && (
          <DetailSection title={character.name}>
            <div className="flex flex-wrap gap-4">
              {variants.map((v) => {
                const elNorm = normalizeLabel(v.element)
                const baseKey = specialEffectToBase[elNorm] ?? elNorm
                const elIcon = attackerElementIconMap[baseKey]
                const starsSrc = starAssetMap[v.visual_tier] ?? starAssetMap[5]
                return (
                  <Link
                    key={v.master_pc_id}
                    href={`/characters/${v.master_pc_id}`}
                    className="group flex w-32 flex-col items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900/50 p-3 transition-all hover:border-gray-500 hover:bg-gray-700/50"
                  >
                    <div className="relative">
                      <img
                        src={toPublicAssetPath(v.icon)}
                        alt={v.affiliation_name}
                        className="h-20 w-20 rounded-lg object-contain"
                      />
                      {elIcon && (
                        <img src={elIcon} alt="" className="absolute -right-1.5 -top-1.5 h-5 w-5 object-contain drop-shadow" />
                      )}
                    </div>
                    <img src={starsSrc} alt="" className="h-4 object-contain drop-shadow" />
                    <span className="text-center text-[11px] font-medium leading-tight text-gray-400 group-hover:text-white">{v.affiliation_name}</span>
                  </Link>
                )
              })}
            </div>
          </DetailSection>
        )}
      </div>
    </main>
  )
}