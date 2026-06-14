"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { stripColorTags, type Heartprint } from "@/lib/pc-wiki"
import { NkBoard, NkHeaderPod, NkPod } from "./pod-kit"

// Night-ink port of the Heartprints browser: identical data + filter logic,
// re-housed in the pod organism. Element/stat hues are kept (arbitrary hex is
// theme-independent); only the ocean semantic tokens are swapped for night-ink.

function heartprintThumb(p: string): string {
  return "/" + p.replace("{0}", "S") + ".webp"
}
function heartprintLarge(p: string): string {
  return "/" + p.replace("{0}", "L") + ".webp"
}

const ELEMENT_NAMES: Record<number, string> = {
  1: "Earth", 2: "Space", 3: "Wind", 4: "Water", 5: "Fire", 6: "Light", 7: "Dark", 90: "Protection",
}
const ELEMENT_BAR_COLORS: Record<number, string> = {
  1: "#a8761e", 2: "#4f53c0", 3: "#178a48", 4: "#0f6fbf", 5: "#cc3940", 6: "#b8860b", 7: "#6743c4", 90: "#54677f",
}

function formatSeason(season: string | null | undefined): string | null {
  return season || null
}
function formatCondition(c: { type: number; target_count: number; quest_id: number | null; quest_name: string | null; target_season: number | null; required_still_id?: number | null; required_still_title?: string | null; required_still_season?: string | null }): string {
  if (c.type === 1) return "Complete quest: " + (c.quest_name ?? "ID " + c.quest_id)
  if (c.type === 3) {
    const season = c.required_still_season ? c.required_still_season + " " : ""
    return "Own Heartprint: " + season + (c.required_still_title ?? "ID " + c.required_still_id)
  }
  if (c.type === 6 && c.target_count > 0) return "Collect " + c.target_count + " Heartprint" + (c.target_count !== 1 ? "s" : "")
  return "Condition type " + c.type
}

function HeartprintCard({ hp, onClick }: { hp: Heartprint; onClick: () => void }) {
  const thumb = heartprintThumb(hp.picture_path)
  const desc = hp.skill_description ? stripColorTags(hp.skill_description) : null
  return (
    <button onClick={onClick} className="nk-hp-card">
      <div className="nk-hp-card-img">
        <img src={thumb} alt={hp.title} />
      </div>
      <div className="nk-hp-card-body">
        <p className="nk-hp-card-title">{hp.title}</p>
        {desc && <p className="nk-hp-card-desc">{desc}</p>}
      </div>
    </button>
  )
}

function NotEquipableTable({ heartprints, onSelect }: { heartprints: Heartprint[]; onSelect: (hp: Heartprint) => void }) {
  if (heartprints.length === 0) return <p className="nk-muted" style={{ padding: "12px 0" }}>No heartprints found.</p>

  const byElement = new Map<number, Heartprint[]>()
  for (const hp of heartprints) {
    const tt = hp.passive_skill?.target_type ?? 0
    if (!byElement.has(tt)) byElement.set(tt, [])
    byElement.get(tt)!.push(hp)
  }
  const sortedElements = [...byElement.keys()].sort((a, b) => (a === 90 ? 1 : b === 90 ? -1 : a - b))

  return (
    <div className="nk-table-shell">
      <table className="nk-table" style={{ minWidth: 880 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", width: 96 }}>Element</th>
            <th style={{ textAlign: "left" }}>Heartprint</th>
            <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Elem. Lv</th>
            <th style={{ textAlign: "center" }}>HP%</th>
            <th style={{ textAlign: "center" }}>ATK%</th>
            <th style={{ textAlign: "center" }}>DEF%</th>
            <th style={{ textAlign: "left" }}>EX Effects</th>
          </tr>
        </thead>
        <tbody>
          {sortedElements.map((elemId) => {
            const group = byElement.get(elemId)!
            const sorted = [...group].sort((a, b) => {
              const lvDiff = (b.passive_skill_level ?? 0) - (a.passive_skill_level ?? 0)
              return lvDiff !== 0 ? lvDiff : a.order - b.order
            })
            const elemName = ELEMENT_NAMES[elemId] ?? "Type " + elemId
            const barColor = ELEMENT_BAR_COLORS[elemId] ?? "#37526b"
            return sorted.map((hp, rowIdx) => {
              const maxLv = hp.passive_skill?.levels?.[hp.passive_skill.levels.length - 1]
              const hpPct = maxLv ? "+" + (maxLv.hp / 100).toFixed(2) + "%" : "-"
              const atkPct = maxLv ? "+" + (maxLv.attack / 100).toFixed(2) + "%" : "-"
              const defPct = maxLv ? "+" + (maxLv.defense / 100).toFixed(2) + "%" : "-"
              const season = formatSeason(hp.season)
              const thumb = heartprintThumb(hp.picture_path)
              const isLast = rowIdx === sorted.length - 1
              const exTotals = hp.passive_skill?.ex_effects?.length
                ? hp.passive_skill.ex_effects.reduce(
                    (acc, e: { critical?: number; penetration?: number; cooperation?: number; defcritical?: number; element?: number }) => ({
                      critical: acc.critical + (e.critical ?? 0),
                      penetration: acc.penetration + (e.penetration ?? 0),
                      cooperation: acc.cooperation + (e.cooperation ?? 0),
                      defcritical: acc.defcritical + (e.defcritical ?? 0),
                      element: acc.element + (e.element ?? 0),
                    }),
                    { critical: 0, penetration: 0, cooperation: 0, defcritical: 0, element: 0 },
                  )
                : null
              const exLines: { label: string; val: number }[] = exTotals
                ? [
                    { label: "Crit Dmg", val: exTotals.critical },
                    { label: "Pierce", val: exTotals.penetration },
                    { label: "Synergy", val: exTotals.cooperation },
                    { label: "Aegis", val: exTotals.defcritical },
                    { label: "Element", val: exTotals.element },
                  ].filter((x) => x.val > 0)
                : []
              return (
                <tr key={hp.heartprint_id} className={isLast ? "nk-hp-rowend" : ""} style={{ cursor: "pointer" }} onClick={() => onSelect(hp)}>
                  {rowIdx === 0 && (
                    <td rowSpan={sorted.length} style={{ textAlign: "center", verticalAlign: "middle", background: barColor }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.4)" }}>
                        {elemName}
                      </span>
                    </td>
                  )}
                  <td>
                    <div className="flex items-center gap-3">
                      <img src={thumb} alt={hp.title} style={{ width: 80, height: 48, objectFit: "cover", borderRadius: 6, flex: "none", background: "#0a1828" }} />
                      <div className="flex flex-col">
                        <span style={{ fontWeight: 700, color: "var(--cream)" }}>{hp.title}</span>
                        {season && <span style={{ fontSize: 11, color: "var(--cream-faint)", marginTop: 2 }}>{season}</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 800, color: "var(--cream)" }}>{hp.passive_skill_level ?? "-"}</td>
                  <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: 12, color: "#4ade80", whiteSpace: "nowrap" }}>{hpPct}</td>
                  <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: 12, color: "#f87171", whiteSpace: "nowrap" }}>{atkPct}</td>
                  <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: 12, color: "#60a5fa", whiteSpace: "nowrap" }}>{defPct}</td>
                  <td>
                    {exLines.length > 0 ? (
                      <div className="flex flex-col" style={{ gap: 2 }}>
                        {exLines.map((x) => (
                          <span key={x.label} style={{ fontSize: 11, color: "var(--cream-dim)", whiteSpace: "nowrap" }}>
                            {x.label} <span style={{ fontFamily: "monospace", color: "#fbbf24" }}>+{(x.val / 100).toFixed(2)}%</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: "var(--cream-faint)", fontSize: 12 }}>-</span>
                    )}
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

function HeartprintModal({ hp, onClose }: { hp: Heartprint; onClose: () => void }) {
  const large = heartprintLarge(hp.picture_path)
  const isEquipable = hp.still_type === "rare"
  const season = formatSeason(hp.season)
  const conditions = hp.unlock_conditions ?? []
  const hasObtain = season != null || conditions.length > 0 || !!hp.facility_source || !!hp.arena_rank_source || !!hp.event_source
  const rareLevels = hp.rare_levels ?? []
  const [selectedLevel, setSelectedLevel] = useState<number>(rareLevels.length > 0 ? rareLevels[rareLevels.length - 1].level : 1)
  const activeLevelData = rareLevels.find((l) => l.level === selectedLevel)
  const displayDesc = activeLevelData?.skill_description
    ? stripColorTags(activeLevelData.skill_description)
    : hp.skill_description
    ? stripColorTags(hp.skill_description)
    : null

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 11, color: "var(--cream-faint)", width: 64, flex: "none" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--cream)" }}>{value}</span>
    </div>
  )

  return (
    <div className="nk-modal-scrim" onClick={onClose}>
      <div className="nk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <img src={large} alt={hp.title} style={{ width: "100%", objectFit: "cover", display: "block" }} />
          {isEquipable && rareLevels.length > 0 && (
            <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 6, alignItems: "center" }}>
              {[1, 2, 3].map((pos) => (
                <button key={pos} onClick={(e) => { e.stopPropagation(); setSelectedLevel(pos) }} title={`Level ${pos}`}>
                  <img
                    src={`/UI/Texture/CommonEtcAtlas/iconRarity${selectedLevel}.webp`}
                    alt={`Level ${pos}`}
                    style={{ width: 32, height: 32, objectFit: "contain", opacity: pos <= selectedLevel ? 1 : 0.25, filter: pos <= selectedLevel ? "none" : "grayscale(1)" }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ margin: 0, font: "700 18px/1.2 var(--serif)", color: "var(--cream)" }}>{hp.title}</h2>
          {isEquipable && displayDesc && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--cream-dim)" }}>{displayDesc}</p>}
          {hasObtain && (
            <div>
              <p className="nk-pod-title" style={{ marginBottom: 8 }}>How to Obtain</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {season && row("From", <span style={{ color: "#fbbf24", fontWeight: 600 }}>{season}</span>)}
                {conditions.map((c, i) => <div key={i}>{row("Requires", formatCondition(c))}</div>)}
                {hp.facility_source && row("District", `${hp.facility_source.area_name} district progress level ${hp.facility_source.growth_value}`)}
                {hp.arena_rank_source && row("Arena", `Reach ${hp.arena_rank_source.rank_name} in the Valor Cup`)}
                {hp.event_source && row("Event", `${hp.event_source.quest_name ? `Complete quest "${hp.event_source.quest_name}" in a limited story event` : "Complete a limited story event"}${hp.event_source.is_missable ? " (Missable)" : ""}`)}
              </div>
            </div>
          )}
          {!hasObtain && <p style={{ fontSize: 12, color: "var(--cream-faint)", fontStyle: "italic" }}>No obtain information available.</p>}
        </div>
        <button onClick={onClose} className="nk-modal-close" aria-label="Close">✕</button>
      </div>
    </div>
  )
}

type ExFilterKey = "crit" | "pierce" | "synergy" | "aegis" | "gauge" | "soul" | "heal" | "skillpts"
const EX_FILTER_OPTIONS: { key: ExFilterKey; label: string }[] = [
  { key: "crit", label: "Critical" }, { key: "pierce", label: "Pierce" }, { key: "synergy", label: "Synergy" },
  { key: "aegis", label: "Aegis" }, { key: "gauge", label: "Gauge" }, { key: "soul", label: "Soul Change" },
  { key: "heal", label: "Heal / HP" }, { key: "skillpts", label: "Skill Points" },
]
const EX_FILTER_PATTERNS: Record<ExFilterKey, RegExp> = {
  crit: /critical power/i, pierce: /pierce power/i, synergy: /synergy power/i, aegis: /aegis power/i,
  gauge: /protection gauge/i, soul: /changes non-|soul of/i, heal: /heal|max hp/i, skillpts: /skill points/i,
}
function getRareDesc(hp: Heartprint): string {
  const levels = hp.rare_levels ?? []
  const last = levels[levels.length - 1]
  return stripColorTags(last?.skill_description ?? hp.skill_description ?? "")
}
function heartprintMatchesFilter(hp: Heartprint, key: ExFilterKey): boolean {
  return EX_FILTER_PATTERNS[key].test(getRareDesc(hp))
}

function EffectFilter({ selected, onToggle }: { selected: ExFilterKey[]; onToggle: (k: ExFilterKey) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="nk-dropdown" style={{ maxWidth: 260 }}>
      <button className="nk-dropdown-toggle" onClick={() => setOpen((o) => !o)}>
        <span>{selected.length > 0 ? `${selected.length} effect${selected.length > 1 ? "s" : ""}` : "Filter by effect"}</span>
        <span className="nk-dd-caret">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="nk-dropdown-panel">
          <div className="nk-dropdown-list" style={{ padding: 6 }}>
            {EX_FILTER_OPTIONS.map((o) => {
              const checked = selected.includes(o.key)
              return (
                <button key={o.key} className={`nk-dropdown-item${checked ? " is-active" : ""}`} onClick={() => onToggle(o.key)} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, border: "1px solid var(--line-strong)", background: checked ? "var(--red-bright)" : "transparent", flex: "none", display: "grid", placeItems: "center", fontSize: 10, color: "#fff" }}>
                    {checked ? "✓" : ""}
                  </span>
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function NightInkHeartprintsBrowser({ heartprints }: { heartprints: Heartprint[] }) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Heartprint | null>(null)
  const [exFilters, setExFilters] = useState<ExFilterKey[]>([])

  const toggleExFilter = (k: ExFilterKey) => setExFilters((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return heartprints
    return heartprints.filter(
      (hp) =>
        hp.title.toLowerCase().includes(q) ||
        (hp.skill_description && stripColorTags(hp.skill_description).toLowerCase().includes(q)) ||
        (hp.season && hp.season.toLowerCase().includes(q)),
    )
  }, [heartprints, search])

  const allEquipable = filtered.filter((hp) => hp.still_type === "rare").sort((a, b) => a.order - b.order)
  const equipable = exFilters.length > 0 ? allEquipable.filter((hp) => exFilters.every((k) => heartprintMatchesFilter(hp, k))) : allEquipable
  const notEquipable = filtered.filter((hp) => hp.still_type === "normal").sort((a, b) => a.order - b.order)

  return (
    <NkBoard>
      <NkHeaderPod
        kicker="Memory Stills"
        title="Heart"
        accent="prints"
        sub="Every Heartprint in the game — equipable stat stills and the element-bonus collection set."
        actions={
          <div className="nk-searchbar" style={{ minWidth: 280 }}>
            <Search />
            <input placeholder="Search heartprints…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      />

      <NkPod style={{ marginTop: 30 }} label="Equipable heartprints">
        <div className="nk-row" style={{ marginBottom: 18 }}>
          <span className="nk-seclabel">Equipable</span>
          <span className="nk-count"><b>{equipable.length}</b></span>
          <EffectFilter selected={exFilters} onToggle={toggleExFilter} />
        </div>
        {equipable.length === 0 ? (
          <p className="nk-muted">No heartprints found.</p>
        ) : (
          <div className="nk-hp-grid">
            {equipable.map((hp) => (
              <HeartprintCard key={hp.heartprint_id} hp={hp} onClick={() => setSelected(hp)} />
            ))}
          </div>
        )}
      </NkPod>

      <NkPod style={{ marginTop: 26 }} label="Not equipable heartprints">
        <div className="nk-row" style={{ marginBottom: 16 }}>
          <span className="nk-seclabel">Not Equipable</span>
          <span className="nk-count"><b>{notEquipable.length}</b></span>
          <span className="nk-muted" style={{ fontSize: 12 }}>Click a row to see how to obtain it</span>
        </div>
        <NotEquipableTable heartprints={notEquipable} onSelect={setSelected} />
      </NkPod>

      {selected && <HeartprintModal hp={selected} onClose={() => setSelected(null)} />}
    </NkBoard>
  )
}
