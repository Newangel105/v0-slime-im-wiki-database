"use client"
import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Search, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import {
  getAllWikiCharacters,
  WikiCharacter,
  toPublicAssetPath,
  getCharacterVisualTier,
  normalizeLabel,
} from "@/lib/pc-wiki"

function isProtectorChar(character: WikiCharacter): boolean {
  return (
    character.character_role === "Supporter" &&
    !character.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
  )
}

const rarityFrameMap: Record<number, string> = {
  3: "/frame/frameMemberM3.png",
  4: "/frame/frameMemberM4.png",
  5: "/frame/frameMemberM5.png",
  6: "/frame/frameMemberM6.png",
  7: "/frame/frameMemberM7.png",
}

const blessFrameMap: Record<number, string> = {
  3: "/frame/frameBlessM3.png",
  4: "/frame/frameBlessM4.png",
  5: "/frame/frameBlessM5.png",
  6: "/frame/frameBlessM6.png",
  7: "/frame/frameBlessM7.png",
}

const starAssetMap: Record<number, string> = {
  3: "/stars/starCharaL3A.png",
  4: "/stars/starCharaL4A.png",
  5: "/stars/starCharaL5A.png",
  6: "/stars/starCharaL6A.png",
  7: "/stars/starCharaL7A.png",
}

const attackerElementIconMap: Record<string, string> = {
  air: "/elements/icElementspace.png",
  dark: "/elements/icElementDark.png",
  earth: "/elements/icElementEarth.png",
  enhancedair: "/elements/Enhancedspace.png",
  enhanceddark: "/elements/Enhanceddark.png",
  enhancedearth: "/elements/Enhancedearth.png",
  enhancedfire: "/elements/Enhancedfire.png",
  enhancedholy: "/elements/Enhancedlight.png",
  enhancedwater: "/elements/Enhancedwater.png",
  enhancedwind: "/elements/Enhancedwind.png",
  fire: "/elements/icElementFire.png",
  holy: "/elements/icElementlight.png",
  water: "/elements/icElementWater.png",
  wind: "/elements/icElementWind.png",
}

const protectorElementIconMap: Record<string, string> = {
  air: "/Image/IcElementBless/IcElementBlessAir.png",
  all: "/Image/IcElementBless/IcElementBlessAll.png",
  dark: "/Image/IcElementBless/IcElementBlessDark.png",
  earth: "/Image/IcElementBless/IcElementBlessEarth.png",
  fire: "/Image/IcElementBless/IcElementBlessFire.png",
  holy: "/Image/IcElementBless/IcElementBlessHoly.png",
  magic: "/Image/IcElementBless/IcElementBlessMagic.png",
  physics: "/Image/IcElementBless/IcElementBlessPhysics.png",
  water: "/Image/IcElementBless/IcElementBlessWater.png",
  wind: "/Image/IcElementBless/IcElementBlessWind.png",
}

function getElementIconForCard(character: WikiCharacter): string | undefined {
  const key = normalizeLabel(character.element)
  if (isProtectorChar(character)) return protectorElementIconMap[key]
  return attackerElementIconMap[key]
}

const allCharacters = getAllWikiCharacters()

export default function ForcesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedForces, setExpandedForces] = useState<Set<string>>(new Set())

  const forceIconLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const char of allCharacters) {
      for (const force of char.forces) {
        if (!map.has(force.name)) map.set(force.name, toPublicAssetPath(force.icon_path))
      }
    }
    return map
  }, [])

  const forceGroups = useMemo(() => {
    const groups: Record<string, WikiCharacter[]> = {}
    for (const character of allCharacters) {
      for (const force of character.forces) {
        if (!groups[force.name]) groups[force.name] = []
        groups[force.name].push(character)
      }
    }

    if (!searchTerm) return groups

    const filtered: Record<string, WikiCharacter[]> = {}
    for (const [forceName, chars] of Object.entries(groups)) {
      const forceMatch = forceName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchedChars = chars.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      if (forceMatch || matchedChars.length > 0) {
        filtered[forceName] = forceMatch ? chars : matchedChars
      }
    }
    return filtered
  }, [searchTerm])

  const sortedForces = Object.keys(forceGroups).sort()

  const toggleForce = (forceName: string) => {
    setExpandedForces((prev) => {
      const next = new Set(prev)
      next.has(forceName) ? next.delete(forceName) : next.add(forceName)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto pl-6 pr-4 sm:pl-8 sm:pr-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-300 uppercase tracking-wider">FORCES</h1>
        </div>

        {/* Search */}
        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-700 border-gray-600 text-white"
            />
          </div>
        </div>

        {/* Forces List */}
        <div className="space-y-4">
          {sortedForces.map((forceName) => {
            const forceChars = forceGroups[forceName]
            const isExpanded = expandedForces.has(forceName)
            const forceIcon = forceIconLookup.get(forceName)

            return (
              <Card key={forceName} className="bg-gray-800 border-gray-700">
                <CardContent className="p-0">
                  {/* Force Header */}
                  <button
                    onClick={() => toggleForce(forceName)}
                    className="w-full flex items-center justify-between px-6 py-5 hover:bg-gray-700 transition-colors"
                  >
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                      {forceIcon && (
                        <img src={forceIcon} alt={forceName} className="w-8 h-8 object-contain flex-shrink-0" />
                      )}
                      <span className="text-white font-medium text-sm sm:text-base leading-tight text-left block max-w-full whitespace-normal break-words">{forceName}</span>
                    </div>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-gray-400 font-medium">{forceChars.length}</span>
                      <img src="/icons/name.png" alt="User Icon" className="w-3 h-5" />
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Characters Grid */}
                  {isExpanded && (
                    <div className="px-4 pt-4 pb-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-y-4 gap-x-2">
                        {forceChars.map((character) => {
                          const visualTier = getCharacterVisualTier(character)
                          const frameMap = isProtectorChar(character) ? blessFrameMap : rarityFrameMap
                          const frameSrc = frameMap[visualTier] ?? frameMap[5]
                          const starsSrc = starAssetMap[visualTier] ?? starAssetMap[5]
                          const iconSrc = toPublicAssetPath(character.images.icon)
                          const elementIcon = getElementIconForCard(character)

                          return (
                            <Link key={character.master_pc_id} href={`/characters/${character.master_pc_id}`} className="min-w-0">
                              <div className="relative w-full pt-[100%] overflow-hidden rounded cursor-pointer hover:ring-2 hover:ring-white transition-all">
                                <img
                                  src={iconSrc}
                                  alt={character.name}
                                  className="absolute inset-0 w-full h-full object-cover object-top"
                                />
                                <img
                                  src={frameSrc}
                                  alt=""
                                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                />
                                {/* Name (top-left) */}
                                <div className="absolute top-1 left-1 bg-black bg-opacity-80 text-white text-[10px] px-1 py-0.5 rounded z-10">
                                  {character.name}
                                </div>
                                {/* Stars (bottom-left) */}
                                <img
                                  src={starsSrc}
                                  alt=""
                                  className="absolute bottom-1 left-1 h-6 object-contain z-10"
                                />
                                {/* Element Icon (top-right) */}
                                {elementIcon && (
                                  <div className="absolute top-1 right-1 z-20">
                                    <img src={elementIcon} alt={character.element} className="w-6 h-6 object-contain" />
                                  </div>
                                )}
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {sortedForces.length === 0 && (
          <div className="text-center text-gray-400 py-8">No forces found matching the current search.</div>
        )}
      </div>
    </div>
  )
}
