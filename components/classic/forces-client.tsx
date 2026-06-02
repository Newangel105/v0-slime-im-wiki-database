"use client"
import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Search, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"

export type SlimForceCharacter = {
  master_pc_id: number
  name: string
  visualTier: number
  baseSrc: string
  frameSrc: string
  starsSrc: string
  iconSrc: string
  firstIcon?: string
  secondIcon?: string
}

export type SlimForceGroup = {
  name: string
  forceIcon?: string
  characters: SlimForceCharacter[]
}

export function ClassicForcesClient({ forceGroups }: { forceGroups: SlimForceGroup[] }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedForces, setExpandedForces] = useState<Set<string>>(new Set())

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return forceGroups
    const q = searchTerm.toLowerCase()
    const result: SlimForceGroup[] = []
    for (const group of forceGroups) {
      const forceMatch = group.name.toLowerCase().includes(q)
      const matchedChars = group.characters.filter((c) =>
        c.name.toLowerCase().includes(q)
      )
      if (forceMatch || matchedChars.length > 0) {
        result.push({ ...group, characters: forceMatch ? group.characters : matchedChars })
      }
    }
    return result
  }, [forceGroups, searchTerm])

  const toggleForce = (forceName: string) => {
    setExpandedForces((prev) => {
      const next = new Set(prev)
      next.has(forceName) ? next.delete(forceName) : next.add(forceName)
      return next
    })
  }

  return (
    <div className="site-page text-white">
      <div className="max-w-7xl mx-auto pl-6 pr-4 sm:pl-8 sm:pr-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <p className="section-kicker">Team Affinities</p>
          <h1 className="section-title mt-2">Forces</h1>
        </div>

        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#080d18]/80 border-white/10 text-white"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const isExpanded = expandedForces.has(group.name)
            return (
              <Card key={group.name} className="glass-panel overflow-hidden">
                <CardContent className="p-0">
                  <button
                    onClick={() => toggleForce(group.name)}
                    className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.06] transition-colors"
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      {group.forceIcon && (
                        <img src={group.forceIcon} alt={group.name} className="w-8 h-8 object-contain flex-shrink-0" />
                      )}
                      <span className="text-white font-medium text-sm sm:text-base leading-tight text-left block max-w-full whitespace-normal break-words">
                        {group.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-gray-400 font-medium">{group.characters.length}</span>
                      <img src="/icons/name.webp" alt="User Icon" className="w-3 h-5" />
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pt-4 pb-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-y-4 gap-x-2">
                        {group.characters.map((character) => (
                          <Link key={character.master_pc_id} href={`/characters/${character.master_pc_id}`} className="min-w-0">
                            <div className="relative w-full pt-[100%] overflow-hidden rounded cursor-pointer hover:ring-2 hover:ring-white transition-all">
                              {character.visualTier >= 8 ? (
                                <div className="absolute inset-[7%]">
                                  <img
                                    src={character.baseSrc}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-fill pointer-events-none"
                                  />
                                </div>
                              ) : (
                                <img
                                  src={character.baseSrc}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                                />
                              )}
                              <div className={`absolute overflow-hidden ${character.visualTier >= 8 ? "inset-[4%] rounded-[6%]" : "inset-[7%] rounded-[10%]"}`}>
                                <img
                                  src={character.iconSrc}
                                  alt={character.name}
                                  loading="lazy"
                                  decoding="async"
                                  className="h-full w-full object-cover object-top"
                                />
                              </div>
                              <img
                                src={character.frameSrc}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                              />
                              <div className="absolute top-1 left-1 bg-black bg-opacity-80 text-white text-[10px] px-1 py-0.5 rounded z-10">
                                {character.name}
                              </div>
                              <img
                                src={character.starsSrc}
                                alt=""
                                className="absolute bottom-1 left-1 h-6 object-contain z-10"
                              />
                              <div className="absolute top-1 right-1 z-20 flex flex-col items-end gap-1">
                                {character.firstIcon && (
                                  <img src={character.firstIcon} alt="" className="w-6 h-6 object-contain" />
                                )}
                                {character.secondIcon && (
                                  <img src={character.secondIcon} alt="" className="w-6 h-6 object-contain" />
                                )}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {filteredGroups.length === 0 && (
          <div className="text-center text-gray-400 py-8">No forces found matching the current search.</div>
        )}
      </div>
    </div>
  )
}
