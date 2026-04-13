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
  stripColorTags,
  getCharacterForceEntries,
  isExUnboundCharacter,
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

const baseRarityMap: Record<number, string> = {
  3: "/frame/baseMemberM3.png",
  4: "/frame/baseMemberM4.png",
  5: "/frame/baseMemberM5.png",
  6: "/frame/baseMemberM6.png",
  7: "/frame/baseMemberM7.png",
}

const baseBlessMap: Record<number, string> = {
  3: "/frame/baseBlessM3.png",
  4: "/frame/baseBlessM4.png",
  5: "/frame/baseBlessM5.png",
  6: "/frame/baseBlessM6.png",
  7: "/frame/baseBlessM7.png",
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

// Defender IcElementBless icons for base element keys (used by character browser)
const defenderBlessIconMap: Record<string, string> = {
  air: "/Image/IcElementBless/IcElementBlessAir.png",
  dark: "/Image/IcElementBless/IcElementBlessDark.png",
  earth: "/Image/IcElementBless/IcElementBlessEarth.png",
  fire: "/Image/IcElementBless/IcElementBlessFire.png",
  holy: "/Image/IcElementBless/IcElementBlessHoly.png",
  water: "/Image/IcElementBless/IcElementBlessWater.png",
  wind: "/Image/IcElementBless/IcElementBlessWind.png",
}

// Generic element icon map (mirrors character-browser mapping)
const elementIconMap: Record<string, string> = {
  air: "/elements/space.png",
  all: "/Image/IcElementBless/IcElementBlessAll.png",
  dark: "/elements/dark.png",
  earth: "/elements/earth.png",
  enhancedair: "/Image/IcElementBless/IcElementBlessEnhancedAir.png",
  enhanceddark: "/Image/IcElementBless/IcElementBlessEnhancedDark.png",
  enhancedearth: "/Image/IcElementBless/IcElementBlessEnhancedEarth.png",
  enhancedfire: "/Image/IcElementBless/IcElementBlessEnhancedFire.png",
  enhancedholy: "/Image/IcElementBless/IcElementBlessEnhancedHoly.png",
  enhancedwater: "/Image/IcElementBless/IcElementBlessEnhancedWater.png",
  enhancedwind: "/Image/IcElementBless/IcElementBlessEnhancedWind.png",
  fire: "/elements/fire.png",
  holy: "/elements/light.png",
  light: "/elements/icElementlight.png",
  magic: "/Image/IcElementBless/IcElementBlessMagic.png",
  physics: "/Image/IcElementBless/IcElementBlessPhysics.png",
  special: "/type_dmg/IcElementBlessSpecial.png",
  space: "/elements/icElementspace.png",
  specialeffectelementair: "/Image/IcElementBless/IcElementBlessSpecialEffectElementAir.png",
  specialeffectelementdark: "/Image/IcElementBless/IcElementBlessSpecialEffectElementDark.png",
  specialeffectelementearth: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEarth.png",
  specialeffectelementenhancedair: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedAir.png",
  specialeffectelementenhanceddark: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedDark.png",
  specialeffectelementenhancedearth: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedEarth.png",
  specialeffectelementenhancedfire: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedFire.png",
  specialeffectelementenhancedholy: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedHoly.png",
  specialeffectelementenhancedwater: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWater.png",
  specialeffectelementenhancedwind: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWind.png",
  specialeffectelementfire: "/Image/IcElementBless/IcElementBlessSpecialEffectElementFire.png",
  specialeffectelementholy: "/Image/IcElementBless/IcElementBlessSpecialEffectElementHoly.png",
  specialeffectelementnone: "/Image/IcElementBless/IcElementBlessSpecialEffectElementNone.png",
  specialeffectelementwater: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWater.png",
  specialeffectelementwind: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWind.png",
  water: "/elements/water.png",
  wind: "/elements/wind.png",
}

function getProtectorElementDisplayIcon(value: string | null | undefined): string | undefined {
  const normalized = normalizeLabel(value)
  if (normalized === "" || normalized === "none") return undefined
  // base element keys use IcElementBless icons, others fallback to generic elementIconMap
  return defenderBlessIconMap[normalized] ?? elementIconMap[normalized]
}

const attackTypeIconMap: Record<string, string> = {
  magic: "/type_dmg/icAttackTypeMagic.png",
  physical: "/type_dmg/icAttackTypePhysics.png",
}

function isAttackerChar(character: WikiCharacter): boolean {
  if (character.character_role === "Attacker") return true
  return character.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}

// Helpers copied/adapted from the character browser to derive protector element values
const baseElementKeys = new Set(["air", "dark", "earth", "fire", "holy", "water", "wind"])
const hiddenElementKeys = new Set(["none", "specialeffectelementnone"])

function getDefenderElementValues(character: WikiCharacter): string[] {
  if (!isProtectorChar(character)) return [normalizeLabel(character.element)]

  const normalized = normalizeLabel(character.element)
  const values: string[] = []

  // Primary: use the character's element (base or specialeffect key) if present
  if (normalized.startsWith("specialeffectelement")) {
    values.push(normalized)
  } else if (baseElementKeys.has(normalized)) {
    values.push(normalized)
  }

  // Secondary: use canonical `master_leader_skill_element_type_2` (no leader_skill parsing)
  const secondRaw = (character as any).master_leader_skill_element_type_2 ?? null
  if (secondRaw) {
    const secondKey = normalizeLabel(secondRaw)
    if (secondKey && secondKey !== "none" && !values.includes(secondKey)) {
      values.push(secondKey)
    }
  }

  // Fallback to raw element value if nothing matched
  if (values.length === 0 && normalized && normalized !== "none") {
    values.push(normalized)
  }

  return values
}

const allCharacters = getAllWikiCharacters()

export default function ForcesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedForces, setExpandedForces] = useState<Set<string>>(new Set())

  const forceIconLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const char of allCharacters) {
      const entries = getCharacterForceEntries(char)
      for (const entry of entries) {
        if (!map.has(entry.name) && entry.icon) map.set(entry.name, entry.icon)
      }
    }
    return map
  }, [])

  const forceGroups = useMemo(() => {
    const groups: Record<string, WikiCharacter[]> = {}
    for (const character of allCharacters) {
      const entries = getCharacterForceEntries(character)
      for (const entry of entries) {
        if (!groups[entry.name]) groups[entry.name] = []
        groups[entry.name].push(character)
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
                          const baseMap = isProtectorChar(character) ? baseBlessMap : baseRarityMap
                          const baseSrc = baseMap[visualTier] ?? baseMap[5]
                          const starsSrc = starAssetMap[visualTier] ?? starAssetMap[5]
                          const iconSrc = toPublicAssetPath(character.images.icon)

                          // Determine first/second icons per user rules.
                          // Attackers: [element, attack-type]
                          // Protectors: priority -> Force, Element, Physics/Magic/All
                          const isProtector = isProtectorChar(character)
                          const isAttacker = isAttackerChar(character)
                          let firstIcon: string | undefined
                          let secondIcon: string | undefined

                          const protTypeMap: Record<string, string> = {
                            physics: "/type_dmg/prot_phys.png",
                            magic: "/type_dmg/prot_magic.png",
                          }

                          function toEnhancedElementValue(value: string): string {
                            return `Enhanced${value.charAt(0).toUpperCase()}${value.slice(1)}`
                          }

                          const specialEffectToBase: Record<string, string> = {
                            all: "Earth",
                            special: "Air",
                            specialeffectelementearth: "Earth",
                            specialeffectelementair: "Air",
                            specialeffectelementwind: "Wind",
                            specialeffectelementwater: "Water",
                            specialeffectelementfire: "Fire",
                            specialeffectelementholy: "Holy",
                            specialeffectelementdark: "Dark",
                            specialeffectelementenhancedearth: "EnhancedEarth",
                            specialeffectelementenhancedair: "EnhancedAir",
                            specialeffectelementenhancedwind: "EnhancedWind",
                            specialeffectelementenhancedwater: "EnhancedWater",
                            specialeffectelementenhancedfire: "EnhancedFire",
                            specialeffectelementenhancedholy: "EnhancedHoly",
                            specialeffectelementenhanceddark: "EnhancedDark",
                          }

                          function getCharacterElementValue(character: WikiCharacter): string {
                            if (isProtectorChar(character)) {
                              return getDefenderElementValues(character)[0]
                            }
                            const normalized = normalizeLabel(character.element)
                            const baseFromSpecial = specialEffectToBase[normalized]
                            if (isAttackerChar(character) && baseFromSpecial) {
                              const baseNormalized = normalizeLabel(baseFromSpecial)
                              if (baseElementKeys.has(baseNormalized) && isExUnboundCharacter(character)) {
                                return toEnhancedElementValue(baseNormalized)
                              }
                              return baseFromSpecial
                            }
                            if (isAttackerChar(character) && baseElementKeys.has(normalized) && isExUnboundCharacter(character)) {
                              return toEnhancedElementValue(normalized)
                            }
                            return character.element
                          }

                          function getAttackerElementIcon(value: string | null | undefined): string | undefined {
                            const normalized = normalizeLabel(value)
                            if (hiddenElementKeys.has(normalized)) return undefined
                            return attackerElementIconMap[normalized]
                          }

                          function isElementLike(val: string): boolean {
                            const n = normalizeLabel(val)
                            if (baseElementKeys.has(n)) return true
                            if (n.startsWith("specialeffectelement")) return true
                            if (n.startsWith("specialeffectelementenhanced")) return true
                            if (n === "all") return true
                            return false
                          }

                          if (isAttacker) {
                            const elemVal = getCharacterElementValue(character)
                            firstIcon = getAttackerElementIcon(elemVal) ?? getElementIconForCard(character)
                            secondIcon = attackTypeIconMap[normalizeLabel(character.attack_type)]
                          } else if (isProtector) {
                            const forceEntries = getCharacterForceEntries(character)
                            const defenderValues = getDefenderElementValues(character)

                            // If there are forces, first icon = first force (if it has icon)
                            if (forceEntries.length > 0) {
                              if (forceEntries[0].icon) {
                                firstIcon = forceEntries[0].icon
                              } else if (character.forces.length > 0) {
                                firstIcon = toPublicAssetPath(character.forces[0].icon_path)
                              }

                              // second icon: prefer the character's primary element value first,
                              // otherwise fall back to any element-like value, then qualifiers.
                              const primary = defenderValues.length > 0 ? defenderValues[0] : null
                              if (primary && isElementLike(primary)) {
                                secondIcon = getProtectorElementDisplayIcon(primary)
                              } else {
                                const elementsList = defenderValues.filter(isElementLike)
                                if (elementsList.length > 0) {
                                  const sel = elementsList[elementsList.length - 1]
                                  secondIcon = getProtectorElementDisplayIcon(sel)
                                } else {
                                  // pick last qualifier (physics/magic/all)
                                  const quals = defenderValues.filter((v) => {
                                    const n = normalizeLabel(v)
                                    return n === "physics" || n === "magic" || n === "all"
                                  })
                                  if (quals.length > 0) {
                                    const lastQ = normalizeLabel(quals[quals.length - 1])
                                    if (lastQ === "physics" || lastQ === "magic") {
                                      secondIcon = protTypeMap[lastQ]
                                    } else {
                                      secondIcon = elementIconMap[lastQ]
                                    }
                                  }
                                }
                              }
                            } else {
                              // No forces: show up to two element/qualifier icons
                              const elementsList = defenderValues.filter(isElementLike)
                              if (elementsList.length >= 2) {
                                firstIcon = getProtectorElementDisplayIcon(elementsList[0])
                                secondIcon = getProtectorElementDisplayIcon(elementsList[1])
                              } else if (elementsList.length === 1) {
                                firstIcon = getProtectorElementDisplayIcon(elementsList[0])
                                const quals = defenderValues.filter((v) => {
                                  const n = normalizeLabel(v)
                                  return n === "physics" || n === "magic" || n === "all"
                                })
                                if (quals.length > 0) {
                                  const q = normalizeLabel(quals[0])
                                  if (q === "physics" || q === "magic") {
                                    secondIcon = protTypeMap[q]
                                  } else {
                                    secondIcon = elementIconMap[q]
                                  }
                                }
                              } else {
                                // No elements or forces: show single qualifier if available
                                const quals = defenderValues.filter((v) => {
                                  const n = normalizeLabel(v)
                                  return n === "physics" || n === "magic" || n === "all"
                                })
                                if (quals.length > 0) {
                                  const q = normalizeLabel(quals[0])
                                  if (q === "physics" || q === "magic") {
                                    firstIcon = protTypeMap[q]
                                  } else {
                                    firstIcon = elementIconMap[q]
                                  }
                                }
                              }
                            }
                          } else {
                            firstIcon = getElementIconForCard(character)
                          }

                          return (
                            <Link key={character.master_pc_id} href={`/characters/${character.master_pc_id}`} className="min-w-0">
                              <div className="relative w-full pt-[100%] overflow-hidden rounded cursor-pointer hover:ring-2 hover:ring-white transition-all">
                                <img
                                  src={baseSrc}
                                  alt=""
                                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                />
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
                                {/* Top-right icons (element/force / type) */}
                                <div className="absolute top-1 right-1 z-20 flex flex-col items-end gap-1">
                                    {firstIcon && (
                                      <img src={firstIcon} alt="" className="w-6 h-6 object-contain" />
                                    )}
                                    {secondIcon && (
                                      <img src={secondIcon} alt="" className="w-6 h-6 object-contain" />
                                    )}
                                </div>
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
