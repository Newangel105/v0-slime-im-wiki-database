"use client"

import { useMemo, useState, useEffect } from "react"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { stripColorTags, type Heartprint } from "@/lib/pc-wiki"

function heartprintThumb(picturePath: string): string {
  return "/" + picturePath.replace(/^Image\//, "").replace("{0}", "S") + ".png"
}

function heartprintLarge(picturePath: string): string {
  return "/" + picturePath.replace(/^Image\//, "").replace("{0}", "L") + ".png"
}

const ELEMENT_NAMES: Record<number, string> = {
  1: "Earth", 2: "Space", 3: "Wind", 4: "Water", 5: "Fire", 6: "Light", 7: "Dark", 90: "Protection",
}

const ELEMENT_COLORS: Record<number, string> = {
  1: "text-yellow-600 bg-yellow-900/30 border-yellow-700/40",
  2: "text-indigo-400 bg-indigo-900/30 border-indigo-700/40",
  3: "text-green-400 bg-green-900/30 border-green-700/40",
  4: "text-blue-400 bg-blue-900/30 border-blue-700/40",
  5: "text-red-400 bg-red-900/30 border-red-700/40",
  6: "text-yellow-300 bg-yellow-900/20 border-yellow-600/40",
  7: "text-purple-400 bg-purple-900/30 border-purple-700/40",
  90: "text-gray-300 bg-gray-700/30 border-gray-600/40",
}

const ELEMENT_HEADER_COLORS: Record<number, string> = {
  1: "border-yellow-700/50 bg-yellow-900/20",
  2: "border-indigo-700/50 bg-indigo-900/20",
  3: "border-green-700/50 bg-green-900/20",
  4: "border-blue-700/50 bg-blue-900/20",
  5: "border-red-700/50 bg-red-900/20",
  6: "border-yellow-600/50 bg-yellow-900/10",
  7: "border-purple-700/50 bg-purple-900/20",
  90: "border-gray-600/50 bg-gray-800/40",
}

function formatSeason(season: string | null | undefined): string | null {
  if (!season) return null
  return season
}

function formatCondition(c: { type: number; target_count: number; quest_id: number | null; quest_name: string | null; target_season: number | null; required_still_id?: number | null; required_still_title?: string | null; required_still_season?: string | null }): string {
  if (c.type === 1) return "Complete quest: " + (c.quest_name ?? ("ID " + c.quest_id))
  if (c.type === 3) {
    const season = c.required_still_season ? c.required_still_season + " " : ""
    return "Own Heartprint: " + season + (c.required_still_title ?? ("ID " + c.required_still_id))
  }
  if (c.type === 6 && c.target_count > 0) return "Collect " + c.target_count + " Heartprint" + (c.target_count !== 1 ? "s" : "")
  return "Condition type " + c.type
}

// -- Equipable card --

function HeartprintCard({ hp, onClick }: { hp: Heartprint; onClick: () => void }) {
  const thumb = heartprintThumb(hp.picture_path)
  const desc = hp.skill_description ? stripColorTags(hp.skill_description) : null

  return (
    <button
      onClick={onClick}
      className="group flex flex-col bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500/60 transition-all text-left w-full"
    >
      <div className="relative w-full aspect-video bg-gray-900 overflow-hidden">
        <img src={thumb} alt={hp.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        <p className="text-sm font-semibold text-white leading-tight line-clamp-2">{hp.title}</p>
        {desc && <p className="text-xs text-gray-400 leading-snug line-clamp-2">{desc}</p>}
      </div>
    </button>
  )
}

// -- Not Equipable table with rowspan element column --

function NotEquipableTable({ heartprints, onSelect }: { heartprints: Heartprint[]; onSelect: (hp: Heartprint) => void }) {
  if (heartprints.length === 0) return <p className="text-gray-500 text-sm py-4">No heartprints found.</p>

  const byElement: Map<number, Heartprint[]> = new Map()
  for (const hp of heartprints) {
    const tt = hp.passive_skill?.target_type ?? 0
    if (!byElement.has(tt)) byElement.set(tt, [])
    byElement.get(tt)!.push(hp)
  }
  const sortedElements = [...byElement.keys()].sort((a, b) => {
    if (a === 90) return 1
    if (b === 90) return -1
    return a - b
  })

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-700/60">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-800/80 border-b border-gray-700">
            <th className="text-left px-4 py-3 text-gray-400 font-semibold uppercase tracking-wide text-xs w-28">Element</th>
            <th className="text-left px-4 py-3 text-gray-400 font-semibold uppercase tracking-wide text-xs">Heartprint</th>
            <th className="text-center px-4 py-3 text-gray-400 font-semibold uppercase tracking-wide text-xs whitespace-nowrap">Elem. Lv</th>
            <th className="text-center px-4 py-3 text-gray-400 font-semibold uppercase tracking-wide text-xs">HP%</th>
            <th className="text-center px-4 py-3 text-gray-400 font-semibold uppercase tracking-wide text-xs">ATK%</th>
            <th className="text-center px-4 py-3 text-gray-400 font-semibold uppercase tracking-wide text-xs">DEF%</th>
            <th className="text-left px-4 py-3 text-gray-400 font-semibold uppercase tracking-wide text-xs">EX Effects</th>
          </tr>
        </thead>
        <tbody>
          {sortedElements.map((elemId) => {
            const group = byElement.get(elemId)!
            const sorted = [...group].sort((a, b) => {
              const lvDiff = (b.passive_skill_level ?? 0) - (a.passive_skill_level ?? 0)
              return lvDiff !== 0 ? lvDiff : a.order - b.order
            })
            const elemName = ELEMENT_NAMES[elemId] ?? ("Type " + elemId)
            const badgeCls = ELEMENT_COLORS[elemId] ?? "text-gray-300 bg-gray-700/30 border-gray-600/40"
            const elemBgCls = ELEMENT_HEADER_COLORS[elemId] ?? "bg-gray-800/40"

            return sorted.map((hp, rowIdx) => {
              const maxLv = hp.passive_skill?.levels?.[hp.passive_skill.levels.length - 1]
              const hpPct  = maxLv ? "+" + (maxLv.hp      / 100).toFixed(2) + "%" : "-"
              const atkPct = maxLv ? "+" + (maxLv.attack   / 100).toFixed(2) + "%" : "-"
              const defPct = maxLv ? "+" + (maxLv.defense  / 100).toFixed(2) + "%" : "-"
              const season = formatSeason(hp.season)
              const thumb  = heartprintThumb(hp.picture_path)
              const isLast = rowIdx === sorted.length - 1

              // EX totals across all ex_effect entries
              const exTotals = hp.passive_skill?.ex_effects?.length
                ? hp.passive_skill.ex_effects.reduce(
                    (acc, e: { critical?: number; penetration?: number; cooperation?: number; defcritical?: number; element?: number }) => ({
                      critical:    acc.critical    + (e.critical    ?? 0),
                      penetration: acc.penetration + (e.penetration ?? 0),
                      cooperation: acc.cooperation + (e.cooperation ?? 0),
                      defcritical: acc.defcritical + (e.defcritical ?? 0),
                      element:     acc.element     + (e.element     ?? 0),
                    }),
                    { critical: 0, penetration: 0, cooperation: 0, defcritical: 0, element: 0 }
                  )
                : null
              const exLines: { label: string; val: number }[] = exTotals ? [
                { label: "Crit Dmg",    val: exTotals.critical    },
                { label: "Pierce",      val: exTotals.penetration },
                { label: "Synergy",     val: exTotals.cooperation },
                { label: "Aegis",       val: exTotals.defcritical },
                { label: "Element",     val: exTotals.element     },
              ].filter(x => x.val > 0) : []

              return (
                <tr
                  key={hp.heartprint_id}
                  className={"border-b border-gray-700/40 hover:bg-gray-700/25 cursor-pointer transition-colors" + (isLast ? " border-b-2 border-b-gray-600/60" : "")}
                  onClick={() => onSelect(hp)}
                >
                  {/* Element cell — rowspan on first row only */}
                  {rowIdx === 0 && (
                    <td
                      rowSpan={sorted.length}
                      className={"px-4 text-center align-middle border-r border-gray-700/40 " + elemBgCls}
                    >
                      <span className={"inline-block rounded border px-2 py-1 text-xs font-bold " + badgeCls}>
                        {elemName}
                      </span>
                    </td>
                  )}

                  {/* Heartprint thumbnail + name + season */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <img
                        src={thumb}
                        alt={hp.title}
                        className="w-20 h-12 object-cover rounded flex-shrink-0 bg-gray-900"
                      />
                      <div className="flex flex-col">
                        <span className="text-white font-medium leading-snug">{hp.title}</span>
                        {season && <span className="text-xs text-gray-500 mt-0.5">{season}</span>}
                      </div>
                    </div>
                  </td>

                  {/* Elem. Lv */}
                  <td className="px-4 py-2 text-center">
                    <span className="font-bold text-gray-200">{hp.passive_skill_level ?? "-"}</span>
                  </td>

                  {/* Stats */}
                  <td className="px-4 py-2 text-center font-mono text-xs text-green-400 whitespace-nowrap">{hpPct}</td>
                  <td className="px-4 py-2 text-center font-mono text-xs text-red-400 whitespace-nowrap">{atkPct}</td>
                  <td className="px-4 py-2 text-center font-mono text-xs text-blue-400 whitespace-nowrap">{defPct}</td>

                  {/* EX effects */}
                  <td className="px-4 py-2">
                    {exLines.length > 0
                      ? (
                        <div className="flex flex-col gap-0.5">
                          {exLines.map(x => (
                            <span key={x.label} className="text-xs text-gray-300 whitespace-nowrap">
                              <span className="text-gray-500">{x.label} </span>
                              <span className="font-mono text-yellow-300">+{(x.val / 100).toFixed(2)}%</span>
                            </span>
                          ))}
                        </div>
                      )
                      : <span className="text-gray-600 text-xs">-</span>
                    }
                  </td>
                </tr>
              )
            })
          })}
        </tbody>
      </table>
    </div>
  )
}

// -- Modal --

function HeartprintModal({ hp, onClose }: { hp: Heartprint; onClose: () => void }) {
  const large = heartprintLarge(hp.picture_path)
  const isEquipable = hp.still_type === "rare"
  const season = formatSeason(hp.season)
  const conditions = hp.unlock_conditions ?? []
  const hasObtain = season != null || conditions.length > 0 || !!hp.facility_source || !!hp.arena_rank_source || !!hp.event_source

  // Level toggle state for equipable (rare) heartprints
  const rareLevels = hp.rare_levels ?? []
  const [selectedLevel, setSelectedLevel] = useState<number>(rareLevels.length > 0 ? rareLevels[rareLevels.length - 1].level : 1)
  const activeLevelData = rareLevels.find((l) => l.level === selectedLevel)
  const displayDesc = activeLevelData?.skill_description
    ? stripColorTags(activeLevelData.skill_description)
    : hp.skill_description
    ? stripColorTags(hp.skill_description)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative bg-gray-800 border border-gray-600 rounded-xl overflow-hidden max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero image with level selector overlay for equipable */}
        <div className="relative">
          <img src={large} alt={hp.title} className="w-full object-cover" />
          {isEquipable && rareLevels.length > 0 && (
            <div className="absolute bottom-3 left-3 flex gap-1.5 items-center">
              {[1, 2, 3].map((pos) => {
                const isActive = pos <= selectedLevel
                return (
                  <button
                    key={pos}
                    onClick={(e) => { e.stopPropagation(); setSelectedLevel(pos) }}
                    title={`Level ${pos}`}
                    className="transition-all"
                  >
                    <img
                      src={`/UI/Texture/CommonEtcAtlas/iconRarity${selectedLevel}.png`}
                      alt={`Level ${pos}`}
                      className={`w-8 h-8 object-contain transition-all ${isActive ? "opacity-100" : "opacity-25 grayscale"}`}
                    />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-5 space-y-3">
          <h2 className="text-lg font-bold text-white leading-tight">{hp.title}</h2>

          {/* Equipable: show per-level skill description */}
          {isEquipable && displayDesc && (
            <p className="text-sm text-gray-300 leading-snug">{displayDesc}</p>
          )}

          {/* How to Obtain — shown for both equipable and not-equipable */}
          {hasObtain && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">How to Obtain</p>
              <div className="space-y-1.5">
                {season && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">From</span>
                    <span className="text-sm text-yellow-300 font-semibold">{season}</span>
                  </div>
                )}
                {conditions.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">Requires</span>
                    <span className="text-sm text-gray-200">{formatCondition(c)}</span>
                  </div>
                ))}
                {hp.facility_source && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">District</span>
                    <span className="text-sm text-gray-200">
                      {hp.facility_source.area_name} district progress level {hp.facility_source.growth_value}
                    </span>
                  </div>
                )}
                {hp.arena_rank_source && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">Arena</span>
                    <span className="text-sm text-gray-200">
                      Reach {hp.arena_rank_source.rank_name} in the Valor Cup
                    </span>
                  </div>
                )}
                {hp.event_source && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">Event</span>
                    <span className="text-sm text-gray-200">
                      {hp.event_source.quest_name
                        ? `Complete quest "${hp.event_source.quest_name}" in a limited story event`
                        : "Complete a limited story event"}
                      {hp.event_source.is_missable && " (Missable)"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!hasObtain && (
            <p className="text-xs text-gray-500 italic">No obtain information available.</p>
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

// -- Main browser --

interface Props {
  heartprints: Heartprint[]
}

type ExFilterKey = "crit" | "pierce" | "synergy" | "aegis" | "gauge" | "soul" | "heal" | "skillpts"

const EX_FILTER_OPTIONS: { key: ExFilterKey; label: string }[] = [
  { key: "crit",     label: "Critical"     },
  { key: "pierce",   label: "Pierce"       },
  { key: "synergy",  label: "Synergy"      },
  { key: "aegis",    label: "Aegis"        },
  { key: "gauge",    label: "Gauge"        },
  { key: "soul",     label: "Soul Change"  },
  { key: "heal",     label: "Heal / HP"    },
  { key: "skillpts", label: "Skill Points" },
]

const EX_FILTER_PATTERNS: Record<ExFilterKey, RegExp> = {
  crit:     /critical power/i,
  pierce:   /pierce power/i,
  synergy:  /synergy power/i,
  aegis:    /aegis power/i,
  gauge:    /protection gauge/i,
  soul:     /changes non-|soul of/i,
  heal:     /heal|max hp/i,
  skillpts: /skill points/i,
}

function getRareDesc(hp: Heartprint): string {
  const levels = hp.rare_levels ?? []
  const last = levels[levels.length - 1]
  const raw = last?.skill_description ?? hp.skill_description ?? ""
  return stripColorTags(raw)
}

function heartprintMatchesFilter(hp: Heartprint, key: ExFilterKey): boolean {
  const desc = getRareDesc(hp)
  return EX_FILTER_PATTERNS[key].test(desc)
}

function EquipableFilterDropdown({
  selectedValues,
  onToggle,
}: {
  selectedValues: string[]
  onToggle: (value: string) => void
}) {
  const [dropdownSearch, setDropdownSearch] = useState("")
  const visibleOptions = dropdownSearch.trim()
    ? EX_FILTER_OPTIONS.filter((o) => o.label.toLowerCase().includes(dropdownSearch.toLowerCase()))
    : EX_FILTER_OPTIONS
  return (
    <Popover onOpenChange={() => setDropdownSearch("")}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-auto min-h-[2.25rem] justify-between gap-2 border-gray-600 bg-gray-700 px-3 py-1.5 text-white hover:bg-gray-600">
          {selectedValues.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {selectedValues.map((v) => {
                const opt = EX_FILTER_OPTIONS.find((o) => o.key === v)
                return (
                  <span key={v} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium">
                    {opt?.label ?? v}
                  </span>
                )
              })}
            </span>
          ) : (
            <span className="text-sm text-gray-300">Filter by effect</span>
          )}
          <Badge variant="secondary" className="ml-1 shrink-0 bg-gray-900 text-white">
            {selectedValues.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 border-gray-600 bg-gray-700 p-0 text-white" align="start">
        <div className="border-b border-gray-600 px-4 py-3">
          <p className="text-sm font-semibold text-white mb-2">Filter by effect</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <Input
              placeholder="Search..."
              value={dropdownSearch}
              onChange={(e) => setDropdownSearch(e.target.value)}
              className="h-7 pl-8 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
            />
          </div>
        </div>
        <ScrollArea className="max-h-64 px-4 py-3">
          <div className="space-y-1">
            {visibleOptions.map((option) => {
              const checked = selectedValues.includes(option.key)
              return (
                <label key={option.key} className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors ${
                  checked ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5"
                }`}>
                  <Checkbox checked={checked} onCheckedChange={() => onToggle(option.key)} />
                  <span>{option.label}</span>
                </label>
              )
            })}
            {visibleOptions.length === 0 && (
              <p className="py-2 text-center text-xs text-gray-500">No results</p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

export function HeartprintsBrowser() {
  const [heartprints, setHeartprints] = useState<Heartprint[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    fetch("/api/heartprints")
      .then((r) => r.json())
      .then((data) => { setHeartprints(data); setDataLoading(false) })
      .catch(() => setDataLoading(false))
  }, [])

  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Heartprint | null>(null)
  const [exFilters, setExFilters] = useState<ExFilterKey[]>([])

  function toggleExFilter(key: string) {
    const k = key as ExFilterKey
    setExFilters((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k])
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return heartprints
    return heartprints.filter(
      (hp) =>
        hp.title.toLowerCase().includes(q) ||
        (hp.skill_description && stripColorTags(hp.skill_description).toLowerCase().includes(q)) ||
        (hp.season && hp.season.toLowerCase().includes(q))
    )
  }, [heartprints, search])

  const allEquipable = filtered.filter((hp) => hp.still_type === "rare").sort((a, b) => a.order - b.order)
  const equipable = exFilters.length > 0
    ? allEquipable.filter((hp) => exFilters.every((k) => heartprintMatchesFilter(hp, k)))
    : allEquipable
  const notEquipable = filtered.filter((hp) => hp.still_type === "normal").sort((a, b) => a.order - b.order)

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-700 border-t-blue-400" />
          <p className="text-sm text-gray-500 animate-pulse">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto pl-6 pr-4 sm:pl-8 sm:pr-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-300 uppercase tracking-wider">HEARTPRINTS</h1>
        </div>

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
        <section className="mb-14">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <h2 className="text-xl font-bold text-gray-200 uppercase tracking-wide">Equipable</h2>
            <span className="rounded-full bg-blue-600/20 border border-blue-500/30 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
              {equipable.length}
            </span>
            <EquipableFilterDropdown
              selectedValues={exFilters}
              onToggle={toggleExFilter}
            />
          </div>
          {equipable.length === 0
            ? <p className="text-gray-500 text-sm py-4">No heartprints found.</p>
            : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {equipable.map((hp) => (
                  <HeartprintCard key={hp.heartprint_id} hp={hp} onClick={() => setSelected(hp)} />
                ))}
              </div>
            )
          }
        </section>

        {/* Not Equipable section - grouped grid */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-bold text-gray-200 uppercase tracking-wide">Not Equipable</h2>
            <span className="rounded-full bg-purple-600/20 border border-purple-500/30 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
              {notEquipable.length}
            </span>
            <span className="text-xs text-gray-500 ml-1">Click a row to see how to obtain it</span>
          </div>
          <NotEquipableTable heartprints={notEquipable} onSelect={setSelected} />
        </section>
      </div>

      {selected && <HeartprintModal hp={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}