"use client"
import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
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

export default function ForcesClient({ forceGroups }: { forceGroups: SlimForceGroup[] }) {
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
    <main className="site-page slime-page-forces px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mx-auto mb-8 max-w-md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#aeb6c4]" />
            <Input
              placeholder="Search forces or characters"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-12 rounded-full border-border/30 bg-[rgba(24,62,92,0.92)] pl-11 pr-4 text-foreground placeholder:text-[#aeb6c4]/70 focus-visible:ring-accent/45 backdrop-blur-md"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const isExpanded = expandedForces.has(group.name)
            return (
              <div
                key={group.name}
                className="overflow-hidden rounded-2xl border border-border/[0.26] bg-[linear-gradient(160deg,rgba(30,77,113,0.96),rgba(22,58,88,0.97))] shadow-[0_16px_40px_rgba(8,30,52,0.34),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md"
              >
                <button
                  onClick={() => toggleForce(group.name)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center justify-between rounded-2xl px-6 py-5 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {group.forceIcon && (
                      <img src={group.forceIcon} alt={group.name} className="h-8 w-8 flex-shrink-0 object-contain" />
                    )}
                    <span className="block max-w-full whitespace-normal break-words text-left text-sm font-semibold leading-tight text-[#e8eef6] sm:text-base">
                      {group.name}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center space-x-3">
                    <span className="font-semibold tabular-nums text-[#aeb6c4]">{group.characters.length}</span>
                    <img src="/icons/name.webp" alt="User Icon" className="h-5 w-3" />
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-accent" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-accent" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-4">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                      {group.characters.map((character) => (
                        <Link key={character.master_pc_id} href={`/characters/${character.master_pc_id}`} className="min-w-0">
                          <div className="relative w-full cursor-pointer overflow-hidden rounded pt-[100%] transition-all duration-200 hover:-translate-y-0.5 hover:ring-2 hover:ring-[#0a9baa]/70">
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
                            <div className="absolute left-1 top-1 z-10 rounded bg-[#072a51]/85 px-1 py-0.5 text-[10px] text-white">
                              {character.name}
                            </div>
                            <img
                              src={character.starsSrc}
                              alt=""
                              className="absolute bottom-1 left-1 h-6 object-contain z-10"
                            />
                            <div className="absolute top-1 right-1 z-20 flex flex-col items-end gap-1">
                              {character.firstIcon && (
                                <img src={character.firstIcon} alt="" className="w-6 h-6 object-contain drop-shadow-[0_0_1.5px_rgba(255,255,255,0.9)]" />
                              )}
                              {character.secondIcon && (
                                <img src={character.secondIcon} alt="" className="w-6 h-6 object-contain drop-shadow-[0_0_1.5px_rgba(255,255,255,0.9)]" />
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {filteredGroups.length === 0 && (
          <div className="py-8 text-center text-[#072a51]">No forces found matching the current search.</div>
        )}
      </div>
    </main>
  )
}
