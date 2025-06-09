"use client"
import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Gamepad2, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import { getAllCharacters } from "@/lib/getCharacters"

interface Character {
  id: string
  name: string
  type: string
  ulti: string
  dmg_type: string
  element: "fire" | "water" | "earth" | "space" | "wind" | "dark" | "light"
  stars: 3 | 4 | 5 | 6
  weapon: "sword" | "katana" | "hammer" | "spear" | "greatsword" | "book" | "fists"
  awakening: number
  char_type: string
  skills: string[]
  traits: string[]
  force: string[]
  town: string
  image: string
  attack: number
  health: number
  defense: number
  existence: number
  rarity: number
  tag: string[]
  battle_skills: Array<{ description: string }>
  secret_skills: Array<{ description: string }>
  skill_traits: Array<{ description: string }>
  ex_abilities: Array<{ description: string }>
  release_date: string
  final_attack: number
  final_health: number
  final_defense: number
}

const characters = getAllCharacters()

const elementIcons = {
  fire: "/elements/icElementFire.png",
  water: "/elements/icElementWater.png",
  earth: "/elements/icElementEarth.png",
  space: "/elements/icElementspace.png",
  wind: "/elements/icElementWind.png",
  dark: "/elements/icElementDark.png",
  light: "/elements/icElementlight.png",
  ex_fire: "/elements/Enhancedfire.png",
  ex_water: "/elements/Enhancedwater.png",
  ex_earth: "/elements/Enhancedearth.png",
  ex_space: "/elements/Enhancedspace.png",
  ex_wind: "/elements/Enhancedwind.png",
  ex_dark: "/elements/Enhanceddark.png",
  ex_light: "/elements/Enhancedlight.png",
}

const forcesMap = {
  Adventurer: "/protector_elements/Adventurer.png",
  Antagonist: "/protector_elements/Antagonist.png",
  Axiom_of_Haze: "/protector_elements/Axiom_of_Haze.png",
  Clan_Chief: "/protector_elements/Clan_Chief.png",
  Commander: "/protector_elements/Commander.png",
  Demon_Lord_Invasion: "/protector_elements/Demon_Lord_Invasion.png",
  Determination_to_Prosper: "/protector_elements/Determination_to_Prosper.png",
  Dragon_Haki: "/protector_elements/Dragon_Haki.png",
  Exalted_Champions: "/protector_elements/Exalted_Champions.png",
  Festive_Memories: "/protector_elements/Festive_Memories.png",
  Flashback_Beatdown_Emissary: "/protector_elements/Flashback_Beatdown_Emissary.png",
  Forest_Fracas: "/protector_elements/Forest_Fracas.png",
  Fount_of_Wisdom: "/protector_elements/Fount_of_Wisdom.png",
  Frozen_Continent: "/protector_elements/Frozen_Continent.png",
  Gaining_Status: "/protector_elements/Gaining_Status.png",
  Goddess_of_Destiny: "/protector_elements/Goddess_of_Destiny.png",
  Heart_of_a_Hero: "/protector_elements/Heart_of_a_Hero.png",
  Hyper_Heart: "/protector_elements/Hyper_Heart.png",
  Lycanthropes_Pride: "/protector_elements/Lycanthrope's_Pride.png",
  Monster_and_Human_Mingling: "/protector_elements/Monster_and_Human_Mingling.png",
  New_Years_Blessing: "/protector_elements/New_Year's_Blessing.png",
  Octagram: "/protector_elements/Octagram.png",
  Octagram_Bazaar: "/protector_elements/Octagram_Bazaar.png",
  Octagram_Demon_Lord: "/protector_elements/Octagram_Demon_Lord.png",
  Ogres_Pride: "/protector_elements/Ogre's_Pride.png",
  Otherworlder: "/protector_elements/Otherworlder.png",
  Otherworld_Legend: "/protector_elements/Otherworld_Legend.png",
  Pariah: "/protector_elements/Pariah.png",
  Pretty_Sparkle: "/protector_elements/Pretty_Sparkle.png",
  Primal_Demon: "/protector_elements/Primal_Demon.png",
  Protector_of_Peace: "/protector_elements/Protector_of_Peace.png",
  Scarlet_Bond: "/protector_elements/Scarlet_Bond.png",
  Schemer: "/protector_elements/Schemer.png",
  Shizus_Will: "/protector_elements/Shizu's_Will.png",
  Spirit_Master: "/protector_elements/Spirit_Master.png",
  Stern_of_Spirit: "/protector_elements/Stern_of_Spirit.png",
  Summer_Memories: "/protector_elements/Summer_Memories.png",
  Tempest_Elite: "/protector_elements/Tempest_Elite.png",
  Ten_Great_Demon_Lords: "/protector_elements/Ten_Great_Demon_Lords.png",
  Valentine: "/protector_elements/Valentine.png",
  Visions_of_Coleus: "/protector_elements/Visions_of_Coleus.png",
  Warriors_Mind: "/protector_elements/Warrior's_Mind.png",
  Wholehearted_Devotion: "/protector_elements/Wholehearted_Devotion.png",
  Wielder_of_Magic: "/protector_elements/Wielder_of_Magic.png",
  World_of_Fantasy: "/protector_elements/World_of_Fantasy.png",
}

const protelementIcons2 = {
  magic: "/type_dmg/prot_magic.png",
  phys: "/type_dmg/prot_phys.png",
  prot_phys: "/type_dmg/prot_phys.png",
  prot_magic: "/type_dmg/prot_magic.png",
  prot_fire: "/protector_elements/Anti-Fire.png",
  prot_water: "/protector_elements/Anti-Water.png",
  prot_earth: "/protector_elements/Anti-Earth.png",
  prot_space: "/protector_elements/Anti-Space.png",
  prot_wind: "/protector_elements/Anti-Wind.png",
  prot_dark: "/protector_elements/Anti-Dark.png",
  prot_light: "/protector_elements/Anti-Light.png",
  old_fire: "/protector_elements/fire.png",
  old_water: "/protector_elements/water.png",
  old_earth: "/protector_elements/earth.png",
  old_space: "/protector_elements/space.png",
  old_wind: "/protector_elements/wind.png",
  old_dark: "/protector_elements/dark.png",
  old_light: "/protector_elements/light.png",
  prot_ex_fire: "/elements/anti_fire_attribute_unbound.png",
  prot_ex_water: "/elements/anti_water_attribute_unbound.png",
  prot_ex_earth: "/elements/anti_earth_attribute_unbound.png",
  prot_ex_space: "/elements/anti_space_attribute_unbound.png",
  prot_ex_wind: "/elements/anti_wind_attribute_unbound.png",
  prot_ex_dark: "/elements/anti_dark_attribute_unbound.png",
  prot_ex_light: "/elements/anti_light_attribute_unbound.png",
  Adventurer: "/protector_elements/Adventurer.png",
  Antagonist: "/protector_elements/Antagonist.png",
  Axiom_of_Haze: "/protector_elements/Axiom_of_Haze.png",
  Clan_Chief: "/protector_elements/Clan_Chief.png",
  Commander: "/protector_elements/Commander.png",
  Demon_Lord_Invasion: "/protector_elements/Demon_Lord_Invasion.png",
  Determination_to_Prosper: "/protector_elements/Determination_to_Prosper.png",
  Dragon_Haki: "/protector_elements/Dragon_Haki.png",
  Exalted_Champions: "/protector_elements/Exalted_Champions.png",
  Festive_Memories: "/protector_elements/Festive_Memories.png",
  Flashback_Beatdown_Emissary: "/protector_elements/Flashback_Beatdown_Emissary.png",
  Forest_Fracas: "/protector_elements/Forest_Fracas.png",
  Fount_of_Wisdom: "/protector_elements/Fount_of_Wisdom.png",
  Frozen_Continent: "/protector_elements/Frozen_Continent.png",
  Gaining_Status: "/protector_elements/Gaining_Status.png",
  Goddess_of_Destiny: "/protector_elements/Goddess_of_Destiny.png",
  Heart_of_a_Hero: "/protector_elements/Heart_of_a_Hero.png",
  Hyper_Heart: "/protector_elements/Hyper_Heart.png",
  Lycanthropes_Pride: "/protector_elements/Lycanthrope's_Pride.png",
  Monster_and_Human_Mingling: "/protector_elements/Monster_and_Human_Mingling.png",
  New_Years_Blessing: "/protector_elements/New_Year's_Blessing.png",
  Octagram: "/protector_elements/Octagram.png",
  Octagram_Bazaar: "/protector_elements/Octagram_Bazaar.png",
  Octagram_Demon_Lord: "/protector_elements/Octagram_Demon_Lord.png",
  Ogres_Pride: "/protector_elements/Ogre's_Pride.png",
  Otherworlder: "/protector_elements/Otherworlder.png",
  Otherworld_Legend: "/protector_elements/Otherworld_Legend.png",
  Pariah: "/protector_elements/Pariah.png",
  Pretty_Sparkle: "/protector_elements/Pretty_Sparkle.png",
  Primal_Demon: "/protector_elements/Primal_Demon.png",
  Protector_of_Peace: "/protector_elements/Protector_of_Peace.png",
  Scarlet_Bond: "/protector_elements/Scarlet_Bond.png",
  Schemer: "/protector_elements/Schemer.png",
  Shizus_Will: "/protector_elements/Shizu's_Will.png",
  Spirit_Master: "/protector_elements/Spirit_Master.png",
  Stern_of_Spirit: "/protector_elements/Stern_of_Spirit.png",
  Summer_Memories: "/protector_elements/Summer_Memories.png",
  Tempest_Elite: "/protector_elements/Tempest_Elite.png",
  Ten_Great_Demon_Lords: "/protector_elements/Ten_Great_Demon_Lords.png",
  Valentine: "/protector_elements/Valentine.png",
  Divine_General: "/protector_elements/divine-general.png",
  Tournament_Stalwart: "/protector_elements/tournament_stalwart.png",
  Sparkle_of_Youth: "/protector_elements/sparkle_of_youth.png",
  Visions_of_Coleus: "/protector_elements/Visions_of_Coleus.png",
  Warriors_Mind: "/protector_elements/Warrior's_Mind.png",
  Wholehearted_Devotion: "/protector_elements/Wholehearted_Devotion.png",
  Wielder_of_Magic: "/protector_elements/Wielder_of_Magic.png",
  World_of_Fantasy: "/protector_elements/World_of_Fantasy.png",
}

const dmg_typeIcons = {
  old_fire: "/protector_elements/fire.png",
  old_water: "/protector_elements/water.png",
  old_earth: "/protector_elements/earth.png",
  old_space: "/protector_elements/space.png",
  old_wind: "/protector_elements/wind.png",
  old_dark: "/protector_elements/dark.png",
  old_light: "/protector_elements/light.png",
  magic: "/type_dmg/icAttackTypeMagic.png",
  phys: "/type_dmg/icAttackTypePhysics.png",
  prot_phys: "/type_dmg/prot_phys.png",
  prot_magic: "/type_dmg/prot_magic.png",
  Adventurer: "/protector_elements/Adventurer.png",
  Antagonist: "/protector_elements/Antagonist.png",
  Axiom_of_Haze: "/protector_elements/Axiom_of_Haze.png",
  Clan_Chief: "/protector_elements/Clan_Chief.png",
  Commander: "/protector_elements/Commander.png",
  Demon_Lord_Invasion: "/protector_elements/Demon_Lord_Invasion.png",
  Determination_to_Prosper: "/protector_elements/Determination_to_Prosper.png",
  Dragon_Haki: "/protector_elements/Dragon_Haki.png",
  Exalted_Champions: "/protector_elements/Exalted_Champions.png",
  Festive_Memories: "/protector_elements/Festive_Memories.png",
  Flashback_Beatdown_Emissary: "/protector_elements/Flashback_Beatdown_Emissary.png",
  Forest_Fracas: "/protector_elements/Forest_Fracas.png",
  Fount_of_Wisdom: "/protector_elements/Fount_of_Wisdom.png",
  Frozen_Continent: "/protector_elements/Frozen_Continent.png",
  Divine_General: "/protector_elements/divine-general.png",
  Tournament_Stalwart: "/protector_elements/tournament_stalwart.png",
  Sparkle_of_Youth: "/protector_elements/sparkle_of_youth.png",
  Gaining_Status: "/protector_elements/Gaining_Status.png",
  Goddess_of_Destiny: "/protector_elements/Goddess_of_Destiny.png",
  Heart_of_a_Hero: "/protector_elements/Heart_of_a_Hero.png",
  Hyper_Heart: "/protector_elements/Hyper_Heart.png",
  Lycanthropes_Pride: "/protector_elements/Lycanthrope's_Pride.png",
  Monster_and_Human_Mingling: "/protector_elements/Monster_and_Human_Mingling.png",
  New_Years_Blessing: "/protector_elements/New_Year's_Blessing.png",
  Octagram: "/protector_elements/Octagram.png",
  Octagram_Bazaar: "/protector_elements/Octagram_Bazaar.png",
  Octagram_Demon_Lord: "/protector_elements/Octagram_Demon_Lord.png",
  Ogres_Pride: "/protector_elements/Ogre's_Pride.png",
  Otherworlder: "/protector_elements/Otherworlder.png",
  Otherworld_Legend: "/protector_elements/Otherworld_Legend.png",
  Pariah: "/protector_elements/Pariah.png",
  Pretty_Sparkle: "/protector_elements/Pretty_Sparkle.png",
  Primal_Demon: "/protector_elements/Primal_Demon.png",
  Protector_of_Peace: "/protector_elements/Protector_of_Peace.png",
  Scarlet_Bond: "/protector_elements/Scarlet_Bond.png",
  Schemer: "/protector_elements/Schemer.png",
  Shizus_Will: "/protector_elements/Shizu's_Will.png",
  Spirit_Master: "/protector_elements/Spirit_Master.png",
  Stern_of_Spirit: "/protector_elements/Stern_of_Spirit.png",
  Summer_Memories: "/protector_elements/Summer_Memories.png",
  Tempest_Elite: "/protector_elements/Tempest_Elite.png",
  Ten_Great_Demon_Lords: "/protector_elements/Ten_Great_Demon_Lords.png",
  Valentine: "/protector_elements/Valentine.png",
  Visions_of_Coleus: "/protector_elements/Visions_of_Coleus.png",
  Warriors_Mind: "/protector_elements/Warrior's_Mind.png",
  Wholehearted_Devotion: "/protector_elements/Wholehearted_Devotion.png",
  Wielder_of_Magic: "/protector_elements/Wielder_of_Magic.png",
  World_of_Fantasy: "/protector_elements/World_of_Fantasy.png",
}

export default function ForcesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedForces, setExpandedForces] = useState<Set<string>>(new Set(["Adventurer"]))

  // Group characters by forces
  const forceGroups = useMemo(() => {
    const groups: Record<string, Character[]> = {}

    characters.forEach((character) => {
      character.force.forEach((force) => {
        if (!groups[force]) {
          groups[force] = []
        }
        groups[force].push(character)
      })
    })

    // Filter by search term
    if (searchTerm) {
      const filteredGroups: Record<string, Character[]> = {}
      Object.entries(groups).forEach(([force, chars]) => {
        const filteredChars = chars.filter((char) => char.name.toLowerCase().includes(searchTerm.toLowerCase()))
        if (filteredChars.length > 0 || force.toLowerCase().includes(searchTerm.toLowerCase())) {
          filteredGroups[force] = force.toLowerCase().includes(searchTerm.toLowerCase()) ? chars : filteredChars
        }
      })
      return filteredGroups
    }

    return groups
  }, [searchTerm])

  // Sort forces alphabetically
  const sortedForces = Object.keys(forceGroups).sort()

  const toggleForce = (force: string) => {
    const newExpanded = new Set(expandedForces)
    if (newExpanded.has(force)) {
      newExpanded.delete(force)
    } else {
      newExpanded.add(force)
    }
    setExpandedForces(newExpanded)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <img
                    src="/icons/logo.png"
                    alt="Logo"
                    className="w-[77px] h-[67px] object-contain"
                />
                <span className="text-xl font-bold">SLIME.WIKI</span>
              </div>
              <nav className="hidden md:flex space-x-6">
                <Link href="/characters" className="text-gray-300 hover:text-white transition-colors">
                  Characters
                </Link>
                <a href="/forces" className="text-white font-medium">
                  Forces
                </a>
                <a href="/events" className="text-gray-300 hover:text-white transition-colors">
                  Events
                </a>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          {sortedForces.map((force) => {
            const forceChars = forceGroups[force]
            const isExpanded = expandedForces.has(force)
            const forceIcon = forcesMap[force.replace(/\s+/g, "_").replace(/'/g, "")]
            const displayName = force.replace(/_/g, " ")

            return (
              <Card key={force} className="bg-gray-800 border-gray-700">
                <CardContent className="p-0">
                  {/* Force Header */}
                  <button
                    onClick={() => toggleForce(force)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {forceIcon && (
                        <img
                          src={forceIcon || "/placeholder.svg"}
                          alt={displayName}
                          className="w-8 h-8 object-contain"
                        />
                      )}
                      <span className="text-white font-medium text-lg">{displayName}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <span className="text-gray-400 font-medium">{forceChars.length}</span>
                        <img
                            src="/icons/name.png"
                            alt="User Icon"
                            className="w-3 h-5"
                        />
                        {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                    </div>
                  </button>

                  {/* Characters Grid */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                        {forceChars.map((character) => (
                          <Link key={character.id} href={`/characters/${character.id}`}>
                            <div className="relative w-full h-32 overflow-hidden rounded cursor-pointer hover:ring-2 hover:ring-white transition-all">
                              {/* Character Image */}
                              <img
                                src={`/chars/${character.id}/image.png`}
                                alt={character.name}
                                className="absolute inset-0 w-full h-full object-cover"
                              />

                              {/* Frame Overlay */}
                              <img
                                src={
                                  character.type === "attacker"
                                    ? `/frame/frameMemberM${character.stars}.png`
                                    : `/frame/frameBlessM${character.stars}.png`
                                }
                                alt="Frame"
                                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                              />

                              {/* Name (top-left) */}
                              <div className="absolute top-1 left-1 bg-black bg-opacity-80 text-white text-[10px] px-1 py-0.5 rounded z-10">
                                {character.name}
                              </div>

                              {/* Stars (bottom-left) */}
                              <img
                                src={`/stars/starCharaL${character.stars}A.png`}
                                alt="stars"
                                className="absolute bottom-1 left-1 h-6 object-contain z-10"
                              />

                              {/* Element Icon (top-right) */}
                              <div className="absolute top-1 right-1 flex flex-col items-center z-20 space-y-1">
                                {character.element !== "" && (
                                  <img
                                    src={
                                      character.type === "attacker"
                                        ? elementIcons[character.element.replace(/\s+/g, "_").replace(/'/g, "")] ||
                                          "/placeholder.svg"
                                        : protelementIcons2[character.element.replace(/\s+/g, "_").replace(/'/g, "")] ||
                                          "/placeholder.svg"
                                    }
                                    alt={character.element}
                                    className="w-6 h-6 object-contain"
                                  />
                                )}

                                {/* DMG Type Icon */}
                                {character.dmg_type !== "" && (
                                  <img
                                    src={
                                      dmg_typeIcons[
                                        character.type === "attacker"
                                          ? character.dmg_type.replace(/\s+/g, "_").replace(/'/g, "")
                                          : ["magic", "phys"].includes(character.dmg_type.toLowerCase())
                                            ? "prot_" + character.dmg_type.replace(/\s+/g, "_").replace(/'/g, "")
                                            : character.dmg_type.replace(/\s+/g, "_").replace(/'/g, "")
                                      ] || "/placeholder.svg"
                                    }
                                    alt="Dmg"
                                    className="w-6 h-6 object-contain"
                                  />
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

        {sortedForces.length === 0 && (
          <div className="text-center text-gray-400 py-8">No forces found matching the current search.</div>
        )}
      </div>
    </div>
  )
}
