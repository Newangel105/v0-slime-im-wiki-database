"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Gamepad2, X, ChevronDown } from "lucide-react"
import Link from "next/link"
import { getAllCharacters } from "@/lib/getCharacters"
import { useSearchParams } from "next/navigation"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"

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
  Visions_of_Coleus: "/protector_elements/Visions_of_Coleus.png",
  Warriors_Mind: "/protector_elements/Warrior's_Mind.png",
  Wholehearted_Devotion: "/protector_elements/Wholehearted_Devotion.png",
  Wielder_of_Magic: "/protector_elements/Wielder_of_Magic.png",
  World_of_Fantasy: "/protector_elements/World_of_Fantasy.png",
}

const protelementIcons = {
  prot_fire: "/protector_elements/Anti-Fire.png",
  prot_water: "/protector_elements/Anti-Water.png",
  prot_earth: "/protector_elements/Anti-Earth.png",
  prot_space: "/protector_elements/Anti-Space.png",
  prot_wind: "/protector_elements/Anti-Wind.png",
  prot_dark: "/protector_elements/Anti-Dark.png",
  prot_light: "/protector_elements/Anti-Light.png",
  prot_ex_fire: "/elements/anti_fire_attribute_unbound.png",
  prot_ex_water: "/elements/anti_water_attribute_unbound.png",
  prot_ex_earth: "/elements/anti_earth_attribute_unbound.png",
  prot_ex_space: "/elements/anti_space_attribute_unbound.png",
  prot_ex_wind: "/elements/anti_wind_attribute_unbound.png",
  prot_ex_dark: "/elements/anti_dark_attribute_unbound.png",
  prot_ex_light: "/elements/anti_light_attribute_unbound.png",
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

const dmg_typeIcons_1 = {
  magic: "/type_dmg/icAttackTypeMagic.png",
  phys: "/type_dmg/icAttackTypePhysics.png",
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

const typeIcons = {
  attacker: "/type/attacker.png",
  protector: "/type/protector.png",
}

const ultiIcons = {
  aoe: "/ulti_type/aoe.png",
  single: "/ulti_type/single.png",
}

const chartypeIcons = {
  attack: "/char_type/attack.png",
  balance: "/char_type/balance.png",
  defense: "/char_type/defense.png",
}

// Multi-select dropdown component with grouped options
function MultiSelectDropdown({
  placeholder,
  options,
  selectedValues,
  onSelectionChange,
  renderOption,
}: {
  placeholder: string
  options: Array<{
    label: string
    options: Array<{ value: string; label: string; icon?: string; section?: string }>
  }>
  selectedValues: string[]
  onSelectionChange: (values: string[]) => void
  renderOption?: (option: { value: string; label: string; icon?: string; section?: string }) => React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter((v) => v !== value))
    } else {
      onSelectionChange([...selectedValues, value])
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
        >
          <span className="truncate">
            {selectedValues.length > 0 ? `${selectedValues.length} selected` : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-gray-700 border-gray-600" align="start">
        <div className="max-h-60 overflow-auto">
          {options.map((group) => (
            <div key={group.label}>
              {/* Section Header */}
              <div className="px-3 py-2 text-xs font-semibold text-gray-300 bg-gray-600 uppercase tracking-wide">
                {group.label}
              </div>
              {/* Section Options */}
              {group.options.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-600 cursor-pointer"
                  onClick={() => toggleOption(option.value)}
                >
                  <Checkbox checked={selectedValues.includes(option.value)} className="border-gray-400" />
                  {renderOption ? (
                    renderOption(option)
                  ) : (
                    <div className="flex items-center space-x-2">
                      {option.icon && (
                        <img
                          src={option.icon || "/placeholder.svg"}
                          alt={option.label}
                          className="w-5 h-5 object-contain"
                        />
                      )}
                      <span className="text-white text-sm">{option.label}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function CharactersPage() {
  const searchParams = useSearchParams()
  const query = searchParams.get("tag")

  const [searchTerm, setSearchTerm] = useState("")
  const [searchSkills, setSearchSkills] = useState(false)
  const [selectedElements, setSelectedElements] = useState<string[]>([])
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>([])
  const [selectedStars, setSelectedStars] = useState<number[]>([])
  const [selectedDMGType, setSelectedDMGType] = useState<string[]>([])
  const [selectedType, setSelectedType] = useState<string[]>([])
  const [selectedUlti, setSelectedUlti] = useState<string[]>([]);
  const [selectedCharType, setSelectedCharType] = useState<string[]>([])
  const [selectedAwakening, setSelectedAwakening] = useState<number[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Multi-select states
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [selectedTraits, setSelectedTraits] = useState<string[]>([])
  const [selectedForces, setSelectedForces] = useState<string[]>([])
  const [selectedTowns, setSelectedTowns] = useState<string[]>([])

  const [sortBy, setSortBy] = useState("release_date")

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

  function renderSortableHeader(key: typeof sortKey, iconSrc: string, label: string) {
    const isActive = sortKey === key

    const toggleSort = () => {
      if (isActive) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
      } else {
        setSortKey(key)
        setSortOrder("asc")
      }
    }

    const directionIcon = isActive && sortOrder === "asc" ? "↑" : isActive && sortOrder === "desc" ? "↓" : "↕" // nothing when inactive

    return (
      <button
        onClick={toggleSort}
        className={`flex items-center gap-1 hover:text-white transition ${isActive ? "text-white font-semibold" : ""}`}
      >
        <img src={iconSrc || "/placeholder.svg"} alt={label} className="w-4 h-4" />
        <span>{label}</span>
        <span className="text-xs">{directionIcon}</span>
      </button>
    )
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    const tag = params.get("tag");

    if (!tag) return;

    // 🔸 Define tag groups
    const forces = [
      "Shizu's Will", "Lycanthrope's Pride", "New Year's Blessing", "Ogre's Pride", "Warrior's Mind",
      "Axiom of Haze", "Clan Chief", "Demon Lord Invasion", "Determination to Prosper", "Dragon Haki",
      "Exalted Champions", "Festive Memories", "Flashback Beatdown Emissary", "Forest Fracas", "Fount of Wisdom",
      "Frozen Continent", "Gaining Status", "Goddess of Destiny", "Heart of a Hero", "Hyper Heart",
      "Monster and Human Mingling", "Octagram Bazaar", "Octagram Demon Lord", "Otherworld Legend", "Pretty Sparkle",
      "Primal Demon", "Protector of Peace", "Scarlet Bond", "Spirit Master", "Stern of Spirit", "Summer Memories",
      "Tempest Elite", "Ten Great Demon Lords", "Visions of Coleus", "Wholehearted Devotion", "Wielder of Magic",
      "World of Fantasy"
    ];

      const skillSections2 = [
        "special",
        "from soul",
        "soul amount",
        "to soul",
        "soul buff",
        "gauge",
        "buff all",
        "buff self",
        "debuff all",
        "debuff single",
        "heal",
      ];
      const traitSections2 = [...skillSections2];

    const weapons = ["Katana", "Hammer", "Spear", "Greatsword", "Book", "Fists"];
    const elements = ["Fire", "Dark", "Earth", "Space", "Light", "Water", "Wind"];
    const targetTypes = ["All", "Single"];
    const damageTypes = ["Magic", "Physical"];
    const starLevels = ["3", "4", "5", "EX 5"];
    const characterTypes = ["Battle Characters", "Protection Characters"];
    const exRoles = ["EX Attack", "EX Balance", "EX Defense"];

    // 🔸 Handle each tag type
    if (tag.startsWith("Skills")) {
      // Remove 'Skills' prefix
      const afterSkills = tag.slice(6).trim(); // "Gauge Skill Points"
      
      // Find which section it starts with
      const section = skillSections2.find(sec => afterSkills.toLowerCase().startsWith(sec));
      if (section) {
        // Extract the rest after the section name
        const subTag = afterSkills.slice(section.length).trim(); // "Skill Points"

        if (subTag) {
          // Compose value in dropdown format
          const value = `${section}|${subTag}`;
          setSelectedSkills([value]);
        }
      }
    } else if (tag.startsWith("Traits")) {
      const afterTraits = tag.slice(6).trim();
      const section = traitSections2.find(sec => afterTraits.toLowerCase().startsWith(sec));
      if (section) {
        const subTag = afterTraits.slice(section.length).trim();
        if (subTag) {
          const value = `${section}|${subTag}`;
          setSelectedTraits([value]);
        }
      }
    } else if (tag.endsWith("%")) {
      setSelectedTowns([tag]);
    } else if (forces.includes(tag)) {
      setSelectedForces([tag]);
    } else if (damageTypes.includes(tag)) {
       if(tag == "Magic"){
        setSelectedDMGType(["magic"]);
      }
      else{
        setSelectedDMGType(["phys"])
      }
    } else if (targetTypes.includes(tag)) {
      if(tag == "All"){
        setSelectedUlti(["aoe"]);
      }
      if(tag == "Single"){
        setSelectedUlti(["single"]);
      }
    } else if (starLevels.includes(tag)) {
      // Handle star level
      if (tag === "EX 5") {
        setSelectedStars([6]); // EX 5 maps to 6-star filter
      } else {
        setSelectedStars([parseInt(tag)]);
      }
    } else if (tag.startsWith("Anti")) {
      // Handle anti-type tags
      setSelectedElements([tag.replace("Anti-", "").toLowerCase()]);
    } else if (elements.includes(tag)) {
      // Handle element tag
      setSelectedElements([tag.toLowerCase()]);
    } else if (characterTypes.includes(tag)) {
      // Battle or Protection characters
      
      if (tag === "Battle Characters") {
        setSelectedType(["attacker"]);
      } else {
        setSelectedType(["protector"]);
      }
    } else if (exRoles.includes(tag)) {
      // EX Role selection
      if (tag === "EX Attack") {
        setSelectedCharType(["attack"]);
      } else if(tag === "EX Balance") {
        setSelectedCharType(["balance"]);
      }
      else {
        setSelectedCharType(["defense"]);
      }
    } else if (weapons.includes(tag)) {
      // Weapon filtering
      setSelectedWeapons([tag.toLowerCase()])
    }
    // add similar conditions for others if needed
  }, [])

  const skillSections = [
    "special",
    "from soul",
    "soul amount",
    "to soul",
    "soul buff",
    "gauge",
    "buff all",
    "buff self",
    "debuff all",
    "debuff single",
    "heal",
  ]
  const traitSections = [...skillSections] // same structure for trait tags

  const skillsData: Record<string, Set<string>> = {}
  const traitsData: Record<string, Set<string>> = {}
  const townData: Set<string> = new Set()

  characters.forEach((char) => {
    const tags = char.tag

    tags.forEach((tag: string) => {
      const trimmedTag = tag.trim()
      const tagLower = trimmedTag.toLowerCase()

      if (tagLower.startsWith("skills")) {
        const afterSkills = trimmedTag.slice(6).trim() // remove "Skills"
        const section = skillSections.find((sec) => afterSkills.toLowerCase().startsWith(sec))
        if (section) {
          if (!skillsData[section]) skillsData[section] = new Set()
          const subTag = afterSkills.slice(section.length).trim() // remove section name
          if (subTag) skillsData[section].add(subTag)
        }
        return
      }

      if (tagLower.startsWith("traits")) {
        const afterTraits = trimmedTag.slice(6).trim() // remove "Traits"
        const section = traitSections.find((sec) => afterTraits.toLowerCase().startsWith(sec))
        if (section) {
          if (!traitsData[section]) traitsData[section] = new Set()
          const subTag = afterTraits.slice(section.length).trim() // remove section name
          if (subTag) traitsData[section].add(subTag)
        }
        return
      }

      if (/\+\d+%$/.test(tag)) {
        townData.add(tag.trim())
      }
    })
  })

  // Prepare options for dropdowns with grouped structure
  const skillOptions = Object.entries(skillsData).map(([section, items]) => ({
    label: section,
    options: Array.from(items).map((item) => ({
      value: `${section}|${item}`,
      label: item, // Just the item name, not "section: item"
      section: section,
    })),
  }))

  const traitOptions = Object.entries(traitsData).map(([section, items]) => ({
    label: section,
    options: Array.from(items).map((item) => ({
      value: `${section}|${item}`,
      label: item, // Just the item name, not "section: item"
      section: section,
    })),
  }))

  const forceOptions = [
    {
      label: "Forces",
      options: Object.entries(forcesMap).map(([forceName, imgPath]) => ({
        value: forceName,
        label: forceName.replace(/_/g, " "),
        icon: imgPath,
      })),
    },
  ]

  const townOptions = [
    {
      label: "Towns",
      options: Array.from(townData).map((town) => ({
        value: town,
        label: town,
      })),
    },
  ]

  // Remove selected item function
  const removeSelectedItem = (type: "skills" | "traits" | "forces" | "towns", value: string) => {
    switch (type) {
      case "skills":
        setSelectedSkills((prev) => prev.filter((item) => item !== value))
        break
      case "traits":
        setSelectedTraits((prev) => prev.filter((item) => item !== value))
        break
      case "forces":
        setSelectedForces((prev) => prev.filter((item) => item !== value))
        break
      case "towns":
        setSelectedTowns((prev) => prev.filter((item) => item !== value))
        break
    }
  }

  const [sortKey, setSortKey] = useState<
    "name" | "final_attack" | "final_health" | "final_defense" | "stars" | "release_date" | "existence" | null
  >(null)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const filteredCharacters = useMemo(() => {
    const search = searchTerm.toLowerCase()

    // First, apply filtering
    const filtered = characters.filter((character) => {
      if (search) {
        if (!searchSkills) {
          if (!character.name.toLowerCase().includes(search) && 
              !character.sub_name?.toLowerCase().includes(search)) {
            return false;
          }
        } else {
          const combinedSkillsText = [
            ...character.battle_skills.map((s) => s.description),
            ...character.secret_skills.map((s) => s.description),
            ...character.skill_traits.map((s) => s.description),
            ...character.ex_abilities.map((s) => s.description),
          ]
            .join(" ")
            .toLowerCase()

          if (!combinedSkillsText.includes(search)) return false
        }
      }

      const stripPrefixes = (element) => element.replace(/^(prot_)?(ex_)?/, "")

      const baseElement = stripPrefixes(character.element)

      const isMatch = selectedElements.some((sel) => {
        if (sel.startsWith("prot_") || sel.startsWith("ex_")) {
          // Exact match required when selector is prefixed
          return sel === character.element
        } else {
          // Loose match: strip prefixes from character.element
          return sel === baseElement
        }
      })

      if (selectedElements.length > 0 && !isMatch) return false

      if (selectedWeapons.length > 0 && !selectedWeapons.includes(character.weapon)) return false
      if (selectedStars.length > 0 && !selectedStars.includes(character.stars)) return false

      const baseDmgType = character.dmg_type.startsWith("prot_") ? character.dmg_type.slice(5) : character.dmg_type

      if (selectedDMGType.length > 0 && !selectedDMGType.includes(baseDmgType)) return false
      if (selectedType.length > 0 && !selectedType.includes(character.type)) return false
      if (selectedUlti.length > 0 && !selectedUlti.includes(character.ulti)) return false
      if (selectedCharType.length > 0 && !selectedCharType.includes(character.char_type)) return false
      if (selectedAwakening.length > 0 && !selectedAwakening.includes(character.awakening)) return false

      // Multi-select filters
      if (selectedForces.length > 0 && !selectedForces.some((force) => character.force.includes(force))) return false
      if (selectedSkills.length > 0) {
        // Check if character has any of the selected skills
        const hasSkill = selectedSkills.some((skill) => {
          const [section, item] = skill.split("|")
          return character.tag.some(
            (tag) =>
              tag.toLowerCase().includes("skills") &&
              tag.toLowerCase().includes(section.toLowerCase()) &&
              tag.toLowerCase().includes(item.toLowerCase()),
          )
        })
        if (!hasSkill) return false
      }
      if (selectedTraits.length > 0) {
        // Check if character has any of the selected traits
        const hasTrait = selectedTraits.some((trait) => {
          const [section, item] = trait.split("|")
          return character.tag.some(
            (tag) =>
              tag.toLowerCase().includes("traits") &&
              tag.toLowerCase().includes(section.toLowerCase()) &&
              tag.toLowerCase().includes(item.toLowerCase()),
          )
        })
        if (!hasTrait) return false
      }
      if (selectedTowns.length > 0) {
        const hasTown = selectedTowns.some((town) => character.tag.includes(town))
        if (!hasTown) return false
      }

      return true
    })

    // Then, apply sorting
    if (sortKey) {
      filtered.sort((a, b) => {
        let aValue = a[sortKey]
        let bValue = b[sortKey]

        if (sortKey === "release_date") {
          // Convert to dates
          aValue = new Date(a.release_date)
          bValue = new Date(b.release_date)
        }

        if (typeof aValue === "string") aValue = aValue.toLowerCase()
        if (typeof bValue === "string") bValue = bValue.toLowerCase()

        if (aValue < bValue) return sortOrder === "asc" ? -1 : 1
        if (aValue > bValue) return sortOrder === "asc" ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [
    characters,
    searchTerm,
    searchSkills,
    selectedElements,
    selectedWeapons,
    selectedStars,
    selectedDMGType,
    selectedType,
    selectedUlti,
    selectedCharType,
    selectedAwakening,
    selectedSkills,
    selectedTraits,
    selectedForces,
    selectedTowns,
    sortKey,
    sortOrder,
  ])

  // Get all selected items for the common display area
  const allSelectedItems = [
    ...selectedSkills.map((skill) => ({
      type: "skills" as const,
      value: skill,
      label: skill.split("|")[1] || skill, // Just show the value part
      section: skill.split("|")[0] || "", // Keep section for context if needed
    })),
    ...selectedTraits.map((trait) => ({
      type: "traits" as const,
      value: trait,
      label: trait.split("|")[1] || trait, // Just show the value part
      section: trait.split("|")[0] || "",
    })),
    ...selectedForces.map((force) => ({
      type: "forces" as const,
      value: force,
      label: force.replace(/_/g, " "),
      section: "forces",
    })),
    ...selectedTowns.map((town) => ({
      type: "towns" as const,
      value: town,
      label: town,
      section: "towns",
    })),
  ]

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

              <label className="flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={searchSkills}
                  onChange={() => setSearchSkills(!searchSkills)}
                  className="hidden peer" // <-- Add 'peer' here
                />
                <div
                  className="w-10 h-5 bg-gray-600 rounded-full relative transition-colors duration-300 ease-in-out
                        after:absolute after:top-0.5 after:left-0.5 after:bg-white after:w-4 after:h-4 after:rounded-full after:transition-transform
                        after:duration-300 after:ease-in-out
                        peer-checked:bg-red-600 peer-checked:after:translate-x-5"
                ></div>
                <span className="ml-3 text-sm text-gray-300 select-none">Search Skills</span>
              </label>
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
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
                <div className="border-r border-white opacity-30 h-6 mx-1"></div>
              </div>

              {/* Protector Element Filters */}
              <div className="flex items-center space-x-2">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(protelementIcons).map(([element, iconPath]) => (
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
                <div className="border-r border-white opacity-30 h-6 mx-1"></div>
              </div>

              {/* Weapon Filters */}
              <div className="flex items-center space-x-1">
                <div className="flex flex-wrap gap-1">
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
                <div className="border-r border-white opacity-30 h-6 mx-1"></div>
              </div>

              {/* Star Filters */}
              <div className="flex items-center space-x-1">
                <div className="flex gap-1">
                  {[3, 4, 5, 6, 7].map((stars) => (
                    <button
                      key={stars}
                      onClick={() => toggleFilter(stars, selectedStars, setSelectedStars)}
                      className={`p-1 rounded transition-opacity ${
                        selectedStars.includes(stars)
                          ? "opacity-100 ring-2 ring-white"
                          : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      <img
                        src={`/stars/starCharaL${stars}A.png`}
                        alt={`${stars} Stars`}
                        className="h-6 object-contain"
                      />
                    </button>
                  ))}
                </div>
                <div className="border-r border-white opacity-30 h-6 mx-1"></div>
              </div>

              {/* Type DMG */}
              <div className="flex items-center space-x-1">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(dmg_typeIcons_1).map(([type, iconPath]) => (
                    <button
                      key={type}
                      onClick={() => toggleFilter(type, selectedDMGType, setSelectedDMGType)}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-opacity ${
                        selectedDMGType.includes(type) ? "opacity-100 ring-2 ring-white" : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      <img src={iconPath || "/placeholder.svg"} alt={type} className="w-8 h-8 object-contain" />
                    </button>
                  ))}
                </div>
                <div className="border-r border-white opacity-30 h-6 mx-1"></div>
              </div>

              {/* Type */}
              <div className="flex items-center space-x-1">
                <div className="flex flex-wrap gap-1">
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
                <div className="border-r border-white opacity-30 h-6 mx-1"></div>
              </div>

              {/* Ulti */}
              <div className="flex items-center space-x-1">
                <div className="flex flex-wrap gap-1">
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
                <div className="border-r border-white opacity-30 h-6 mx-1"></div>
              </div>

              {/* Char Type */}
              <div className="flex items-center space-x-1">
                <div className="flex flex-wrap gap-1">
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

            {/* Multi-Select Dropdown Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <MultiSelectDropdown
                placeholder="Select Skills"
                options={skillOptions}
                selectedValues={selectedSkills}
                onSelectionChange={setSelectedSkills}
              />

              <MultiSelectDropdown
                placeholder="Select Traits"
                options={traitOptions}
                selectedValues={selectedTraits}
                onSelectionChange={setSelectedTraits}
              />

              <MultiSelectDropdown
                placeholder="Select Forces"
                options={forceOptions}
                selectedValues={selectedForces}
                onSelectionChange={setSelectedForces}
                renderOption={(option) => (
                  <div className="flex items-center space-x-2">
                    {option.icon && (
                      <img
                        src={option.icon || "/placeholder.svg"}
                        alt={option.label}
                        className="w-5 h-5 object-contain"
                      />
                    )}
                    <span className="text-white text-sm">{option.label}</span>
                  </div>
                )}
              />

              <MultiSelectDropdown
                placeholder="Select Towns"
                options={townOptions}
                selectedValues={selectedTowns}
                onSelectionChange={setSelectedTowns}
              />
            </div>

            {/* Selected Items Display */}
            {allSelectedItems.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Selected Filters:</h3>
                <div className="flex flex-wrap gap-2">
                  {allSelectedItems.map((item, index) => (
                    <div
                      key={`${item.type}-${item.value}-${index}`}
                      className="flex items-center bg-gray-700 text-white text-sm px-3 py-1 rounded-full border border-gray-600"
                    >
                      <span className="text-xs text-gray-400 mr-1 capitalize">{item.type}:</span>
                      <span>{item.label}</span>
                      <button
                        onClick={() => removeSelectedItem(item.type, item.value)}
                        className="ml-2 hover:text-red-400 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Characters Section */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-300">CHARACTERS</h2>
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                {renderSortableHeader("release_date", "/icons/release.png", "Release")}
                {renderSortableHeader("final_attack", "/icons/ATK.png", "Attack")}
                {renderSortableHeader("final_health", "/icons/HP.png", "Health")}
                {renderSortableHeader("final_defense", "/icons/DEF.png", "Defense")}
                {renderSortableHeader("existence", "/icons/existence.png", "Existence")}
                {renderSortableHeader("stars", "/icons/rarity.png", "Rarity")}
                {renderSortableHeader("name", "/icons/name.png", "Name")}
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

                      {/* Only show dmg_type icon if element is NOT empty AND dmg_type is NOT empty */}
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
            {filteredCharacters.length === 0 && (
              <div className="text-center text-gray-400 py-8">No characters found matching the current filters.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}