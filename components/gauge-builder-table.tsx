"use client"

import Link from "next/link"
import Image from "next/image"
import { toPublicAssetPath } from "@/lib/pc-wiki"
import {
  extractGaugeEntries,
  getCharactersForCell,
  GAUGE_ROWS,
  GAUGE_COLUMNS,
  SKILL_POINT_GAUGE_ROWS,
  SKILL_POINT_GAUGE_COLUMNS,
  SECRET_SKILL_GAUGE_ROWS,
  SECRET_SKILL_GAUGE_COLUMNS,
} from "@/lib/gauge-parser"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Beach-theme tokens: warm hairline border + glossy-blue active tab chip.
const HAIRLINE = "border-border/[0.22]"
// Color-coded gauge tabs (Protection=blue, Skill Points=green, Secret Skills=orange),
// rendered as glossy gradient chips with white text so they read on the cream track.
const TAB_BASE = "rounded-md font-bold text-foreground data-[state=active]:text-white"
const TAB_BLUE = "data-[state=active]:bg-[linear-gradient(180deg,#3b8fe0,#1f5da0)] data-[state=active]:shadow-[0_4px_10px_rgba(8,119,207,0.30)]"
const TAB_GREEN = "data-[state=active]:bg-[linear-gradient(180deg,#3fb985,#1c8b58)] data-[state=active]:shadow-[0_4px_10px_rgba(21,156,91,0.30)]"
const TAB_ORANGE = "data-[state=active]:bg-[linear-gradient(180deg,#e6914a,#c4622a)] data-[state=active]:shadow-[0_4px_10px_rgba(226,104,47,0.30)]"

export default function GaugeBuilderTable() {
  const gaugeEntries = extractGaugeEntries()

  const GaugeTable = ({ gaugeType }: { gaugeType: "protection" | "skillPoint" | "secretSkill" }) => {
    const count = new Set(
      gaugeEntries.filter((e) => e.gaugeType === gaugeType).map((e) => e.character.master_pc_id)
    ).size

    const rows: readonly string[] =
      gaugeType === "skillPoint" ? SKILL_POINT_GAUGE_ROWS :
      gaugeType === "secretSkill" ? SECRET_SKILL_GAUGE_ROWS :
      GAUGE_ROWS
    const columns: readonly string[] =
      gaugeType === "skillPoint" ? SKILL_POINT_GAUGE_COLUMNS :
      gaugeType === "secretSkill" ? SECRET_SKILL_GAUGE_COLUMNS :
      GAUGE_COLUMNS

    return (
      <div className="flex flex-col gap-4">
        <div className={`self-start rounded-full border ${HAIRLINE} bg-card/85 px-4 py-1.5 shadow-[0_8px_20px_rgba(20,54,120,0.10)] backdrop-blur-md`}>
          <p className="text-sm text-foreground">
            Showing <span className="font-semibold tabular-nums text-accent">{count} characters</span> with gauge traits organized by timing and amount.
          </p>
        </div>
        <div className={`w-full overflow-x-auto rounded-2xl border ${HAIRLINE} bg-card/[0.88] shadow-[0_14px_36px_rgba(20,54,120,0.13)] backdrop-blur-md`}>
          <table className="w-full text-xs sm:text-sm">
            <thead className={`sticky top-0 border-b ${HAIRLINE}`}>
              <tr>
                <th className={`px-2 py-2 text-left font-bold text-foreground whitespace-nowrap sticky left-0 z-20 bg-popover w-16 sm:w-32 border-b ${HAIRLINE}`}>Turn(s)</th>
                {columns.map((column) => (
                  <th
                    key={column}
                    className={`px-2 py-2 text-center font-bold text-foreground whitespace-nowrap min-w-[100px] sm:min-w-[160px] bg-popover border-b ${HAIRLINE}`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row} className={`border-b ${HAIRLINE} transition-colors hover:bg-[rgba(210,69,58,0.10)]`}>
                  <td className={`px-1 sm:px-3 py-2 sm:py-3 text-left font-bold text-foreground bg-popover sticky left-0 z-10 w-16 sm:w-32 whitespace-nowrap text-xs sm:text-sm leading-tight border-r ${HAIRLINE}`}>
                    {row}
                  </td>
                  {columns.map((column) => {
                    const cellCharacters = getCharactersForCell(
                      gaugeEntries,
                      gaugeType,
                      row,
                      column
                    )

                    return (
                      <td
                        key={`${row}-${column}`}
                        className={`p-0 border-r ${HAIRLINE} align-top`}
                      >
                        {cellCharacters.length > 0 ? (
                          <div className="grid grid-cols-4 gap-0.5 p-0.5">
                            {cellCharacters.map((character) => (
                              <Link
                                key={character.master_pc_id}
                                href={`/characters/${character.master_pc_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`${character.name}${character.affiliation_name ? ` — ${character.affiliation_name}` : ""}`}
                                className="block"
                              >
                                <div className="relative w-9 h-9 sm:w-12 sm:h-12 overflow-hidden rounded-md transition-all hover:brightness-110 hover:ring-2 hover:ring-[#d2453a]/70 cursor-pointer">
                                  <Image
                                    src={toPublicAssetPath(character.images.icon)}
                                    alt={character.name}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="px-3 py-4 text-xs text-foreground/35">—</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Tabs defaultValue="protection" className="w-full">
        <TabsList className={`grid w-full grid-cols-3 gap-1.5 rounded-xl border ${HAIRLINE} bg-card/[0.72] p-1.5 backdrop-blur-md`}>
          <TabsTrigger value="protection" className={`${TAB_BASE} ${TAB_BLUE}`}>
            Protection
          </TabsTrigger>
          <TabsTrigger value="skillPoint" className={`${TAB_BASE} ${TAB_GREEN}`}>
            Skill Points
          </TabsTrigger>
          <TabsTrigger value="secretSkill" className={`${TAB_BASE} ${TAB_ORANGE}`}>
            Secret Skills
          </TabsTrigger>
        </TabsList>

        <TabsContent value="protection" className="mt-6">
          <GaugeTable gaugeType="protection" />
        </TabsContent>

        <TabsContent value="skillPoint" className="mt-6">
          <GaugeTable gaugeType="skillPoint" />
        </TabsContent>

        <TabsContent value="secretSkill" className="mt-6">
          <GaugeTable gaugeType="secretSkill" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
