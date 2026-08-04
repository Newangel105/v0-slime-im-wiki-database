"use client"

import Link from "next/link"
import Image from "next/image"
import { toPublicAssetPath } from "@/lib/pc-wiki"
import {
  getCharactersForCell,
  GAUGE_ROWS,
  GAUGE_COLUMNS,
  SKILL_POINT_GAUGE_ROWS,
  SKILL_POINT_GAUGE_COLUMNS,
  SECRET_SKILL_GAUGE_ROWS,
  SECRET_SKILL_GAUGE_COLUMNS,
  type GaugeEntry,
} from "@/lib/gauge-parser"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function ClassicGaugeBuilderTable({ gaugeEntries }: { gaugeEntries: GaugeEntry[] }) {

  const GaugeTable = ({ gaugeType }: { gaugeType: "protection" | "skillPoint" | "secretSkill" }) => {
    const gaugeLabel = {
      protection: "Protection Gauge",
      skillPoint: "Skill Point Gauge",
      secretSkill: "Secret Skill Gauge",
    }[gaugeType]

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
        <p className="text-sm text-gray-300">
          Showing <span className="font-semibold text-blue-400">{count} characters</span> with gauge traits organized by timing and amount.
        </p>
        <div className="w-fit max-w-full overflow-x-auto border border-gray-700 rounded-lg bg-[#1f2937]">
          <table className="text-xs sm:text-sm">
            <thead className="bg-[#111827] border-b border-gray-700 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-gray-300 whitespace-nowrap sticky left-0 z-20 bg-[#111827] w-16 sm:w-32">Turn(s)</th>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="px-2 py-2 text-center font-semibold text-gray-300 whitespace-nowrap min-w-[150px] sm:min-w-[230px]"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row} className="border-b border-gray-700 hover:bg-[#374151] transition-colors">
                  <td className="px-1 sm:px-3 py-2 sm:py-3 text-left font-semibold text-gray-200 bg-[#111827] sticky left-0 z-10 w-16 sm:w-32 whitespace-nowrap text-xs sm:text-sm leading-tight">
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
                        className="p-0 border-r border-gray-700 align-top"
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
                                <div className="relative w-9 h-9 sm:w-14 sm:h-14 overflow-hidden hover:brightness-110 hover:ring-1 hover:ring-blue-400 transition-all cursor-pointer">
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
                          <div className="text-gray-600 text-xs px-3 py-4">—</div>
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
        <TabsList className="grid w-full grid-cols-3 gap-2 bg-[#111827] border border-gray-700 p-1">
          <TabsTrigger value="protection" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Protection
          </TabsTrigger>
          <TabsTrigger value="skillPoint" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
            Skill Points
          </TabsTrigger>
          <TabsTrigger value="secretSkill" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
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
