"use client"

import Link from "next/link"
import Image from "next/image"
import { toPublicAssetPath } from "@/lib/pc-wiki"
import {
  extractOrbConvertEntries,
  getOrbCellEntries,
  getOrbTableRows,
  groupOrbTableRows,
  ORB_TARGET_CONFIG,
  FROM_TYPE_CONFIG,
  ORB_AMOUNTS,
  type OrbTarget,
  type OrbAmount,
} from "@/lib/orb-converter-parser"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const SOLO_TABS: OrbTarget[] = ["blue", "green", "orange"]
const COMBINED_TARGETS: OrbTarget[] = ["unity", "steal", "give", "reset"]

const COMBINED_ORB_COLORS: Record<OrbTarget, string> = {
  blue:   "",
  green:  "",
  orange: "",
  unity:  "bg-purple-900 text-purple-100",
  steal:  "bg-pink-900 text-pink-100",
  give:   "bg-emerald-900 text-emerald-100",
  reset:  "bg-cyan-900 text-cyan-100",
}

// Beach-theme table tokens (cream surfaces + navy ink). Sticky cells use OPAQUE
// creams so horizontally/vertically scrolled content does not bleed through.
const HAIRLINE = "border-border/[0.22]"

// Color-coded orb tabs as glossy gradient chips (To Blue=blue, To Green=green, To Orange=orange).
const TAB_GRADIENT: Record<string, string> = {
  blue: "data-[state=active]:bg-[linear-gradient(180deg,#3bb8ff,#0877cf)] data-[state=active]:shadow-[0_4px_10px_rgba(8,119,207,0.30)]",
  green: "data-[state=active]:bg-[linear-gradient(180deg,#4bd99a,#159c5b)] data-[state=active]:shadow-[0_4px_10px_rgba(21,156,91,0.30)]",
  orange: "data-[state=active]:bg-[linear-gradient(180deg,#ffa45c,#e2682f)] data-[state=active]:shadow-[0_4px_10px_rgba(226,104,47,0.30)]",
}

export default function OrbConverterTable() {
  const entries = extractOrbConvertEntries()

  const CharCell = ({ entry }: { entry: ReturnType<typeof extractOrbConvertEntries>[number] }) => (
    <Link
      key={`${entry.character.master_pc_id}-${entry.skillSlot}-${entry.isSkillChange}`}
      href={`/characters/${entry.character.master_pc_id}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`${entry.character.name}${entry.character.affiliation_name ? ` — ${entry.character.affiliation_name}` : ""}${entry.isSkillChange ? " (Skill Change)" : ""}\n${entry.conversionLine}`}
      className="block relative"
    >
      <div className="relative w-9 h-9 sm:w-12 sm:h-12 overflow-hidden rounded-md transition-all hover:brightness-110 hover:ring-2 hover:ring-[#0a9baa]/70">
        <Image src={toPublicAssetPath(entry.character.images.icon)} alt={entry.character.name} fill className="object-cover" />
      </div>
      {entry.isSkillChange && (
        <img
          src="/skill-icons/skill_integrated_3400001_ItemM.webp"
          alt="Skill Change"
          className="absolute bottom-0 right-0 w-4 h-4 sm:w-5 sm:h-5 z-[1] select-none"
          draggable={false}
        />
      )}
    </Link>
  )

  const OrbTable = ({ toOrb }: { toOrb: OrbTarget }) => {
    const count = new Set(
      entries.filter((e) => e.toOrb === toOrb).map((e) => `${e.character.master_pc_id}-${e.skillSlot}`)
    ).size
    const rows = getOrbTableRows(entries, toOrb)
    const groups = groupOrbTableRows(rows)
    if (groups.length === 0) return <p className="text-sm text-foreground">No data found.</p>

    return (
      <div className="flex flex-col gap-4">
        <div className={`self-start rounded-full border ${HAIRLINE} bg-card/85 px-4 py-1.5 shadow-[0_8px_20px_rgba(20,54,120,0.10)] backdrop-blur-md`}>
          <p className="text-sm text-foreground">
            Showing <span className="font-semibold text-accent">{count} entries</span> with orb convert skills.
          </p>
        </div>
        <div className={`orb-converter-table-shell w-full overflow-x-auto rounded-2xl border ${HAIRLINE} bg-card/[0.88] shadow-[0_14px_36px_rgba(20,54,120,0.13)] backdrop-blur-md`}>
          <table className="w-full min-w-[860px] border-separate border-spacing-0 text-xs sm:text-sm">
            <thead className={`sticky top-0 z-20 border-b ${HAIRLINE}`}>
              <tr>
                <th className={`px-2 py-2 text-left font-bold text-foreground whitespace-nowrap sticky left-0 z-30 bg-popover min-w-[88px] sm:min-w-[124px] border-b ${HAIRLINE}`}>From / Type</th>
                <th className={`px-2 py-2 text-center font-bold text-foreground whitespace-nowrap sticky left-[110px] sm:left-[124px] z-30 bg-popover min-w-[56px] border-b ${HAIRLINE}`}>SP Cost</th>
                {ORB_AMOUNTS.map((amt) => (
                  <th key={amt} className={`px-2 py-2 text-center font-bold text-foreground whitespace-nowrap min-w-[100px] sm:min-w-[160px] bg-popover border-b ${HAIRLINE}`}>{amt}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group, groupIdx) => {
                const cfg = FROM_TYPE_CONFIG[group.fromType] ?? { label: group.fromType, bgClass: "" }
                const altGroup = groupIdx % 2 !== 0
                return group.subRows.map((subRow, subIdx) => {
                  const altSub = subIdx % 2 !== 0
                  const trBg = altGroup
                    ? (altSub ? "bg-border/[0.09]" : "bg-border/[0.04]")
                    : (altSub ? "bg-border/[0.07]" : "")
                  const stickyBg = altGroup
                    ? (altSub ? "bg-muted" : "bg-popover")
                    : (altSub ? "bg-popover" : "bg-card")
                  return (
                  <tr key={`${group.fromType}-${subRow.spCostLabel}`} className={`border-b ${HAIRLINE} transition-colors hover:bg-[rgba(125,205,225,0.10)] ${trBg}`}>
                    {subIdx === 0 && (
                      <td rowSpan={group.subRows.length} className={`px-2 py-2 text-left text-xs font-bold leading-tight border-r ${HAIRLINE} sticky left-0 z-10 ${altGroup ? "bg-popover" : "bg-card"} text-foreground min-w-[88px] sm:min-w-[124px] whitespace-normal`}>
                        {cfg.label}
                      </td>
                    )}
                    <td className={`px-2 py-2 text-center text-xs font-semibold text-foreground whitespace-nowrap border-r ${HAIRLINE} sticky left-[110px] sm:left-[124px] z-10 ${stickyBg} min-w-[56px]`}>
                      {subRow.spCostLabel}
                    </td>
                    {(ORB_AMOUNTS as readonly OrbAmount[]).map((amount) => {
                      const cellEntries = getOrbCellEntries(entries, toOrb, group.fromType, subRow.spCostLabel, amount)
                      return (
                        <td key={amount} className={`p-0 border-r ${HAIRLINE} align-top`}>
                          {cellEntries.length > 0 ? (
                            <div className="grid grid-cols-4 gap-0.5 p-0.5">
                              {cellEntries.map((entry) => <CharCell key={`${entry.character.master_pc_id}-${entry.skillSlot}-${entry.isSkillChange}`} entry={entry} />)}
                            </div>
                          ) : (
                            <div className="px-2 py-3 text-center text-xs text-foreground/35">—</div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                  )
                })
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const CombinedTable = () => {
    const count = new Set(
      entries.filter((e) => COMBINED_TARGETS.includes(e.toOrb)).map((e) => `${e.character.master_pc_id}-${e.skillSlot}`)
    ).size

    // Build sections: only targets that have rows
    const sections = COMBINED_TARGETS.flatMap((toOrb) => {
      const groups = groupOrbTableRows(getOrbTableRows(entries, toOrb))
      if (groups.length === 0) return []
      return [{ toOrb, groups }]
    })

    if (sections.length === 0) return <p className="text-sm text-foreground">No data found.</p>

    return (
      <div className="flex flex-col gap-4">
        <div className={`self-start rounded-full border ${HAIRLINE} bg-card/85 px-4 py-1.5 shadow-[0_8px_20px_rgba(20,54,120,0.10)] backdrop-blur-md`}>
          <p className="text-sm text-foreground">
            Showing <span className="font-semibold text-accent">{count} entries</span> with orb convert skills.
          </p>
        </div>
        <div className={`orb-converter-table-shell w-full overflow-x-auto rounded-2xl border ${HAIRLINE} bg-card/[0.88] shadow-[0_14px_36px_rgba(20,54,120,0.13)] backdrop-blur-md`}>
          <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-xs sm:text-sm">
            <thead className={`sticky top-0 z-20 border-b ${HAIRLINE}`}>
              <tr>
                <th className={`px-2 py-2 text-center font-bold text-foreground whitespace-nowrap sticky left-0 z-30 bg-popover min-w-[60px] sm:min-w-[80px] border-b ${HAIRLINE}`}>To Orb</th>
                <th className={`px-2 py-2 text-left font-bold text-foreground whitespace-nowrap sticky left-[60px] sm:left-[80px] z-30 bg-popover min-w-[88px] sm:min-w-[124px] border-b ${HAIRLINE}`}>From / Type</th>
                <th className={`px-2 py-2 text-center font-bold text-foreground whitespace-nowrap sticky left-[170px] sm:left-[200px] z-30 bg-popover min-w-[56px] border-b ${HAIRLINE}`}>SP Cost</th>
                {ORB_AMOUNTS.map((amt) => (
                  <th key={amt} className={`px-2 py-2 text-center font-bold text-foreground whitespace-nowrap min-w-[100px] sm:min-w-[160px] bg-popover border-b ${HAIRLINE}`}>{amt}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map(({ toOrb, groups }, sectionIdx) => {
                const orbCfg = ORB_TARGET_CONFIG[toOrb]
                const totalSubRows = groups.reduce((s, g) => s + g.subRows.length, 0)
                let orbCellRendered = false
                const altSection = sectionIdx % 2 !== 0
                const orbCellBg = altSection ? "bg-popover" : "bg-card"

                return groups.map((group, groupIdx) => {
                  const cfg = FROM_TYPE_CONFIG[group.fromType] ?? { label: group.fromType, bgClass: "" }
                  const altGroup = groupIdx % 2 !== 0
                  return group.subRows.map((subRow, subIdx) => {
                    const altSub = subIdx % 2 !== 0
                    const trBg = altGroup
                      ? (altSub ? "bg-border/[0.09]" : "bg-border/[0.04]")
                      : (altSub ? "bg-border/[0.07]" : "")
                    const stickyBg = altGroup
                      ? (altSub ? "bg-muted" : "bg-popover")
                      : (altSub ? "bg-popover" : "bg-card")
                    const isFirstOfSection = !orbCellRendered && subIdx === 0
                    if (isFirstOfSection) orbCellRendered = true
                    const sectionDivider = sectionIdx > 0 && groupIdx === 0 && subIdx === 0 ? "border-t-2 border-t-[rgba(10,155,170,0.45)]" : ""
                    return (
                      <tr key={`${toOrb}-${group.fromType}-${subRow.spCostLabel}`} className={`border-b ${HAIRLINE} transition-colors hover:bg-[rgba(125,205,225,0.10)] ${trBg} ${sectionDivider}`}>
                        {isFirstOfSection && (
                          <td rowSpan={totalSubRows} className={`px-1 py-2 text-center text-xs font-bold leading-tight border-r ${HAIRLINE} sticky left-0 z-10 ${orbCellBg} text-foreground min-w-[60px] sm:min-w-[80px] whitespace-normal`}>
                            {orbCfg.label}
                          </td>
                        )}
                        {subIdx === 0 && (
                          <td rowSpan={group.subRows.length} className={`px-2 py-2 text-left text-xs font-bold leading-tight border-r ${HAIRLINE} sticky left-[60px] sm:left-[80px] z-10 ${altGroup ? "bg-popover" : "bg-card"} text-foreground min-w-[88px] sm:min-w-[124px] whitespace-normal`}>
                            {cfg.label}
                          </td>
                        )}
                        <td className={`px-2 py-2 text-center text-xs font-semibold text-foreground whitespace-nowrap border-r ${HAIRLINE} sticky left-[170px] sm:left-[200px] z-10 ${stickyBg} min-w-[56px]`}>
                          {subRow.spCostLabel}
                        </td>
                        {(ORB_AMOUNTS as readonly OrbAmount[]).map((amount) => {
                          const cellEntries = getOrbCellEntries(entries, toOrb, group.fromType, subRow.spCostLabel, amount)
                          return (
                            <td key={amount} className={`p-0 border-r ${HAIRLINE} align-top`}>
                              {cellEntries.length > 0 ? (
                                <div className="grid grid-cols-4 gap-0.5 p-0.5">
                                  {cellEntries.map((entry) => <CharCell key={`${entry.character.master_pc_id}-${entry.skillSlot}-${entry.isSkillChange}`} entry={entry} />)}
                                </div>
                              ) : (
                                <div className="px-2 py-3 text-center text-xs text-foreground/35">—</div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })
                })
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <Tabs defaultValue="blue" className="w-full">
      <TabsList className={`orb-converter-tabs mb-4 flex h-auto w-full flex-wrap justify-start gap-1.5 rounded-xl border ${HAIRLINE} bg-card/[0.72] p-1.5 backdrop-blur-md`}>
        {SOLO_TABS.map((target) => {
          const cfg = ORB_TARGET_CONFIG[target]
          return (
            <TabsTrigger key={target} value={target} className={`rounded-md px-3 py-1.5 text-xs font-bold text-foreground data-[state=active]:text-white sm:text-sm ${TAB_GRADIENT[target] ?? ""}`}>
              {cfg.label}
            </TabsTrigger>
          )
        })}
        <TabsTrigger value="combined" className="rounded-md px-3 py-1.5 text-xs font-bold text-foreground data-[state=active]:bg-[linear-gradient(180deg,#a78bfa,#7c3aed)] data-[state=active]:text-white data-[state=active]:shadow-[0_4px_10px_rgba(124,58,237,0.30)] sm:text-sm">
          Unity / Steal / Give / Reset
        </TabsTrigger>
      </TabsList>

      {SOLO_TABS.map((target) => (
        <TabsContent key={target} value={target} className="mt-0">
          <OrbTable toOrb={target} />
        </TabsContent>
      ))}
      <TabsContent value="combined" className="mt-0">
        <CombinedTable />
      </TabsContent>
    </Tabs>
  )
}
