"use client"

import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Star, Sword, Shield, Gamepad2 } from "lucide-react"
import Link from 'next/link'
import { getAllCharacters } from '@/lib/getCharacters'
import { useSearchParams } from "next/navigation"

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
}

const protelementIcons = {
  fire: "/protector_elements/fire.png",
  water: "/protector_elements/water.png",
  earth: "/protector_elements/earth.png",
  space: "/protector_elements/space.png",
  wind: "/protector_elements/wind.png",
  dark: "/protector_elements/dark.png",
  light: "/protector_elements/light.png",
}

const weaponIcons = {
  sword: "/weapons/sword.png",
  katana: "/weapons/katana.png",
  hammer: "/weapons/hammer.png",
  spear: "/weapons/spear.png",
  greatsword: "/weapons/greatsword.png",
  book: "/weapons/book.png",
  fists: "/weapons/fists.png",
}

const dmg_typeIcons = {
  magic: "/type_dmg/icAttackTypeMagic.png",
  phys: "/type_dmg/icAttackTypePhysics.png"
}

const typeIcons = {
  attacker: "/type/attacker.png",
  protector: "/type/protector.png"
}

const ultiIcons = {
  aoe: "/ulti_type/aoe.png",
  single: "/ulti_type/single.png"
}

const chartypeIcons = {
  attack: "/char_type/attack.png",
  balance: "/char_type/balance.png",
  defense: "/char_type/defense.png"
}

export default function CharactersPage() {
  const searchParams = useSearchParams()
  const elementQuery = searchParams.get("element")

  const [searchTerm, setSearchTerm] = useState("")
  const [searchSkills, setSearchSkills] = useState(false)
  const [selectedElements, setSelectedElements] = useState<string[]>([])
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>([])
  const [selectedStars, setSelectedStars] = useState<number[]>([])
  const [selectedDMGType, setSelectedDMGType] = useState<number[]>([])
  const [selectedType, setSelectedType] = useState<number[]>([])
  const [selectedUlti, setSelectedUlti] = useState<number[]>([])
  const [selectedCharType, setSelectedCharType] = useState<number[]>([])
  const [selectedAwakening, setSelectedAwakening] = useState<number[]>([])
  const [skillsFilter, setSkillsFilter] = useState("")
  const [traitsFilter, setTraitsFilter] = useState("")
  const [forceFilter, setForceFilter] = useState("")
  const [townFilter, setTownFilter] = useState("")
  const [sortBy, setSortBy] = useState("release")

  const toggleFilter = (
    value: string | number,
    currentFilters: (string | number)[],
    setFilters: (filters: (string | number)[]) => void,
  ) => {
    if (currentFilters.includes(value)) {
      setFilters(currentFilters.filter((f) => f !== value))
    } else {
      setFilters([...currentFilters, value])
    }
  }

  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.has("element")) {
      setSelectedElements([params.get("element")!.toLowerCase()])
    } else if (params.has("force")) {
      setForceFilter(params.get("force")!)
    }
    // add similar conditions for others if needed
  }, [])


  const filteredCharacters = useMemo(() => {
    return characters.filter((character) => {
      // Search filter
      if (searchTerm) {
        const searchTarget = searchSkills ? character.skills.join(" ") : character.name
        if (!searchTarget.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false
        }
      }

      // Element filter
      if (selectedElements.length > 0 && !selectedElements.includes(character.element)) {
        return false
      }

      // Weapon filter
      if (selectedWeapons.length > 0 && !selectedWeapons.includes(character.weapon)) {
        return false
      }

      // Stars filter
      if (selectedStars.length > 0 && !selectedStars.includes(character.stars)) {
        return false
      }
      if (selectedDMGType.length > 0 && !selectedDMGType.includes(character.dmg_type)) {
        return false
      }
      if (selectedType.length > 0 && !selectedType.includes(character.type)) {
        return false
      }
      if (selectedUlti.length > 0 && !selectedUlti.includes(character.ulti)) {
        return false
      }
      if (selectedCharType.length > 0 && !selectedCharType.includes(character.char_type)) {
        return false
      }
      // Awakening filter
      if (selectedAwakening.length > 0 && !selectedAwakening.includes(character.awakening)) {
        return false
      }
      // Force filter
      if (forceFilter && forceFilter !== "all" && !character.force.includes(forceFilter)) {
        return false
      }


      return true
    })
  }, [searchTerm, searchSkills, selectedElements, selectedWeapons, selectedStars, selectedDMGType , selectedType, selectedUlti , selectedCharType , selectedAwakening, forceFilter])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <span className="text-xl font-bold">SLIME.WIKI</span>
              </div>
              <nav className="hidden md:flex space-x-6">
                <a href="#" className="text-white font-medium">
                  Characters
                </a>
                <a href="#" className="text-gray-300 hover:text-white transition-colors">
                  Forces
                </a>
                <a href="#" className="text-gray-300 hover:text-white transition-colors">
                  Events
                </a>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-300">FILTERS</h2>

            {/* Search */}
            <div className="flex items-center space-x-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <Button
                variant={searchSkills ? "default" : "outline"}
                size="sm"
                onClick={() => setSearchSkills(!searchSkills)}
                className={searchSkills ? "bg-red-600 hover:bg-red-700" : "border-gray-600 text-gray-300"}
              >
                Search Skills
              </Button>
            </div>

            <div className="flex items-center space-x-4 flex-wrap">
              {/* Element Filters */}
              <div className="flex items-center space-x-2">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(elementIcons).map(([element, iconPath]) => (
                    <button
                      key={element}
                      onClick={() => toggleFilter(element, selectedElements, setSelectedElements)}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-opacity ${
                        selectedElements.includes(element)
                          ? "opacity-100 ring-2 ring-white"
                          : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      <img src={iconPath || "/placeholder.svg"} alt={element} className="w-8 h-8 object-contain" />
                    </button>
                  ))}
                </div>

                {/* Vertical Splitter */}
                <div className="border-r border-white opacity-30 h-8 mx-4"></div>
              </div>

              {/* Weapon Filters */}
              <div className="flex items-center space-x-4">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(weaponIcons).map(([weapon, iconPath]) => (
                    <button
                      key={weapon}
                      onClick={() => toggleFilter(weapon, selectedWeapons, setSelectedWeapons)}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-opacity ${
                        selectedWeapons.includes(weapon)
                          ? "opacity-100 ring-2 ring-white"
                          : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      <img src={iconPath || "/placeholder.svg"} alt={weapon} className="w-8 h-8 object-contain" />
                    </button>
                  ))}
                </div>
                <div className="border-r border-white opacity-30 h-8 mx-4"></div>
              </div>

              {/* Star Filters */}
              <div className="flex items-center space-x-4">
                <div className="flex gap-2">
                  {[3, 4, 5, 6].map((stars) => (
                    <button
                      key={stars}
                      onClick={() => toggleFilter(stars, selectedStars, setSelectedStars)}
                      className="p-1"
                    >
                      <img
                        src={`/stars/starCharaL${stars}A.png`}
                        alt={`${stars} Stars`}
                        className="h-6 object-contain"
                      />
                    </button>
                  ))}
                </div>
                <div className="border-r border-white opacity-30 h-8 mx-4"></div>
              </div>

              {/* Type DMG */}
              <div className="flex items-center space-x-4">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dmg_typeIcons).map(([type, iconPath]) => (
                    <button
                      key={type}
                      onClick={() => toggleFilter(type, selectedDMGType, setSelectedDMGType)}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-opacity ${
                        selectedDMGType.includes(type)
                          ? "opacity-100 ring-2 ring-white"
                          : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      <img src={iconPath || "/placeholder.svg"} alt={type} className="w-8 h-8 object-contain" />
                    </button>
                  ))}
                </div>
                <div className="border-r border-white opacity-30 h-8 mx-4"></div>
              </div>

              {/* Type */}
              <div className="flex items-center space-x-4">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(typeIcons).map(([type_char, iconPath]) => (
                    <button
                      key={type_char}
                      onClick={() => toggleFilter(type_char, selectedType, setSelectedType)}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-opacity ${
                        selectedType.includes(type_char)
                          ? "opacity-100 ring-2 ring-white"
                          : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      <img src={iconPath || "/placeholder.svg"} alt={type_char} className="w-8 h-8 object-contain" />
                    </button>
                  ))}
                </div>
                <div className="border-r border-white opacity-30 h-8 mx-4"></div>
              </div>

              {/* Ulti */}
              <div className="flex items-center space-x-4">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ultiIcons).map(([ulti_type, iconPath]) => (
                    <button
                      key={ulti_type}
                      onClick={() => toggleFilter(ulti_type, selectedUlti, setSelectedUlti)}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-opacity ${
                        selectedUlti.includes(ulti_type)
                          ? "opacity-100 ring-2 ring-white"
                          : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      <img src={iconPath || "/placeholder.svg"} alt={ulti_type} className="w-8 h-8 object-contain" />
                    </button>
                  ))}
                </div>
                <div className="border-r border-white opacity-30 h-8 mx-4"></div>
              </div>

              {/* Char Type */}
              <div className="flex items-center space-x-4">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(chartypeIcons).map(([char_type, iconPath]) => (
                    <button
                      key={char_type}
                      onClick={() => toggleFilter(char_type, selectedCharType, setSelectedCharType)}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-opacity ${
                        selectedCharType.includes(char_type)
                          ? "opacity-100 ring-2 ring-white"
                          : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      <img src={iconPath || "/placeholder.svg"} alt={char_type} className="w-8 h-8 object-contain" />
                    </button>
                  ))}
                </div>
                {/* No splitter after last group */}
              </div>
            </div>


            {/* Dropdown Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={skillsFilter} onValueChange={setSkillsFilter}>
                <SelectTrigger className="bg-gray-700 border-gray-600">
                  <SelectValue placeholder="SKILLS" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="all">All Skills</SelectItem>
                  <SelectItem value="predator">Predator</SelectItem>
                  <SelectItem value="healing">Healing</SelectItem>
                </SelectContent>
              </Select>

              <Select value={traitsFilter} onValueChange={setTraitsFilter}>
                <SelectTrigger className="bg-gray-700 border-gray-600">
                  <SelectValue placeholder="TRAITS" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="all">All Traits</SelectItem>
                  <SelectItem value="slime">Slime</SelectItem>
                  <SelectItem value="ogre">Ogre</SelectItem>
                </SelectContent>
              </Select>

              <Select value={forceFilter} onValueChange={setForceFilter}>
                <SelectTrigger className="bg-gray-700 border-gray-600">
                  <SelectValue placeholder="FORCES" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="all">All Forces</SelectItem>
                  <SelectItem value="Protector of Peace">Protector of Peace</SelectItem>
                  <SelectItem value="Stuff">Stuff</SelectItem>
                </SelectContent>
              </Select>

              <Select value={townFilter} onValueChange={setTownFilter}>
                <SelectTrigger className="bg-gray-700 border-gray-600">
                  <SelectValue placeholder="TOWN" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="all">All Towns</SelectItem>
                  <SelectItem value="rimuru-city">Rimuru City</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Characters Section */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-300">CHARACTERS</h2>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  <Shield className="w-4 h-4" />
                  <span>Release</span>
                  <Sword className="w-4 h-4" />
                  <span>Attack</span>
                  <span>❤️</span>
                  <span>Health</span>
                  <Shield className="w-4 h-4" />
                  <span>Defense</span>
                  <span>⚡</span>
                  <span>Existence</span>
                  <span>🌟</span>
                  <span>Rarity</span>
                  <span>📛</span>
                  <span>Name</span>
                </div>
              </div>
            </div>

            {/* Character Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {filteredCharacters.map((character) => (
              <Link key={character.id} href={`/characters/${character.id}`}>
                <div className="relative w-full h-32 overflow-hidden rounded cursor-pointer hover:ring-2 hover:ring-white">
                  {/* Character Image */}
                  <img
                    src={`/chars/${character.id}/image.png`}
                    alt={character.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />

                  {/* Frame Overlay */}
                  <img
                    src="/frame/frameMemberM5up.png"
                    alt="Frame"
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />

                  {/* Stars (bottom-left) */}
                  <img
                    src="/stars/starCharaL5A.png"
                    alt="stars"
                    className="absolute bottom-1 left-1 h-6 object-contain z-10"
                  />

                  {/* Element Icon (top-right) */}
                  <div className="absolute top-1 right-1 flex flex-col items-center z-20 space-y-1">
                    <img
                      src={
                        character.type === "attacker"
                          ? (elementIcons[character.element] || "/placeholder.svg")
                          : (protelementIcons[character.element] || "/placeholder.svg")
                      }
                      alt={character.element}
                      className="w-6 h-6 object-contain"
                    />
                    <img
                      src="/type_dmg/icAttackTypePhysics.png"
                      alt="Dmg"
                      className="w-6 h-6 object-contain"
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
            {filteredCharacters.length === 0 && (
              <div className="text-center text-gray-400 py-8">No characters found matching the current filters.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
