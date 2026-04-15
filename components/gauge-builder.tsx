"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { toPublicAssetPath } from "@/lib/pc-wiki"
import {
  extractGaugeEntries,
  getCharactersForCell,
  GAUGE_ROWS,
  GAUGE_COLUMNS,
  type GaugeRow,
  type GaugeColumn,
} from "@/lib/gauge-parser"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function GaugeBuilder() {
  const [hoveredCharacter, setHoveredCharacter] = useState<string | null>(null)

  const gaugeEntries = useMemo(() => extractGaugeEntries(), [])

  const GaugeTable = ({ gaugeType }: { gaugeType: "protection" | "skillPoint" | "secretSkill" }) => {
    const gaugeLabel = {
      protection: "Protection Gauge",
      skillPoint: "Skill Point Gauge",
      secretSkill: "Secret Skill Gauge",
    }[gaugeType]

    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-xl font-bold text-white">{gaugeLabel}</h3>
        <div className="overflow-x-auto border border-gray-700 rounded-lg bg-[#1f2937]">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-[#111827] border-b border-gray-700 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-300 w-24">Turn(s)</th>
                {GAUGE_COLUMNS.map((column) => (
                  <th
                    key={column}
                    className="px-2 py-2 text-center font-semibold text-gray-300 whitespace-nowrap"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GAUGE_ROWS.map((row) => (
                <tr key={row} className="border-b border-gray-700 hover:bg-[#374151] transition-colors">
                  <td className="px-3 py-3 text-left font-semibold text-gray-200 bg-[#111827]">
                    {row}
                  </td>
                  {GAUGE_COLUMNS.map((column) => {
                    const cellCharacters = getCharactersForCell(
                      gaugeEntries,
                      gaugeType,
                      row as GaugeRow,
                      column as GaugeColumn
                    )

                    return (
                      <td
                        key={`${row}-${column}`}
                        className="px-2 py-3 text-center border-r border-gray-700"
                      >
                        <div className="flex flex-wrap gap-1 justify-center items-center">
                          {cellCharacters.length > 0 ? (
                            cellCharacters.map((character) => (
                              <div
                                key={character.name}
                                className="relative group"
                                onMouseEnter={() => setHoveredCharacter(character.name)}
                                onMouseLeave={() => setHoveredCharacter(null)}
                              >
                                <div className="relative w-12 h-12 rounded border-2 border-gray-600 overflow-hidden hover:border-blue-400 transition-colors">
                                  <Image
                                    src={toPublicAssetPath(character.images.icon)}
                                    alt={character.name}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                {hoveredCharacter === character.name && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black/90 text-white px-2 py-1 rounded text-xs whitespace-nowrap z-10">
                                    {character.name}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-gray-600 text-xs h-12 flex items-center">-</div>
                          )}
                        </div>
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
      <div className="bg-[#1f2937] border border-gray-700 rounded-lg p-4">
        <p className="text-sm text-gray-300">
          Showing characters with <span className="font-semibold text-blue-400">Awaken 3/5</span> unlock
          level. Characters are organized by gauge increase timing and amount.
        </p>
      </div>

      <Tabs defaultValue="protection" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-[#111827] border border-gray-700">
          <TabsTrigger value="protection" className="data-[state=active]:bg-[#1f2937]">
            🛡️ Protection
          </TabsTrigger>
          <TabsTrigger value="skillPoint" className="data-[state=active]:bg-[#1f2937]">
            ⚡ Skill Points
          </TabsTrigger>
          <TabsTrigger value="secretSkill" className="data-[state=active]:bg-[#1f2937]">
            ✨ Secret Skills
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
