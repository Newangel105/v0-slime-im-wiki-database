"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { type WikiSkill, toPublicAssetPath } from "@/lib/pc-wiki"

/* ── Inline description rendering (mirrors page's RichDescription) ── */

const statIconMap: Record<string, string> = {
  hp: "/stats/hp.png",
  atk: "/stats/attack.png",
  def: "/stats/defense.png",
}

const atkTypeIconMap: Record<string, string> = {
  "p-": "/type_dmg/icAttackTypePhysics.png",
  "m-": "/type_dmg/icAttackTypeMagic.png",
}

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

type Seg =
  | { type: "text"; text: string }
  | { type: "value"; text: string }
  | { type: "stat"; text: string; icon: string }
  | { type: "atktype"; prefix: string; prefixIcon: string; stat: string; statIcon: string }
  | { type: "element"; element: string; icon: string }
  | { type: "badge"; text: string }
  | { type: "note"; text: string }
  | { type: "force"; text: string }

function parseStatTokens(text: string): Seg[] {
  const segs: Seg[] = []
  const pat = /\b([PM]-)?(ATK|DEF|HP)\b|\b(fire|water|earth|wind|dark|light|holy|space)(?=\s+(?:attribute\b|(?:[PM]-)?(?:ATK|DEF)\b))/gi
  let last = 0; let m: RegExpExecArray | null
  while ((m = pat.exec(text)) !== null) {
    if (m.index > last) segs.push({ type: "text", text: text.slice(last, m.index) })
    if (m[2]) {
      const prefix = m[1]?.toUpperCase() ?? null
      const stat = m[2].toUpperCase()
      const statIcon = statIconMap[stat.toLowerCase()]
      if (prefix && atkTypeIconMap[prefix.toLowerCase()]) {
        segs.push({ type: "atktype", prefix, prefixIcon: atkTypeIconMap[prefix.toLowerCase()], stat, statIcon: statIcon ?? "/stats/attack.png" })
      } else if (statIcon) {
        segs.push({ type: "stat", text: stat, icon: statIcon })
      } else {
        segs.push({ type: "text", text: m[0] })
      }
    } else if (m[3]) {
      const icon = inlineElementIconMap[m[3].toLowerCase()]
      if (icon) segs.push({ type: "element", element: m[3], icon })
      else segs.push({ type: "text", text: m[3] })
    }
    last = pat.lastIndex
  }
  if (last < text.length) segs.push({ type: "text", text: text.slice(last) })
  return segs
}

function parseInline(text: string): Seg[] {
  const segs: Seg[] = []
  const badgePat = /(\(Turns:\s*\d+[^)]*\)|\(Uses by this character per battle:\s*\d+\)|\bUnlimited\b|\([^)]{10,}\))/gi
  let last = 0; let m: RegExpExecArray | null
  while ((m = badgePat.exec(text)) !== null) {
    if (m.index > last) segs.push(...parseStatTokens(text.slice(last, m.index)))
    let t = m[1]; const isParen = t.startsWith("(") && t.endsWith(")")
    if (isParen) t = t.slice(1, -1)
    if (/^Turns:/i.test(t) || /^Uses by/i.test(t) || /^Unlimited$/i.test(t)) {
      t = t.replace(/^Turns:\s*/i, "Turns ")
      segs.push({ type: "badge", text: t })
    } else if (isParen) {
      segs.push({ type: "note", text: t })
    } else {
      segs.push({ type: "badge", text: t })
    }
    last = badgePat.lastIndex
  }
  if (last < text.length) segs.push(...parseStatTokens(text.slice(last)))
  return segs
}

function processColor(raw: string): Seg[] {
  const segs: Seg[] = []
  const colorRe = /<color=([^>]+)>(.*?)<\/color>/gi
  let last = 0; let m: RegExpExecArray | null
  while ((m = colorRe.exec(raw)) !== null) {
    if (m.index > last) segs.push(...parseInline(raw.slice(last, m.index)))
    segs.push({ type: "value", text: m[2] })
    last = colorRe.lastIndex
  }
  if (last < raw.length) segs.push(...parseInline(raw.slice(last)))
  return segs
}

function parseLine(raw: string): Seg[] {
  const segs: Seg[] = []
  const badgePre = /\((Turns:\s*\d+[^)]*|Uses by this character per battle:[^)]*?)\)/gi
  const regions: Array<{ start: number; end: number; text: string }> = []
  let bm: RegExpExecArray | null
  while ((bm = badgePre.exec(raw)) !== null) {
    let inner = bm[1].replace(/<color=[^>]+>(.*?)<\/color>/gi, "$1").replace(/^Turns:\s*/i, "Turns ")
    regions.push({ start: bm.index, end: badgePre.lastIndex, text: inner.trim() })
  }
  let pos = 0
  for (const r of regions) {
    if (r.start > pos) segs.push(...processColor(raw.slice(pos, r.start)))
    segs.push({ type: "badge", text: r.text })
    pos = r.end
  }
  if (pos < raw.length) segs.push(...processColor(raw.slice(pos)))
  return segs
}

function BadgeContent({ text }: { text: string }) {
  const turnsMatch = text.match(/^(Turns)\s+(\d+)(.*)$/)
  if (turnsMatch) {
    const remainder = turnsMatch[3]
    const usesInRemainder = remainder ? remainder.match(/^(.*?:\s*)(\d+%?)$/) : null
    return (
      <>
        <span className="px-2 py-0.5 text-gray-800">{turnsMatch[1]} </span>
        <span className="flex self-stretch items-center bg-gray-900 px-1.5 text-white">{turnsMatch[2]}</span>
        {remainder && usesInRemainder ? (
          <><span className="px-2 py-0.5 text-gray-800">{usesInRemainder[1]}</span><span className="flex self-stretch items-center bg-gray-900 px-1.5 text-white">{usesInRemainder[2]}</span></>
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

function SkillDescription({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1.5 text-sm leading-7 text-gray-300 text-left">
      {lines.map((line, li) => {
        const segs = parseLine(line)
        return (
          <p key={li}>
            {segs.map((seg, i) => {
              switch (seg.type) {
                case "value":
                  return <span key={i} className="font-bold text-white">{seg.text}</span>
                case "stat":
                  return (
                    <span key={i} className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white align-middle shadow-[0_0_6px_rgba(255,255,255,0.15)]">
                      <img src={seg.icon} alt={seg.text} className="inline h-4 w-4 object-contain" />{seg.text}
                    </span>
                  )
                case "atktype":
                  return (
                    <span key={i} className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white align-middle shadow-[0_0_6px_rgba(255,255,255,0.15)]">
                      <img src={seg.prefixIcon} alt={seg.prefix} className="inline h-4 w-4 object-contain" /><span>{seg.prefix}</span>
                      <img src={seg.statIcon} alt={seg.stat} className="inline h-4 w-4 object-contain" /><span>{seg.stat}</span>
                    </span>
                  )
                case "element":
                  return (
                    <span key={i} className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white align-middle shadow-[0_0_6px_rgba(255,255,255,0.15)]">
                      <img src={seg.icon} alt={seg.element} className="inline h-4 w-4 object-contain" />{seg.element}
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

/* ── Grouping logic ── */

type SkillGroup = {
  base: WikiSkill
  changed: WikiSkill | null
  changedLabel?: string // defaults to "Skill Change"
  isSecretSkillSwap?: boolean
  // 3-state mode: base (_22) + Attack (_822) + Support (_823)
  attackVariant?: WikiSkill | null
  supportVariant?: WikiSkill | null
}

function groupSkills(skills: WikiSkill[]): SkillGroup[] {
  // Build a lookup of skill change variants by the label they replace
  const changesByReplaces = new Map<string, WikiSkill>()
  for (const skill of skills) {
    if (skill.is_skill_change && skill.replaces_label) {
      changesByReplaces.set(skill.replaces_label, skill)
    }
  }

  // Pair active_skill_3 with active_skill_1 as Ultimate Manifestation variant
  const ultManifest = skills.find((s) => s.slot === "active_skill_3") ?? null
  const skill1 = skills.find((s) => s.slot === "active_skill_1") ?? null

  // Pair special_skill_sub with special_skill as Attack/Support swap (newer chars)
  const specialSkillSub = skills.find((s) => s.slot === "special_skill_sub") ?? null
  // 3-state mode for old chars: base (_22) + attack (_822) + support (_823)
  const specialSkillAttack = skills.find((s) => s.slot === "special_skill_attack") ?? null
  const specialSkillSupport = skills.find((s) => s.slot === "special_skill_support") ?? null

  const groups: SkillGroup[] = []
  for (const skill of skills) {
    if (skill.is_skill_change) continue // handled as part of their base
    if (skill.slot === "active_skill_3") continue // handled as part of active_skill_1
    if (skill.slot === "special_skill_sub") continue // handled as part of special_skill
    if (skill.slot === "special_skill_attack") continue // handled as part of special_skill
    if (skill.slot === "special_skill_support") continue // handled as part of special_skill
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
      const subType = specialSkillSub.special_skill_type
      groups.push({
        base: skill,
        changed: specialSkillSub,
        changedLabel: subType ?? "Sub",
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

const SKILL_CHANGE_TYPE_STYLES: Record<string, string> = {
  "Attack Changing":        "bg-red-900/40 text-red-300 border border-red-700/50",
  "Defense Changing":       "bg-blue-900/40 text-blue-300 border border-blue-700/50",
  "Body and Spirit Changing": "bg-green-900/40 text-green-300 border border-green-700/50",
  "Magic Changing":         "bg-yellow-900/40 text-yellow-300 border border-yellow-700/50",
}

function SkillChangeTypeBadge({ type }: { type: string }) {
  const cls = SKILL_CHANGE_TYPE_STYLES[type] ?? "bg-gray-800 text-gray-300 border border-gray-600"
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {type}
    </span>
  )
}

function SecretSkillTypeBadge({ type }: { type: string }) {
  const isAttack = type === "Attack"
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        isAttack
          ? "bg-orange-900/40 text-orange-300 border border-orange-700/50"
          : "bg-blue-900/40 text-blue-300 border border-blue-700/50"
      }`}
    >
      {type}
    </span>
  )
}

const BATTLE_ATLAS = "/UI/Texture/BattleAtlas"

function SecretSkillIcon({
  skill,
  tripleMode,
  rarity,
  baseSkill,
}: {
  skill: WikiSkill
  tripleMode: "base" | "attack" | "support" | null
  rarity?: number
  baseSkill: WikiSkill
}) {
  const isSecretSkill = baseSkill.slot?.startsWith("special_skill")
  const isAoe = baseSkill.description_max_level?.includes("all-target")
  // Determine card frame based on triple mode or skill type
  const effectiveType = tripleMode === "attack" ? "Attack"
    : tripleMode === "support" ? "Support"
    : tripleMode === "base" ? null
    : skill.special_skill_type
  const cardFrame = isSecretSkill
    ? effectiveType === "Attack"
      ? `${BATTLE_ATLAS}/cardBaseSpAttack.png`
      : effectiveType === "Support"
        ? `${BATTLE_ATLAS}/cardBaseSpSupport.png`
        : `${BATTLE_ATLAS}/cardBaseSp.png`
    : null
  const targetIcon = isAoe ? `${BATTLE_ATLAS}/icSpTypeAll.png` : `${BATTLE_ATLAS}/icSpTypeSingle.png`
  const rarityIcon = rarity === 6 ? `${BATTLE_ATLAS}/icEpicOff.png` : `${BATTLE_ATLAS}/icUltimateOff.png`

  return (
    <div className="relative h-14 w-14 shrink-0">
      {cardFrame ? (
        <>
          {/* Card frame as background */}
          <img src={cardFrame} alt="" className="absolute inset-0 h-full w-full object-contain" aria-hidden />
          {/* Character image on top, inside the circle */}
          {skill.icon_path && (
            <div className="absolute inset-[9px] rounded-full overflow-hidden">
              <img
                src={toPublicAssetPath(skill.icon_path)}
                alt={skill.name}
                className="h-full w-full object-cover object-top scale-[1.35]"
              />
            </div>
          )}
          {/* Bottom-left: target type */}
          <img src={targetIcon} alt={isAoe ? "All targets" : "Single target"} className="absolute bottom-0 left-0 h-4 w-4 object-contain z-[2]" />
          {/* Bottom-center: rarity badge */}
          <img src={rarityIcon} alt="" className="absolute bottom-0 left-1/2 -translate-x-1/2 h-4 w-4 object-contain z-[2]" aria-hidden />
        </>
      ) : (
        <>
          {/* Active skill: original style */}
          <div className="absolute inset-0 rounded-xl bg-gray-900" />
          <img
            src={toPublicAssetPath(skill.icon_path)}
            alt={skill.name}
            className="absolute inset-0 h-full w-full object-contain p-1.5"
          />
        </>
      )}
    </div>
  )
}

function SkillGroupCard({ group, rarity }: { group: SkillGroup; rarity?: number }) {
  // Default to showing the skill change version when one exists
  const [showChanged, setShowChanged] = useState(group.isSecretSkillSwap ? false : !!group.changed)
  // 3-state mode: "base" | "attack" | "support"
  const [tripleMode, setTripleMode] = useState<"base" | "attack" | "support">("base")
  const variantLabel = group.changedLabel ?? "Skill Change"
  const isUltManifest = variantLabel === "Ultimate Manifestation"
  const isSecretSwap = !!group.isSecretSkillSwap
  const isSecretTriple = !!(group.attackVariant && group.supportVariant)
  const skill = isSecretTriple
    ? (tripleMode === "attack" ? group.attackVariant! : tripleMode === "support" ? group.supportVariant! : group.base)
    : (showChanged && group.changed ? group.changed : group.base)
  const displayedType = isSecretTriple && tripleMode !== "base" ? skill.special_skill_type : (!isSecretTriple ? skill.special_skill_type : undefined)
  const skillChangeType = group.base.skill_change_type

  return (
      <Card
      className={`rounded-2xl transition-all ${
        isSecretTriple
          ? tripleMode === "attack"
            ? "border-orange-500/50 bg-gray-700 shadow-[0_0_24px_rgba(249,115,22,0.18)]"
            : tripleMode === "support"
              ? "border-blue-500/50 bg-gray-700 shadow-[0_0_24px_rgba(59,130,246,0.18)]"
              : "border-gray-600 bg-gray-700 shadow-none"
          : showChanged && group.changed
            ? isUltManifest
              ? "border-purple-500/50 bg-gray-700 shadow-[0_0_24px_rgba(168,85,247,0.18)]"
              : isSecretSwap
                ? "border-blue-500/50 bg-gray-700 shadow-[0_0_24px_rgba(59,130,246,0.18)]"
                : "border-amber-500/50 bg-gray-700 shadow-[0_0_24px_rgba(245,158,11,0.18)]"
            : "border-gray-600 bg-gray-700 shadow-none"
      }`}
    >
      <CardContent className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 p-5 items-start">
        {/* Mobile header: icon + name inline, description below (full width) */}
        <div className="flex items-center gap-4 sm:hidden">
          <SecretSkillIcon skill={skill} tripleMode={isSecretTriple ? tripleMode : null} rarity={rarity} baseSkill={group.base} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-white">{skill.name}</h3>
              <span className="rounded bg-gray-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {group.base.slot === "special_skill" ? "secret skill" : group.base.slot.replace(/_/g, " ")}
              </span>
              {displayedType && <SecretSkillTypeBadge type={displayedType} />}
              {skillChangeType && <SkillChangeTypeBadge type={skillChangeType} />}
              {skill.cost !== null && (
                <span className="rounded bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold text-blue-300 border border-blue-700/50">
                  Cost: {skill.cost}
                </span>
              )}
            </div>
            {isSecretTriple ? (
              <div className="flex items-center gap-1 rounded-xl bg-gray-900/60 p-1 w-fit mt-2">
                <button
                  onClick={() => setTripleMode("base")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    tripleMode === "base"
                      ? "bg-gray-700 text-white shadow"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Base
                </button>
                <button
                  onClick={() => setTripleMode("attack")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    tripleMode === "attack"
                      ? "bg-orange-500/25 text-orange-300 shadow ring-1 ring-orange-500/40"
                      : "text-gray-500 hover:text-orange-400"
                  }`}
                >
                  Attack
                </button>
                <button
                  onClick={() => setTripleMode("support")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    tripleMode === "support"
                      ? "bg-blue-500/25 text-blue-300 shadow ring-1 ring-blue-500/40"
                      : "text-gray-500 hover:text-blue-400"
                  }`}
                >
                  Support
                </button>
              </div>
            ) : group.changed ? (
              <div className="flex items-center gap-1 rounded-xl bg-gray-900/60 p-1 w-fit mt-2">
                {isSecretSwap ? (
                  <>
                    <button
                      onClick={() => setShowChanged(false)}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                        !showChanged
                          ? "bg-orange-500/25 text-orange-300 shadow ring-1 ring-orange-500/40"
                          : "text-gray-500 hover:text-orange-400"
                      }`}
                    >
                      {group.base.special_skill_type ?? "Attack"}
                    </button>
                    <button
                      onClick={() => setShowChanged(true)}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                        showChanged
                          ? "bg-blue-500/25 text-blue-300 shadow ring-1 ring-blue-500/40"
                          : "text-gray-500 hover:text-blue-400"
                      }`}
                    >
                      {group.changed.special_skill_type ?? variantLabel}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowChanged(false)}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                        !showChanged
                          ? "bg-gray-700 text-white shadow"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      Base
                    </button>
                    <button
                      onClick={() => setShowChanged(true)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                        showChanged
                          ? isUltManifest
                            ? "bg-purple-500/25 text-purple-300 shadow ring-1 ring-purple-500/40"
                            : "bg-amber-500/25 text-amber-300 shadow ring-1 ring-amber-500/40"
                          : isUltManifest
                            ? "text-gray-500 hover:text-purple-400"
                            : "text-gray-500 hover:text-amber-400"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        showChanged
                          ? isUltManifest ? "bg-purple-400" : "bg-amber-400"
                          : "bg-gray-600"
                      }`} />
                      {variantLabel}
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Desktop image column */}
        <div className="hidden sm:block">
          <SecretSkillIcon skill={skill} tripleMode={isSecretTriple ? tripleMode : null} rarity={rarity} baseSkill={group.base} />
        </div>

        {/* Desktop content column */}
        <div className="hidden sm:block min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-white">{skill.name}</h3>
            <span className="rounded bg-gray-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {group.base.slot === "special_skill" ? "secret skill" : group.base.slot.replace(/_/g, " ")}
            </span>
            {displayedType && <SecretSkillTypeBadge type={displayedType} />}
            {skillChangeType && <SkillChangeTypeBadge type={skillChangeType} />}
            {skill.cost !== null && (
              <span className="rounded bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold text-blue-300 border border-blue-700/50">
                Cost: {skill.cost}
              </span>
            )}
          </div>
          {isSecretTriple ? (
            <div className="flex items-center gap-1 rounded-xl bg-gray-900/60 p-1 w-fit">
              <button
                onClick={() => setTripleMode("base")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  tripleMode === "base"
                    ? "bg-gray-700 text-white shadow"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Base
              </button>
              <button
                onClick={() => setTripleMode("attack")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  tripleMode === "attack"
                    ? "bg-orange-500/25 text-orange-300 shadow ring-1 ring-orange-500/40"
                    : "text-gray-500 hover:text-orange-400"
                }`}
              >
                Attack
              </button>
              <button
                onClick={() => setTripleMode("support")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  tripleMode === "support"
                    ? "bg-blue-500/25 text-blue-300 shadow ring-1 ring-blue-500/40"
                    : "text-gray-500 hover:text-blue-400"
                }`}
              >
                Support
              </button>
            </div>
          ) : group.changed ? (
            <div className="flex items-center gap-1 rounded-xl bg-gray-900/60 p-1 w-fit">
              {isSecretSwap ? (
                <>
                  <button
                    onClick={() => setShowChanged(false)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                      !showChanged
                        ? "bg-orange-500/25 text-orange-300 shadow ring-1 ring-orange-500/40"
                        : "text-gray-500 hover:text-orange-400"
                    }`}
                  >
                    {group.base.special_skill_type ?? "Attack"}
                  </button>
                  <button
                    onClick={() => setShowChanged(true)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                      showChanged
                        ? "bg-blue-500/25 text-blue-300 shadow ring-1 ring-blue-500/40"
                        : "text-gray-500 hover:text-blue-400"
                    }`}
                  >
                    {group.changed.special_skill_type ?? variantLabel}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowChanged(false)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                      !showChanged
                        ? "bg-gray-700 text-white shadow"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Base
                  </button>
                  <button
                    onClick={() => setShowChanged(true)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                      showChanged
                        ? isUltManifest
                          ? "bg-purple-500/25 text-purple-300 shadow ring-1 ring-purple-500/40"
                          : "bg-amber-500/25 text-amber-300 shadow ring-1 ring-amber-500/40"
                        : isUltManifest
                          ? "text-gray-500 hover:text-purple-400"
                          : "text-gray-500 hover:text-amber-400"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      showChanged
                        ? isUltManifest ? "bg-purple-400" : "bg-amber-400"
                        : "bg-gray-600"
                    }`} />
                    {variantLabel}
                  </button>
                </>
              )}
            </div>
          ) : null}
          <div className="mt-1 sm:mt-2">
            <SkillDescription text={skill.description_max_level} />
          </div>
        </div>

        {/* Mobile description: full width starting at card left */}
        <div className="sm:hidden mt-1">
          <SkillDescription text={skill.description_max_level} />
        </div>
      </CardContent>
    </Card>
  )
}

export function SkillList({ skills, rarity }: { skills: WikiSkill[]; rarity?: number }) {
  const groups = groupSkills(skills)
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <SkillGroupCard key={group.base.label} group={group} rarity={rarity} />
      ))}
    </div>
  )
}
