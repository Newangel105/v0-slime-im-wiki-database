"use client"

import Link from "next/link"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  getSkillEffectFilterGroups,
  getSkillEffectTags,
  primeCharacterEffectFilterHeuristics,
  type CharacterEffectFilterGroup,
} from "@/lib/character-effect-filters"
import {
  getCharacterVisualTier,
  normalizeLabel,
  stripColorTags,
  toPublicAssetPath,
  type WikiCharacter,
  type WikiSkill,
} from "@/lib/pc-wiki"
import { groupSkills, type SkillGroup } from "@/lib/skill-grouping"

type SkillViewerVariantKey = "base" | "changed" | "attack" | "support"

type SkillViewerVariant = {
  key: SkillViewerVariantKey
  skill: WikiSkill
  slotLabel: string
  variantNote: string | null
  toggleLabel: string
  tags: string[]
  searchText: string
  tripleMode: "base" | "attack" | "support" | null
}

type SkillViewerEntry = {
  id: string
  character: WikiCharacter
  isProtector: boolean
  baseSkill: WikiSkill
  sortSlot: string
  changedLabel?: string
  isSecretSkillSwap: boolean
  isSecretTriple: boolean
  variants: SkillViewerVariant[]
  searchText: string
}

type SkillViewerGroup = {
  character: WikiCharacter
  entries: FilteredSkillViewerEntry[]
}

type FilteredSkillViewerEntry = SkillViewerEntry & {
  matchingVariantKeys: SkillViewerVariantKey[]
}

const STAR_ASSETS: Record<number, string> = {
  3: "/stars/starCharaL3A.webp",
  4: "/stars/starCharaL4A.webp",
  5: "/stars/starCharaL5A.webp",
  6: "/stars/starCharaL6A.webp",
  7: "/stars/starCharaL7A.webp",
  8: "/stars/starCharaL7_Epic.webp",
}

const SLOT_LABELS: Record<string, string> = {
  active_skill_1: "First Skill",
  active_skill_2: "Second Skill",
  active_skill_3: "Ultimate Manifestation",
  active_skill_4: "Fourth Skill",
  active_skill_5: "Fifth Skill",
  assist_leader_skill: "Support Skill",
  bless_skill: "Protector Skill",
  leader_skill: "Leader Skill",
  special_skill: "Secret Skill",
  special_skill_attack: "Secret Skill Attack",
  special_skill_sub: "Secret Skill Swap",
  special_skill_support: "Secret Skill Support",
}

const SLOT_ORDER: Record<string, number> = {
  leader_skill: 0,
  bless_skill: 1,
  assist_leader_skill: 2,
  special_skill: 10,
  special_skill_attack: 11,
  special_skill_sub: 12,
  special_skill_support: 13,
  active_skill_1: 20,
  active_skill_2: 21,
  active_skill_3: 22,
  active_skill_4: 23,
  active_skill_5: 24,
}

function getMiniFramePaths(tier: number, role: "member" | "bless") {
  const safeTier = Math.min(Math.max(tier, 3), 8)
  const prefix = role === "bless" ? "Bless" : "Member"
  if (safeTier === 8) return { base: `UI/Texture/CommonRarityAtlas/base${prefix}M7_Epic.webp`, frame: `UI/Texture/CommonRarityAtlas/frame${prefix}M7_Epic.webp` }
  if (safeTier === 7) return { base: `UI/Texture/CommonRarityAtlas/base${prefix}M6_SpecialPlus.webp`, frame: `UI/Texture/CommonRarityAtlas/frame${prefix}M6_SpecialPlus.webp` }
  return { base: `UI/Texture/CommonRarityAtlas/base${prefix}M${safeTier}.webp`, frame: `UI/Texture/CommonRarityAtlas/frame${prefix}M${safeTier}.webp` }
}

function isProtectorCharacter(character: WikiCharacter): boolean {
  return character.skills.some((skill) => skill.slot === "bless_skill")
}

function getSlotLabel(skill: WikiSkill): string {
  if (skill.is_skill_change && skill.replaces_slot) {
    const replacedLabel = SLOT_LABELS[skill.replaces_slot] ?? skill.replaces_slot.replace(/_/g, " ")
    return `${replacedLabel} Change`
  }

  return SLOT_LABELS[skill.slot] ?? skill.slot.replace(/_/g, " ")
}

function getVariantNote(skill: WikiSkill): string | null {
  if (!skill.is_skill_change || !skill.replaces_slot) {
    return null
  }

  const replacedLabel = SLOT_LABELS[skill.replaces_slot] ?? skill.replaces_slot.replace(/_/g, " ")
  return `Replaces ${replacedLabel}`
}

function buildSkillSearchText(character: WikiCharacter, skill: WikiSkill, slotLabel: string, variantNote?: string | null): string {
  return normalizeLabel(
    [
      character.name,
      character.affiliation_name,
      slotLabel,
      variantNote ?? "",
      skill.special_skill_type ?? "",
      skill.name ?? "",
      stripColorTags(skill.description_max_level ?? ""),
    ].join(" "),
  )
}

function sortGroups(groups: SkillViewerGroup[]): SkillViewerGroup[] {
  return groups
    .map((group) => ({
      ...group,
      entries: [...group.entries].sort((left, right) => {
        const slotDelta = (SLOT_ORDER[left.sortSlot] ?? 999) - (SLOT_ORDER[right.sortSlot] ?? 999)
        if (slotDelta !== 0) {
          return slotDelta
        }
        return left.baseSkill.name.localeCompare(right.baseSkill.name)
      }),
    }))
    .sort((left, right) => left.character.name.localeCompare(right.character.name))
}

function CharIcon({ character, size = 72 }: { character: WikiCharacter; size?: number }) {
  const tier = getCharacterVisualTier(character)
  const isProtector = isProtectorCharacter(character)
  const { base, frame } = getMiniFramePaths(tier, isProtector ? "bless" : "member")
  const starSrc = STAR_ASSETS[tier] ?? STAR_ASSETS[7]
  const iconSrc = toPublicAssetPath(character.images.icon)

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <img src={base} alt="" className="absolute inset-0 h-full w-full object-contain pointer-events-none" />
      {iconSrc && <img src={iconSrc} alt={character.name} className="absolute inset-0 h-full w-full object-contain" style={{ padding: "8%" }} />}
      <img src={frame} alt="" className="absolute inset-0 h-full w-full object-contain pointer-events-none" />
      {starSrc && <img src={starSrc} alt="" className="absolute bottom-0 left-0 h-[38%] w-[38%] object-contain pointer-events-none" />}
    </div>
  )
}

function SkillIcon({ skill, size = 40 }: { skill: WikiSkill; size?: number }) {
  const src = toPublicAssetPath(skill.icon_path)
  if (!src) {
    return <div className="rounded-full bg-gray-700" style={{ width: size, height: size }} />
  }

  return <img src={src} alt={skill.name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
}

const BATTLE_ATLAS = "/UI/Texture/BattleAtlas"

function SecretSkillIcon({
  skill,
  tripleMode,
  rarity,
  baseSkill,
}: {
  skill: WikiSkill
  tripleMode: "base" | "attack" | "support" | null
  rarity?: number
  baseSkill: WikiSkill
}) {
  const isAoe = baseSkill.description_max_level?.includes("all-target")
  const effectiveType = tripleMode === "attack"
    ? "Attack"
    : tripleMode === "support"
      ? "Support"
      : tripleMode === "base"
        ? null
        : skill.special_skill_type
  const cardFrame = effectiveType === "Attack"
    ? `${BATTLE_ATLAS}/cardBaseSpAttack.webp`
    : effectiveType === "Support"
      ? `${BATTLE_ATLAS}/cardBaseSpSupport.webp`
      : `${BATTLE_ATLAS}/cardBaseSp.webp`
  const targetIcon = isAoe ? `${BATTLE_ATLAS}/icSpTypeAll.webp` : `${BATTLE_ATLAS}/icSpTypeSingle.webp`
  const rarityIcon = rarity === 6 ? `${BATTLE_ATLAS}/icEpicOff.webp` : `${BATTLE_ATLAS}/icUltimateOff.webp`

  return (
    <div className="relative h-12 w-12 shrink-0">
      <img src={cardFrame} alt="" className="absolute inset-0 h-full w-full object-contain" aria-hidden />
      {skill.icon_path && (
        <div className="absolute inset-[8px] overflow-hidden rounded-full">
          <img
            src={toPublicAssetPath(skill.icon_path)}
            alt={skill.name}
            className="h-full w-full scale-[1.35] object-cover object-top"
          />
        </div>
      )}
      <img src={targetIcon} alt={isAoe ? "All targets" : "Single target"} className="absolute bottom-0 left-0 z-[2] h-3.5 w-3.5 object-contain" />
      <img src={rarityIcon} alt="" className="absolute bottom-0 left-1/2 z-[2] h-3.5 w-3.5 -translate-x-1/2 object-contain" aria-hidden />
    </div>
  )
}

function ViewerSkillIcon({
  baseSkill,
  skill,
  tripleMode,
  rarity,
}: {
  baseSkill: WikiSkill
  skill: WikiSkill
  tripleMode: "base" | "attack" | "support" | null
  rarity?: number
}) {
  if (baseSkill.slot.startsWith("special_skill")) {
    return <SecretSkillIcon skill={skill} tripleMode={tripleMode} rarity={rarity} baseSkill={baseSkill} />
  }

  return <SkillIcon skill={skill} size={38} />
}

function getVariantToggleLabel(group: SkillGroup, key: SkillViewerVariantKey, skill: WikiSkill): string {
  if (group.attackVariant && group.supportVariant) {
    if (key === "attack") return "Attack"
    if (key === "support") return "Support"
    return "Base"
  }

  if (key === "base") {
    return group.isSecretSkillSwap ? group.base.special_skill_type ?? "Base" : "Base"
  }

  if (group.isSecretSkillSwap) {
    return skill.special_skill_type ?? group.changedLabel ?? "Sub"
  }

  return group.changedLabel ?? "Skill Change"
}

function getVariantSlotLabel(group: SkillGroup, key: SkillViewerVariantKey, skill: WikiSkill): string {
  if (group.base.slot === "special_skill") {
    return SLOT_LABELS.special_skill
  }

  if (key === "changed" && group.changedLabel === "Ultimate Manifestation") {
    return group.changedLabel
  }

  return getSlotLabel(skill)
}

function getVariantNoteForGroup(group: SkillGroup, key: SkillViewerVariantKey, skill: WikiSkill): string | null {
  if (group.attackVariant && group.supportVariant) {
    if (key === "attack") return "Attack"
    if (key === "support") return "Support"
    return null
  }

  if (group.isSecretSkillSwap) {
    return key === "base"
      ? group.base.special_skill_type ?? null
      : skill.special_skill_type ?? group.changedLabel ?? null
  }

  if (key === "changed") {
    return group.changedLabel ?? getVariantNote(skill)
  }

  return getVariantNote(skill)
}

function getVariantTripleMode(group: SkillGroup, key: SkillViewerVariantKey): "base" | "attack" | "support" | null {
  if (!(group.attackVariant && group.supportVariant)) {
    return null
  }

  if (key === "attack") return "attack"
  if (key === "support") return "support"
  return "base"
}

function buildSkillViewerVariant(
  character: WikiCharacter,
  group: SkillGroup,
  skill: WikiSkill,
  key: SkillViewerVariantKey,
): SkillViewerVariant {
  const slotLabel = getVariantSlotLabel(group, key, skill)
  const variantNote = getVariantNoteForGroup(group, key, skill)

  return {
    key,
    skill,
    slotLabel,
    variantNote,
    toggleLabel: getVariantToggleLabel(group, key, skill),
    tags: [...getSkillEffectTags(skill)],
    searchText: buildSkillSearchText(character, skill, slotLabel, variantNote),
    tripleMode: getVariantTripleMode(group, key),
  }
}

function buildSkillViewerEntry(character: WikiCharacter, isProtector: boolean, group: SkillGroup): SkillViewerEntry {
  const variants: SkillViewerVariant[] = [buildSkillViewerVariant(character, group, group.base, "base")]

  if (group.attackVariant && group.supportVariant) {
    variants.push(buildSkillViewerVariant(character, group, group.attackVariant, "attack"))
    variants.push(buildSkillViewerVariant(character, group, group.supportVariant, "support"))
  } else if (group.changed) {
    variants.push(buildSkillViewerVariant(character, group, group.changed, "changed"))
  }

  return {
    id: `${character.master_pc_id}:${group.base.slot}:${group.base.label}`,
    character,
    isProtector,
    baseSkill: group.base,
    sortSlot: group.base.slot,
    changedLabel: group.changedLabel,
    isSecretSkillSwap: !!group.isSecretSkillSwap,
    isSecretTriple: !!(group.attackVariant && group.supportVariant),
    variants,
    searchText: normalizeLabel(variants.map((variant) => variant.searchText).join(" ")),
  }
}

function RichSkillDesc({ text }: { text: string }) {
  if (!text) {
    return null
  }

  const lines = text.split("\n")
  return (
    <div className="space-y-1 text-xs leading-relaxed text-gray-300 text-left">
      {lines.map((line, lineIndex) => {
        const parts: { colored: boolean; text: string }[] = []
        const colorRe = /<color=[^>]+>(.*?)<\/color>/gi
        let lastIndex = 0
        let match: RegExpExecArray | null

        while ((match = colorRe.exec(line)) !== null) {
          if (match.index > lastIndex) {
            parts.push({ colored: false, text: line.slice(lastIndex, match.index) })
          }
          parts.push({ colored: true, text: match[1] })
          lastIndex = colorRe.lastIndex
        }

        if (lastIndex < line.length) {
          parts.push({ colored: false, text: line.slice(lastIndex) })
        }

        return (
          <p key={lineIndex}>
            {parts.map((part, index) =>
              part.colored ? (
                <span key={index} className="font-semibold text-white">{part.text}</span>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </p>
        )
      })}
    </div>
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
  const [dropdownSearch, setDropdownSearch] = useState("")
  const query = dropdownSearch.toLowerCase().trim()
  const filteredGroups = query
    ? groups
        .map((group) => ({ ...group, options: group.options.filter((option) => option.label.toLowerCase().includes(query)) }))
        .filter((group) => group.options.length > 0)
    : groups

  return (
    <Popover onOpenChange={() => setDropdownSearch("")}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between gap-2 border-gray-600 bg-gray-700 text-white hover:bg-gray-600">
          <span>{title}</span>
          <Badge variant="secondary" className="bg-gray-900 text-white">
            {selectedValues.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-gray-600 bg-gray-700 p-0 text-white" align="start">
        <div className="border-b border-gray-600 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-white">{title}</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search..."
              value={dropdownSearch}
              onChange={(event) => setDropdownSearch(event.target.value)}
              className="h-7 border-gray-600 bg-gray-800 pl-8 text-xs text-white placeholder:text-gray-500"
            />
          </div>
        </div>
        <ScrollArea className="h-96">
          <div className="p-0">
            {filteredGroups.length === 0 && <p className="py-4 text-center text-xs text-gray-500">No results</p>}
            {filteredGroups.map((group) => (
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

function SkillChangeTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    "Attack Changing": "bg-red-900/40 text-red-300 border border-red-700/50",
    "Defense Changing": "bg-blue-900/40 text-blue-300 border border-blue-700/50",
    "Body and Spirit Changing": "bg-green-900/40 text-green-300 border border-green-700/50",
    "Magic Changing": "bg-yellow-900/40 text-yellow-300 border border-yellow-700/50",
  }

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[type] ?? "bg-gray-800 text-gray-300 border border-gray-600"}`}>
      {type}
    </span>
  )
}

function SecretSkillTypeBadge({ type }: { type: string }) {
  const isAttack = type === "Attack"
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        isAttack
          ? "bg-orange-900/40 text-orange-300 border border-orange-700/50"
          : "bg-blue-900/40 text-blue-300 border border-blue-700/50"
      }`}
    >
      {type}
    </span>
  )
}

function SkillVariantToggle({
  entry,
  selectedKey,
  onSelect,
}: {
  entry: SkillViewerEntry
  selectedKey: SkillViewerVariantKey
  onSelect: (key: SkillViewerVariantKey) => void
}) {
  if (entry.variants.length <= 1) {
    return null
  }

  const variantLabel = entry.changedLabel ?? "Skill Change"
  const isUltManifest = variantLabel === "Ultimate Manifestation"
  const toggleContainerClass = "flex w-fit items-center gap-1 rounded-xl bg-gray-700/60 p-1"

  if (entry.isSecretTriple) {
    return (
      <div className={toggleContainerClass}>
        {entry.variants.map((variant) => {
          const isSelected = selectedKey === variant.key
          const className = variant.key === "attack"
            ? isSelected
              ? "bg-orange-500/25 text-orange-300 shadow ring-1 ring-orange-500/40"
              : "text-gray-500 hover:text-orange-400"
            : variant.key === "support"
              ? isSelected
                ? "bg-blue-500/25 text-blue-300 shadow ring-1 ring-blue-500/40"
                : "text-gray-500 hover:text-blue-400"
              : isSelected
                ? "bg-gray-900/60 text-white shadow"
                : "text-gray-500 hover:text-gray-300"

          return (
            <button
              key={variant.key}
              onClick={() => onSelect(variant.key)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${className}`}
            >
              {variant.toggleLabel}
            </button>
          )
        })}
      </div>
    )
  }

  if (entry.isSecretSkillSwap) {
    return (
      <div className={toggleContainerClass}>
        {entry.variants.map((variant) => {
          const isBase = variant.key === "base"
          const isSelected = selectedKey === variant.key
          const className = isBase
            ? isSelected
              ? "bg-orange-500/25 text-orange-300 shadow ring-1 ring-orange-500/40"
              : "text-gray-500 hover:text-orange-400"
            : isSelected
              ? "bg-blue-500/25 text-blue-300 shadow ring-1 ring-blue-500/40"
              : "text-gray-500 hover:text-blue-400"

          return (
            <button
              key={variant.key}
              onClick={() => onSelect(variant.key)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${className}`}
            >
              {variant.toggleLabel}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={toggleContainerClass}>
      {entry.variants.map((variant) => {
        const isBase = variant.key === "base"
        const isSelected = selectedKey === variant.key
        const className = isBase
          ? isSelected
            ? "bg-gray-700 text-white shadow"
            : "text-gray-500 hover:text-gray-300"
          : isSelected
            ? isUltManifest
              ? "bg-purple-500/25 text-purple-300 shadow ring-1 ring-purple-500/40"
              : "bg-amber-500/25 text-amber-300 shadow ring-1 ring-amber-500/40"
            : isUltManifest
              ? "text-gray-500 hover:text-purple-400"
              : "text-gray-500 hover:text-amber-400"

        return (
          <button
            key={variant.key}
            onClick={() => onSelect(variant.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${className}`}
          >
            {!isBase && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isSelected
                    ? isUltManifest
                      ? "bg-purple-400"
                      : "bg-amber-400"
                    : "bg-gray-600"
                }`}
              />
            )}
            {variant.toggleLabel}
          </button>
        )
      })}
    </div>
  )
}

function SkillResultRow({
  entry,
  entryIndex,
  groupSize,
  showCharacterCells,
  borderClass,
}: {
  entry: FilteredSkillViewerEntry
  entryIndex: number
  groupSize: number
  showCharacterCells: boolean
  borderClass: string
}) {
  const [selectedVariantKey, setSelectedVariantKey] = useState<SkillViewerVariantKey>(entry.matchingVariantKeys[0] ?? entry.variants[0].key)
  const matchingVariantSignature = entry.matchingVariantKeys.join("|")

  useEffect(() => {
    setSelectedVariantKey(entry.matchingVariantKeys[0] ?? entry.variants[0].key)
  }, [entry.id, matchingVariantSignature])

  const selectedVariant = entry.variants.find((variant) => variant.key === selectedVariantKey) ?? entry.variants[0]

  return (
    <tr
      className={`${entryIndex % 2 === 0 ? "bg-gray-900" : "bg-gray-900/60"} align-top ${entryIndex === groupSize - 1 ? borderClass : ""}`}
    >
      {showCharacterCells && (
        <>
          <td className="px-3 py-3" rowSpan={groupSize}>
            <Link href={`/characters/${entry.character.master_pc_id}`} className="inline-flex">
              <CharIcon character={entry.character} size={68} />
            </Link>
          </td>
          <td className="px-3 py-3 font-semibold text-white" rowSpan={groupSize}>
            <Link href={`/characters/${entry.character.master_pc_id}`} className="transition-colors hover:text-cyan-300">
              {entry.character.name}
            </Link>
            <div className="mt-1 text-xs font-normal text-gray-500">{entry.character.affiliation_name}</div>
          </td>
        </>
      )}
      <td className="px-3 py-3">
        <ViewerSkillIcon
          baseSkill={entry.baseSkill}
          skill={selectedVariant.skill}
          tripleMode={selectedVariant.tripleMode}
          rarity={entry.character.rarity}
        />
      </td>
      <td className="px-3 py-3 text-xs font-medium text-yellow-300">
        <div>{selectedVariant.slotLabel}</div>
        {selectedVariant.variantNote && <div className="mt-1 text-[11px] text-gray-500">{selectedVariant.variantNote}</div>}
      </td>
      <td className="max-w-xl px-3 py-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-semibold text-white">{selectedVariant.skill.name}</span>
          {selectedVariant.skill.special_skill_type && <SecretSkillTypeBadge type={selectedVariant.skill.special_skill_type} />}
          {selectedVariant.skill.skill_change_type && <SkillChangeTypeBadge type={selectedVariant.skill.skill_change_type} />}
          {selectedVariant.skill.is_skill_change && !selectedVariant.skill.skill_change_type && (
            <span className="inline-flex items-center rounded border border-amber-700/50 bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              Skill Change
            </span>
          )}
        </div>
        {entry.variants.length > 1 && (
          <div className="mb-3">
            <SkillVariantToggle entry={entry} selectedKey={selectedVariantKey} onSelect={setSelectedVariantKey} />
          </div>
        )}
        <RichSkillDesc text={selectedVariant.skill.description_max_level ?? ""} />
      </td>
      <td className="px-3 py-3 text-center font-mono text-xs text-gray-300">
        {selectedVariant.skill.cost != null ? selectedVariant.skill.cost : "—"}
      </td>
    </tr>
  )
}

function SkillResultsTable({
  title,
  accentClass,
  groups,
}: {
  title: string
  accentClass: string
  groups: SkillViewerGroup[]
}) {
  if (groups.length === 0) {
    return null
  }

  return (
    <section>
      <h2 className={`mb-3 text-xs font-bold uppercase tracking-widest ${accentClass}`}>{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-xs uppercase tracking-wider text-gray-400">
              <th className="w-20 px-3 py-3 text-left">Icon</th>
              <th className="min-w-[150px] px-3 py-3 text-left">Character</th>
              <th className="w-12 px-3 py-3 text-left">Skill</th>
              <th className="w-32 px-3 py-3 text-left">Which skill</th>
              <th className="px-3 py-3 text-left">Skill details</th>
              <th className="w-20 px-3 py-3 text-center">Cost</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group, groupIndex) => {
              const borderClass = groupIndex < groups.length - 1 ? "border-b-2 border-gray-700" : ""
              return group.entries.map((entry, entryIndex) => (
                <SkillResultRow
                  key={entry.id}
                  entry={entry}
                  entryIndex={entryIndex}
                  groupSize={group.entries.length}
                  showCharacterCells={entryIndex === 0}
                  borderClass={borderClass}
                />
              ))
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function SkillViewerClient({ characters }: { characters: WikiCharacter[] }) {
  const [searchText, setSearchText] = useState("")
  const [selectedSkillFilters, setSelectedSkillFilters] = useState<string[]>([])
  const deferredSearchText = useDeferredValue(searchText)

  const allEntries = useMemo<SkillViewerEntry[]>(() => {
    primeCharacterEffectFilterHeuristics(characters.flatMap((character) => character.skills))

    return characters.flatMap((character) => {
      const protector = isProtectorCharacter(character)
      return groupSkills(character.skills).map((group) => buildSkillViewerEntry(character, protector, group))
    })
  }, [characters])

  const skillGroups = useMemo(
    () => getSkillEffectFilterGroups(allEntries.flatMap((entry) => entry.variants.map((variant) => variant.skill))),
    [allEntries],
  )

  const filterLabelMap = useMemo(() => {
    const map = new Map<string, { groupTitle: string; label: string }>()
    for (const group of skillGroups) {
      for (const option of group.options) {
        map.set(option.value, { groupTitle: group.title, label: option.label })
      }
    }
    return map
  }, [skillGroups])

  const hasSelectedSkillFilters = selectedSkillFilters.length > 0
  const normalizedQuery = normalizeLabel(deferredSearchText)
  const filteredEntries = useMemo<FilteredSkillViewerEntry[]>(() => {
    if (!hasSelectedSkillFilters) {
      return []
    }

    return allEntries.flatMap((entry) => {
      if (normalizedQuery && !entry.searchText.includes(normalizedQuery)) {
        return []
      }

      const matchingVariantKeys = entry.variants
        .filter((variant) => selectedSkillFilters.every((value) => variant.tags.includes(value)))
        .map((variant) => variant.key)

      if (matchingVariantKeys.length === 0) {
        return []
      }

      return [{
        ...entry,
        matchingVariantKeys,
      }]
    })
  }, [allEntries, hasSelectedSkillFilters, normalizedQuery, selectedSkillFilters])

  const groupedResults = useMemo(() => {
    const regularMap = new Map<number, SkillViewerGroup>()
    const protectorMap = new Map<number, SkillViewerGroup>()

    for (const entry of filteredEntries) {
      const targetMap = entry.isProtector ? protectorMap : regularMap
      const existing = targetMap.get(entry.character.master_pc_id)
      if (existing) {
        existing.entries.push(entry)
        continue
      }

      targetMap.set(entry.character.master_pc_id, {
        character: entry.character,
        entries: [entry],
      })
    }

    return {
      protectors: sortGroups([...protectorMap.values()]),
      regulars: sortGroups([...regularMap.values()]),
    }
  }, [filteredEntries])

  const resultCharacterCount = useMemo(() => new Set(filteredEntries.map((entry) => entry.character.master_pc_id)).size, [filteredEntries])

  const activeFilterLabels = useMemo(
    () => selectedSkillFilters.map((value) => {
      const info = filterLabelMap.get(value)
      return {
        value,
        label: info ? `${info.groupTitle} ${info.label}` : value,
      }
    }),
    [filterLabelMap, selectedSkillFilters],
  )

  function toggleSkillFilter(value: string) {
    setSelectedSkillFilters((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    )
  }

  function clearFilters() {
    setSearchText("")
    setSelectedSkillFilters([])
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-700/60 bg-[#181f2a]/80 backdrop-blur-sm">
        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search characters, skills, or descriptions..."
                className="border-gray-600 bg-gray-800 pl-10 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <GroupedToggleFilter
                title="Skills"
                groups={skillGroups}
                selectedValues={selectedSkillFilters}
                onToggle={toggleSkillFilter}
              />
              <Button
                variant="outline"
                className="border-gray-600 bg-gray-700 text-white hover:bg-gray-600"
                onClick={clearFilters}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <span>{filteredEntries.length} matching skills</span>
            <span className="text-gray-600">•</span>
            <span>{resultCharacterCount} characters</span>
          </div>

          {activeFilterLabels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilterLabels.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => toggleSkillFilter(filter.value)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-gray-700 px-3 py-1 text-xs text-gray-200 transition-colors hover:border-red-500/40 hover:bg-red-900/40 hover:text-white"
                >
                  <span>{filter.label}</span>
                  <span className="ml-0.5 text-gray-400">×</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {filteredEntries.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-700 bg-[#181f2a]/60 px-6 py-14 text-center">
          <p className="text-base font-semibold text-white">
            {hasSelectedSkillFilters ? "No matching skills" : "Select at least one skill filter"}
          </p>
          <p className="mt-2 text-sm text-gray-400">
            {hasSelectedSkillFilters
              ? "Adjust the skill filters or search query to broaden the results."
              : "Choose one or more skill filters to show matching characters and skills."}
          </p>
        </section>
      ) : (
        <div className="space-y-8">
          <SkillResultsTable title="Divine Protection" accentClass="text-blue-400" groups={groupedResults.protectors} />
          <SkillResultsTable title="Battle Skills" accentClass="text-green-400" groups={groupedResults.regulars} />
        </div>
      )}
    </div>
  )
}