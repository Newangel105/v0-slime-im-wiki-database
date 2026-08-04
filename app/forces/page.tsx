import ForcesClient, { type SlimForceGroup, type SlimForceCharacter } from "@/components/forces-client"
import { ClassicForcesClient } from "@/components/classic/forces-client"
import NightInkForcesClient from "@/components/nightink/forces-client"
import { getDesign } from "@/lib/design"
import {
  getAllWikiCharacters,
  toPublicAssetPath,
  getCharacterVisualTier,
  getCharacterForceEntriesOf,
  getForceIconLookupOf,
  normalizeLabel,
  isExUnboundCharacter,
  type WikiCharacter,
} from "@/lib/pc-wiki"

const rarityFrameMap: Record<number, string> = {
  3: "UI/Texture/CommonRarityAtlas/frameMemberM3.webp", 4: "UI/Texture/CommonRarityAtlas/frameMemberM4.webp",
  5: "UI/Texture/CommonRarityAtlas/frameMemberM5.webp", 6: "UI/Texture/CommonRarityAtlas/frameMemberM6_Special.webp",
  7: "UI/Texture/CommonRarityAtlas/frameMemberM6_SpecialPlus.webp", 8: "UI/Texture/CommonRarityAtlas/frameMemberM7_Epic.webp",
}
const blessFrameMap: Record<number, string> = {
  3: "UI/Texture/CommonRarityAtlas/frameBlessM3.webp", 4: "UI/Texture/CommonRarityAtlas/frameBlessM4.webp",
  5: "UI/Texture/CommonRarityAtlas/frameBlessM5.webp", 6: "UI/Texture/CommonRarityAtlas/frameBlessM6_Special.webp",
  7: "UI/Texture/CommonRarityAtlas/frameBlessM6_SpecialPlus.webp", 8: "UI/Texture/CommonRarityAtlas/frameBlessM7_Epic.webp",
}
const baseRarityMap: Record<number, string> = {
  3: "UI/Texture/CommonRarityAtlas/baseMemberM3.webp", 4: "UI/Texture/CommonRarityAtlas/baseMemberM4.webp",
  5: "UI/Texture/CommonRarityAtlas/baseMemberM5.webp", 6: "UI/Texture/CommonRarityAtlas/baseMemberM6_Special.webp",
  7: "UI/Texture/CommonRarityAtlas/baseMemberM6_SpecialPlus.webp", 8: "UI/Texture/CommonRarityAtlas/baseMemberM7_Epic.webp",
}
const baseBlessMap: Record<number, string> = {
  3: "UI/Texture/CommonRarityAtlas/baseBlessM3.webp", 4: "UI/Texture/CommonRarityAtlas/baseBlessM4.webp",
  5: "UI/Texture/CommonRarityAtlas/baseBlessM5.webp", 6: "UI/Texture/CommonRarityAtlas/baseBlessM6_Special.webp",
  7: "UI/Texture/CommonRarityAtlas/baseBlessM6_SpecialPlus.webp", 8: "UI/Texture/CommonRarityAtlas/baseBlessM7_Epic.webp",
}
const starAssetMap: Record<number, string> = {
  3: "/UI/Texture/CommonRarityAtlas/starCharaL3.webp", 4: "/UI/Texture/CommonRarityAtlas/starCharaL4.webp",
  5: "/UI/Texture/CommonRarityAtlas/starCharaL5.webp", 6: "/UI/Texture/CommonRarityAtlas/starCharaL6.webp",
  7: "/UI/Texture/CommonRarityAtlas/starCharaL6_SpecialPlus.webp", 8: "/UI/Texture/CommonRarityAtlas/starCharaL7_Epic.webp",
}
const attackerElementIconMap: Record<string, string> = {
  air: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementAir.webp", dark: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementDark.webp",
  earth: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEarth.webp", enhancedair: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedAir.webp",
  enhanceddark: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedDark.webp", enhancedearth: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedEarth.webp",
  enhancedfire: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedFire.webp", enhancedholy: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedHoly.webp",
  enhancedwater: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedWater.webp", enhancedwind: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedWind.webp",
  fire: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementFire.webp", holy: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementHoly.webp",
  water: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementWater.webp", wind: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementWind.webp",
}
const protectorElementIconMap: Record<string, string> = {
  air: "/Image/IcElementBless/IcElementBlessAir.webp", all: "/Image/IcElementBless/IcElementBlessAll.webp",
  dark: "/Image/IcElementBless/IcElementBlessDark.webp", earth: "/Image/IcElementBless/IcElementBlessEarth.webp",
  fire: "/Image/IcElementBless/IcElementBlessFire.webp", holy: "/Image/IcElementBless/IcElementBlessHoly.webp",
  magic: "/Image/IcElementBless/IcElementBlessMagic.webp", physics: "/Image/IcElementBless/IcElementBlessPhysics.webp",
  water: "/Image/IcElementBless/IcElementBlessWater.webp", wind: "/Image/IcElementBless/IcElementBlessWind.webp",
}
const defenderBlessIconMap: Record<string, string> = {
  air: "/Image/IcElementBless/IcElementBlessAir.webp", dark: "/Image/IcElementBless/IcElementBlessDark.webp",
  earth: "/Image/IcElementBless/IcElementBlessEarth.webp", fire: "/Image/IcElementBless/IcElementBlessFire.webp",
  holy: "/Image/IcElementBless/IcElementBlessHoly.webp", water: "/Image/IcElementBless/IcElementBlessWater.webp",
  wind: "/Image/IcElementBless/IcElementBlessWind.webp",
}
const elementIconMap: Record<string, string> = {
  air: "/UI/Texture/CommonLotteryInfoPanelAtlas/space.webp", all: "/Image/IcElementBless/IcElementBlessAll.webp",
  dark: "/UI/Texture/CommonLotteryInfoPanelAtlas/dark.webp", earth: "/UI/Texture/CommonLotteryInfoPanelAtlas/earth.webp",
  enhancedair: "/Image/IcElementBless/IcElementBlessEnhancedAir.webp",
  enhanceddark: "/Image/IcElementBless/IcElementBlessEnhancedDark.webp",
  enhancedearth: "/Image/IcElementBless/IcElementBlessEnhancedEarth.webp",
  enhancedfire: "/Image/IcElementBless/IcElementBlessEnhancedFire.webp",
  enhancedholy: "/Image/IcElementBless/IcElementBlessEnhancedHoly.webp",
  enhancedwater: "/Image/IcElementBless/IcElementBlessEnhancedWater.webp",
  enhancedwind: "/Image/IcElementBless/IcElementBlessEnhancedWind.webp",
  fire: "/UI/Texture/CommonLotteryInfoPanelAtlas/fire.webp", holy: "/UI/Texture/CommonLotteryInfoPanelAtlas/light.webp",
  light: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementHoly.webp", magic: "/Image/IcElementBless/IcElementBlessMagic.webp",
  physics: "/Image/IcElementBless/IcElementBlessPhysics.webp",
  special: "/Image/IcElementBless/IcElementBlessSpecial.webp", space: "/UI/Texture/CommonLotteryInfoPanelAtlas/icElementAir.webp",
  specialeffectelementair: "/Image/IcElementBless/IcElementBlessSpecialEffectElementAir.webp",
  specialeffectelementdark: "/Image/IcElementBless/IcElementBlessSpecialEffectElementDark.webp",
  specialeffectelementearth: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEarth.webp",
  specialeffectelementenhancedair: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedAir.webp",
  specialeffectelementenhanceddark: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedDark.webp",
  specialeffectelementenhancedearth: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedEarth.webp",
  specialeffectelementenhancedfire: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedFire.webp",
  specialeffectelementenhancedholy: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedHoly.webp",
  specialeffectelementenhancedwater: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWater.webp",
  specialeffectelementenhancedwind: "/Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWind.webp",
  specialeffectelementfire: "/Image/IcElementBless/IcElementBlessSpecialEffectElementFire.webp",
  specialeffectelementholy: "/Image/IcElementBless/IcElementBlessSpecialEffectElementHoly.webp",
  specialeffectelementnone: "/Image/IcElementBless/IcElementBlessSpecialEffectElementNone.webp",
  specialeffectelementwater: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWater.webp",
  specialeffectelementwind: "/Image/IcElementBless/IcElementBlessSpecialEffectElementWind.webp",
  water: "/UI/Texture/CommonLotteryInfoPanelAtlas/water.webp", wind: "/UI/Texture/CommonLotteryInfoPanelAtlas/wind.webp",
}
const attackTypeIconMap: Record<string, string> = {
  magic: "/UI/Texture/CommonLotteryInfoPanelAtlas/icAttackTypeMagic.webp",
  physical: "/UI/Texture/CommonLotteryInfoPanelAtlas/icAttackTypePhysical.webp",
}
const protTypeMap: Record<string, string> = {
  physics: "/type_dmg/prot_phys.webp",
  magic: "/type_dmg/prot_magic.webp",
}

function isProtectorChar(c: WikiCharacter) {
  return c.character_role === "Supporter" && !c.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}
function isAttackerChar(c: WikiCharacter) {
  if (c.character_role === "Attacker") return true
  return c.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}
const baseElementKeys = new Set(["air","dark","earth","fire","holy","water","wind"])
const hiddenElementKeys = new Set(["none","specialeffectelementnone"])

function getDefenderElementValues(c: WikiCharacter): string[] {
  if (!isProtectorChar(c)) return [normalizeLabel(c.element)]
  const normalized = normalizeLabel(c.element)
  const values: string[] = []
  if (normalized.startsWith("specialeffectelement")) values.push(normalized)
  else if (baseElementKeys.has(normalized)) values.push(normalized)
  const secondRaw = (c as any).master_leader_skill_element_type_2 ?? null
  if (secondRaw) {
    const k = normalizeLabel(secondRaw)
    if (k && k !== "none" && !values.includes(k)) values.push(k)
  }
  if (values.length === 0 && normalized && normalized !== "none") values.push(normalized)
  return values
}

function getProtectorElementDisplayIcon(value: string | null | undefined): string | undefined {
  const normalized = normalizeLabel(value)
  if (normalized === "" || normalized === "none") return undefined
  return defenderBlessIconMap[normalized] ?? elementIconMap[normalized]
}

function isElementLike(val: string): boolean {
  const n = normalizeLabel(val)
  return baseElementKeys.has(n) || n.startsWith("specialeffectelement") || n === "all"
}

const specialEffectToBase: Record<string, string> = {
  all: "Earth", special: "Air",
  specialeffectelementearth: "Earth", specialeffectelementair: "Air",
  specialeffectelementwind: "Wind", specialeffectelementwater: "Water",
  specialeffectelementfire: "Fire", specialeffectelementholy: "Holy",
  specialeffectelementdark: "Dark",
  specialeffectelementenhancedearth: "EnhancedEarth", specialeffectelementenhancedair: "EnhancedAir",
  specialeffectelementenhancedwind: "EnhancedWind", specialeffectelementenhancedwater: "EnhancedWater",
  specialeffectelementenhancedfire: "EnhancedFire", specialeffectelementenhancedholy: "EnhancedHoly",
  specialeffectelementenhanceddark: "EnhancedDark",
}

export default async function ForcesPage() {
  const design = await getDesign()
  const allCharacters = await getAllWikiCharacters()
  const forceIconLookup = getForceIconLookupOf(allCharacters)

  const groupsMap = new Map<string, { icon?: string; chars: typeof allCharacters }>()
  for (const character of allCharacters) {
    const entries = getCharacterForceEntriesOf(character, forceIconLookup)
    for (const entry of entries) {
      if (!groupsMap.has(entry.name)) {
        groupsMap.set(entry.name, { icon: entry.icon, chars: [] })
      }
      groupsMap.get(entry.name)!.chars.push(character)
    }
  }

  const forceGroups: SlimForceGroup[] = Array.from(groupsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, { icon, chars }]) => ({
      name,
      forceIcon: icon,
      characters: chars.map((character): SlimForceCharacter => {
        const visualTier = getCharacterVisualTier(character)
        const isProtector = isProtectorChar(character)
        const isAttacker = isAttackerChar(character)
        const frameMap = isProtector ? blessFrameMap : rarityFrameMap
        const baseMap = isProtector ? baseBlessMap : baseRarityMap
        const frameSrc = frameMap[visualTier] ?? frameMap[5]
        const baseSrc = baseMap[visualTier] ?? baseMap[5]
        const starsSrc = starAssetMap[visualTier] ?? starAssetMap[5]
        const iconSrc = toPublicAssetPath(character.images.icon)

        let firstIcon: string | undefined
        let secondIcon: string | undefined

        if (isAttacker) {
          const normalized = normalizeLabel(character.element)
          const baseFromSpecial = specialEffectToBase[normalized]
          let elemVal = character.element
          if (baseFromSpecial) {
            const baseNorm = normalizeLabel(baseFromSpecial)
            elemVal = baseElementKeys.has(baseNorm) && isExUnboundCharacter(character)
              ? `Enhanced${baseNorm.charAt(0).toUpperCase()}${baseNorm.slice(1)}`
              : baseFromSpecial
          } else if (baseElementKeys.has(normalized) && isExUnboundCharacter(character)) {
            elemVal = `Enhanced${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
          }
          const elemNorm = normalizeLabel(elemVal)
          firstIcon = hiddenElementKeys.has(elemNorm) ? undefined : attackerElementIconMap[elemNorm]
          if (!firstIcon) {
            const k = normalizeLabel(character.element)
            firstIcon = isProtector ? protectorElementIconMap[k] : attackerElementIconMap[k]
          }
          secondIcon = attackTypeIconMap[normalizeLabel(character.attack_type)]
        } else if (isProtector) {
          const forceEntries = getCharacterForceEntriesOf(character, forceIconLookup)
          const defenderValues = getDefenderElementValues(character)
          if (forceEntries.length > 0) {
            if (forceEntries[0].icon) firstIcon = forceEntries[0].icon
            else if (character.forces.length > 0) firstIcon = toPublicAssetPath(character.forces[0].icon_path)
            const primary = defenderValues.length > 0 ? defenderValues[0] : null
            if (primary && isElementLike(primary)) {
              secondIcon = getProtectorElementDisplayIcon(primary)
            } else {
              const elems = defenderValues.filter(isElementLike)
              if (elems.length > 0) {
                secondIcon = getProtectorElementDisplayIcon(elems[elems.length - 1])
              } else {
                const quals = defenderValues.filter((v) => { const n = normalizeLabel(v); return n === "physics" || n === "magic" || n === "all" })
                if (quals.length > 0) {
                  const q = normalizeLabel(quals[quals.length - 1])
                  secondIcon = q === "physics" || q === "magic" ? protTypeMap[q] : elementIconMap[q]
                }
              }
            }
          } else {
            const elems = defenderValues.filter(isElementLike)
            if (elems.length >= 2) {
              firstIcon = getProtectorElementDisplayIcon(elems[0])
              secondIcon = getProtectorElementDisplayIcon(elems[1])
            } else if (elems.length === 1) {
              firstIcon = getProtectorElementDisplayIcon(elems[0])
              const quals = defenderValues.filter((v) => { const n = normalizeLabel(v); return n === "physics" || n === "magic" || n === "all" })
              if (quals.length > 0) {
                const q = normalizeLabel(quals[0])
                secondIcon = q === "physics" || q === "magic" ? protTypeMap[q] : elementIconMap[q]
              }
            } else {
              const quals = defenderValues.filter((v) => { const n = normalizeLabel(v); return n === "physics" || n === "magic" || n === "all" })
              if (quals.length > 0) {
                const q = normalizeLabel(quals[0])
                firstIcon = q === "physics" || q === "magic" ? protTypeMap[q] : elementIconMap[q]
              }
            }
          }
        } else {
          const k = normalizeLabel(character.element)
          firstIcon = isProtector ? protectorElementIconMap[k] : attackerElementIconMap[k]
        }

        return { master_pc_id: character.master_pc_id, name: character.name, visualTier, baseSrc, frameSrc, starsSrc, iconSrc, firstIcon, secondIcon }
      }),
    }))

  if (design === "nightink") return <NightInkForcesClient forceGroups={forceGroups} />

  return design === "classic" ? (
    <ClassicForcesClient forceGroups={forceGroups} />
  ) : (
    <ForcesClient forceGroups={forceGroups} />
  )
}
