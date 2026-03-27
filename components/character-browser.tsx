"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDownUp, Heart, Search, Shield, SlidersHorizontal, Sparkles, Sword } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { normalizeLabel, stripColorTags, toPublicAssetPath, type WikiCharacter } from "@/lib/pc-wiki"

type SortKey = "name" | "release_date" | "rarity" | "attack" | "hp" | "defense" | "existence"

type FilterOption = {
  label: string
  value: string
}

const elementIconMap: Record<string, string> = {
  air: "/elements/icElementWind.png",
  dark: "/elements/icElementDark.png",
  earth: "/elements/icElementEarth.png",
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
        <Button variant="outline" className="justify-between gap-2 border-stone-300 bg-white/80 text-stone-900">
          <span>{title}</span>
          <Badge variant="secondary" className="bg-stone-200 text-stone-900">
            {selectedValues.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 border-stone-200 p-0" align="start">
        <div className="border-b border-stone-200 px-4 py-3">
          <p className="text-sm font-semibold text-stone-900">{title}</p>
        </div>
        <ScrollArea className="h-72 px-4 py-3">
          <div className="space-y-3">
            {options.map((option) => {
              const checked = selectedValues.includes(option.value)
              return (
                <label key={option.value} className="flex cursor-pointer items-center gap-3 text-sm text-stone-700">
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

export function CharacterBrowser({ characters }: { characters: WikiCharacter[] }) {
  const [searchText, setSearchText] = useState("")
  const [selectedElements, setSelectedElements] = useState<string[]>([])
  const [selectedAttackTypes, setSelectedAttackTypes] = useState<string[]>([])
  const [selectedTactics, setSelectedTactics] = useState<string[]>([])
  const [selectedForces, setSelectedForces] = useState<string[]>([])
  const [selectedSkillNames, setSelectedSkillNames] = useState<string[]>([])
  const [selectedTraitNames, setSelectedTraitNames] = useState<string[]>([])
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>("existence")

  const options = useMemo(
    () => ({
      elements: buildOptions(characters.map((character) => character.element)),
      attackTypes: buildOptions(characters.map((character) => character.attack_type)),
      tactics: buildOptions(characters.map((character) => character.tactics_type)),
      forces: buildOptions(characters.flatMap((character) => character.forces.map((force) => force.name))),
      skills: buildOptions(characters.flatMap((character) => character.skills.map((skill) => skill.name))),
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
      if (selectedSkillNames.length && !selectedSkillNames.every((value) => character.skills.some((skill) => skill.name === value))) {
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
    selectedSkillNames,
    selectedTactics,
    selectedTraitNames,
    sortKey,
  ])

  const activeFilterCount =
    selectedElements.length +
    selectedAttackTypes.length +
    selectedTactics.length +
    selectedForces.length +
    selectedSkillNames.length +
    selectedTraitNames.length +
    selectedFacilities.length

  function resetFilters() {
    setSearchText("")
    setSelectedElements([])
    setSelectedAttackTypes([])
    setSelectedTactics([])
    setSelectedForces([])
    setSelectedSkillNames([])
    setSelectedTraitNames([])
    setSelectedFacilities([])
    setSortKey("existence")
  }

  function toggleValue(values: string[], setter: (next: string[]) => void, value: string) {
    setter(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value])
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f6f0df_0%,_#ede4cf_40%,_#dcccae_100%)] px-6 py-10 text-stone-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[32px] border border-stone-200 bg-white/70 shadow-[0_20px_80px_rgba(73,54,24,0.14)] backdrop-blur">
          <div className="grid gap-8 px-8 py-10 lg:grid-cols-[1.35fr_0.65fr] lg:px-10">
            <div className="space-y-4">
              <Badge className="bg-amber-600 text-white hover:bg-amber-600">Characters</Badge>
              <h1 className="max-w-3xl font-serif text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
                A new character database built directly from the generated wiki data.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-stone-700 sm:text-lg">
                Search by name, lock onto exact force or skill combinations, and sort by the stats that matter without the old hand-made data layer getting in the way.
              </p>
            </div>
            <div className="grid gap-3 rounded-[24px] bg-stone-900 p-5 text-stone-100 shadow-inner">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-stone-400">Catalog</p>
                <p className="mt-2 text-3xl font-semibold">{characters.length}</p>
                <p className="text-sm text-stone-400">playable characters indexed from the generated JSON</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-2xl bg-white/10 px-3 py-4">
                  <Sword className="mx-auto mb-2 h-4 w-4" />
                  <p className="font-medium">ATK</p>
                  <p className="text-stone-400">sort-ready</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-4">
                  <Heart className="mx-auto mb-2 h-4 w-4" />
                  <p className="font-medium">HP</p>
                  <p className="text-stone-400">filterable</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-4">
                  <Shield className="mx-auto mb-2 h-4 w-4" />
                  <p className="font-medium">DEF</p>
                  <p className="text-stone-400">visible</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-5 shadow-[0_16px_60px_rgba(73,54,24,0.12)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search names, affiliations, skills, forces, facilities" className="h-12 rounded-full border-stone-300 bg-white pl-11 text-stone-900" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-stone-700">
                  <ArrowDownUp className="h-4 w-4" />
                  <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                    <SelectTrigger className="w-[170px] border-stone-300 bg-white">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
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
                <Button variant="outline" onClick={resetFilters} className="border-stone-300 bg-white text-stone-900">
                  Reset
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <ToggleFilter title="Element" options={options.elements} selectedValues={selectedElements} onToggle={(value) => toggleValue(selectedElements, setSelectedElements, value)} />
              <ToggleFilter title="Attack Type" options={options.attackTypes} selectedValues={selectedAttackTypes} onToggle={(value) => toggleValue(selectedAttackTypes, setSelectedAttackTypes, value)} />
              <ToggleFilter title="Tactics" options={options.tactics} selectedValues={selectedTactics} onToggle={(value) => toggleValue(selectedTactics, setSelectedTactics, value)} />
              <ToggleFilter title="Forces" options={options.forces} selectedValues={selectedForces} onToggle={(value) => toggleValue(selectedForces, setSelectedForces, value)} />
              <ToggleFilter title="Skills" options={options.skills} selectedValues={selectedSkillNames} onToggle={(value) => toggleValue(selectedSkillNames, setSelectedSkillNames, value)} />
              <ToggleFilter title="Traits" options={options.traits} selectedValues={selectedTraitNames} onToggle={(value) => toggleValue(selectedTraitNames, setSelectedTraitNames, value)} />
              <ToggleFilter title="Facilities" options={options.facilities} selectedValues={selectedFacilities} onToggle={(value) => toggleValue(selectedFacilities, setSelectedFacilities, value)} />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
              <div className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-stone-100">
                <SlidersHorizontal className="h-4 w-4" />
                <span>{activeFilterCount} active filters</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-amber-900">
                <Sparkles className="h-4 w-4" />
                <span>{filteredCharacters.length} characters shown</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCharacters.map((character) => {
            const boundedRarity = Math.min(Math.max(character.rarity, 3), 7)
            const frameSrc = rarityFrameMap[boundedRarity] ?? rarityFrameMap[5]
            const starsSrc = starAssetMap[boundedRarity] ?? starAssetMap[5]
            const iconSrc = toPublicAssetPath(character.images.icon)
            const elementIcon = elementIconMap[normalizeLabel(character.element)]
            const attackTypeIcon = attackTypeIconMap[normalizeLabel(character.attack_type)]
            const weaponIcon = weaponIconMap[normalizeLabel(character.weapon_type)]

            return (
              <Link key={character.master_pc_id} href={`/characters/${character.master_pc_id}`} className="block">
                <Card className="group h-full overflow-hidden rounded-[28px] border-stone-200 bg-white/90 shadow-[0_18px_50px_rgba(73,54,24,0.1)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_22px_70px_rgba(73,54,24,0.18)]">
                  <CardContent className="p-0">
                    <div className="border-b border-stone-200 bg-[linear-gradient(135deg,_#32271c,_#8a6840)] px-5 py-4 text-stone-100">
                      <p className="text-xs uppercase tracking-[0.25em] text-stone-300">{character.affiliation_name}</p>
                      <div className="mt-2 flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-2xl font-semibold">{character.name}</h2>
                          <p className="text-sm text-stone-300">#{character.master_pc_id}</p>
                        </div>
                        <img src={starsSrc} alt={`${character.rarity} star`} className="h-6 object-contain" />
                      </div>
                    </div>

                    <div className="grid gap-5 p-5">
                      <div className="flex items-center gap-5">
                        <div className="relative h-28 w-28 shrink-0">
                          <img src={frameSrc} alt="Character frame" className="absolute inset-0 h-full w-full object-contain" />
                          <img src={iconSrc} alt={character.name} className="absolute inset-[10%] h-[80%] w-[80%] object-contain transition-transform duration-200 group-hover:scale-105" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                          <Badge variant="secondary" className="gap-1 bg-stone-100 text-stone-900">
                            {elementIcon ? <img src={elementIcon} alt={character.element} className="h-4 w-4 object-contain" /> : null}
                            {character.element}
                          </Badge>
                          <Badge variant="secondary" className="gap-1 bg-stone-100 text-stone-900">
                            {attackTypeIcon ? <img src={attackTypeIcon} alt={character.attack_type} className="h-4 w-4 object-contain" /> : null}
                            {character.attack_type}
                          </Badge>
                          <Badge variant="secondary" className="gap-1 bg-stone-100 text-stone-900">
                            {weaponIcon ? <img src={weaponIcon} alt={character.weapon_type} className="h-4 w-4 object-contain" /> : null}
                            {character.weapon_type}
                          </Badge>
                          <Badge className="bg-amber-600 text-white hover:bg-amber-600">{character.tactics_type}</Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3 rounded-[24px] bg-stone-50 p-4 text-center">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">HP</p>
                          <p className="mt-1 text-lg font-semibold text-stone-950">{character.stats.hp}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">ATK</p>
                          <p className="mt-1 text-lg font-semibold text-stone-950">{character.stats.attack}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">DEF</p>
                          <p className="mt-1 text-lg font-semibold text-stone-950">{character.stats.defense}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">EXI</p>
                          <p className="mt-1 text-lg font-semibold text-stone-950">{character.stats.existence}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-stone-500">Forces</p>
                          <div className="flex flex-wrap gap-2">
                            {character.forces.slice(0, 4).map((force) => (
                              <Badge key={force.label} variant="outline" className="max-w-full gap-2 border-stone-200 bg-white text-stone-800">
                                <img src={toPublicAssetPath(force.icon_path)} alt={force.name} className="h-4 w-4 object-contain" />
                                <span className="truncate">{force.name}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-stone-500">Skills</p>
                          <div className="flex flex-wrap gap-2">
                            {character.skills.slice(0, 2).map((skill) => (
                              <Badge key={skill.label} variant="secondary" className="max-w-full bg-stone-100 text-stone-900">
                                {skill.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <p className="line-clamp-2 text-sm leading-6 text-stone-700">
                        {stripColorTags(character.skills[0]?.description_max_level ?? "No skill description available.")}
                      </p>
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