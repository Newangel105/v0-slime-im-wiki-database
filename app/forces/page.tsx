import ForcesClient, { type SlimForceGroup, type SlimForceCharacter } from "@/components/forces-client"
import {
  getAllWikiCharacters,
  toPublicAssetPath,
  getCharacterVisualTier,
  getCharacterForceEntries,
  normalizeLabel,
  isExUnboundCharacter,
} from "@/lib/pc-wiki"

const rarityFrameMap: Record<number, string> = {
  3: "/frame/frameMemberM3.png", 4: "/frame/frameMemberM4.png",
  5: "/frame/frameMemberM5.png", 6: "/frame/frameMemberM6.png",
  7: "/frame/frameMemberM7.png", 8: "/frame/frameMemberM7_Epic.png",
}
const blessFrameMap: Record<number, string> = {
  3: "/frame/frameBlessM3.png", 4: "/frame/frameBlessM4.png",
  5: "/frame/frameBlessM5.png", 6: "/frame/frameBlessM6.png",
  7: "/frame/frameBlessM7.png", 8: "/frame/frameBlessM7_Epic.png",
}
const baseRarityMap: Record<number, string> = {
  3: "/frame/baseMemberM3.png", 4: "/frame/baseMemberM4.png",
  5: "/frame/baseMemberM5.png", 6: "/frame/baseMemberM6.png",
  7: "/frame/baseMemberM7.png", 8: "/frame/baseMemberM7_Epic.png",
}
const baseBlessMap: Record<number, string> = {
  3: "/frame/baseBlessM3.png", 4: "/frame/baseBlessM4.png",
  5: "/frame/baseBlessM5.png", 6: "/frame/baseBlessM6.png",
  7: "/frame/baseBlessM7.png", 8: "/frame/baseBlessM7_Epic.png",
}
const starAssetMap: Record<number, string> = {
  3: "/stars/starCharaL3A.png", 4: "/stars/starCharaL4A.png",
  5: "/stars/starCharaL5A.png", 6: "/stars/starCharaL6A.png",
  7: "/stars/starCharaL7A.png", 8: "/stars/starCharaL7_Epic.png",
}
const attackerElementIconMap: Record<string, string> = {
  air: "/elements/icElementspace.png", dark: "/elements/icElementDark.png",
  earth: "/elements/icElementEarth.png", enhancedair: "/elements/Enhancedspace.png",
  enhanceddark: "/elements/Enhanceddark.png", enhancedearth: "/elements/Enhancedearth.png",
  enhancedfire: "/elements/Enhancedfire.png", enhancedholy: "/elements/Enhancedlight.png",
  enhancedwater: "/elements/Enhancedwater.png", enhancedwind: "/elements/Enhancedwind.png",
  fire: "/elements/icElementFire.png", holy: "/elements/icElementlight.png",
  water: "/elements/icElementWater.png", wind: "/elements/icElementWind.png",
}
const protectorElementIconMap: Record<string, string> = {
  air: "/Image/IcElementBless/IcElementBlessAir.png", all: "/Image/IcElementBless/IcElementBlessAll.png",
  dark: "/Image/IcElementBless/IcElementBlessDark.png", earth: "/Image/IcElementBless/IcElementBlessEarth.png",
  fire: "/Image/IcElementBless/IcElementBlessFire.png", holy: "/Image/IcElementBless/IcElementBlessHoly.png",
  magic: "/Image/IcElementBless/IcElementBlessMagic.png", physics: "/Image/IcElementBless/IcElementBlessPhysics.png",
  water: "/Image/IcElementBless/IcElementBlessWater.png", wind: "/Image/IcElementBless/IcElementBlessWind.png",
}
const defenderBlessIconMap: Record<string, string> = {
  air: "/Image/IcElementBless/IcElementBlessAir.png", dark: "/Image/IcElementBless/IcElementBlessDark.png",
  earth: "/Image/IcElementBless/IcElementBlessEarth.png", fire: "/Image/IcElementBless/IcElementBlessFire.png",
  holy: "/Image/IcElementBless/IcElementBlessHoly.png", water: "/Image/IcElementBless/IcElementBlessWater.png",
  wind: "/Image/IcElementBless/IcElementBlessWind.png",
}
const elementIconMap: Record<string, string> = {
  air: "/elements/space.png", all: "/Image/IcElementBless/IcElementBlessAll.png",
  dark: "/elements/dark.png", earth: "/elements/earth.png",
  enhancedair: "/Image/IcElementBless/IcElementBlessEnhancedAir.png",
  enhanceddark: "/Image/IcElementBless/IcElementBlessEnhancedDark.png",
  enhancedearth: "/Image/IcElementBless/IcElementBlessEnhancedEarth.png",
  enhancedfire: "/Image/IcElementBless/IcElementBlessEnhancedFire.png",
  enhancedholy: "/Image/IcElementBless/IcElementBlessEnhancedHoly.png",
  enhancedwater: "/Image/IcElementBless/IcElementBlessEnhancedWater.png",
  enhancedwind: "/Image/IcElementBless/IcElementBlessEnhancedWind.png",
  fire: "/elements/fire.png", holy: "/elements/light.png",
  light: "/elements/icElementlight.png", magic: "/Image/IcElementBless/IcElementBlessMagic.png",
  physics: "/Image/IcElementBless/IcElementBlessPhysics.png",
  special: "/type_dmg/IcElementBlessSpecial.png", space: "/elements/icElementspace.png",
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
  water: "/elements/water.png", wind: "/elements/wind.png",
}
const attackTypeIconMap: Record<string, string> = {
  magic: "/type_dmg/icAttackTypeMagic.png",
  physical: "/type_dmg/icAttackTypePhysics.png",
}
const protTypeMap: Record<string, string> = {
  physics: "/type_dmg/prot_phys.png",
  magic: "/type_dmg/prot_magic.png",
}

function isProtectorChar(c: ReturnType<typeof getAllWikiCharacters>[number]) {
  return c.character_role === "Supporter" && !c.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}
function isAttackerChar(c: ReturnType<typeof getAllWikiCharacters>[number]) {
  if (c.character_role === "Attacker") return true
  return c.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
}
const baseElementKeys = new Set(["air","dark","earth","fire","holy","water","wind"])
const hiddenElementKeys = new Set(["none","specialeffectelementnone"])

function getDefenderElementValues(c: ReturnType<typeof getAllWikiCharacters>[number]): string[] {
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

export default function ForcesPage() {
  const allCharacters = getAllWikiCharacters()

  const groupsMap = new Map<string, { icon?: string; chars: typeof allCharacters }>()
  for (const character of allCharacters) {
    const entries = getCharacterForceEntries(character)
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
          const forceEntries = getCharacterForceEntries(character)
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

        return { master_pc_id: character.master_pc_id, name: character.name, baseSrc, frameSrc, starsSrc, iconSrc, firstIcon, secondIcon }
      }),
    }))

  return <ForcesClient forceGroups={forceGroups} />
}
