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

export function ClassicOrbConverterTable() {
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
      <div className="relative w-9 h-9 sm:w-14 sm:h-14 overflow-hidden hover:brightness-110 hover:ring-1 hover:ring-blue-400 transition-all">
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
    if (groups.length === 0) return <p className="text-gray-400 text-sm">No data found.</p>

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-300">
          Showing <span className="font-semibold text-blue-400">{count} entries</span> with orb convert skills.
        </p>
        <div className="w-fit max-w-full overflow-x-auto border border-gray-700 rounded-lg bg-[#1f2937]">
          <table className="text-xs sm:text-sm border-separate border-spacing-0">
            <thead className="bg-[#111827] border-b border-gray-700 sticky top-0 z-20">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-gray-300 whitespace-nowrap sticky left-0 z-30 bg-[#111827] min-w-[110px] sm:min-w-[160px]">From / Type</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-300 whitespace-nowrap sticky left-[110px] sm:left-[160px] z-30 bg-[#111827] min-w-[56px]">SP Cost</th>
                {ORB_AMOUNTS.map((amt) => (
                  <th key={amt} className="px-2 py-2 text-center font-semibold text-gray-300 whitespace-nowrap min-w-[150px] sm:min-w-[230px]">{amt}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group, groupIdx) => {
                const cfg = FROM_TYPE_CONFIG[group.fromType] ?? { label: group.fromType, bgClass: "bg-gray-700 text-white" }
                const altGroup = groupIdx % 2 !== 0
                return group.subRows.map((subRow, subIdx) => {
                  const altSub = subIdx % 2 !== 0
                  const trBg = altGroup
                    ? (altSub ? "bg-[#253a4a]" : "bg-[#1e2d40]")
                    : (altSub ? "bg-[#1a2232]" : "")
                  const stickyBg = altGroup
                    ? (altSub ? "bg-[#1e3042]" : "bg-[#182838]")
                    : (altSub ? "bg-[#141e2e]" : "bg-[#111827]")
                  return (
                  <tr key={`${group.fromType}-${subRow.spCostLabel}`} className={`border-b border-gray-700 hover:bg-[#374151] transition-colors ${trBg}`}>
                    {subIdx === 0 && (
                      <td rowSpan={group.subRows.length} className={`px-2 py-2 text-left text-xs font-bold leading-tight border-r border-gray-700 sticky left-0 z-10 ${altGroup ? "bg-[#182838]" : "bg-[#111827]"} text-gray-100 min-w-[110px] sm:min-w-[160px] whitespace-normal`}>
                        {cfg.label}
                      </td>
                    )}
                    <td className={`px-2 py-2 text-center text-xs font-semibold text-gray-200 whitespace-nowrap border-r border-gray-700 sticky left-[110px] sm:left-[160px] z-10 ${stickyBg} min-w-[56px]`}>
                      {subRow.spCostLabel}
                    </td>
                    {(ORB_AMOUNTS as readonly OrbAmount[]).map((amount) => {
                      const cellEntries = getOrbCellEntries(entries, toOrb, group.fromType, subRow.spCostLabel, amount)
                      return (
                        <td key={amount} className="p-0 border-r border-gray-700 align-top">
                          {cellEntries.length > 0 ? (
                            <div className="grid grid-cols-4 gap-0.5 p-0.5">
                              {cellEntries.map((entry) => <CharCell key={`${entry.character.master_pc_id}-${entry.skillSlot}-${entry.isSkillChange}`} entry={entry} />)}
                            </div>
                          ) : (
                            <div className="text-gray-600 text-xs px-2 py-3 text-center">—</div>
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

    if (sections.length === 0) return <p className="text-gray-400 text-sm">No data found.</p>

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-300">
          Showing <span className="font-semibold text-blue-400">{count} entries</span> with orb convert skills.
        </p>
        <div className="w-fit max-w-full overflow-x-auto border border-gray-700 rounded-lg bg-[#1f2937]">
          <table className="text-xs sm:text-sm border-separate border-spacing-0">
            <thead className="bg-[#111827] border-b border-gray-700 sticky top-0 z-20">
              <tr>
                <th className="px-2 py-2 text-center font-semibold text-gray-300 whitespace-nowrap sticky left-0 z-30 bg-[#111827] min-w-[60px] sm:min-w-[80px]">To Orb</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-300 whitespace-nowrap sticky left-[60px] sm:left-[80px] z-30 bg-[#111827] min-w-[110px] sm:min-w-[160px]">From / Type</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-300 whitespace-nowrap sticky left-[170px] sm:left-[240px] z-30 bg-[#111827] min-w-[56px]">SP Cost</th>
                {ORB_AMOUNTS.map((amt) => (
                  <th key={amt} className="px-2 py-2 text-center font-semibold text-gray-300 whitespace-nowrap min-w-[150px] sm:min-w-[230px]">{amt}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map(({ toOrb, groups }, sectionIdx) => {
                const orbCfg = ORB_TARGET_CONFIG[toOrb]
                const orbColor = COMBINED_ORB_COLORS[toOrb]
                const totalSubRows = groups.reduce((s, g) => s + g.subRows.length, 0)
                let orbCellRendered = false
                const altSection = sectionIdx % 2 !== 0
                const orbCellBg = altSection ? "bg-[#1e2838]" : "bg-[#111827]"

                return groups.map((group, groupIdx) => {
                  const cfg = FROM_TYPE_CONFIG[group.fromType] ?? { label: group.fromType, bgClass: "bg-gray-700 text-white" }
                  const altGroup = groupIdx % 2 !== 0
                  return group.subRows.map((subRow, subIdx) => {
                    const altSub = subIdx % 2 !== 0
                    const trBg = altGroup
                      ? (altSub ? "bg-[#253a4a]" : "bg-[#1e2d40]")
                      : (altSub ? "bg-[#1a2232]" : "")
                    const stickyBg = altGroup
                      ? (altSub ? "bg-[#1e3042]" : "bg-[#182838]")
                      : (altSub ? "bg-[#141e2e]" : "bg-[#111827]")
                    const isFirstOfSection = !orbCellRendered && subIdx === 0
                    if (isFirstOfSection) orbCellRendered = true
                    const sectionDivider = sectionIdx > 0 && groupIdx === 0 && subIdx === 0 ? "border-t-2 border-t-gray-500" : ""
                    return (
                      <tr key={`${toOrb}-${group.fromType}-${subRow.spCostLabel}`} className={`border-b border-gray-700 hover:bg-[#374151] transition-colors ${trBg} ${sectionDivider}`}>
                        {isFirstOfSection && (
                          <td rowSpan={totalSubRows} className={`px-1 py-2 text-center text-xs font-bold leading-tight border-r border-gray-700 sticky left-0 z-10 ${orbCellBg} text-gray-100 min-w-[60px] sm:min-w-[80px] whitespace-normal`}>
                            {orbCfg.label}
                          </td>
                        )}
                        {subIdx === 0 && (
                          <td rowSpan={group.subRows.length} className={`px-2 py-2 text-left text-xs font-bold leading-tight border-r border-gray-700 sticky left-[60px] sm:left-[80px] z-10 ${altGroup ? "bg-[#182838]" : "bg-[#111827]"} text-gray-100 min-w-[110px] sm:min-w-[160px] whitespace-normal`}>
                            {cfg.label}
                          </td>
                        )}
                        <td className={`px-2 py-2 text-center text-xs font-semibold text-gray-200 whitespace-nowrap border-r border-gray-700 sticky left-[170px] sm:left-[240px] z-10 ${stickyBg} min-w-[56px]`}>
                          {subRow.spCostLabel}
                        </td>
                        {(ORB_AMOUNTS as readonly OrbAmount[]).map((amount) => {
                          const cellEntries = getOrbCellEntries(entries, toOrb, group.fromType, subRow.spCostLabel, amount)
                          return (
                            <td key={amount} className="p-0 border-r border-gray-700 align-top">
                              {cellEntries.length > 0 ? (
                                <div className="grid grid-cols-4 gap-0.5 p-0.5">
                                  {cellEntries.map((entry) => <CharCell key={`${entry.character.master_pc_id}-${entry.skillSlot}-${entry.isSkillChange}`} entry={entry} />)}
                                </div>
                              ) : (
                                <div className="text-gray-600 text-xs px-2 py-3 text-center">—</div>
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
      <TabsList className="flex h-auto flex-wrap gap-1 bg-[#111827] border border-gray-700 p-1 rounded-lg mb-4">
        {SOLO_TABS.map((target) => {
          const cfg = ORB_TARGET_CONFIG[target]
          return (
            <TabsTrigger key={target} value={target} className={`text-xs sm:text-sm px-3 py-1.5 rounded ${cfg.tabClass}`}>
              {cfg.label}
            </TabsTrigger>
          )
        })}
        <TabsTrigger value="combined" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-violet-600 data-[state=active]:text-white">
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

