"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { type WikiTrait, toPublicAssetPath, stripColorTags } from "@/lib/pc-wiki"

type TraitGroup = {
  baseName: string
  members: WikiTrait[]
}

function groupTraits(traits: WikiTrait[]): TraitGroup[] {
  const map = new Map<string, WikiTrait[]>()
  const order: string[] = []
  for (const trait of traits) {
    const base = trait.name.replace(/\s+Initial Conditions$/, "")
    if (!map.has(base)) {
      map.set(base, [])
      order.push(base)
    }
    map.get(base)!.push(trait)
  }
  return order.map((baseName) => ({ baseName, members: map.get(baseName)! }))
}

function unlockShortLabel(unlock: string): string {
  if (unlock === "Initial Conditions") return "Base"
  const match = unlock.match(/Awaken (\d+)\/5/)
  return match ? `${match[1]}/5` : unlock
}

/* ── Inline description rendering (mirrors the page's RichDescription for trait text) ── */

const statIconMap: Record<string, string> = {
  hp: "/stats/hp.webp",
  atk: "/stats/attack.webp",
  def: "/stats/defense.webp",
}

const atkTypeIconMap: Record<string, string> = {
  "p-": "/UI/Texture/CommonLotteryInfoPanelAtlas/icAttackTypePhysical.webp",
  "m-": "/UI/Texture/CommonLotteryInfoPanelAtlas/icAttackTypeMagic.webp",
}

const inlineElementIconMap: Record<string, string> = {
  fire: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementFire.webp",
  water: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementWater.webp",
  earth: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEarth.webp",
  wind: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementWind.webp",
  dark: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementDark.webp",
  light: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementHoly.webp",
  holy: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementHoly.webp",
  space: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementAir.webp",
  air: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementAir.webp",
}

type Seg =
  | { type: "text"; text: string }
  | { type: "value"; text: string }
  | { type: "stat"; text: string; icon: string }
  | { type: "atktype"; prefix: string; prefixIcon: string; stat: string; statIcon: string }
  | { type: "element"; element: string; icon: string }
  | { type: "badge"; text: string }
  | { type: "note"; text: string }

function parseStatTokens(text: string): Seg[] {
  const segs: Seg[] = []
  const pat = /\b([PM]-)?(ATK|DEF|HP)\b|\b(fire|water|earth|wind|dark|light|holy|space)(?=\s+(?:attribute\b|(?:[PM]-)?(?:ATK|DEF)\b))/gi
  let last = 0
  let m: RegExpExecArray | null
  while ((m = pat.exec(text)) !== null) {
    if (m.index > last) segs.push({ type: "text", text: text.slice(last, m.index) })
    if (m[2]) {
      const prefix = m[1]?.toUpperCase() ?? null
      const stat = m[2].toUpperCase()
      const statIcon = statIconMap[stat.toLowerCase()]
      if (prefix && atkTypeIconMap[prefix.toLowerCase()]) {
        segs.push({ type: "atktype", prefix, prefixIcon: atkTypeIconMap[prefix.toLowerCase()], stat, statIcon: statIcon ?? "/stats/attack.webp" })
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
  let last = 0
  let m: RegExpExecArray | null
  while ((m = badgePat.exec(text)) !== null) {
    if (m.index > last) segs.push(...parseStatTokens(text.slice(last, m.index)))
    let t = m[1]
    const isParen = t.startsWith("(") && t.endsWith(")")
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
  let last = 0
  let m: RegExpExecArray | null
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

function TraitDescription({ text }: { text: string }) {
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

function TraitGroupCard({ group }: { group: TraitGroup }) {
  const [selectedIdx, setSelectedIdx] = useState(group.members.length - 1)
  const trait = group.members[selectedIdx]

  const isMaxLevel = selectedIdx === group.members.length - 1

  return (
    <Card
      className={`rounded-2xl transition-all ${
        group.members.length > 1 && isMaxLevel
          ? "border-blue-500/50 bg-gray-700 shadow-[0_0_24px_rgba(59,130,246,0.18)]"
          : "border-gray-600 bg-gray-700 shadow-none"
      }`}
    >
      <CardContent className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 p-5 items-start">
        {/* Mobile header: icon + name inline */}
        <div className="flex items-center gap-4 sm:hidden">
          <img src={toPublicAssetPath(trait.icon_path)} alt={trait.name} className="h-14 w-14 shrink-0 rounded-xl bg-gray-900 p-1.5 object-contain" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-white">{group.baseName}</h3>
              {group.members.length === 1 && (
                <span className="rounded bg-gray-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {trait.unlock}
                </span>
              )}
            </div>
            {group.members.length > 1 && (
              <div className="flex items-center gap-1 rounded-xl bg-gray-900/60 p-1 w-fit mt-2">
                {group.members.map((m, i) => (
                  <button
                    key={m.label}
                    onClick={() => setSelectedIdx(i)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                      i === selectedIdx
                        ? "bg-blue-500/25 text-blue-300 shadow ring-1 ring-blue-500/40"
                        : "text-gray-500 hover:text-blue-300"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${i === selectedIdx ? "bg-blue-400" : "bg-gray-600"}`} />
                      {unlockShortLabel(m.unlock)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desktop image column */}
        <img src={toPublicAssetPath(trait.icon_path)} alt={trait.name} className="hidden sm:block h-14 w-14 shrink-0 rounded-xl bg-gray-900 p-1.5 object-contain" />

        {/* Desktop content column */}
        <div className="hidden sm:block min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-white">{group.baseName}</h3>
            {group.members.length === 1 && (
              <span className="rounded bg-gray-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {trait.unlock}
              </span>
            )}
          </div>
          {group.members.length > 1 && (
            <div className="flex items-center gap-1 rounded-xl bg-gray-900/60 p-1 w-fit">
              {group.members.map((m, i) => (
                <button
                  key={m.label}
                  onClick={() => setSelectedIdx(i)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    i === selectedIdx
                      ? "bg-blue-500/25 text-blue-300 shadow ring-1 ring-blue-500/40"
                      : "text-gray-500 hover:text-blue-300"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${i === selectedIdx ? "bg-blue-400" : "bg-gray-600"}`} />
                    {unlockShortLabel(m.unlock)}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-1 sm:mt-2">
            <TraitDescription text={trait.description_max_level} />
          </div>
        </div>

        {/* Mobile description full width */}
        <div className="sm:hidden mt-1">
          <TraitDescription text={trait.description_max_level} />
        </div>
      </CardContent>
    </Card>
  )
}

export function TraitList({ traits }: { traits: WikiTrait[] }) {
  const groups = groupTraits(traits)

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <TraitGroupCard key={group.baseName} group={group} />
      ))}
    </div>
  )
}
