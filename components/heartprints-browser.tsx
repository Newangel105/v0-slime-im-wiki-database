"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { getAllHeartprints, stripColorTags, type Heartprint } from "@/lib/pc-wiki"

function heartprintThumb(picturePath: string): string {
  // picture_path: "Image/SkillStill/<id>/skill_still_<id>_{0}"
  // → /SkillStill/<id>/skill_still_<id>_S.png
  return "/" + picturePath.replace(/^Image\//, "").replace("{0}", "S") + ".png"
}

function heartprintLarge(picturePath: string): string {
  return "/" + picturePath.replace(/^Image\//, "").replace("{0}", "L") + ".png"
}

function StatPill({ label, value, pct = false }: { label: string; value: number; pct?: boolean }) {
  if (!value) return null
  const display = pct ? `${(value / 100).toFixed(2)}%` : value.toLocaleString()
  return (
    <span className="inline-flex items-center gap-1 rounded bg-gray-700/60 px-2 py-0.5 text-xs text-gray-200">
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold text-white">+{display}</span>
    </span>
  )
}

const ELEMENT_NAMES: Record<number, string> = {
  1: "Earth", 2: "Space", 3: "Wind", 4: "Water", 5: "Fire", 6: "Light", 7: "Dark",
}

function elementSkillDesc(hp: Heartprint): string | null {
  if (hp.still_type !== "normal" || !hp.passive_skill?.target_type) return null
  const targetType = hp.passive_skill.target_type
  if (!hp.passive_skill_level) return null
  if (targetType === 90) return `Increases Protection Characters effect level by ${hp.passive_skill_level}`
  const elem = ELEMENT_NAMES[targetType] ?? String(targetType)
  return `Increases ${elem} Attribute effect level by ${hp.passive_skill_level}`
}

function HeartprintCard({ hp, onClick }: { hp: Heartprint; onClick: () => void }) {
  const thumb = heartprintThumb(hp.picture_path)
  // rare = equipable (active skill), normal = not equipable (passive stats)
  const isEquipable = hp.still_type === "rare"

  // Non-equipable normals show passive max stats
  const maxLevel = !isEquipable
    ? hp.passive_skill?.levels[hp.passive_skill.levels.length - 1]
    : null

  const desc = isEquipable
    ? (hp.skill_description ? stripColorTags(hp.skill_description) : null)
    : elementSkillDesc(hp)

  return (
    <button
      onClick={onClick}
      className="group flex flex-col bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500/60 hover:bg-gray-750 transition-all text-left w-full"
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-gray-900 overflow-hidden">
        <img
          src={thumb}
          alt={hp.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        <p className="text-sm font-semibold text-white leading-tight line-clamp-2">{hp.title}</p>

        {desc && (
          <p className="text-xs text-gray-400 leading-snug line-clamp-2">{desc}</p>
        )}

        {/* Passive max stats (not-equipable only) */}
        {maxLevel && (
          <div className="flex flex-wrap gap-1 mt-auto pt-1">
            <StatPill label="HP" value={maxLevel.hp} pct />
            <StatPill label="ATK" value={maxLevel.attack} pct />
            <StatPill label="DEF" value={maxLevel.defense} pct />
          </div>
        )}
      </div>
    </button>
  )
}

function HeartprintModal({ hp, onClose }: { hp: Heartprint; onClose: () => void }) {
  const large = heartprintLarge(hp.picture_path)
  // rare = equipable (active skill), normal = not equipable (passive stats)
  const isEquipable = hp.still_type === "rare"
  const desc = isEquipable
    ? (hp.skill_description ? stripColorTags(hp.skill_description) : null)
    : elementSkillDesc(hp)

  // Non-equipable normals show passive stats
  const maxLevel = !isEquipable
    ? hp.passive_skill?.levels[hp.passive_skill.levels.length - 1]
    : null

  // Sum all milestone entries for cumulative totals at max level
  const exTotals = !isEquipable && hp.passive_skill?.ex_effects?.length
    ? hp.passive_skill.ex_effects.reduce(
        (acc, e) => ({
          critical:    acc.critical    + (e.critical    ?? 0),
          penetration: acc.penetration + (e.penetration ?? 0),
          cooperation: acc.cooperation + (e.cooperation ?? 0),
          defcritical: acc.defcritical + (e.defcritical ?? 0),
          element:     acc.element     + (e.element     ?? 0),
        }),
        { critical: 0, penetration: 0, cooperation: 0, defcritical: 0, element: 0 }
      )
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-gray-800 border border-gray-600 rounded-xl overflow-hidden max-w-lg w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Large image */}
        <img src={large} alt={hp.title} className="w-full object-cover" />

        <div className="p-5 space-y-3">
          {/* Title + badge */}
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-white leading-tight">{hp.title}</h2>
            <span
              className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                isEquipable
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                  : "bg-purple-600/30 text-purple-300 border border-purple-500/40"
              }`}
            >
              {isEquipable ? "Equipable" : "Not Equipable"}
            </span>
          </div>

          {/* Description */}
          {desc && <p className="text-sm text-gray-300 leading-snug">{desc}</p>}

          {/* Not-equipable normals: passive max stats */}
          {!isEquipable && maxLevel && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">
                Max Level Stats (Lv.{maxLevel.level})
              </p>
              <div className="flex flex-wrap gap-2">
                {maxLevel.hp > 0 && <StatPill label="HP" value={maxLevel.hp} pct />}
                {maxLevel.attack > 0 && <StatPill label="ATK" value={maxLevel.attack} pct />}
                {maxLevel.defense > 0 && <StatPill label="DEF" value={maxLevel.defense} pct />}
              </div>
            </div>
          )}

          {/* Not-equipable normals: EX effects (cumulative totals) */}
          {!isEquipable && exTotals && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">
                EX Effects (Max Level Totals)
              </p>
              <div className="flex flex-wrap gap-2">
                {exTotals.critical    > 0 && <StatPill label="Critical Damage" value={exTotals.critical}    pct />}
                {exTotals.penetration > 0 && <StatPill label="Pierce Power"    value={exTotals.penetration} pct />}
                {exTotals.cooperation > 0 && <StatPill label="Synergy Power"   value={exTotals.cooperation} pct />}
                {exTotals.defcritical > 0 && <StatPill label="Aegis Power"     value={exTotals.defcritical} pct />}
                {exTotals.element     > 0 && <StatPill label="Element"         value={exTotals.element}     pct />}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="absolute top-3 right-3 rounded-full bg-black/50 p-1 text-gray-300 hover:text-white hover:bg-black/70 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function SectionGrid({ heartprints, onSelect }: { heartprints: Heartprint[]; onSelect: (hp: Heartprint) => void }) {
  if (heartprints.length === 0) {
    return <p className="text-gray-500 text-sm py-4">No heartprints found.</p>
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {heartprints.map((hp) => (
        <HeartprintCard key={hp.heartprint_id} hp={hp} onClick={() => onSelect(hp)} />
      ))}
    </div>
  )
}

interface Props {
  heartprints: Heartprint[]
}

export function HeartprintsBrowser({ heartprints }: Props) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Heartprint | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return heartprints
    return heartprints.filter(
      (hp) =>
        hp.title.toLowerCase().includes(q) ||
        (hp.skill_description && stripColorTags(hp.skill_description).toLowerCase().includes(q))
    )
  }, [heartprints, search])

  const equipable = filtered.filter((hp) => hp.still_type === "rare").sort((a, b) => a.order - b.order)
  const notEquipable = filtered.filter((hp) => hp.still_type === "normal").sort((a, b) => a.order - b.order)

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto pl-6 pr-4 sm:pl-8 sm:pr-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-300 uppercase tracking-wider">HEARTPRINTS</h1>
        </div>

        {/* Search */}
        <div className="max-w-md mx-auto mb-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search heartprints..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-gray-700 border-gray-600 text-white"
            />
          </div>
        </div>

        {/* Equipable section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-xl font-bold text-gray-200 uppercase tracking-wide">Equipable</h2>
            <span className="rounded-full bg-blue-600/20 border border-blue-500/30 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
              {equipable.length}
            </span>
          </div>
          <SectionGrid heartprints={equipable} onSelect={setSelected} />
        </section>

        {/* Not Equipable section */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-xl font-bold text-gray-200 uppercase tracking-wide">Not Equipable</h2>
            <span className="rounded-full bg-purple-600/20 border border-purple-500/30 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
              {notEquipable.length}
            </span>
          </div>
          <SectionGrid heartprints={notEquipable} onSelect={setSelected} />
        </section>
      </div>

      {/* Detail modal */}
      {selected && (
        <HeartprintModal hp={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
