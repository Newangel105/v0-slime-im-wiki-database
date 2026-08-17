"use client"

// Night-ink characters index, client side — a faithful React port of the
// approved prototype reports/christmas-vision/my_vision/ecosystem-live-v3.html
// + ecosystem-live.js (filter / sort / render logic + icon-resolution maps).
// Visual styling lives in app/night-ink.css (SECTION = ecosystem-live.css +
// finish-v3.css, ported verbatim with asset url()s rewritten).
//
// Deviations from the prototype (all deliberate):
// - The brand/nav mastrow (.v2-mastrow/.v2-navsq) is NOT rendered here: the app
//   has a global night-ink masthead (components/nightink/site-nav.tsx, mounted
//   once by app/layout.tsx). The rest of the header pod is kept.
// - Cards/feature link via next/link to /characters/{id} (not the prototype's
//   ./character-live.html?id=).
// - window.SLIME_CHARACTERS is replaced by the `characters` prop, mapped on the
//   server from the SAME source as the existing /characters route
//   (components/nightink/characters-browser-data.ts -> getCharacterIndexData).
// - The mutable `state` object + manual querySelector DOM writes are replaced by
//   React state; the prototype's pure helpers (icon maps, element ordering,
//   matching, sorting, gicon/card builders) are ported essentially verbatim.
// - URL prefill (?q / ?tag / filter keys) mirrors the prototype's
//   applyInitialFiltersFromUrl AND keeps the existing route's ?tag= + filter
//   writeback so shared/Back-button filter links keep working.

import Link from "next/link"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { IndexCharacter } from "./characters-browser-data"
// element display names (air→Space, holy→Light, enhanced→"X+") live in ONE place
import { getDisplayElementLabel } from "@/lib/pc-wiki"

const PUBLIC_ROOT = "/"
const SKILL_COST_MIN = 0
const SKILL_COST_MAX = 85

/* ============================================================
   ICON MAPS — ported from ecosystem-live.js. Paths that were
   already app-relative (Image/…, UI/…, L10NAssets/…) resolve under
   /public via publicAsset(); the prototype's four assets/… maps
   (weapons, attack types, roles, two ultimate icons) are rewritten
   here to the real public locations the existing app component uses.
   ============================================================ */

const elementIconMap: Record<string, string> = {
  air: "UI/Texture/CommonLotteryInfoPanelAtlas/space.webp",
  all: "Image/IcElementBless/IcElementBlessAll.webp",
  dark: "UI/Texture/CommonLotteryInfoPanelAtlas/dark.webp",
  earth: "UI/Texture/CommonLotteryInfoPanelAtlas/earth.webp",
  enhancedair: "Image/IcElementBless/IcElementBlessEnhancedAir.webp",
  enhanceddark: "Image/IcElementBless/IcElementBlessEnhancedDark.webp",
  enhancedearth: "Image/IcElementBless/IcElementBlessEnhancedEarth.webp",
  enhancedfire: "Image/IcElementBless/IcElementBlessEnhancedFire.webp",
  enhancedholy: "Image/IcElementBless/IcElementBlessEnhancedHoly.webp",
  enhancedwater: "Image/IcElementBless/IcElementBlessEnhancedWater.webp",
  enhancedwind: "Image/IcElementBless/IcElementBlessEnhancedWind.webp",
  fire: "UI/Texture/CommonLotteryInfoPanelAtlas/fire.webp",
  holy: "UI/Texture/CommonLotteryInfoPanelAtlas/light.webp",
  light: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementHoly.webp",
  magic: "Image/IcElementBless/IcElementBlessMagic.webp",
  physics: "Image/IcElementBless/IcElementBlessPhysics.webp",
  special: "Image/IcElementBless/IcElementBlessSpecial.webp",
  specialeffectelementair: "Image/IcElementBless/IcElementBlessSpecialEffectElementAir.webp",
  specialeffectelementdark: "Image/IcElementBless/IcElementBlessSpecialEffectElementDark.webp",
  specialeffectelementearth: "Image/IcElementBless/IcElementBlessSpecialEffectElementEarth.webp",
  specialeffectelementenhancedair: "Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedAir.webp",
  specialeffectelementenhanceddark: "Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedDark.webp",
  specialeffectelementenhancedearth: "Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedEarth.webp",
  specialeffectelementenhancedfire: "Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedFire.webp",
  specialeffectelementenhancedholy: "Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedHoly.webp",
  specialeffectelementenhancedwater: "Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWater.webp",
  specialeffectelementenhancedwind: "Image/IcElementBless/IcElementBlessSpecialEffectElementEnhancedWind.webp",
  specialeffectelementfire: "Image/IcElementBless/IcElementBlessSpecialEffectElementFire.webp",
  specialeffectelementholy: "Image/IcElementBless/IcElementBlessSpecialEffectElementHoly.webp",
  specialeffectelementnone: "Image/IcElementBless/IcElementBlessSpecialEffectElementNone.webp",
  specialeffectelementwater: "Image/IcElementBless/IcElementBlessSpecialEffectElementWater.webp",
  specialeffectelementwind: "Image/IcElementBless/IcElementBlessSpecialEffectElementWind.webp",
  water: "UI/Texture/CommonLotteryInfoPanelAtlas/water.webp",
  wind: "UI/Texture/CommonLotteryInfoPanelAtlas/wind.webp",
}

const attackerElementIconMap: Record<string, string> = {
  air: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementAir.webp",
  dark: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementDark.webp",
  earth: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementEarth.webp",
  enhancedair: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedAir.webp",
  enhanceddark: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedDark.webp",
  enhancedearth: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedEarth.webp",
  enhancedfire: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedFire.webp",
  enhancedholy: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedHoly.webp",
  enhancedwater: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedWater.webp",
  enhancedwind: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementEnhancedWind.webp",
  fire: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementFire.webp",
  holy: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementHoly.webp",
  water: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementWater.webp",
  wind: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementWind.webp",
}

const defenderBlessIconMap: Record<string, string> = {
  air: "Image/IcElementBless/IcElementBlessAir.webp",
  dark: "Image/IcElementBless/IcElementBlessDark.webp",
  earth: "Image/IcElementBless/IcElementBlessEarth.webp",
  fire: "Image/IcElementBless/IcElementBlessFire.webp",
  holy: "Image/IcElementBless/IcElementBlessHoly.webp",
  water: "Image/IcElementBless/IcElementBlessWater.webp",
  wind: "Image/IcElementBless/IcElementBlessWind.webp",
}

// Prototype used assets/weapons/* — rewritten to the app's /public/weapons/*.
const weaponIcons: Record<string, string> = {
  book: "weapons/book.webp",
  fist: "weapons/fists.webp",
  fists: "weapons/fists.webp",
  greatsword: "weapons/greatsword.webp",
  hammer: "weapons/hammer.webp",
  katana: "weapons/katana.webp",
  knuckle: "weapons/fists.webp",
  largesword: "weapons/greatsword.webp",
  spear: "weapons/spear.webp",
  sword: "weapons/sword.webp",
}

// Prototype used assets/icons/icAttackType* — rewritten to the real atlas.
const attackTypeIcons: Record<string, string> = {
  magic: "UI/Texture/CommonLotteryInfoPanelAtlas/icAttackTypeMagic.webp",
  physical: "UI/Texture/CommonLotteryInfoPanelAtlas/icAttackTypePhysical.webp",
}

// Prototype used assets/icons/icCharaType* — rewritten to the real atlas.
const roleIcons: Record<string, string> = {
  attacker: "UI/Texture/CommonLotteryInfoPanelAtlas/icCharaTypePc.webp",
  supporter: "UI/Texture/CommonLotteryInfoPanelAtlas/icCharaTypeBless.webp",
  protector: "UI/Texture/CommonLotteryInfoPanelAtlas/icCharaTypeBless.webp",
}

// Prototype used assets/icons/icSpType* for attack/support — rewritten to the
// real CharaInfoAtlas (aoe/single already pointed there in the prototype).
const ultimateIcons: Record<string, string> = {
  attack: "UI/Texture/CharaInfoAtlas/icSpTypeSingle.webp",
  support: "UI/Texture/CharaInfoAtlas/icSpTypeAll.webp",
  aoe: "UI/Texture/CharaInfoAtlas/icSpTypeAll.webp",
  single: "UI/Texture/CharaInfoAtlas/icSpTypeSingle.webp",
}

const tacticsIcons: Record<string, string> = {
  charge: "L10NAssets/En/Image/Tactics/tactics_004.webp",
  defense: "L10NAssets/En/Image/Tactics/tactics_003.webp",
  normal: "L10NAssets/En/Image/Tactics/tactics_001.webp",
  speed: "L10NAssets/En/Image/Tactics/tactics_002.webp",
}

function fieldBuildingIcon(id: string, ver: string) {
  return `Image/FieldBuilding/${id}/${ver}/FieldBuilding_${id}_${ver}_icon.webp`
}

const facilityIconMap: Record<string, string> = {
  Armory: fieldBuildingIcon("1209", "02"),
  "Armor Magicubeite Digsite": fieldBuildingIcon("1333", "01"),
  Brewery: fieldBuildingIcon("1318", "02"),
  "Café": fieldBuildingIcon("1308", "02"),
  "Churros Stall": fieldBuildingIcon("1338", "01"),
  "Clothing Store": fieldBuildingIcon("1305", "02"),
  "Crystal Hotel": fieldBuildingIcon("1453", "01"),
  "Crystal Restaurant": fieldBuildingIcon("1347", "01"),
  "Dango Shop": fieldBuildingIcon("1551", "01"),
  "Dark Arts Shrine": fieldBuildingIcon("1633", "02"),
  "Dark Magic Device": fieldBuildingIcon("1613", "01"),
  "Decoration Magicubeite Digsite": fieldBuildingIcon("1334", "01"),
  "Digsite for Attack Magigems": fieldBuildingIcon("1324", "01"),
  "Digsite for Attack Magistones": fieldBuildingIcon("1310", "02"),
  "Digsite for Defense Magigems": fieldBuildingIcon("1321", "01"),
  "Digsite for Defense Magistones": fieldBuildingIcon("1315", "02"),
  "Digsite for Stamina Magigems": fieldBuildingIcon("1322", "01"),
  "Digsite for Stamina Magistones": fieldBuildingIcon("1309", "02"),
  "Digsite for Training Magigems": fieldBuildingIcon("1323", "01"),
  "Digsite for Training Magistones": fieldBuildingIcon("1312", "02"),
  Dojo: fieldBuildingIcon("1360", "01"),
  "Earth Arts Shrine": fieldBuildingIcon("1629", "02"),
  "Earth Magic Device": fieldBuildingIcon("1609", "01"),
  "Elemental Colossus Bay": fieldBuildingIcon("1344", "01"),
  Encampment: fieldBuildingIcon("1326", "01"),
  Farm: fieldBuildingIcon("1301", "03"),
  "Feast Hot Pot": fieldBuildingIcon("1422", "02"),
  Field: fieldBuildingIcon("1313", "03"),
  "Fire Arts Shrine": fieldBuildingIcon("1627", "02"),
  "Fire Magic Device": fieldBuildingIcon("1607", "01"),
  "Forest Supply Corps Base": fieldBuildingIcon("1304", "03"),
  "Fruit Stall": fieldBuildingIcon("1330", "01"),
  "Gift Shop": fieldBuildingIcon("1335", "01"),
  "Geological Survey Station": fieldBuildingIcon("1341", "01"),
  "Hamburger Stall": fieldBuildingIcon("1337", "01"),
  "Honey Café": fieldBuildingIcon("1225", "01"),
  "Hot Dog Stall": fieldBuildingIcon("1336", "01"),
  "Ice Cream Cart": fieldBuildingIcon("1327", "01"),
  Inn: fieldBuildingIcon("1316", "02"),
  "Japanese Style Tavern": fieldBuildingIcon("1214", "01"),
  "Juice Stand": fieldBuildingIcon("1357", "01"),
  Laboratory: fieldBuildingIcon("1606", "02"),
  "Light Arts Shrine": fieldBuildingIcon("1632", "02"),
  "Light Magic Device": fieldBuildingIcon("1612", "01"),
  "Magic Fang Atelier": fieldBuildingIcon("1348", "01"),
  "Magic Feather Atelier": fieldBuildingIcon("1350", "01"),
  "Magic Hide Atelier": fieldBuildingIcon("1349", "01"),
  "Mini Coaster": fieldBuildingIcon("1218", "01"),
  "Monster Museum": fieldBuildingIcon("1345", "01"),
  "Mountain Supply Corps Base": fieldBuildingIcon("1302", "03"),
  "Obstacle Course": fieldBuildingIcon("1359", "01"),
  "Ocean Supply Corps Base": fieldBuildingIcon("1303", "03"),
  Orchard: fieldBuildingIcon("1355", "01"),
  "Paper Mill": fieldBuildingIcon("1354", "01"),
  "Photo Studio": fieldBuildingIcon("1362", "02"),
  "Protection Magistone Digsite": fieldBuildingIcon("1311", "02"),
  "Purple Magicluster Digsite": fieldBuildingIcon("1352", "02"),
  "Ramen Shop": fieldBuildingIcon("1328", "01"),
  "Red Magicluster Digsite": fieldBuildingIcon("1353", "02"),
  Restaurant: fieldBuildingIcon("1306", "03"),
  "Savory Pancake Stall": fieldBuildingIcon("1329", "01"),
  Sawmill: fieldBuildingIcon("1317", "02"),
  "Shaved Ice Shop": fieldBuildingIcon("1351", "01"),
  "Shishkabob Stall": fieldBuildingIcon("1331", "01"),
  "Snack Bar Jura": fieldBuildingIcon("1523", "01"),
  "Souvenir Shop": fieldBuildingIcon("1570", "01"),
  "Space Arts Shrine": fieldBuildingIcon("1631", "02"),
  "Space Magic Device": fieldBuildingIcon("1611", "01"),
  "Sweets Shop": fieldBuildingIcon("1339", "01"),
  "Symbol of Protection": fieldBuildingIcon("1614", "01"),
  "Tableware Store": fieldBuildingIcon("1356", "01"),
  Tavern: fieldBuildingIcon("1307", "02"),
  "Tempest Wheel": fieldBuildingIcon("1216", "01"),
  "Trading Post": fieldBuildingIcon("1206", "02"),
  "Traditional Brewery": fieldBuildingIcon("1325", "01"),
  "Traditional Inn": fieldBuildingIcon("1213", "01"),
  "Traditional Snack Shop": fieldBuildingIcon("1568", "01"),
  "Training Ground": fieldBuildingIcon("1314", "03"),
  "Water Arts Shrine": fieldBuildingIcon("1628", "02"),
  "Water Magic Device": fieldBuildingIcon("1608", "01"),
  "Water Purification Station": fieldBuildingIcon("1346", "01"),
  "Weapon Magicubeite Digsite": fieldBuildingIcon("1332", "01"),
  "Weaving Workshop": fieldBuildingIcon("1320", "02"),
  "Wind Arts Shrine": fieldBuildingIcon("1630", "02"),
  "Wind Magic Device": fieldBuildingIcon("1610", "01"),
  "Flour Mill": fieldBuildingIcon("1365", "01"),
}

const rarityIcons: Record<number, string> = {
  3: "/UI/Texture/CommonRarityAtlas/starCharaL3",
  4: "/UI/Texture/CommonRarityAtlas/starCharaL4",
  5: "/UI/Texture/CommonRarityAtlas/starCharaL5",
  6: "/UI/Texture/CommonRarityAtlas/starCharaL6",
  7: "/UI/Texture/CommonRarityAtlas/starCharaL6_SpecialPlus",
  8: "/UI/Texture/CommonRarityAtlas/starCharaL7_Epic",
}

const memberFrameIcons: Record<number, string> = {
  3: "/UI/Texture/CommonRarityAtlas/frameMemberM3",
  4: "/UI/Texture/CommonRarityAtlas/frameMemberM4",
  5: "/UI/Texture/CommonRarityAtlas/frameMemberM5",
  6: "/UI/Texture/CommonRarityAtlas/frameMemberM6_Special",
  7: "/UI/Texture/CommonRarityAtlas/frameMemberM6_SpecialPlus",
  8: "/UI/Texture/CommonRarityAtlas/frameMemberM7_Epic",
}

const blessFrameIcons: Record<number, string> = {
  3: "/UI/Texture/CommonRarityAtlas/frameBlessM3",
  4: "/UI/Texture/CommonRarityAtlas/frameBlessM4",
  5: "/UI/Texture/CommonRarityAtlas/frameBlessM5",
  6: "/UI/Texture/CommonRarityAtlas/frameBlessM6_Special",
  7: "/UI/Texture/CommonRarityAtlas/frameBlessM6_SpecialPlus",
  8: "/UI/Texture/CommonRarityAtlas/frameBlessM7_Epic",
}

const memberBaseIcons: Record<number, string> = {
  3: "/UI/Texture/CommonRarityAtlas/baseMemberM3",
  4: "/UI/Texture/CommonRarityAtlas/baseMemberM4",
  5: "/UI/Texture/CommonRarityAtlas/baseMemberM5",
  6: "/UI/Texture/CommonRarityAtlas/baseMemberM6_Special",
  7: "/UI/Texture/CommonRarityAtlas/baseMemberM6_SpecialPlus",
  8: "/UI/Texture/CommonRarityAtlas/baseMemberM7_Epic",
}

const blessBaseIcons: Record<number, string> = {
  3: "/UI/Texture/CommonRarityAtlas/baseBlessM3",
  4: "/UI/Texture/CommonRarityAtlas/baseBlessM4",
  5: "/UI/Texture/CommonRarityAtlas/baseBlessM5",
  6: "/UI/Texture/CommonRarityAtlas/baseBlessM6_Special",
  7: "/UI/Texture/CommonRarityAtlas/baseBlessM6_SpecialPlus",
  8: "/UI/Texture/CommonRarityAtlas/baseBlessM7_Epic",
}

/* ============================================================
   PURE HELPERS — ported verbatim from ecosystem-live.js
   ============================================================ */

function stripHtml(value: unknown): string {
  return String(value ?? "").replace(/<[^>]*>/g, " ")
}

function normalizeLabel(value: unknown): string {
  return stripHtml(value)
    .toLowerCase()
    .replace(/&nbsp;/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim()
}

// Some characters go by different names depending on localization/version
// (e.g. Jaune ⇄ Carrera). Searching for one should also surface the other.
const NAME_ALIAS_GROUPS: string[][] = [
  ["jaune", "carrera"],
  ["ultima", "violet"],
  ["testarossa", "blanc"],
]

// Force shorthands for the search box: typing the shorthand filters to that force
// (e.g. "WoF" -> World of Fantasy). Only forces with an established meta get one
// (that's why several forces have none — e.g. Wholehearted Devotion, Valentine).
// Numbered variants (WoF1/WoF2, OP1/OP2, Adv1/Adv2 …) are community aliases for the
// same single force. Keys are the normalizeLabel() form (lowercase, alnum-only) of
// the shorthand; values are the exact force name (compared via normalizeLabel).
const FORCE_SHORTHANDS: Record<string, string> = {
  // Tribe
  op: "Ogre's Pride", op1: "Ogre's Pride", op2: "Ogre's Pride",
  pd: "Primal Demon", pd1: "Primal Demon", pd2: "Primal Demon",
  dh: "Dragon Haki",
  // Skill / Personality
  hoah: "Heart of a Hero",
  wom: "Wielder of Magic",
  c: "Commander",
  sos: "Stern of Spirit",
  s: "Schemer",
  spm: "Spirit Master",
  // Organisation
  te: "Tempest Elite",
  odl: "Octagram Demon Lord",
  ant: "Antagonist",
  adv: "Adventurer", adv1: "Adventurer", adv2: "Adventurer",
  // Event / Theme
  fm: "Festive Memories", fm1: "Festive Memories", fm2: "Festive Memories",
  nyb: "New Year's Blessing",
  god: "Goddess of Destiny",
  sm: "Summer Memories", sm1: "Summer Memories", sm2: "Summer Memories",
  ol: "Otherworld Legend",
  fow: "Fount of Wisdom",
  wof: "World of Fantasy", wof1: "World of Fantasy", wof2: "World of Fantasy",
  wm: "Warrior's Mind", wm1: "Warrior's Mind", wm2: "Warrior's Mind",
  voc: "Visions of Coleus",
  fbe: "Flashback Beatdown Emissary",
  ps: "Pretty Sparkle",
  ec: "Exalted Champions",
  dtp: "Determination to Prosper",
  pop: "Protector of Peace",
  dg: "Divine General",
  ts: "Tournament Stalwart",
  soy: "Sparkle of Youth",
  dc: "Dungeon Crawler", dc1: "Dungeon Crawler", dc2: "Dungeon Crawler",
  sw: "Scourge Wielder",
  at: "Assault Team",
  tears: "Tears of the Azure Sea", tears1: "Tears of the Azure Sea", tears2: "Tears of the Azure Sea",
}

function expandSearchQuery(query: string): string[] {
  const variants = new Set<string>([query])
  for (const group of NAME_ALIAS_GROUPS) {
    if (group.some((alias) => query.includes(alias) || alias.includes(query))) {
      for (const alias of group) variants.add(alias)
    }
  }
  return [...variants]
}

function formatWikiLabel(value: unknown): string {
  return String(value || "")
    .replace(/^specialeffectelement/i, "")
    .replace(/enhanced/i, "Enhanced ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

// Resolve a map path to a /public URL. Mirrors the prototype's publicAsset:
// already-extensioned paths keep their extension; bare paths get .webp.
function publicAsset(path: string): string {
  if (!path) return ""
  const clean = String(path).replace(/^\//, "")
  if (/^https?:/i.test(clean)) return clean
  if (/\.(webp|png|jpg|jpeg|gif|svg)$/i.test(clean)) return `${PUBLIC_ROOT}${clean}`
  return `${PUBLIC_ROOT}${clean}.webp`
}

function displayElement(value: unknown): string {
  const normalized = normalizeLabel(value)
  if (!normalized || normalized === "none" || normalized === "specialeffectelementnone") return "None"
  // strip the specialeffect prefix (this page shows the bare element name), then
  // resolve via the shared map so air→Space / holy→Light / enhanced→"X+" apply
  return getDisplayElementLabel(normalized.replace(/^specialeffectelement/, ""))
}

function isBlessCharacter(character: IndexCharacter): boolean {
  return character.role === "Supporter" || String(character.thumb || "").includes("/Bless/")
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

const baseElementKeys = new Set(["air", "dark", "earth", "fire", "holy", "water", "wind"])
const hiddenElementKeys = new Set(["none", "specialeffectelementnone"])
const attackerElementOrder = [
  "air",
  "dark",
  "earth",
  "fire",
  "holy",
  "water",
  "wind",
  "enhancedair",
  "enhanceddark",
  "enhancedearth",
  "enhancedfire",
  "enhancedholy",
  "enhancedwater",
  "enhancedwind",
]
const defenderElementOrder = [
  "all",
  "special",
  "physics",
  "magic",
  "fire",
  "water",
  "earth",
  "air",
  "wind",
  "dark",
  "holy",
  "specialeffectelementair",
  "specialeffectelementdark",
  "specialeffectelementearth",
  "specialeffectelementfire",
  "specialeffectelementholy",
  "specialeffectelementwater",
  "specialeffectelementwind",
  "specialeffectelementenhancedair",
  "specialeffectelementenhanceddark",
  "specialeffectelementenhancedearth",
  "specialeffectelementenhancedfire",
  "specialeffectelementenhancedholy",
  "specialeffectelementenhancedwater",
  "specialeffectelementenhancedwind",
]
const attackerElementOrderIndex = new Map(attackerElementOrder.map((value, index) => [value, index]))
const defenderElementOrderIndex = new Map(defenderElementOrder.map((value, index) => [value, index]))

function compareByOrder(left: string, right: string, orderIndex: Map<string, number>): number {
  const leftIndex = orderIndex.get(normalizeLabel(left))
  const rightIndex = orderIndex.get(normalizeLabel(right))
  if (leftIndex !== undefined || rightIndex !== undefined) {
    if (leftIndex === undefined) return 1
    if (rightIndex === undefined) return -1
    return leftIndex - rightIndex
  }
  return displayElement(left).localeCompare(displayElement(right))
}

function toEnhancedElementValue(value: string): string {
  const clean = String(value || "")
  return `Enhanced${clean.charAt(0).toUpperCase()}${clean.slice(1)}`
}

function getDefenderElementValues(character: IndexCharacter): string[] {
  if (!isBlessCharacter(character)) return [normalizeLabel(character.element)]
  const normalized = normalizeLabel(character.element)
  const values: string[] = []
  if (normalized.startsWith("specialeffectelement")) {
    values.push(normalized)
  } else if (
    baseElementKeys.has(normalized) ||
    normalized === "physics" ||
    normalized === "magic" ||
    normalized === "all" ||
    normalized === "special"
  ) {
    values.push(normalized)
  }
  const secondRaw = character.master_leader_skill_element_type_2
  const secondKey = normalizeLabel(secondRaw)
  if (secondKey && secondKey !== "none" && !values.includes(secondKey)) values.push(secondKey)
  if (!values.length && normalized && normalized !== "none") values.push(normalized)
  return values
}

function isExUnboundCharacter(character: IndexCharacter): boolean {
  return /Enhanced/i.test(character.element || "")
}

function isExAttacker(character: IndexCharacter): boolean {
  return /^(SpecialEffect)/i.test(character.element || "")
}

function getCharacterElementValue(character: IndexCharacter): string {
  if (isBlessCharacter(character)) return getDefenderElementValues(character)[0] || normalizeLabel(character.element)
  const normalized = normalizeLabel(character.element)
  const baseFromSpecial = specialEffectToBase[normalized]
  if (baseFromSpecial) {
    const baseNormalized = normalizeLabel(baseFromSpecial)
    if (baseElementKeys.has(baseNormalized) && isExUnboundCharacter(character)) return toEnhancedElementValue(baseNormalized)
    return baseFromSpecial
  }
  if (baseElementKeys.has(normalized) && isExUnboundCharacter(character)) return toEnhancedElementValue(normalized)
  return character.element
}

function getDefenderFilterIcon(value: string): string {
  const normalized = normalizeLabel(value)
  if (hiddenElementKeys.has(normalized)) return ""
  return defenderBlessIconMap[normalized] || elementIconMap[normalized] || ""
}

function elementIconFor(characterOrElement: IndexCharacter): string {
  if (isBlessCharacter(characterOrElement)) {
    return getDefenderFilterIcon(getDefenderElementValues(characterOrElement)[0])
  }
  return attackerElementIconMap[normalizeLabel(getCharacterElementValue(characterOrElement))] ?? ""
}

function hasExSpecialSkill(character: IndexCharacter): boolean {
  return (character.skills || []).some(
    (skill) => skill.slot === "special_skill" && /EX Soul of Combos/i.test(skill.desc || ""),
  )
}

function visualTierFor(character: IndexCharacter): number {
  if (character.rarity === 6) return 8
  if (character.rarity !== 5) return Math.min(Math.max(Number(character.rarity) || 5, 3), 7)
  if (isExUnboundCharacter(character)) return 7
  if (hasExSpecialSkill(character)) return 6
  if (isExAttacker(character)) return 6
  return 5
}

function frameFor(character: IndexCharacter): string {
  const map = isBlessCharacter(character) ? blessFrameIcons : memberFrameIcons
  return map[visualTierFor(character)] || map[5]
}

function baseFor(character: IndexCharacter): string {
  const map = isBlessCharacter(character) ? blessBaseIcons : memberBaseIcons
  return map[visualTierFor(character)] || map[5]
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b))
}

function normalizeEffectFilterLabel(label: unknown): string {
  let normalized = stripHtml(label).replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  if (/^EX Soul of Combos Damage(?:\s+UP|\s+DOWN)?$/i.test(normalized)) return "EX Soul of Combos"
  if (/^Soul of Combos Damage(?:\s+UP|\s+DOWN)?$/i.test(normalized)) return "Soul of Combos"
  if (!/^Seal\b/i.test(normalized)) normalized = normalized.replace(/\s+(UP|DOWN)$/i, "")
  if (/^Skill Points?$/i.test(normalized)) return "Skill Points"
  return normalized.trim()
}

function normalizeEffectFilterValues(values: string[] | undefined): string[] {
  return [...new Set((values || []).map(normalizeEffectFilterLabel).filter(Boolean))]
}

type FreqEntry = { value: string; count: number }

function frequencySorted(values: (string | null | undefined)[], limit = Infinity): FreqEntry[] {
  const counts = new Map<string, number>()
  values.filter(Boolean).forEach((value) => {
    const key = String(value)
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }))
}

type ElementFreq = { value: string; count: number; raw: string; bless: boolean }

function elementFrequency(list: IndexCharacter[]): ElementFreq[] {
  const seen = new Map<string, ElementFreq>()
  list.forEach((character) => {
    const key = normalizeLabel(getCharacterElementValue(character))
    if (!seen.has(key)) {
      seen.set(key, { value: key, count: 0, raw: getCharacterElementValue(character), bless: isBlessCharacter(character) })
    }
    seen.get(key)!.count += 1
  })
  return [...seen.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

function attackerElementFrequency(list: IndexCharacter[]): ElementFreq[] {
  return elementFrequency(list).sort((a, b) => compareByOrder(a.value, b.value, attackerElementOrderIndex))
}

function protectorElementFrequency(list: IndexCharacter[]): ElementFreq[] {
  const seen = new Map<string, ElementFreq>()
  list.forEach((character) => {
    getDefenderElementValues(character).forEach((value) => {
      if (!value || hiddenElementKeys.has(value)) return
      if (!seen.has(value)) seen.set(value, { value, count: 0, raw: value, bless: true })
      seen.get(value)!.count += 1
    })
  })
  ;["all", "special"].forEach((value) => {
    if (!seen.has(value)) seen.set(value, { value, count: 0, raw: value, bless: true })
  })
  return [...seen.values()].sort((a, b) => compareByOrder(a.value, b.value, defenderElementOrderIndex))
}

function countValues(values: (string | null | undefined)[]): Map<string, number> {
  const counts = new Map<string, number>()
  values.filter(Boolean).forEach((value) => {
    const clean = String(value)
    counts.set(clean, (counts.get(clean) || 0) + 1)
  })
  return counts
}

function weaponIconFor(value: string): string {
  return weaponIcons[normalizeLabel(value)] || ""
}

function attackTypeIconFor(value: string): string {
  return attackTypeIcons[normalizeLabel(value)] || ""
}

function roleIconFor(value: string): string {
  const role = normalizeLabel(value) === "supporter" ? "supporter" : normalizeLabel(value)
  return roleIcons[role] || ""
}

function ultimateIconFor(value: string): string {
  return ultimateIcons[normalizeLabel(value)] || ""
}

function facilityIconFor(value: string): string {
  // drawer facility option values can carry a " +12%" effect suffix that the
  // icon map keys don't — strip it (cards already did) so the icon resolves
  const clean = value.replace(/\s*\+\d+%$/, "").trim()
  const direct = facilityIconMap[clean]
  if (direct) return direct
  const key = normalizeLabel(clean)
  const match = Object.entries(facilityIconMap).find(([name]) => normalizeLabel(name) === key)
  return match?.[1] || ""
}

function facilityIconsFor(character: IndexCharacter, limit = 3): { name: string; icon: string }[] {
  return [...new Set((character.facilities || []).map((entry) => entry.replace(/ \+\d+%$/, "").trim()).filter(Boolean))]
    .map((name) => ({ name, icon: facilityIconFor(name) }))
    .filter((entry) => entry.icon)
    .slice(0, limit)
}

function skillCostInRange(cost: number | null | undefined, min: number, max: number): boolean {
  if (typeof cost !== "number" || Number.isNaN(cost)) return false
  if (max >= SKILL_COST_MAX) return cost >= min
  return cost >= min && cost <= max
}

/* ============================================================
   FILTER STATE
   ============================================================ */

type FilterMode = "AND" | "OR"
type SortKey = "release" | "name" | "rarity" | "attack" | "hp" | "defense" | "existence"

// Array-valued filter groups (the keys the prototype toggles by name).
const LIST_GROUPS = [
  "role",
  "attackerElement",
  "protectorElement",
  "weapon",
  "type",
  "ultimate",
  "rarity",
  "tactics",
  "forces",
  "skills",
  "traits",
  "valorTraits",
  "facilities",
] as const
type ListGroup = (typeof LIST_GROUPS)[number]

type FilterState = {
  query: string
  searchSkills: boolean
  filterMode: FilterMode
  sortKey: SortKey
  sortAsc: boolean
  skillCostMin: number
  skillCostMax: number
} & Record<ListGroup, string[]>

function emptyListGroups(): Record<ListGroup, string[]> {
  return {
    role: [],
    attackerElement: [],
    protectorElement: [],
    weapon: [],
    type: [],
    ultimate: [],
    rarity: [],
    tactics: [],
    forces: [],
    skills: [],
    traits: [],
    valorTraits: [],
    facilities: [],
  }
}

function defaultState(): FilterState {
  return {
    query: "",
    searchSkills: false,
    filterMode: "AND",
    sortKey: "release",
    sortAsc: false,
    skillCostMin: SKILL_COST_MIN,
    skillCostMax: SKILL_COST_MAX,
    ...emptyListGroups(),
  }
}

// Prototype's applyInitialFiltersFromUrl — read ?q/?tag + filter keys on mount.
function readStateFromUrl(base: FilterState): FilterState {
  if (typeof window === "undefined") return base
  const next: FilterState = { ...base, ...emptyListGroups() }
  // start from real empties so URL fully determines the discrete filters
  for (const group of LIST_GROUPS) next[group] = [...base[group]]

  const params = new URLSearchParams(window.location.search)
  const queryKeyMap: Record<string, ListGroup> = {
    role: "role",
    attackerElement: "attackerElement",
    attacker: "attackerElement",
    protectorElement: "protectorElement",
    defender: "protectorElement",
    weapon: "weapon",
    type: "type",
    ultimate: "ultimate",
    ulti: "ultimate",
    rarity: "rarity",
    tactics: "tactics",
    forces: "forces",
    force: "forces",
    skill: "skills",
    traits: "traits",
    trait: "traits",
    valorTraits: "valorTraits",
    valor: "valorTraits",
    facilities: "facilities",
    facility: "facilities",
  }

  if (params.has("q")) next.query = params.get("q") || ""
  if (params.has("tag")) next.query = params.get("tag") || ""
  if (params.has("searchSkills")) next.searchSkills = params.get("searchSkills") === "1"
  if (params.has("skills")) next.searchSkills = params.get("skills") === "1"

  const mode = params.get("mode")?.toUpperCase()
  if (mode === "AND" || mode === "OR") next.filterMode = mode

  const cminRaw = params.get("cmin")
  const cmaxRaw = params.get("cmax")
  const cmin = cminRaw == null ? Number.NaN : Number(cminRaw)
  const cmax = cmaxRaw == null ? Number.NaN : Number(cmaxRaw)
  if (Number.isFinite(cmin)) next.skillCostMin = Math.max(SKILL_COST_MIN, Math.min(SKILL_COST_MAX, cmin))
  if (Number.isFinite(cmax)) next.skillCostMax = Math.max(SKILL_COST_MIN, Math.min(SKILL_COST_MAX, cmax))

  const sort = params.get("sort")
  if (sort && ["release", "name", "rarity", "attack", "hp", "defense", "existence"].includes(sort)) {
    next.sortKey = sort as SortKey
  }
  if (params.get("asc") === "1") next.sortAsc = true

  Object.entries(queryKeyMap).forEach(([queryKey, group]) => {
    if (!params.has(queryKey)) return
    const values = params
      .getAll(queryKey)
      .flatMap((value) => String(value || "").split(/[|,]/))
      .map((value) => value.trim())
      .filter(Boolean)
    const cleanValues =
      group === "skills" || group === "traits" ? values.map(normalizeEffectFilterLabel).filter(Boolean) : values
    if (cleanValues.length) next[group] = [...new Set(cleanValues)]
  })

  return next
}

/* ============================================================
   COMPONENT
   ============================================================ */

// img() equivalent: a hide-on-error <img> matching the prototype's onerror.
function Img({ path, alt = "", className, title }: { path: string; alt?: string; className?: string; title?: string }) {
  const src = publicAsset(path)
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt}
      title={title}
      className={className}
      loading="lazy"
      decoding="async"
      onError={(event) => {
        event.currentTarget.hidden = true
      }}
    />
  )
}

function GameIcon({ character, size = 84, isNew }: { character: IndexCharacter; size?: number; isNew: boolean }) {
  const elementIcons = isBlessCharacter(character)
    ? getDefenderElementValues(character).map(getDefenderFilterIcon).filter(Boolean)
    : [elementIconFor(character)].filter(Boolean)
  const firstIcon = elementIcons[0]
  const secondIcon = isBlessCharacter(character) ? elementIcons[1] : attackTypeIconFor(character.type)
  const star = rarityIcons[visualTierFor(character)] || rarityIcons[5]
  const tier = visualTierFor(character)
  const baseImg = <Img path={baseFor(character)} className="gicon-layer" />

  return (
    <span className="gicon" style={{ width: size, height: size }}>
      {tier >= 8 ? <span className="gicon-base-epic">{baseImg}</span> : baseImg}
      <span className="gicon-crop">
        <Img path={character.thumb} alt={character.name} className="gicon-portrait" />
      </span>
      <Img path={frameFor(character)} className="gicon-layer gicon-frame" />
      {firstIcon ? <Img path={firstIcon} className="gicon-el" /> : null}
      {secondIcon ? <Img path={secondIcon} className="gicon-type" /> : null}
      <Img path={star} className="gicon-star" />
      {isNew ? <span className="gicon-new">NEW</span> : null}
    </span>
  )
}

// memoised so re-rendering the grid on a filter/sort change only re-renders
// cards whose data actually changed — the rest keep their decoded images,
// which is what made re-filtering feel slow
const CharacterCard = memo(function CharacterCard({ character, hot }: { character: IndexCharacter; hot: boolean }) {
  const facilityIcons = facilityIconsFor(character, 2)
  const weaponIcon = weaponIconFor(character.weapon)
  return (
    <Link className={`v2-card${hot ? " is-hot" : ""}`} href={`/characters/${character.id}`} prefetch={false}>
      <GameIcon character={character} size={84} isNew={hot} />
      <span className="info">
        <span className="nm">{character.name}</span>
        <span className="tt">{character.title || "No title"}</span>
        <span className="meta">
          {weaponIcon ? (
            <Img path={weaponIcon} alt={character.weapon || "Weapon"} className="weapon-icon" title={character.weapon || "Weapon"} />
          ) : null}
          {facilityIcons.map(({ name, icon }) => (
            <Img key={name} path={icon} alt={name} title={name} />
          ))}
        </span>
      </span>
      <span className="go">→</span>
    </Link>
  )
})

type DropOption = { value: string; label: string; icon: string; count: number }

function compactPages(current: number, total: number): (number | "gap-left" | "gap-right")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const pages: (number | "gap-left" | "gap-right")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push("gap-left")
  for (let page = start; page <= end; page += 1) pages.push(page)
  if (end < total - 1) pages.push("gap-right")
  pages.push(total)
  return pages
}

// localStorage: remember whether the filter rail is collapsed (the "hide filters"
// toggle), so it stays hidden/shown across reloads and page closes
const FILTERS_COLLAPSED_KEY = "nk-chars-filters-collapsed"

// matchMedia(≤640px) gate. /characters is the ONLY responsive .board.v2 page
// (every other route is force-desktop), so this is the same breakpoint the
// phone CSS in app/night-ink.css keys off. Desktop never trips it, so all the
// mobile-only chrome (filter drawer + sticky bar) stays out of the desktop tree.
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mql = window.matchMedia("(max-width: 640px)")
    const apply = () => setIsMobile(mql.matches)
    apply()
    mql.addEventListener("change", apply)
    return () => mql.removeEventListener("change", apply)
  }, [])
  return isMobile
}

export function NightInkCharactersBrowser({ characters }: { characters: IndexCharacter[] }) {
  const [state, setState] = useState<FilterState>(defaultState)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [openDrawer, setOpenDrawer] = useState<string | null>(null)
  const isMobile = useIsMobile()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [drawerSearch, setDrawerSearch] = useState<Record<string, string>>({})
  const [hydrated, setHydrated] = useState(false)
  const clusterRef = useRef<HTMLElement>(null)
  const towerRef = useRef<HTMLDivElement>(null)
  const elementsRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // newest record id (release desc, then id desc) — prototype §0
  const newestCharacterId = useMemo(() => {
    return (
      characters
        .filter((character) => character.release)
        .sort(
          (left, right) =>
            String(right.release || "").localeCompare(String(left.release || "")) || Number(right.id || 0) - Number(left.id || 0),
        )[0]?.id ?? null
    )
  }, [characters])

  // §read URL on mount (q/tag + filter keys) — prototype applyInitialFiltersFromUrl
  useEffect(() => {
    setState((base) => readStateFromUrl(base))
    // restore the visitor's hide-filters preference
    try {
      setFiltersCollapsed(localStorage.getItem(FILTERS_COLLAPSED_KEY) === "1")
    } catch {
      /* ignore unavailable storage */
    }
    setHydrated(true)
  }, [])

  // Keep filter state in the URL so shared links + Back restore the view
  // (mirrors the existing /characters route's ?tag= + filter-key writeback).
  useEffect(() => {
    if (!hydrated) return
    const params = new URLSearchParams()
    if (state.query) params.set("tag", state.query)
    if (state.role.length) params.set("role", state.role.join(","))
    if (state.attackerElement.length) params.set("attacker", state.attackerElement.join(","))
    if (state.protectorElement.length) params.set("defender", state.protectorElement.join(","))
    if (state.type.length) params.set("type", state.type.join(","))
    if (state.weapon.length) params.set("weapon", state.weapon.join(","))
    if (state.ultimate.length) params.set("ulti", state.ultimate.join(","))
    if (state.rarity.length) params.set("rarity", state.rarity.join(","))
    if (state.tactics.length) params.set("tactics", state.tactics.join(","))
    if (state.forces.length) params.set("force", state.forces.join(","))
    if (state.facilities.length) params.set("facility", state.facilities.join(","))
    if (state.skills.length) params.set("skill", state.skills.join(","))
    if (state.traits.length) params.set("trait", state.traits.join(","))
    if (state.valorTraits.length) params.set("valor", state.valorTraits.join(","))
    if (state.sortKey !== "release") params.set("sort", state.sortKey)
    if (state.sortAsc) params.set("asc", "1")
    if (state.skillCostMin > SKILL_COST_MIN) params.set("cmin", String(state.skillCostMin))
    if (state.skillCostMax < SKILL_COST_MAX) params.set("cmax", String(state.skillCostMax))
    if (state.filterMode !== "AND") params.set("mode", state.filterMode.toLowerCase())
    if (state.searchSkills) params.set("skills", "1")
    const qs = params.toString()
    // Sync the shareable URL WITHOUT a Next.js navigation. router.replace() does a
    // soft re-render of the route on every keystroke / filter change, which blurs the
    // focused search box — that's the "caret resets every time I change an option"
    // bug. history.replaceState updates the address bar with zero re-render.
    window.history.replaceState(null, "", qs ? `/characters?${qs}` : "/characters")
  }, [hydrated, state])

  /* ---- filter option lists (setupFilters) ---- */
  const options = useMemo(() => {
    const iconLookups = (() => {
      const forces = new Map<string, string>()
      const traits = new Map<string, string>()
      const valorTraits = new Map<string, string>()
      characters.forEach((character) => {
        ;(character.forces || []).forEach((force) => {
          if (force.name && !forces.has(force.name)) forces.set(force.name, force.icon)
        })
        ;(character.traits || []).forEach((trait) => {
          if (trait.name && trait.icon && !valorTraits.has(trait.name)) valorTraits.set(trait.name, trait.icon)
          ;(character.traitFilters || []).forEach((filter) => {
            const normalizedFilter = normalizeEffectFilterLabel(filter)
            if (normalizedFilter && trait.icon && !traits.has(normalizedFilter)) traits.set(normalizedFilter, trait.icon)
          })
        })
      })
      return { forces, traits, valorTraits }
    })()

    const roles = frequencySorted(characters.map((c) => c.role).filter((role) => role && role !== "None"))
    const attackerElements = attackerElementFrequency(characters.filter((c) => !isBlessCharacter(c)))
    const protectorElements = protectorElementFrequency(characters.filter(isBlessCharacter))
    const weapons = frequencySorted(characters.map((c) => c.weapon).filter(Boolean))
    const types = frequencySorted(characters.map((c) => c.type).filter(Boolean))
    const ultimates = frequencySorted(characters.map((c) => c.ultimate).filter((value) => value && value !== "None"))
    const rarityCounts = countValues(characters.map((c) => String(visualTierFor(c))))
    const rarities = [3, 4, 5, 6, 7, 8].map((value) => ({ value: String(value), count: rarityCounts.get(String(value)) || 0 }))
    const tactics = frequencySorted(characters.map((c) => c.tactics).filter(Boolean))
    const forces = frequencySorted(characters.flatMap((c) => (c.forces || []).map((force) => force.name)), 90)
    const skills = frequencySorted(characters.flatMap((c) => normalizeEffectFilterValues(c.skillFilters || [])), 110)
    const traits = frequencySorted(characters.flatMap((c) => normalizeEffectFilterValues(c.traitFilters || [])), 90)
    const valorTraits = frequencySorted(characters.flatMap((c) => (c.traits || []).map((trait) => trait.name)), 110)
    const facilities = frequencySorted(characters.flatMap((c) => c.facilities || []), 90)

    const tacticsOptions: DropOption[] = tactics.map(({ value, count }) => ({
      value,
      label: value,
      icon: tacticsIcons[normalizeLabel(value)] || "",
      count,
    }))
    const forceOptions: DropOption[] = forces.map(({ value, count }) => ({
      value,
      label: value,
      icon: iconLookups.forces.get(value) || "",
      count,
    }))
    const skillOptions: DropOption[] = skills.map(({ value, count }) => ({ value, label: value, icon: "", count }))
    const traitOptions: DropOption[] = traits.map(({ value, count }) => ({
      value,
      label: value,
      icon: iconLookups.traits.get(value) || "",
      count,
    }))
    const valorTraitOptions: DropOption[] = valorTraits.map(({ value, count }) => ({
      value,
      label: value,
      icon: iconLookups.valorTraits.get(value) || "",
      count,
    }))
    const facilityOptions: DropOption[] = facilities.map(({ value, count }) => ({
      value,
      label: value,
      icon: facilityIconFor(value),
      count,
    }))

    return {
      roles,
      attackerElements,
      protectorElements,
      weapons,
      types,
      ultimates,
      rarities,
      iconLookups,
      tactics: tacticsOptions,
      forces: forceOptions,
      skills: skillOptions,
      traits: traitOptions,
      valorTraits: valorTraitOptions,
      facilities: facilityOptions,
    }
  }, [characters])

  // archive metrics (renderMetrics)
  const metrics = useMemo(() => {
    const forces = uniqueSorted(characters.flatMap((c) => (c.forces || []).map((force) => force.name)))
    const skills = uniqueSorted(characters.flatMap((c) => normalizeEffectFilterValues(c.skillFilters || [])))
    return { records: characters.length, forces: forces.length, skills: skills.length }
  }, [characters])

  /* ---- selection helpers ---- */
  const selected = useCallback((group: ListGroup) => state[group], [state])
  const hasSelected = useCallback((group: ListGroup, value: string) => state[group].includes(String(value)), [state])

  const toggleSelected = useCallback((group: ListGroup, value: string) => {
    const clean = String(value)
    setPage(1)
    setState((prev) => ({
      ...prev,
      [group]: prev[group].includes(clean) ? prev[group].filter((entry) => entry !== clean) : [...prev[group], clean],
    }))
  }, [])

  const clearGroup = useCallback((group: ListGroup) => {
    setPage(1)
    setState((prev) => ({ ...prev, [group]: [] }))
  }, [])

  /* ---- matching (characterMatches) ---- */
  const matchesAny = (selectedValues: string[], values: (string | null | undefined)[]) => {
    if (!selectedValues.length) return true
    return values.some((value) => selectedValues.includes(String(value)))
  }
  const matchesByFilterMode = (selectedValues: string[], values: (string | null | undefined)[], mode = state.filterMode) => {
    if (!selectedValues.length) return true
    const cleanValues = values.map((value) => String(value))
    return mode === "AND"
      ? selectedValues.every((value) => cleanValues.includes(String(value)))
      : selectedValues.some((value) => cleanValues.includes(String(value)))
  }
  const matchesEffectFilters = (selectedValues: string[], values: string[], mode = state.filterMode) => {
    if (!selectedValues.length) return true
    const normalizedValues = normalizeEffectFilterValues(values)
    return mode === "AND"
      ? selectedValues.every((value) => normalizedValues.includes(value))
      : selectedValues.some((value) => normalizedValues.includes(value))
  }

  const skillCostFilterActive = state.skillCostMin > SKILL_COST_MIN || state.skillCostMax < SKILL_COST_MAX

  const characterSkillsMatch = useCallback(
    (character: IndexCharacter) => {
      const costFilterActive = state.skillCostMin > SKILL_COST_MIN || state.skillCostMax < SKILL_COST_MAX
      const skills = character.skills || []
      const skillMatchesSelectedFilter = (skill: IndexCharacter["skills"][number], filter: string) =>
        normalizeEffectFilterValues(skill.filters || []).includes(filter)
      const skillPasses = (skill: IndexCharacter["skills"][number], filter: string | null) => {
        const effectOk = filter === null || skillMatchesSelectedFilter(skill, filter)
        const costOk = !costFilterActive || skillCostInRange(skill.cost, state.skillCostMin, state.skillCostMax)
        return effectOk && costOk
      }
      if (!state.skills.length) {
        return !costFilterActive || skills.some((skill) => skillPasses(skill, null))
      }
      return state.filterMode === "AND"
        ? state.skills.every((filter) => skills.some((skill) => skillPasses(skill, filter)))
        : state.skills.some((filter) => skills.some((skill) => skillPasses(skill, filter)))
    },
    [state.skills, state.skillCostMin, state.skillCostMax, state.filterMode],
  )

  const visible = useMemo(() => {
    const query = normalizeLabel(state.query)

    // Expand aliases:
    // jaune -> jaune + carrera
    // carrera -> jaune + carrera
    const queryVariants = query ? expandSearchQuery(query) : []

    const normalizedQuery = normalizeLabel(query)

    const hasExactNameMatch = characters.some(
      (c) => normalizeLabel(c.name) === normalizedQuery,
    )

    // Force shorthand: typing e.g. "WoF" / "OP1" filters to that force (World of
    // Fantasy / Ogre's Pride). Resolved once per query; null when not a shorthand.
    const shorthandForceLabel = FORCE_SHORTHANDS[query] ?? null
    const shorthandForce = shorthandForceLabel ? normalizeLabel(shorthandForceLabel) : null

    // const queryRes = queryVariants.map(
    //   (variant) =>
    //     new RegExp(
    //       `(?:^|[^a-z0-9])${variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!'s\\b)`,
    //       "i",
    //     ),
    // )
    const matched = characters.filter((character) => {
      const weapon = character.weapon || ""
      const attackerElement = normalizeLabel(getCharacterElementValue(character))
      const defenderElements = getDefenderElementValues(character)
      const elementSelected = state.attackerElement.length || state.protectorElement.length
      // A protector only matches when a PROTECTOR element is actually selected, and an
      // attacker only when an ATTACKER element is selected. (Without the length check,
      // an empty protector filter matched ALL protectors — so attacker-element filters
      // were wrongly showing every protector too.)
      const elementOk = !elementSelected
        ? true
        : isBlessCharacter(character)
          ? state.protectorElement.length > 0 && matchesByFilterMode(state.protectorElement, defenderElements)
          : state.attackerElement.length > 0 && state.attackerElement.includes(attackerElement)

      // Query corpus per spec: name + affiliation (title). The "Search Skills"
      // toggle additionally searches the ACTIVE skills' descriptions only
      // (active_skill_1/2/3), with markup stripped so only visible effect text counts.
      const normalizedName = normalizeLabel(character.name)
      const hasExactName =
        query.length > 0 &&
        characters.some(
          (c) => normalizeLabel(c.name) === query,
        )

      const nameMatch = hasExactNameMatch
        ? queryVariants.some((alias) => normalizedName === alias)
        : queryVariants.some((alias) => normalizedName.includes(alias))

      const queryCorpus = [character.title, (character as any).affiliation_name]
      if (state.searchSkills) {
        for (const skill of character.skills || []) {
          if ((skill.slot || "").startsWith("active_skill")) {
            queryCorpus.push((skill.desc || "").replace(/<[^>]*>/g, " "))
          }
        }
      }

      const extraMatch =
        !hasExactNameMatch &&
        query.length > 0 &&
        queryCorpus.some((text) =>
          normalizeLabel(text).includes(query),
  )

      return (
        matchesAny(state.role, [character.role]) &&
        elementOk &&
        matchesAny(state.weapon, [weapon]) &&
        matchesAny(state.type, [character.type]) &&
        matchesByFilterMode(state.ultimate, [character.ultimate]) &&
        matchesAny(state.rarity, [String(visualTierFor(character))]) &&
        matchesByFilterMode(state.tactics, [character.tactics]) &&
        matchesByFilterMode(state.forces, (character.forces || []).map((force) => force.name)) &&
        characterSkillsMatch(character) &&
        matchesEffectFilters(state.traits, character.traitFilters || []) &&
        matchesByFilterMode(state.valorTraits, (character.traits || []).map((trait) => trait.name)) &&
        matchesByFilterMode(state.facilities, character.facilities || []) &&
        (!query.length ||
          // A recognised force shorthand filters to that force ONLY; otherwise the
          // query falls back to name / affiliation matching.
          (shorthandForce
            ? (character.forces || []).some((force) => normalizeLabel(force.name) === shorthandForce)
            : nameMatch || extraMatch))
      )
    })

    // sortCharacters
    const sign = state.sortAsc ? 1 : -1
    matched.sort((left, right) => {
      let result = 0
      if (state.sortKey === "name") {
        result = left.name.localeCompare(right.name)
      } else if (state.sortKey === "release") {
        result = String(left.release || "").localeCompare(String(right.release || ""))
      } else if (state.sortKey === "rarity") {
        result = Number(visualTierFor(left) || 0) - Number(visualTierFor(right) || 0)
      } else {
        const key = state.sortKey as "attack" | "hp" | "defense" | "existence"
        result = Number(left.stats?.[key] || 0) - Number(right.stats?.[key] || 0)
      }
      if (result === 0) result = Number(left.id || 0) - Number(right.id || 0)
      return result * sign
    })
    return matched
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters, state, characterSkillsMatch])

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const shown = visible.slice(start, start + pageSize)
  const from = visible.length ? start + 1 : 0
  const to = start + shown.length

  // Featured unit: the prototype's renderFeature() runs ONCE at init and shows
  // sortCharacters(characters)[0] under the default release-desc sort — i.e. the
  // global newest record, NOT the filtered/sorted top. Keep it static.
  const featured = useMemo(() => sortFeature(characters), [characters])

  /* ---- active filter chips (activeFilterChips) ---- */
  const activeFilterCount =
    state.attackerElement.length +
    state.protectorElement.length +
    state.type.length +
    state.weapon.length +
    state.tactics.length +
    state.forces.length +
    state.skills.length +
    state.traits.length +
    state.valorTraits.length +
    state.facilities.length +
    state.role.length +
    state.ultimate.length +
    state.rarity.length +
    (skillCostFilterActive ? 1 : 0)

  const forceIconFor = useCallback(
    (value: string) => {
      const match = characters.flatMap((c) => c.forces || []).find((force) => force.name === value)
      return match?.icon || ""
    },
    [characters],
  )

  const filterChipLabel = (group: string, value: string) => {
    if (group === "attackerElement" || group === "protectorElement") return displayElement(value)
    if (group === "skillCost")
      return `SP Cost ${state.skillCostMin}-${state.skillCostMax >= SKILL_COST_MAX ? `${SKILL_COST_MAX}+` : state.skillCostMax}`
    return stripHtml(value)
  }
  const filterChipIcon = (group: string, value: string) => {
    if (group === "attackerElement") return attackerElementIconMap[normalizeLabel(value)] || ""
    if (group === "protectorElement") return getDefenderFilterIcon(value)
    if (group === "type") return attackTypeIconFor(value)
    if (group === "weapon") return weaponIconFor(value)
    if (group === "tactics") return tacticsIcons[normalizeLabel(value)] || ""
    if (group === "forces") return forceIconFor(value)
    if (group === "facilities") return facilityIconFor(value)
    if (group === "role") return roleIconFor(value)
    if (group === "ultimate") return ultimateIconFor(value)
    if (group === "rarity") return rarityIcons[Number(value)] || ""
    return ""
  }

  type ActiveChip = { group: string; value: string; category: string; label: string; icon: string }
  const activeFilterChips: ActiveChip[] = useMemo(() => {
    const groups: [ListGroup, string][] = [
      ["attackerElement", "Attacker"],
      ["protectorElement", "Protector"],
      ["type", "Attack Type"],
      ["weapon", "Weapon"],
      ["tactics", "Tactics"],
      ["role", "Role"],
      ["ultimate", "Ultimate"],
      ["rarity", "Rarity"],
      ["forces", "Force"],
      ["facilities", "Facility"],
      ["traits", "Trait"],
      ["valorTraits", "Valor Trait"],
      ["skills", "Skills"],
    ]
    const chips: ActiveChip[] = groups.flatMap(([group, category]) =>
      state[group].map((value) => ({
        group,
        value,
        category,
        label: filterChipLabel(group, value),
        icon: filterChipIcon(group, value),
      })),
    )
    if (skillCostFilterActive) {
      chips.push({ group: "skillCost", value: "range", category: "Skills", label: filterChipLabel("skillCost", ""), icon: "" })
    }
    return chips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, skillCostFilterActive, forceIconFor])

  const removeActiveFilter = (group: string, value: string) => {
    setPage(1)
    if (group === "skillCost") {
      setState((prev) => ({ ...prev, skillCostMin: SKILL_COST_MIN, skillCostMax: SKILL_COST_MAX }))
      return
    }
    if (!(LIST_GROUPS as readonly string[]).includes(group)) return
    setState((prev) => ({ ...prev, [group as ListGroup]: prev[group as ListGroup].filter((entry) => entry !== value) }))
  }

  const clearFilters = () => {
    setPage(1)
    setState((prev) => ({
      ...prev,
      query: "",
      searchSkills: false,
      filterMode: "OR",
      sortKey: "release",
      sortAsc: false,
      skillCostMin: SKILL_COST_MIN,
      skillCostMax: SKILL_COST_MAX,
      ...emptyListGroups(),
    }))
    setDrawerSearch({})
  }

  /* ---- skill cost slider (setSkillCost / updateSkillCostUI) ---- */
  const setSkillCost = (which: "min" | "max", rawValue: string) => {
    const value = Math.max(SKILL_COST_MIN, Math.min(SKILL_COST_MAX, Number(rawValue) || 0))
    setPage(1)
    setState((prev) =>
      which === "min"
        ? { ...prev, skillCostMin: Math.min(value, prev.skillCostMax) }
        : { ...prev, skillCostMax: Math.max(value, prev.skillCostMin) },
    )
  }
  const minPct = ((state.skillCostMin - SKILL_COST_MIN) / (SKILL_COST_MAX - SKILL_COST_MIN)) * 100
  const maxPct = ((state.skillCostMax - SKILL_COST_MIN) / (SKILL_COST_MAX - SKILL_COST_MIN)) * 100

  /* ---- cluster height sync (syncFilterClusterHeight) ---- */
  const syncFilterClusterHeight = useCallback(() => {
    const cluster = clusterRef.current
    const tower = towerRef.current
    const elements = elementsRef.current
    const search = searchRef.current
    if (!cluster || !tower || !elements || !search) return

    // This effect re-runs on every visible.length change — i.e. every filter toggle.
    // The inner rail (.v2-tower-scroll) overflows the tower's fixed height, so clearing
    // `tower.style.height` collapses the rail and snaps its scrollTop back to 0; the
    // elements/cluster minHeight reset likewise shrinks the page and bumps the window
    // scroll. baseTowerHeight below is measured from an OFF-SCREEN CLONE, so the real
    // tower never needs collapsing on desktop — leave its height alone so the rail keeps
    // its scroll position. Still snapshot + restore the window scroll as a safety net.
    const rail = tower.querySelector<HTMLElement>(".v2-tower-scroll")
    const savedRail = rail ? rail.scrollTop : 0
    const savedWin = window.scrollY
    const restoreScroll = () => {
      if (rail) rail.scrollTop = savedRail
      if (window.scrollY !== savedWin) window.scrollTo(0, savedWin)
    }

    elements.style.minHeight = ""
    cluster.style.minHeight = ""

    if (window.matchMedia("(max-width: 1340px)").matches) {
      // narrow/mobile uses natural flow — undo any desktop-synced tower height
      tower.style.height = ""
      restoreScroll()
      return
    }

    const towerWidth = tower.getBoundingClientRect().width
    const clone = tower.cloneNode(true) as HTMLElement
    clone.querySelectorAll("details").forEach((drop) => {
      ;(drop as HTMLDetailsElement).open = false
    })
    Object.assign(clone.style, {
      position: "absolute",
      visibility: "hidden",
      pointerEvents: "none",
      left: "-9999px",
      top: "0",
      width: `${towerWidth}px`,
      height: "auto",
    })
    document.body.appendChild(clone)
    const cloneScroll = clone.querySelector<HTMLElement>(".v2-tower-scroll")
    const baseTowerHeight = Math.ceil(cloneScroll ? cloneScroll.scrollHeight : clone.getBoundingClientRect().height)
    clone.remove()

    const gap = Number.parseFloat(getComputedStyle(cluster).getPropertyValue("--cluster-gap")) || 26
    const searchHeight = search.getBoundingClientRect().height
    const elementsMinHeight = Math.max(elements.getBoundingClientRect().height, baseTowerHeight - searchHeight - gap)
    tower.style.height = `${baseTowerHeight}px`
    elements.style.minHeight = `${Math.ceil(elementsMinHeight)}px`
    restoreScroll()
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(syncFilterClusterHeight)
    const onResize = () => requestAnimationFrame(syncFilterClusterHeight)
    window.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener("resize", onResize)
    }
  }, [syncFilterClusterHeight, openDrawer, visible.length, filtersCollapsed, options])

  // hide-filters collapse: the prototype toggles body.filters-collapsed (the
  // ecosystem-live.css / night-ink.css collapse rules key off it). Mirror that
  // on <body>, mirroring how the night-ink home toggles body.motion, and always
  // clean the class up on unmount so it can't leak onto other routes.
  useEffect(() => {
    document.body.classList.toggle("filters-collapsed", filtersCollapsed)
    // persist the preference (only after hydration, so we don't overwrite the
    // restored value with the initial default on first mount)
    if (hydrated) {
      try {
        localStorage.setItem(FILTERS_COLLAPSED_KEY, filtersCollapsed ? "1" : "0")
      } catch {
        /* ignore */
      }
    }
    return () => {
      document.body.classList.remove("filters-collapsed")
    }
  }, [filtersCollapsed, hydrated])

  /* ---- drawer accordion: only one open at a time ---- */
  const toggleDrawer = (key: string) => {
    setOpenDrawer((prev) => (prev === key ? null : key))
  }

  // mobile filter sheet: lock the page behind it while open, and force it shut
  // if the viewport grows back to desktop (so the fixed panel can't strand).
  useEffect(() => {
    if (!isMobile && mobileFiltersOpen) setMobileFiltersOpen(false)
  }, [isMobile, mobileFiltersOpen])

  useEffect(() => {
    if (!(isMobile && mobileFiltersOpen)) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    // the drawer is nested inside .v2-inner (a z-index:1 stacking context), so the
    // global masthead (z-60 at the body level) renders OVER it; hide the masthead
    // while the sheet is open so its ☰ toggle doesn't poke through the drawer header
    document.body.classList.add("chars-filters-open")
    return () => {
      document.body.style.overflow = previous
      document.body.classList.remove("chars-filters-open")
    }
  }, [isMobile, mobileFiltersOpen])

  /* ============================================================
     RENDER HELPERS
     ============================================================ */

  const renderIconChip = (group: ListGroup, value: string, label: string, iconPath: string, count?: number) => {
    const iconOnlyGroups = new Set<ListGroup>([
      "role",
      "attackerElement",
      "protectorElement",
      "weapon",
      "type",
      "ultimate",
      "rarity",
    ])
    const cleanValue = String(value)
    const iconOnly = iconOnlyGroups.has(group) && !!iconPath
    const active = hasSelected(group, cleanValue)
    return (
      <button
        key={`${group}:${cleanValue}`}
        className={`ichip filter-chip${iconOnly ? " is-icon-only" : ""}${active ? " is-active" : ""}`}
        type="button"
        aria-pressed={active}
        title={label}
        onClick={() => toggleSelected(group, cleanValue)}
      >
        {iconPath ? <Img path={iconPath} /> : null}
        {iconOnly ? <span className="sr-filter-label">{label}</span> : <span>{stripHtml(label)}</span>}
        {count && !iconOnly ? <em>{count}</em> : null}
      </button>
    )
  }

  const renderAllChip = (group: ListGroup, label = "All") => {
    const active = selected(group).length === 0
    return (
      <button
        className={`filter-all-chip${active ? " is-active" : ""}`}
        type="button"
        aria-pressed={active}
        onClick={() => clearGroup(group)}
      >
        {label}
      </button>
    )
  }

  const renderDrawer = (key: string, title: string, group: ListGroup, opts: DropOption[], searchPlaceholder: string) => {
    const count = state[group].length
    const search = (drawerSearch[key] || "").trim().toLowerCase()
    return (
      <details className={`v2-drawer-drop${count > 0 ? " has" : ""}`} open={openDrawer === key}>
        <summary
          className="v2-drawer"
          onClick={(event) => {
            event.preventDefault()
            toggleDrawer(key)
          }}
        >
          <span className="lhs">
            {title}
            <span className="n">{count}</span>
          </span>
          <span className="caret">▾</span>
        </summary>
        <label className="drop-search">
          <span>{searchPlaceholder}</span>
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={drawerSearch[key] || ""}
            onChange={(event) => setDrawerSearch((prev) => ({ ...prev, [key]: event.target.value }))}
          />
        </label>
        <div className="drop-options">
          {opts.map((option) => {
            const haystack = `${option.value} ${option.label} ${option.count}`.toLowerCase()
            const hidden = Boolean(search && !haystack.includes(search))
            const active = hasSelected(group, option.value)
            return (
              <button
                key={option.value}
                className={`drop-item drop-${group}${active ? " is-active" : ""}`}
                type="button"
                aria-pressed={active}
                title={stripHtml(option.label)}
                hidden={hidden}
                onClick={() => toggleSelected(group, option.value)}
              >
                <span className="drop-check" aria-hidden="true" />
                {option.icon ? (
                  <span className="drop-icon">
                    <Img path={option.icon} />
                  </span>
                ) : (
                  <span className="drop-icon is-empty" aria-hidden="true" />
                )}
                <span className="drop-label">{stripHtml(option.label)}</span>
                {option.count ? <em>{option.count}</em> : null}
              </button>
            )
          })}
        </div>
      </details>
    )
  }

  const pages = compactPages(currentPage, totalPages)

  return (
    <main className="board v2">
      <div className="v2-inner">
        <section className="v2-head" aria-label="Character archive overview">
          <span className="nf-ring nf-ring-head" aria-hidden="true" />

          {/* prototype's .v2-mastrow/.v2-navsq dropped — global NightInkSiteNav owns the nav */}

          <div className="v2-head-left">
            <h1 className="v2-h1">
              Chara<em>cters</em>
            </h1>
            <p className="v2-head-sub">
              The complete battle archive with live stats, skills, forces, traits, facilities, and release metadata pulled
              from the wiki data.
            </p>
            <span className="cap" id="archiveCount">
              {metrics.records.toLocaleString()} records · {metrics.forces.toLocaleString()} forces ·{" "}
              {metrics.skills.toLocaleString()} skill tags
            </span>
          </div>
        </section>

        {featured ? (
          <Link className="v2-feature" href={`/characters/${featured.id}`} style={{ marginRight: 380 }} aria-label="Latest character">
            <GameIcon character={featured} size={68} isNew={Number(featured.id) === newestCharacterId} />
            <span>
              <span className="cap" style={{ color: "var(--red-bright)", marginBottom: 5, display: "block" }}>
                New this banner
              </span>
              <span className="nm">
                {featured.name} - <span className="tt">{featured.title || "No title"}</span>
              </span>
            </span>
            <span className="go">→</span>
          </Link>
        ) : (
          <a className="v2-feature" href="#" style={{ marginRight: 380 }} aria-label="Latest character" />
        )}

        <div className="v2-stem is-four-corner" aria-hidden="true">
          <i className="tl" />
          <i className="tr" />
          <i className="bl" />
          <i className="br" />
        </div>

        {isMobile ? (
          <button
            type="button"
            className={`v2-mobile-backdrop${mobileFiltersOpen ? " is-open" : ""}`}
            aria-hidden={!mobileFiltersOpen}
            tabIndex={-1}
            onClick={() => setMobileFiltersOpen(false)}
          />
        ) : null}

        <section
          className={`v2-cluster${isMobile ? " is-mobile-drawer" : ""}${isMobile && mobileFiltersOpen ? " is-open" : ""}`}
          id="filters"
          aria-label="Character filters"
          aria-hidden={isMobile && !mobileFiltersOpen}
          ref={clusterRef}
        >
          {isMobile ? (
            <div className="v2-drawer-head">
              <span className="v2-drawer-title">Filters</span>
              <button
                type="button"
                className="v2-drawer-close"
                aria-label="Close filters"
                onClick={() => setMobileFiltersOpen(false)}
              >
                ✕
              </button>
            </div>
          ) : null}

          <div className="v2-drawer-body">
          <div className="v2-pod v2-search-pod" ref={searchRef}>
            <label className="v2-searchbox" htmlFor="characterSearch">
              <input
                id="characterSearch"
                type="search"
                autoComplete="off"
                placeholder="Search names, affiliations, effects, forces, towns..."
                value={state.query}
                onChange={(event) => {
                  setPage(1)
                  setState((prev) => ({ ...prev, query: event.target.value }))
                }}
              />
            </label>

            <button
              className={`v2-toggle${state.searchSkills ? " is-active" : ""}`}
              id="searchSkillsToggle"
              type="button"
              aria-pressed={state.searchSkills}
              onClick={() => {
                setPage(1)
                setState((prev) => ({ ...prev, searchSkills: !prev.searchSkills }))
              }}
            >
              <span className="knob" />
              Search Skills
            </button>

            <label className="v2-sort" htmlFor="sortSelect">
              <span aria-hidden="true">⇅</span>
              <select
                id="sortSelect"
                aria-label="Sort characters"
                value={state.sortKey}
                onChange={(event) => {
                  setPage(1)
                  setState((prev) => ({ ...prev, sortKey: event.target.value as SortKey }))
                }}
              >
                <option value="release">Release date</option>
                <option value="name">Name</option>
                <option value="rarity">Rarity</option>
                <option value="attack">Attack</option>
                <option value="hp">Health</option>
                <option value="defense">Defense</option>
                <option value="existence">Existence</option>
              </select>
            </label>

            <button
              className="v2-sort v2-sort-button"
              id="sortDirection"
              type="button"
              aria-label="Toggle sort direction"
              onClick={() => {
                setPage(1)
                setState((prev) => ({ ...prev, sortAsc: !prev.sortAsc }))
              }}
            >
              {state.sortAsc ? "Asc" : "Desc"}
            </button>
            <button
              className="v2-sort v2-sort-button"
              id="hideFiltersToggle"
              type="button"
              aria-pressed={filtersCollapsed}
              onClick={() => setFiltersCollapsed((prev) => !prev)}
            >
              {filtersCollapsed ? "Show" : "Hide"}
            </button>
            <button className="v2-reset" id="clearFilters" type="button" onClick={clearFilters}>
              Reset
            </button>
          </div>

          <aside className="v2-pod v2-tower" aria-label="Dropdown archive index" ref={towerRef}>
            <div className="v2-bridge h" style={{ left: -27, width: 28, top: 44, height: 44 }} aria-hidden="true">
              <i className="tl" />
              <i className="tr" />
              <i className="bl" />
              <i className="br" />
            </div>

            <div className="v2-tower-scroll">
              {renderDrawer("tactics", "Tactics", "tactics", options.tactics, "Search tactics")}
              {renderDrawer("forces", "Forces", "forces", options.forces, "Search forces")}
              {renderDrawer("skills", "Skills", "skills", options.skills, "Search skills")}
              {renderDrawer("traits", "Traits", "traits", options.traits, "Search traits")}
              {renderDrawer("valorTraits", "Valor Traits", "valorTraits", options.valorTraits, "Search valor traits")}
              {renderDrawer("facilities", "Facilities", "facilities", options.facilities, "Search facilities")}

              <div className="foot cap">Forces · Skills · Traits open as drawers</div>
            </div>
          </aside>

          <div className="v2-pod v2-elements" ref={elementsRef}>
            <div className="v2-bridge v" style={{ top: -27, height: 28, left: 110, width: 84 }} aria-hidden="true">
              <i className="tl" />
              <i className="tr" />
              <i className="bl" />
              <i className="br" />
            </div>

            <div className="v2-section">
              <span className="v2-tab">Attacker</span>
              <div className="v2-icons" id="attackerElementFilters">
                {options.attackerElements.map(({ value }) =>
                  renderIconChip("attackerElement", value, displayElement(value), attackerElementIconMap[value] || ""),
                )}
              </div>
            </div>
            <div className="v2-section">
              <span className="v2-tab">Protector</span>
              <div className="v2-icons" id="protectorElementFilters">
                {options.protectorElements.map(({ value }) =>
                  renderIconChip("protectorElement", value, displayElement(value), getDefenderFilterIcon(value)),
                )}
              </div>
            </div>
          </div>

          <div className="v2-pod v2-tray">
            <div className="v2-bridge v" style={{ top: -27, height: 28, left: 110, width: 84 }} aria-hidden="true">
              <i className="tl" />
              <i className="tr" />
              <i className="bl" />
              <i className="br" />
            </div>
            <div className="v2-bridge v" style={{ top: -27, height: 28, right: 150, width: 84 }} aria-hidden="true">
              <i className="tl" />
              <i className="tr" />
              <i className="bl" />
              <i className="br" />
            </div>

            <div className="v2-section">
              <span className="v2-tab">Weapon</span>
              <div className="v2-icons" id="weaponFilters">
                {options.weapons.map(({ value }) => renderIconChip("weapon", value, value, weaponIconFor(value)))}
              </div>
              <span className="v2-subsep" />
              <span className="v2-minicap">Type</span>
              <div className="v2-icons v2-inline-icons" id="typeFilters">
                {options.types.map(({ value }) => renderIconChip("type", value, value, attackTypeIconFor(value)))}
              </div>
              <span className="v2-subsep" />
              <span className="v2-minicap">Role</span>
              <div className="v2-icons v2-inline-icons" id="roleFilters">
                {options.roles.map(({ value }) => renderIconChip("role", value, value, roleIconFor(value)))}
              </div>
              <span className="v2-subsep" />
              <span className="v2-minicap">Ulti</span>
              <div className="v2-icons v2-inline-icons" id="ultimateFilters">
                {options.ultimates.map(({ value }) => renderIconChip("ultimate", value, value, ultimateIconFor(value)))}
              </div>
            </div>

            <div className="v2-section">
              <span className="v2-tab alt">Rarity</span>
              <div className="v2-icons" id="rarityFilters">
                {renderAllChip("rarity")}
                {options.rarities.map(({ value }) =>
                  renderIconChip("rarity", value, `${value} rarity`, rarityIcons[Number(value)] || ""),
                )}
              </div>
              <div className={`v2-slider${skillCostFilterActive ? " is-active" : ""}`} id="skillCostSlider" style={{ ["--minPct" as string]: `${minPct}%`, ["--maxPct" as string]: `${maxPct}%` }}>
                <span className="v2-minicap">SP Cost</span>
                <span className="track">
                  <span className="fill" />
                  <input
                    id="skillCostMin"
                    type="range"
                    min={0}
                    max={85}
                    step={1}
                    value={state.skillCostMin}
                    aria-label="Minimum SP cost"
                    onChange={(event) => setSkillCost("min", event.target.value)}
                  />
                  <input
                    id="skillCostMax"
                    type="range"
                    min={0}
                    max={85}
                    step={1}
                    value={state.skillCostMax}
                    aria-label="Maximum SP cost"
                    onChange={(event) => setSkillCost("max", event.target.value)}
                  />
                </span>
                <span className="val" id="skillCostValue">
                  {state.skillCostMin} - {state.skillCostMax >= SKILL_COST_MAX ? `${SKILL_COST_MAX}+` : state.skillCostMax}
                </span>
                <button
                  className="skill-cost-clear"
                  id="skillCostClear"
                  type="button"
                  onClick={() => {
                    setPage(1)
                    setState((prev) => ({ ...prev, skillCostMin: SKILL_COST_MIN, skillCostMax: SKILL_COST_MAX }))
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          </div>

          {isMobile ? (
            <div className="v2-drawer-foot">
              <button type="button" className="v2-drawer-clear" onClick={clearFilters}>
                Clear all
              </button>
              <button type="button" className="v2-drawer-apply" onClick={() => setMobileFiltersOpen(false)}>
                Show {visible.length.toLocaleString()} result{visible.length === 1 ? "" : "s"}
              </button>
            </div>
          ) : null}
        </section>

        {isMobile ? (
          <div className="v2-mobile-bar">
            <button
              type="button"
              className={`v2-mobile-filters-btn${activeFilterCount ? " has-active" : ""}`}
              onClick={() => setMobileFiltersOpen(true)}
            >
              <span className="mfb-ico" aria-hidden="true">
                ⚑
              </span>
              Filters
              {activeFilterCount ? <span className="mfb-badge">{activeFilterCount}</span> : null}
            </button>
            <label className="v2-mobile-search" htmlFor="characterSearchMobile">
              <span className="mfs-ico" aria-hidden="true">
                ⌕
              </span>
              <input
                id="characterSearchMobile"
                type="search"
                autoComplete="off"
                placeholder="Search characters..."
                value={state.query}
                onChange={(event) => {
                  setPage(1)
                  setState((prev) => ({ ...prev, query: event.target.value }))
                }}
              />
            </label>
          </div>
        ) : null}

        <section className="v2-gridshell" aria-label="Character results">
          <div className="v2-bridge v" style={{ top: -46, height: 47, right: 170, width: 90 }} aria-hidden="true">
            <i className="tl" />
            <i className="tr" />
            <i className="bl" />
            <i className="br" />
          </div>
          <div className="v2-resultpod" id="resultSummary">
            Showing{" "}
            <b>
              {from.toLocaleString()}-{to.toLocaleString()}
            </b>{" "}
            of {visible.length.toLocaleString()}
          </div>

          <div className="v2-gridhead">
            <span className="count">Results</span>
            <div className="legend" id="activeFilters" aria-live="polite">
              {activeFilterCount ? (
                <>
                  <span className="active-filter-count">{activeFilterCount} active filters</span>
                  <button
                    className={`filter-mode-toggle ${state.filterMode === "AND" ? "is-and" : "is-or"}`}
                    type="button"
                    aria-label="Switch filter mode"
                    title={
                      state.filterMode === "AND"
                        ? "AND: character must match all selected filters. Click for OR."
                        : "OR: character may match any selected filter. Click for AND."
                    }
                    onClick={() => {
                      setPage(1)
                      setState((prev) => ({ ...prev, filterMode: prev.filterMode === "AND" ? "OR" : "AND" }))
                    }}
                  >
                    <span className="mode-track" aria-hidden="true">
                      <i />
                    </span>
                    <span>{state.filterMode}</span>
                  </button>
                  <button className="active-filter-reset" type="button" onClick={clearFilters}>
                    Reset
                  </button>
                  {activeFilterChips.map((chip) => (
                    <button
                      key={`${chip.group}:${chip.value}`}
                      className="active-filter-chip"
                      type="button"
                      title={`Remove ${chip.category} filter`}
                      onClick={() => removeActiveFilter(chip.group, chip.value)}
                    >
                      <span className="chip-category">{chip.category}</span>
                      <span className="chip-separator">-</span>
                      {chip.icon ? <Img path={chip.icon} className="chip-icon" /> : null}
                      <span className="chip-label">{chip.label}</span>
                      <span className="chip-remove" aria-hidden="true">
                        x
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                <span>Sort · {state.sortKey === "release" ? "Newest" : state.sortKey}</span>
              )}
            </div>
          </div>
          <div className="v2-grid" id="characterGrid">
            {shown.length ? (
              shown.map((character) => (
                <CharacterCard key={character.id} character={character} hot={Number(character.id) === newestCharacterId} />
              ))
            ) : (
              <div className="empty-state">No characters match this set of filters.</div>
            )}
          </div>
        </section>

        <div className="v2-dockbar">
          <button
            className="page-btn"
            id="prevPage"
            type="button"
            disabled={visible.length === 0 || currentPage <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Prev
          </button>
          <div className="page-pills" id="pagePills" aria-label="Result pages">
            {pages.map((pageItem, index) =>
              typeof pageItem === "number" ? (
                <button
                  key={pageItem}
                  className={`page-pill${pageItem === currentPage ? " is-active" : ""}`}
                  type="button"
                  aria-current={pageItem === currentPage ? "page" : "false"}
                  onClick={() => setPage(pageItem)}
                >
                  {pageItem}
                </button>
              ) : (
                <span key={`${pageItem}-${index}`} className="page-gap">
                  ...
                </span>
              ),
            )}
          </div>
          <button
            className="page-btn"
            id="nextPage"
            type="button"
            disabled={visible.length === 0 || currentPage >= totalPages}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </button>
          <label className="page-size" htmlFor="pageSizeSelect">
            <span>Per page</span>
            <select
              id="pageSizeSelect"
              value={pageSize}
              onChange={(event) => {
                setPage(1)
                setPageSize(Number(event.target.value) || 50)
              }}
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </label>
          <span className="upp" id="dockCount">
            {visible.length.toLocaleString()} matched · {metrics.records.toLocaleString()} records
          </span>
        </div>
      </div>
    </main>
  )
}

// renderFeature fallback: when nothing matches, the prototype still shows the
// top of the full sorted list (sortCharacters(characters)[0]).
function sortFeature(characters: IndexCharacter[]): IndexCharacter | undefined {
  if (!characters.length) return undefined
  const sorted = [...characters]
  sorted.sort((left, right) => {
    let result = String(left.release || "").localeCompare(String(right.release || ""))
    if (result === 0) result = Number(left.id || 0) - Number(right.id || 0)
    return result * -1
  })
  return sorted[0]
}