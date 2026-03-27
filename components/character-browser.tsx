"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowDownUp, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  characterMatchesEffectFilters,
  getCharacterEffectFilterGroups,
  type CharacterEffectFilterGroup,
} from "@/lib/character-effect-filters"
import {
  formatWikiLabel,
  getCharacterVisualTier,
  getCharacterRarityLabel,
  getDisplayElementLabel,
  normalizeLabel,
  toPublicAssetPath,
  type WikiCharacter,
} from "@/lib/pc-wiki"

type SortKey = "name" | "release_date" | "rarity" | "attack" | "hp" | "defense" | "existence"

type FilterOption = {
  label: string
  value: string
}

const elementIconMap: Record<string, string> = {
  air: "/elements/icElementWind.png",
  dark: "/elements/icElementDark.png",
  earth: "/elements/icElementEarth.png",
  enhancedair: "/Image/IcElementBless/IcElementBlessEnhancedAir.png",
  enhanceddark: "/Image/IcElementBless/IcElementBlessEnhancedDark.png",
  enhancedearth: "/Image/IcElementBless/IcElementBlessEnhancedEarth.png",
  enhancedfire: "/Image/IcElementBless/IcElementBlessEnhancedFire.png",
  enhancedholy: "/Image/IcElementBless/IcElementBlessEnhancedHoly.png",
  enhancedwater: "/Image/IcElementBless/IcElementBlessEnhancedWater.png",
  enhancedwind: "/Image/IcElementBless/IcElementBlessEnhancedWind.png",
  fire: "/elements/icElementFire.png",
  light: "/elements/icElementlight.png",
  space: "/elements/icElementspace.png",
  water: "/elements/icElementWater.png",
  wind: "/elements/icElementWind.png",
}

const attackTypeIconMap: Record<string, string> = {
  magic: "/type_dmg/icAttackTypeMagic.png",
  physical: "/type_dmg/icAttackTypePhysics.png",
}

const weaponIconMap: Record<string, string> = {
  book: "/weapons/book.png",
  fist: "/weapons/fists.png",
  fists: "/weapons/fists.png",
  greatsword: "/weapons/greatsword.png",
  hammer: "/weapons/hammer.png",
  katana: "/weapons/katana.png",
  knuckle: "/weapons/fists.png",
  spear: "/weapons/spear.png",
  sword: "/weapons/sword.png",
}

const tacticsIconMap: Record<string, string> = {
  charge: "/Image/Tactics/charge.png",
  defense: "/Image/Tactics/defense.png",
  normal: "/Image/Tactics/normal.png",
  speed: "/Image/Tactics/speed.png",
}

const rarityFrameMap: Record<number, string> = {
  3: "/frame/frameMemberM3.png",
  4: "/frame/frameMemberM4.png",
  5: "/frame/frameMemberM5.png",
  6: "/frame/frameMemberM6.png",
  7: "/frame/frameMemberM7.png",
}

const starAssetMap: Record<number, string> = {
  3: "/stars/starCharaL3A.png",
  4: "/stars/starCharaL4A.png",
  5: "/stars/starCharaL5A.png",
  6: "/stars/starCharaL6A.png",
  7: "/stars/starCharaL7A.png",
}

function buildOptions(values: string[]): FilterOption[] {
  return [...new Set(values.filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ label: value, value }))
}

function ToggleFilter({
  title,
  options,
  selectedValues,
  onToggle,
}: {
  title: string
  options: FilterOption[]
  selectedValues: string[]
  onToggle: (value: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between gap-2 border-gray-600 bg-gray-700 text-white hover:bg-gray-600">
          <span>{title}</span>
          <Badge variant="secondary" className="bg-gray-900 text-white">
            {selectedValues.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 border-gray-600 bg-gray-700 p-0 text-white" align="start">
        <div className="border-b border-gray-600 px-4 py-3">
          <p className="text-sm font-semibold text-white">{title}</p>
        </div>
        <ScrollArea className="h-72 px-4 py-3">
          <div className="space-y-3">
            {options.map((option) => {
              const checked = selectedValues.includes(option.value)
              return (
                <label key={option.value} className="flex cursor-pointer items-center gap-3 text-sm text-gray-200">
                  <Checkbox checked={checked} onCheckedChange={() => onToggle(option.value)} />
                  <span>{option.label}</span>
                </label>
              )
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function GroupedToggleFilter({
  title,
  groups,
  selectedValues,
  onToggle,
}: {
  title: string
  groups: CharacterEffectFilterGroup[]
  selectedValues: string[]
  onToggle: (value: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between gap-2 border-gray-600 bg-gray-700 text-white hover:bg-gray-600">
          <span>{title}</span>
          <Badge variant="secondary" className="bg-gray-900 text-white">
            {selectedValues.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-gray-600 bg-gray-700 p-0 text-white" align="start">
        <ScrollArea className="h-96">
          <div className="p-0">
            {groups.map((group) => (
              <div key={group.key} className="border-b border-gray-600 last:border-b-0">
                <div className="bg-gray-600/70 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-gray-100">
                  {group.title}
                </div>
                <div className="space-y-3 px-4 py-3">
                  {group.options.map((option) => {
                    const checked = selectedValues.includes(option.value)

                    return (
                      <label key={option.value} className="flex cursor-pointer items-center gap-3 text-sm text-gray-200">
                        <Checkbox checked={checked} onCheckedChange={() => onToggle(option.value)} />
                        <span>{option.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

export function CharacterBrowser({ characters }: { characters: WikiCharacter[] }) {
  const searchParams = useSearchParams()
  const [searchText, setSearchText] = useState("")
  const [selectedElements, setSelectedElements] = useState<string[]>([])
  const [selectedAttackTypes, setSelectedAttackTypes] = useState<string[]>([])
  const [selectedTactics, setSelectedTactics] = useState<string[]>([])
  const [selectedForces, setSelectedForces] = useState<string[]>([])
  const [selectedSkillFilters, setSelectedSkillFilters] = useState<string[]>([])
  const [selectedTraitNames, setSelectedTraitNames] = useState<string[]>([])
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>("release_date")

  useEffect(() => {
    const tag = searchParams.get("tag")
    if (!tag) {
      return
    }

    setSearchText(tag)
  }, [searchParams])

  const options = useMemo(
    () => ({
      elements: buildOptions(characters.map((character) => character.element)),
      attackTypes: buildOptions(characters.map((character) => character.attack_type)),
      tactics: buildOptions(characters.map((character) => character.tactics_type)),
      forces: buildOptions(characters.flatMap((character) => character.forces.map((force) => force.name))),
      skillGroups: getCharacterEffectFilterGroups(characters),
      traits: buildOptions(characters.flatMap((character) => character.traits.map((trait) => trait.name))),
      facilities: buildOptions(characters.flatMap((character) => character.facilities)),
    }),
    [characters],
  )

  const filteredCharacters = useMemo(() => {
    const query = normalizeLabel(searchText)
    const filtered = characters.filter((character) => {
      const searchable = [
        character.name,
        character.affiliation_name,
        character.element,
        character.attack_type,
        character.weapon_type,
        character.tactics_type,
        ...character.forces.map((force) => force.name),
        ...character.skills.map((skill) => skill.name),
        ...character.traits.map((trait) => trait.name),
        ...character.facilities,
      ]
        .join(" ")
        .toLowerCase()

      if (query && !searchable.includes(query)) {
        return false
      }
      if (selectedElements.length && !selectedElements.includes(character.element)) {
        return false
      }
      if (selectedAttackTypes.length && !selectedAttackTypes.includes(character.attack_type)) {
        return false
      }
      if (selectedTactics.length && !selectedTactics.includes(character.tactics_type)) {
        return false
      }
      if (selectedForces.length && !selectedForces.every((value) => character.forces.some((force) => force.name === value))) {
        return false
      }
      if (!characterMatchesEffectFilters(character, selectedSkillFilters)) {
        return false
      }
      if (selectedTraitNames.length && !selectedTraitNames.every((value) => character.traits.some((trait) => trait.name === value))) {
        return false
      }
      if (selectedFacilities.length && !selectedFacilities.every((value) => character.facilities.includes(value))) {
        return false
      }

      return true
    })

    return filtered.sort((left, right) => {
      switch (sortKey) {
        case "attack":
          return right.stats.attack - left.stats.attack
        case "hp":
          return right.stats.hp - left.stats.hp
        case "defense":
          return right.stats.defense - left.stats.defense
        case "existence":
          return right.stats.existence - left.stats.existence
        case "rarity":
          return right.rarity - left.rarity || right.stats.existence - left.stats.existence
        case "release_date":
          return right.release_date.localeCompare(left.release_date)
        case "name":
        default:
          return left.name.localeCompare(right.name)
      }
    })
  }, [
    characters,
    searchText,
    selectedAttackTypes,
    selectedElements,
    selectedFacilities,
    selectedForces,
    selectedSkillFilters,
    selectedTactics,
    selectedTraitNames,
    sortKey,
  ])

  const activeFilterCount =
    selectedElements.length +
    selectedAttackTypes.length +
    selectedTactics.length +
    selectedForces.length +
    selectedSkillFilters.length +
    selectedTraitNames.length +
    selectedFacilities.length

  function resetFilters() {
    setSearchText("")
    setSelectedElements([])
    setSelectedAttackTypes([])
    setSelectedTactics([])
    setSelectedForces([])
    setSelectedSkillFilters([])
    setSelectedTraitNames([])
    setSelectedFacilities([])
    setSortKey("release_date")
  }

  function toggleValue(values: string[], setter: (next: string[]) => void, value: string) {
    setter(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value])
  }

  return (
    <main className="min-h-screen bg-[#111827] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rounded-2xl border border-gray-700 bg-gray-800 p-5 shadow-[0_0_24px_rgba(255,255,255,0.08)]">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">Characters</h1>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search names, affiliations, effects, forces, towns" className="h-12 rounded-full border-gray-600 bg-gray-700 pl-11 text-white placeholder:text-gray-400" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <ArrowDownUp className="h-4 w-4" />
                  <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                    <SelectTrigger className="w-[170px] border-gray-600 bg-gray-700 text-white">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent className="border-gray-600 bg-gray-700 text-white">
                      <SelectItem value="existence">Existence</SelectItem>
                      <SelectItem value="attack">Attack</SelectItem>
                      <SelectItem value="hp">Health</SelectItem>
                      <SelectItem value="defense">Defense</SelectItem>
                      <SelectItem value="rarity">Rarity</SelectItem>
                      <SelectItem value="release_date">Release date</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={resetFilters} className="border-gray-600 bg-gray-700 text-white hover:bg-gray-600">
                  Reset
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <ToggleFilter title="Element" options={options.elements} selectedValues={selectedElements} onToggle={(value) => toggleValue(selectedElements, setSelectedElements, value)} />
              <ToggleFilter title="Attack Type" options={options.attackTypes} selectedValues={selectedAttackTypes} onToggle={(value) => toggleValue(selectedAttackTypes, setSelectedAttackTypes, value)} />
              <ToggleFilter title="Tactics" options={options.tactics} selectedValues={selectedTactics} onToggle={(value) => toggleValue(selectedTactics, setSelectedTactics, value)} />
              <ToggleFilter title="Forces" options={options.forces} selectedValues={selectedForces} onToggle={(value) => toggleValue(selectedForces, setSelectedForces, value)} />
              <GroupedToggleFilter title="Skills" groups={options.skillGroups} selectedValues={selectedSkillFilters} onToggle={(value) => toggleValue(selectedSkillFilters, setSelectedSkillFilters, value)} />
              <ToggleFilter title="Traits" options={options.traits} selectedValues={selectedTraitNames} onToggle={(value) => toggleValue(selectedTraitNames, setSelectedTraitNames, value)} />
              <ToggleFilter title="Towns" options={options.facilities} selectedValues={selectedFacilities} onToggle={(value) => toggleValue(selectedFacilities, setSelectedFacilities, value)} />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-700 px-4 py-2 text-white">
                <span>{activeFilterCount} active filters</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCharacters.map((character) => {
            const visualTier = getCharacterVisualTier(character)
            const frameSrc = rarityFrameMap[visualTier] ?? rarityFrameMap[5]
            const starsSrc = starAssetMap[visualTier] ?? starAssetMap[5]
            const iconSrc = toPublicAssetPath(character.images.icon)
            const elementIcon = elementIconMap[normalizeLabel(character.element)]
            const attackTypeIcon = attackTypeIconMap[normalizeLabel(character.attack_type)]
            const weaponIcon = weaponIconMap[normalizeLabel(character.weapon_type)]
            const tacticsIcon = tacticsIconMap[normalizeLabel(character.tactics_type || "Normal")]
            const elementLabel = getDisplayElementLabel(character.element)
            const attackTypeLabel = formatWikiLabel(character.attack_type)
            const weaponLabel = formatWikiLabel(character.weapon_type)
            const rarityLabel = getCharacterRarityLabel(character)

            return (
              <Link key={character.master_pc_id} href={`/characters/${character.master_pc_id}`} className="block">
                <Card className="group h-full overflow-hidden rounded-3xl border border-gray-700 bg-gradient-to-b from-[#243042] to-[#1a2433] shadow-[0_0_24px_rgba(255,255,255,0.08)] transition-colors duration-200 hover:from-[#2b3850] hover:to-[#1e2a3b]">
                  <CardContent className="p-0">
                    <div className="grid gap-5 p-5">
                      <div className="flex items-start gap-5">
                        <div className="relative h-[124px] w-[124px] shrink-0">
                          <div className="absolute inset-[8px] overflow-hidden rounded-[20px] bg-black/35">
                            <img src={iconSrc} alt={character.name} className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-105" />
                          </div>
                          <img src={frameSrc} alt="Character frame" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h2 className="truncate text-[1.9rem] font-semibold leading-none text-white">{character.name}</h2>
                              <p className="mt-2 truncate text-sm uppercase tracking-[0.22em] text-gray-400">{character.affiliation_name}</p>
                            </div>
                            <img src={starsSrc} alt={rarityLabel} className="h-8 shrink-0 object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)]" />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 overflow-hidden">
                            {elementIcon ? (
                              <Badge variant="secondary" className="max-w-full gap-2 rounded-full bg-gray-700/90 px-2.5 py-1 text-xs text-white">
                                <img src={elementIcon} title={elementLabel} alt={elementLabel} className="h-5 w-5 shrink-0 object-contain" />
                                <span className="truncate">{elementLabel}</span>
                              </Badge>
                            ) : null}
                            {attackTypeIcon ? (
                              <Badge variant="secondary" className="max-w-full gap-2 rounded-full bg-gray-700/90 px-2.5 py-1 text-xs text-white">
                                <img src={attackTypeIcon} title={attackTypeLabel} alt={attackTypeLabel} className="h-5 w-5 shrink-0 object-contain" />
                                <span className="truncate">{attackTypeLabel}</span>
                              </Badge>
                            ) : null}
                            {weaponIcon ? (
                              <Badge variant="secondary" className="max-w-full gap-2 rounded-full bg-gray-700/90 px-2.5 py-1 text-xs text-white">
                                <img src={weaponIcon} title={weaponLabel} alt={weaponLabel} className="h-5 w-5 shrink-0 object-contain" />
                                <span className="truncate">{weaponLabel}</span>
                              </Badge>
                            ) : null}
                            {tacticsIcon ? (
                              <Badge variant="secondary" className="max-w-full gap-2 rounded-full bg-gray-700/90 px-2.5 py-1 text-xs text-white">
                                <img src={tacticsIcon} title={character.tactics_type || "Normal"} alt={character.tactics_type || "Normal"} className="h-5 w-5 shrink-0 object-contain" />
                                <span className="truncate">{character.tactics_type || "Normal"}</span>
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3 rounded-[22px] bg-[#111827] px-4 py-5 text-center text-white shadow-inner">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">HP</p>
                          <p className="mt-2 text-[1.95rem] font-semibold leading-none text-emerald-200">{character.stats.hp}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">ATK</p>
                          <p className="mt-2 text-[1.95rem] font-semibold leading-none text-rose-200">{character.stats.attack}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">DEF</p>
                          <p className="mt-2 text-[1.95rem] font-semibold leading-none text-sky-200">{character.stats.defense}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">EXI</p>
                          <p className="mt-2 text-[1.95rem] font-semibold leading-none text-amber-100">{character.stats.existence}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {character.forces.slice(0, 4).map((force) => (
                          <Badge key={force.label} variant="outline" className="max-w-full gap-2 border-gray-600 bg-gray-700/80 text-white">
                            <img src={toPublicAssetPath(force.icon_path)} alt={force.name} className="h-4 w-4 shrink-0 object-contain" />
                            <span className="truncate">{force.name}</span>
                          </Badge>
                        ))}
                      </div>

                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </section>
      </div>
    </main>
  )
}