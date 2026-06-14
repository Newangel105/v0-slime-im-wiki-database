"use client"

// Night-ink character detail, client side — a faithful port of the approved
// prototype reports/christmas-vision/my_vision/character-live.html + .js
// (page-specific styles: ./character-detail.nightink.css; the shared board /
// pod / bridge / chip / dockbar styling lives in app/night-ink.css = the
// ecosystem-live.css + finish-v3.css port).
//
// The prototype builds the page by writing HTML strings into placeholder
// nodes and binds tab / variant-toggle clicks by hand. Here the pure
// string-builder helpers are kept verbatim (so the rich skill / trait / EX
// markup is byte-for-byte the prototype's) and rendered through
// dangerouslySetInnerHTML, while the Combat tab switcher and per-card variant
// toggles are driven by React state instead of manual DOM listeners.
//
// Deviations: no inline nav (global masthead); icon-map asset urls rewritten
// from the prototype's PUBLIC_ROOT ("../../../public/") and its bundled
// assets/ copies to the app's canonical /public paths (/UI, /Image,
// /L10NAssets, /weapons, /stats) — mirroring components/ocean/character-detail.
import Link from "next/link"
import { useState, type CSSProperties } from "react"
import "./character-detail.nightink.css"
// element display names (air→Space, holy→Light, enhanced→"X+") — one source of truth
import { getDisplayElementLabel } from "@/lib/pc-wiki"

/* ======================================================================
   payload types (built by components/nightink/character-detail.tsx)
   ====================================================================== */
export type DetailSkill = {
  slot: string
  kind: string
  name: string
  cost: number | null
  desc: string
  icon: string
  specialSkillType: string | null
  skillChangeType: string | null
}
export type DetailTrait = { name: string; desc: string; icon: string; unlock: string }
export type DetailExAbility = { name: string; desc: string; effects: string[]; icon: string }
export type DetailForce = { name: string; group: string; icon: string }
export type DetailCharacter = {
  id: number
  name: string
  title: string
  rarity: number
  element: string
  role: string
  type: string
  weapon: string
  tactics: string
  ultimate: string
  release: string
  stats: { hp: number; attack: number; defense: number; existence: number }
  thumb: string
  art: string
  forces: DetailForce[]
  facilities: string[]
  traits: DetailTrait[]
  exAbilities: DetailExAbility[]
  skills: DetailSkill[]
}
export type StatMaxes = { hp: number; attack: number; defense: number; existence: number }
export type DockLink = { id: number; name: string; title: string }

type Props = {
  character: DetailCharacter
  statMaxes: StatMaxes
  prev: DockLink | null
  next: DockLink | null
  recordIndex: number
  recordTotal: number
}

/* ======================================================================
   icon maps — rewritten to the app's canonical /public paths
   (prototype PUBLIC_ROOT="../../../public/" + bundled assets/* copies)
   ====================================================================== */
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
  magic: "Image/IcElementBless/IcElementBlessMagic.webp",
  physics: "Image/IcElementBless/IcElementBlessPhysics.webp",
  special: "Image/IcElementBless/IcElementBlessSpecial.webp",
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

const weaponIcons: Record<string, string> = {
  book: "/weapons/book.webp",
  fist: "/weapons/fists.webp",
  fists: "/weapons/fists.webp",
  greatsword: "/weapons/greatsword.webp",
  hammer: "/weapons/hammer.webp",
  katana: "/weapons/katana.webp",
  knuckle: "/weapons/fists.webp",
  largesword: "/weapons/greatsword.webp",
  spear: "/weapons/spear.webp",
  sword: "/weapons/sword.webp",
}

const attackTypeIcons: Record<string, string> = {
  magic: "/UI/Texture/CommonLotteryInfoPanelAtlas/icAttackTypeMagic.webp",
  physical: "/UI/Texture/CommonLotteryInfoPanelAtlas/icAttackTypePhysical.webp",
}

const roleIcons: Record<string, string> = {
  attacker: "/UI/Texture/CommonLotteryInfoPanelAtlas/icCharaTypePc.webp",
  supporter: "/UI/Texture/CommonLotteryInfoPanelAtlas/icCharaTypeBless.webp",
  protector: "/UI/Texture/CommonLotteryInfoPanelAtlas/icCharaTypeBless.webp",
}

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

function fieldBuildingIcon(id: string, ver: string): string {
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
  3: "UI/Texture/CommonRarityAtlas/starCharaL3",
  4: "UI/Texture/CommonRarityAtlas/starCharaL4",
  5: "UI/Texture/CommonRarityAtlas/starCharaL5",
  6: "UI/Texture/CommonRarityAtlas/starCharaL6",
  7: "UI/Texture/CommonRarityAtlas/starCharaL6_SpecialPlus",
  8: "UI/Texture/CommonRarityAtlas/starCharaL7_Epic",
}

const statIcons: Record<string, string> = {
  hp: "stats/hp.webp",
  attack: "stats/attack.webp",
  defense: "stats/defense.webp",
  existence: "stats/existence.webp",
}

const inlineElementIconMap: Record<string, string> = {
  air: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementAir.webp",
  dark: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementDark.webp",
  earth: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementEarth.webp",
  fire: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementFire.webp",
  holy: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementHoly.webp",
  light: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementHoly.webp",
  space: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementAir.webp",
  water: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementWater.webp",
  wind: "UI/Texture/CommonLotteryInfoPanelAtlas/icElementWind.webp",
}

const inlineStatIconMap: Record<string, string> = {
  atk: statIcons.attack,
  def: statIcons.defense,
  hp: statIcons.hp,
}

/* ======================================================================
   pure helpers — ported verbatim from character-live.js
   (publicAsset prefixes "/" instead of PUBLIC_ROOT for non-absolute paths)
   ====================================================================== */
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function stripHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function stripFormatting(value: unknown): string {
  return stripHtml(value).replace(/\s+/g, " ").trim()
}

function normalizeLabel(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .toLowerCase()
    .replace(/&nbsp;/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim()
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

/* the app public root is "/" — keep the prototype's {1}->3 / {0}->L expansion
   and the bare-path -> .webp default, but treat already-rooted /UI, /weapons
   etc. as absolute (the leading slash is stripped then re-added). */
function publicAsset(path: string): string {
  if (!path) return ""
  const clean = String(path).replace(/^\//, "")
  const expanded = clean.replace(/\{1\}/g, "3").replace(/\{0\}/g, "L")
  if (/^https?:/i.test(expanded)) return expanded
  if (/\.(webp|png|jpg|jpeg|gif|svg)$/i.test(expanded)) return `/${expanded}`
  return `/${expanded}.webp`
}

function img(path: string, alt = "", attrs = ""): string {
  const src = publicAsset(path)
  if (!src) return ""
  return `<img src="${src}" alt="${escapeHtml(alt)}" ${attrs} loading="lazy" decoding="async" onerror="this.onerror=null;this.hidden=true" />`
}

function iconChipHtml(icon: string, label: string, cls = "", href = ""): string {
  if (!icon || !label || /none/i.test(String(label))) return ""
  const className = `ichip chr-icon-chip ${cls}`.trim()
  const title = escapeHtml(label)
  const content = img(icon, label)
  if (!href) return `<span class="${className}" title="${title}" aria-label="${title}">${content}</span>`
  return `<a class="${className}" href="${escapeHtml(href)}" title="${title}" aria-label="Filter characters by ${title}">${content}</a>`
}

function hasExSpecialSkill(character: DetailCharacter): boolean {
  return (character.skills || []).some(
    (skill) => skill.slot === "special_skill" && /EX Soul of Combos/i.test(skill.desc || ""),
  )
}

function isExUnboundCharacter(character: DetailCharacter): boolean {
  return /Enhanced/i.test(character.element || "")
}

function isExAttacker(character: DetailCharacter): boolean {
  return /^(SpecialEffect)/i.test(character.element || "")
}

function visualTierFor(character: DetailCharacter): number {
  if (character.rarity === 6) return 8
  if (character.rarity !== 5) return Math.min(Math.max(Number(character.rarity) || 5, 3), 7)
  if (isExUnboundCharacter(character)) return 7
  if (hasExSpecialSkill(character)) return 6
  if (isExAttacker(character)) return 6
  return 5
}

function displayElement(value: string): string {
  const normalized = normalizeLabel(value)
  if (!normalized || normalized === "none") return "None"
  return getDisplayElementLabel(normalized.replace(/^specialeffectelement/, ""))
}

function elementIcon(value: string): string {
  const key = normalizeLabel(value)
  return attackerElementIconMap[key] || elementIconMap[key] || ""
}

function facilityBaseName(value: string): string {
  return String(value || "").replace(/\s+\+\d+%$/, "").trim()
}

function facilityIconFor(value: string): string {
  const base = facilityBaseName(value)
  const direct = facilityIconMap[base]
  if (direct) return direct
  const key = normalizeLabel(base)
  const match = Object.entries(facilityIconMap).find(([name]) => normalizeLabel(name) === key)
  return match?.[1] || ""
}

function cutinArtFor(character: DetailCharacter): string {
  const artPath = character?.art || ""
  if (!artPath) return ""
  return /CharaInfo$/i.test(artPath)
    ? artPath.replace(/CharaInfo$/i, "CharaCutin")
    : artPath.replace(/CharaInfo\.webp$/i, "CharaCutin.webp")
}

function tagTone(label: string): string {
  const clean = normalizeLabel(label)
  if (!clean) return ""
  if (clean === "attack" || clean === "attackchanging") return "attack"
  if (clean === "support") return "support"
  if (clean === "bodyandspiritchanging") return "change-body"
  if (clean === "defensechanging") return "change-defense"
  if (clean === "magicchanging") return "change-magic"
  if (/down|decrease|resistance|seal|stun|enamor|poison|burn|paralysis|charm|sleep/.test(clean)) return "debuff"
  if (/up|increase|gauge|point|cost|damage|strike|rate|power/.test(clean)) return "buff"
  if (/fire|water|earth|wind|dark|holy|light|space|air/.test(clean)) return "element"
  if (/skill|secret|soul|protection|divine/.test(clean)) return "soul"
  return ""
}

function tag(label: string, cls = ""): string {
  const text = stripFormatting(label)
  if (!text) return ""
  const tone = (cls || tagTone(text)).replace(/[^a-z0-9-]+/gi, "")
  return `<span class="tag ${tone}">${escapeHtml(text)}</span>`
}

function archiveFilterUrl(group: string, value: unknown): string {
  const queryKeys: Record<string, string> = {
    skills: "skill",
    traits: "trait",
    force: "force",
    facility: "facility",
    attacker: "attacker",
    defender: "defender",
    tactics: "tactics",
    weapon: "weapon",
    role: "role",
    type: "type",
    ultimate: "ulti",
    rarity: "rarity",
  }
  const queryKey = queryKeys[group] || group
  return `/characters?${encodeURIComponent(queryKey)}=${encodeURIComponent(String(value || ""))}`
}

function skillIcon(skill: DetailSkill, characterRarity: number): string {
  if (!skill?.icon) return ""
  if (!/^special_skill/.test(skill.slot || "")) return img(skill.icon, skill.name)

  const specialType = normalizeLabel(skill.specialSkillType || "attack")
  const frame =
    specialType === "support"
      ? "UI/Texture/BattleAtlas/cardBaseSpSupport"
      : specialType === "attack"
        ? "UI/Texture/BattleAtlas/cardBaseSpAttack"
        : "UI/Texture/BattleAtlas/cardBaseSp"
  const isAllTarget = /all-target|all target/i.test(skill.desc || "")
  const targetIcon = isAllTarget ? "UI/Texture/BattleAtlas/icSpTypeAll" : "UI/Texture/BattleAtlas/icSpTypeSingle"
  const rarityIcon = characterRarity === 6 ? "UI/Texture/BattleAtlas/icEpicOff" : "UI/Texture/BattleAtlas/icUltimateOff"

  return `<span class="special-skill-emblem">${img(frame, "", 'class="skill-frame" aria-hidden="true"')}<span class="skill-portrait-wrap">${img(
    skill.icon,
    skill.name,
    'class="skill-portrait"',
  )}</span>${img(targetIcon, isAllTarget ? "All targets" : "Single target", 'class="skill-target"')}${img(
    rarityIcon,
    "",
    'class="skill-rarity" aria-hidden="true"',
  )}</span>`
}

function exAbilityIcon(ability: { icon?: string }): string {
  if (ability?.icon) return ability.icon
  return "UI/Texture/CharaInfoAtlas/icSkillExBoard"
}

function skillChangeClass(label: string): string {
  const clean = normalizeLabel(label)
  if (clean === "attackchanging") return "change-attack"
  if (clean === "bodyandspiritchanging") return "change-body"
  if (clean === "defensechanging") return "change-defense"
  if (clean === "magicchanging") return "change-magic"
  return ""
}

function slotLabel(slot: string): string {
  const clean = String(slot || "").replace(/_/g, " ")
  if (!clean) return ""
  return clean.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function skillSlotLabel(slot: string): string {
  switch (slot) {
    case "special_skill":
      return "Secret Skill"
    case "special_skill_attack":
      return "Attack Secret"
    case "special_skill_support":
      return "Support Secret"
    case "special_skill_sub":
      return "Secret Variant"
    case "leader_skill":
      return "Protection"
    case "bless_skill":
      return "Protection Skill"
    case "assist_leader_skill":
      return "Support"
    case "active_skill_1":
      return "Active Skill 1"
    case "active_skill_2":
      return "Active Skill 2"
    case "active_skill_3":
      return "Ultimate Manifestation"
    default:
      return slotLabel(slot)
  }
}

function cleanDescriptionMarkup(value: unknown): string {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(?!\/?color\b)[^>]*>/gi, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n+[ \t]*/g, "\n")
    .trim()
}

function formatDescription(text: unknown): string {
  return cleanDescriptionMarkup(text)
    .replace(/\s+\[Skill Chain\]\s*/g, "\n[Skill Chain]\n")
    .replace(/\s+(Chain\s+\d+:)/g, "\n$1")
    .replace(/\s+(All Skill Chain\s+\d+)/g, "\n$1")
    .replace(/\)\s+(?=(?:Increases|Decreases|Changes|Inflicts|Unleashes|Use|Applies|Grants)\b)/g, ")\n")
    .replace(/;\s+(?=Effect increases\b)/g, "\n")
    .trim()
}

function renderBadge(text: string): string {
  const clean = text.replace(/^\(|\)$/g, "").replace(/^Turns:\s*/i, "Turns ").trim()
  if (/^(Once per turn|available in support formation)$/i.test(clean)) {
    return `<span class="rich-note">${escapeHtml(clean)}</span>`
  }

  const turnsMatch = clean.match(/^Turns\s+(\d+)(.*)$/i)
  if (turnsMatch) {
    return `<span class="rich-badge"><span class="badge-label">Turns</span><span class="badge-value">${escapeHtml(
      turnsMatch[1],
    )}</span>${turnsMatch[2] ? `<span class="badge-rest">${renderRichInline(turnsMatch[2].trim())}</span>` : ""}</span>`
  }

  const usesMatch = clean.match(/^(Uses by this character per battle:\s*)(\d+)$/i)
  if (usesMatch) {
    return `<span class="rich-badge"><span class="badge-label">${escapeHtml(
      usesMatch[1],
    )}</span><span class="badge-value">${escapeHtml(usesMatch[2])}</span></span>`
  }

  return `<span class="rich-badge"><span class="badge-label">${renderRichInline(clean)}</span></span>`
}

function richTokenHtml(token: string): string {
  const statMatch = token.match(/^([PM]-)?(ATK|DEF|HP)$/i)
  if (statMatch) {
    const stat = statMatch[2].toUpperCase()
    const prefix = statMatch[1]?.toUpperCase() || ""
    const statIcon = inlineStatIconMap[stat.toLowerCase()]
    const prefixIcon = prefix === "P-" ? attackTypeIcons.physical : prefix === "M-" ? attackTypeIcons.magic : ""
    return `<span class="rich-chip stat">${prefixIcon ? img(prefixIcon, prefix) : ""}${
      prefix ? `<span>${escapeHtml(prefix)}</span>` : ""
    }${statIcon ? img(statIcon, stat) : ""}<span>${stat}</span></span>`
  }

  const elementKey = normalizeLabel(token)
  if (inlineElementIconMap[elementKey]) {
    return `<span class="rich-chip element">${img(inlineElementIconMap[elementKey], token)}<span>${escapeHtml(
      token,
    )}</span></span>`
  }

  if (/^(?:x\d+(?:\.\d+)?|-?\d+(?:\.\d+)?%|\d+)$/.test(token)) {
    return `<strong class="rich-value">${escapeHtml(token)}</strong>`
  }

  return escapeHtml(token)
}

function renderRichInlineText(text: string): string {
  const escapedParts: string[] = []
  const tokenPattern =
    /(\b(?:(?:[PM]-?)?ATK|DEF|HP)\b|\b(?:fire|water|earth|wind|dark|light|holy|space|air)(?=\+|\s+(?:attribute|ATK|DEF|damage|characters))|x\d+(?:\.\d+)?|-?\d+(?:\.\d+)?%|\b\d+\b)/gi
  let last = 0
  let match: RegExpExecArray | null
  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > last) escapedParts.push(escapeHtml(text.slice(last, match.index)))
    escapedParts.push(richTokenHtml(match[0]))
    last = tokenPattern.lastIndex
  }
  if (last < text.length) escapedParts.push(escapeHtml(text.slice(last)))
  return escapedParts.join("")
}

function renderRichInline(text: string): string {
  const chunks: string[] = []
  const colorPattern = /<color=([^>]+)>(.*?)<\/color>/gi
  let last = 0
  let match: RegExpExecArray | null
  while ((match = colorPattern.exec(text)) !== null) {
    if (match.index > last) chunks.push(renderRichInlineText(text.slice(last, match.index)))
    const color = String(match[1] || "").toLowerCase()
    const tone = color.includes("ffff00") || color.includes("yellow") ? "force" : "value"
    chunks.push(`<strong class="rich-color ${tone}">${renderRichInlineText(match[2])}</strong>`)
    last = colorPattern.lastIndex
  }
  if (last < text.length) chunks.push(renderRichInlineText(text.slice(last)))
  return chunks.join("")
}

function renderRichDescription(text: unknown): string {
  const lines = formatDescription(text).split(/\n+/).filter(Boolean)
  if (!lines.length) return ""

  return `<div class="rich-desc">${lines
    .map((line) => {
      const clean = line.trim()
      if (/^\[.*\]$/.test(clean)) return `<p class="rich-heading">${escapeHtml(clean.replace(/^\[|\]$/g, ""))}</p>`

      const chunks: string[] = []
      const badgePattern =
        /(\([^)]*(?:Turns|Uses by this character per battle|Once per turn|available in support formation|Max|Unlimited|Cannot)[^)]*\)|\bUnlimited\b)/gi
      let last = 0
      let match: RegExpExecArray | null
      while ((match = badgePattern.exec(clean)) !== null) {
        if (match.index > last) chunks.push(renderRichInline(clean.slice(last, match.index)))
        chunks.push(renderBadge(match[0]))
        last = badgePattern.lastIndex
      }
      if (last < clean.length) chunks.push(renderRichInline(clean.slice(last)))
      return `<p>${chunks.join("")}</p>`
    })
    .join("")}</div>`
}

/* ======================================================================
   grouping — skills + traits (ported verbatim from character-live.js)
   ====================================================================== */
type SkillGroup = { base: DetailSkill; variants: DetailSkill[]; labels: string[] }

function groupSkills(skills: DetailSkill[]): SkillGroup[] {
  const list = Array.isArray(skills) ? skills : []
  const used = new Set<number>()
  const groups: SkillGroup[] = []
  const specialAttack = list.find((skill) => skill.slot === "special_skill_attack")
  const specialSupport = list.find((skill) => skill.slot === "special_skill_support")
  const specialSub = list.find((skill) => skill.slot === "special_skill_sub")
  const ultimateManifest = list.find((skill) => skill.slot === "active_skill_3")

  list.forEach((skill, index) => {
    if (used.has(index)) return
    const variants: DetailSkill[] = [skill]
    const labels: string[] = []

    if (skill.slot === "special_skill") {
      labels.push("Base")
      ;(
        [
          [specialAttack, "Attack"],
          [specialSupport, "Support"],
          [specialSub, specialSub?.kind ? formatWikiLabel(specialSub.kind) : "Variant"],
        ] as [DetailSkill | undefined, string][]
      ).forEach(([variant, label]) => {
        if (!variant) return
        const variantIndex = list.indexOf(variant)
        if (variantIndex >= 0 && !used.has(variantIndex)) {
          variants.push(variant)
          labels.push(label)
          used.add(variantIndex)
        }
      })
    } else {
      const duplicateIndexes = list
        .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
        .filter(
          ({ candidate, candidateIndex }) =>
            candidateIndex !== index &&
            !used.has(candidateIndex) &&
            candidate.slot === skill.slot &&
            candidate.name === skill.name,
        )

      duplicateIndexes.forEach(({ candidate, candidateIndex }) => {
        variants.push(candidate)
        used.add(candidateIndex)
      })

      if (skill.slot === "active_skill_1" && ultimateManifest && ultimateManifest.name === skill.name) {
        const variantIndex = list.indexOf(ultimateManifest)
        if (variantIndex >= 0 && !used.has(variantIndex)) {
          variants.push(ultimateManifest)
          used.add(variantIndex)
        }
      }

      labels.push(
        ...variants.map((variant, variantIndex) => {
          if (variant.slot === "active_skill_3") return "Ultimate"
          if (variants.length === 1) return skillSlotLabel(variant.slot)
          if (variantIndex === 0) return "Base"
          if (variantIndex === variants.length - 1) return "Max"
          return `Variant ${variantIndex + 1}`
        }),
      )
    }

    used.add(index)
    groups.push({ base: skill, variants, labels })
  })

  return groups
}

type TraitGroup = { baseName: string; members: DetailTrait[] }

function traitBaseName(trait: DetailTrait): string {
  return String(trait.name || "").replace(/\s+Initial Conditions$/i, "")
}

function groupTraits(traits: DetailTrait[]): TraitGroup[] {
  const groups: TraitGroup[] = []
  const byName = new Map<string, TraitGroup>()
  ;(traits || []).forEach((trait) => {
    const baseName = traitBaseName(trait)
    if (!byName.has(baseName)) {
      const group: TraitGroup = { baseName, members: [] }
      byName.set(baseName, group)
      groups.push(group)
    }
    byName.get(baseName)!.members.push(trait)
  })
  return groups
}

function traitVariantLabel(trait: DetailTrait, index: number, total: number): string {
  if (trait.unlock) {
    if (trait.unlock === "Initial Conditions") return "Base"
    const match = trait.unlock.match(/Awaken\s+(\d+)\/5/i)
    if (match) return `${match[1]}/5`
    return trait.unlock
  }
  if (/Initial Conditions$/i.test(trait.name || "")) return "Base"
  if (total === 1) return "Trait"
  if (index === total - 1) return "Max"
  return `Rank ${index + 1}`
}

/* ======================================================================
   React cards — structure in JSX, rich inner markup via the string helpers
   ====================================================================== */
function VariantToggle({
  labels,
  active,
  onSelect,
}: {
  labels: string[]
  active: number
  onSelect: (index: number) => void
}) {
  if (labels.length <= 1) return null
  return (
    <div className="variant-toggle" role="tablist">
      {labels.map((label, index) => (
        <button
          key={index}
          type="button"
          className={`variant-btn ${index === active ? "is-active" : ""}`}
          aria-selected={index === active}
          onClick={() => onSelect(index)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function SkillCard({ group, characterRarity }: { group: SkillGroup; characterRarity: number }) {
  const initial =
    group.variants.length > 1 && group.base.slot !== "special_skill" ? group.variants.length - 1 : 0
  const [active, setActive] = useState(initial)

  return (
    <article className="chr-rowitem chr-detail-card">
      <span
        className={`ic ${/^special_skill/.test(group.base.slot || "") ? "is-special-skill" : ""}`}
        dangerouslySetInnerHTML={{ __html: skillIcon(group.base, characterRarity) }}
      />
      <div className="bd">
        <VariantToggle labels={group.labels} active={active} onSelect={setActive} />
        <div className="variant-panels">
          {group.variants.map((skill, index) => {
            const specialType = skill.specialSkillType || ""
            const changeType = skill.skillChangeType || ""
            const tags = [
              tag(skillSlotLabel(skill.slot), "slot"),
              specialType ? tag(specialType, tagTone(specialType)) : "",
              changeType ? tag(changeType, skillChangeClass(changeType)) : "",
              skill.cost != null ? tag(`Cost: ${skill.cost}`, "cost") : "",
            ].join("")
            return (
              <section key={index} className={`variant-panel ${index === active ? "is-active" : ""}`}>
                <div className="tt">
                  <h3>{skill.name}</h3>
                  <span className="tagline" dangerouslySetInnerHTML={{ __html: tags }} />
                </div>
                <div dangerouslySetInnerHTML={{ __html: renderRichDescription(skill.desc) }} />
              </section>
            )
          })}
        </div>
      </div>
    </article>
  )
}

function TraitCard({ group }: { group: TraitGroup }) {
  const initial = group.members.length > 1 ? group.members.length - 1 : 0
  const [active, setActive] = useState(initial)
  const labels = group.members.map((trait, index) => traitVariantLabel(trait, index, group.members.length))
  const activeMember = group.members[active] || group.members[0]

  return (
    <article className="chr-rowitem chr-detail-card chr-trait-card">
      <span
        className="ic"
        dangerouslySetInnerHTML={{ __html: activeMember?.icon ? img(activeMember.icon, group.baseName) : "" }}
      />
      <div className="bd">
        <div className="variant-panels">
          {group.members.map((trait, index) => (
            <section key={index} className={`variant-panel ${index === active ? "is-active" : ""}`}>
              <div className="tt">
                <h3>{group.baseName}</h3>
              </div>
              <div dangerouslySetInnerHTML={{ __html: renderRichDescription(trait.desc) }} />
            </section>
          ))}
        </div>
        <VariantToggle labels={labels} active={active} onSelect={setActive} />
      </div>
    </article>
  )
}

function ExCard({ ability }: { ability: DetailExAbility }) {
  const effectText =
    Array.isArray(ability.effects) && ability.effects.length
      ? `${ability.desc || ""}\n${ability.effects.join("\n")}`
      : ability.desc
  return (
    <article className="chr-rowitem chr-detail-card chr-ex-card">
      <span
        className="ic ex"
        dangerouslySetInnerHTML={{ __html: img(exAbilityIcon(ability), ability.name || "EX Ability") }}
      />
      <div className="bd">
        <div className="tt">
          <h3>{ability.name || "EX Ability"}</h3>
        </div>
        <div dangerouslySetInnerHTML={{ __html: renderRichDescription(effectText) }} />
      </div>
    </article>
  )
}

/* ======================================================================
   banner name splitting + size (character-live.js §banner)
   ====================================================================== */
function nameLines(name: string): string[] {
  const words = String(name || "").trim().split(/\s+/)
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2)
    return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")]
  }
  const word = words[0] || ""
  if (word.length >= 9) {
    const cut = Math.ceil(word.length / 2)
    return [word.slice(0, cut), word.slice(cut)]
  }
  return [word]
}

/* ======================================================================
   banner hero art — CharaCutin -> CharaInfo -> thumb fallback chain
   ====================================================================== */
function HeroArt({ character }: { character: DetailCharacter }) {
  const options = Array.from(new Set([cutinArtFor(character), character.art, character.thumb].filter(Boolean)))
  const [index, setIndex] = useState(0)
  const src = options[index]
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="chr-art"
      src={publicAsset(src)}
      alt={`${character.name} artwork`}
      onError={() => setIndex((i) => i + 1)}
    />
  )
}

/* ======================================================================
   the page
   ====================================================================== */
export function NightInkCharacterDetailClient({
  character,
  statMaxes,
  prev,
  next,
  recordIndex,
  recordTotal,
}: Props) {
  const [combatTab, setCombatTab] = useState<"skills" | "traits" | "ex">("skills")

  const lines = nameLines(character.name)
  const longest = Math.max(...lines.map((line) => line.length), 1)
  const nameSize = Math.min(118, Math.round(760 / (longest * 0.62)))

  const visualTier = visualTierFor(character)
  const starIcon = rarityIcons[visualTier]

  const idChips: Array<{ icon: string; label: string; cls?: string; href: string }> = [
    { icon: elementIcon(character.element), label: displayElement(character.element), href: archiveFilterUrl("attacker", character.element) },
    { icon: roleIcons[normalizeLabel(character.role)], label: character.role, href: archiveFilterUrl("role", character.role) },
    { icon: attackTypeIcons[normalizeLabel(character.type)], label: character.type, href: archiveFilterUrl("type", character.type) },
    { icon: weaponIcons[normalizeLabel(character.weapon)], label: character.weapon, href: archiveFilterUrl("weapon", character.weapon) },
    {
      icon: tacticsIcons[normalizeLabel(character.tactics)],
      label: character.tactics ? `${character.tactics} tactics` : "",
      cls: "is-tactics",
      href: archiveFilterUrl("tactics", character.tactics),
    },
    {
      icon: ultimateIcons[normalizeLabel(character.ultimate)],
      label: character.ultimate ? `${character.ultimate} ulti` : "",
      href: archiveFilterUrl("ultimate", character.ultimate),
    },
  ]
  const chipsHtml =
    (starIcon ? iconChipHtml(starIcon, `rarity ${visualTier}`, "is-rarity", archiveFilterUrl("rarity", visualTier)) : "") +
    idChips.map((chip) => iconChipHtml(chip.icon, chip.label, chip.cls || "", chip.href)).join("")

  const stats = character.stats
  const statRows = [
    { k: "Health", key: "hp" as const, v: stats.hp, color: "#34d399", hot: false },
    { k: "Attack", key: "attack" as const, v: stats.attack, color: "#f87171", hot: false },
    { k: "Defense", key: "defense" as const, v: stats.defense, color: "#60a5fa", hot: false },
    { k: "Existence", key: "existence" as const, v: stats.existence, color: "#d2453a", hot: true },
  ]

  const skillGroups = groupSkills(character.skills || [])
  const traitGroups = groupTraits(character.traits || [])
  const exAbilities = character.exAbilities || []
  const hasEx = exAbilities.length > 0

  const facilitiesHtml = (character.facilities || [])
    .map((name) => {
      const icon = facilityIconFor(name)
      return `<a class="ichip" href="${escapeHtml(archiveFilterUrl("facility", name))}" aria-label="Filter characters by ${escapeHtml(
        name,
      )}">${icon ? img(icon, "") : ""}<span>${escapeHtml(name)}</span></a>`
    })
    .join("")

  const forcesHtml =
    (character.forces || [])
      .map(
        (force) => `
  <a class="chr-force" href="${escapeHtml(archiveFilterUrl("force", force.name))}" aria-label="Filter characters by ${escapeHtml(
          force.name,
        )}">
    <span class="force-ic">${force.icon ? img(force.icon, force.name) : ""}</span>
    <span class="nm">${escapeHtml(force.name)}</span>
    <em>${escapeHtml(force.group || "force")}</em>
  </a>`,
      )
      .join("") || '<p class="cap">No forces recorded</p>'

  return (
    <main className="board v2 grain chr-board">
      <div className="v2-inner">
        {/* the "← Archive" back link lives in the global nav's left slot on
            character pages (see NightInkSiteNav) so it shares the nav row */}
        <section className="chr-banner" aria-label="Character identity">
          <span className="nf-ring nf-ring-banner" aria-hidden="true" />
          <div className="chr-blueprint" aria-hidden="true">
            <i className="bp-circle" />
            <i className="bp-cross bp-cross-a" />
            <i className="bp-cross bp-cross-b" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="chr-banner-splat m-a" src="/nightink/splatter/explosion-red.png" alt="" aria-hidden="true" />
          <HeroArt character={character} />
          <div className="chr-copy">
            <span className="cap chr-kicker">Playable character archive &middot; № {character.id}</span>
            <h1 className="chr-name" style={{ "--chr-name-size": `${nameSize}px` } as CSSProperties}>
              {lines.map((line, i) => (
                <span key={i}>{line}</span>
              ))}
            </h1>
            <p className="chr-subtitle">{character.title || ""}</p>
            <div className="chr-idchips" dangerouslySetInnerHTML={{ __html: chipsHtml }} />
          </div>
        </section>

        <section className="chr-row1" aria-label="Battle stats and forces">
          <div className="v2-pod chr-stats">
            <span className="v2-tab">Battle</span>
            <div className="chr-statgrid">
              {statRows.map((stat) => {
                const value = Number(stat.v || 0)
                const max = Number(statMaxes[stat.key] || 1)
                const percent = Math.min(100, Math.max(0, Math.round((value / max) * 100)))
                return (
                  <div
                    key={stat.key}
                    className={`chr-stat ${stat.hot ? "is-existence" : ""}`}
                    style={{ "--stat-color": stat.color, "--stat-pct": `${percent}%` } as CSSProperties}
                  >
                    <span className="stat-head" dangerouslySetInnerHTML={{ __html: `${img(statIcons[stat.key], stat.k)}<span class="k">${escapeHtml(stat.k)}</span>` }} />
                    <span className="v">{value.toLocaleString("en-US")}</span>
                    <span className="stat-bar">
                      <i />
                    </span>
                    <span className="stat-note">{percent}% of archive max</span>
                  </div>
                )
              })}
            </div>
            <div className="chr-statfoot">
              <span className="cap">
                Released {character.release || "—"} &middot; Rarity {character.rarity}★ &middot; {character.role || ""}
              </span>
              <div className="chr-facilities" dangerouslySetInnerHTML={{ __html: facilitiesHtml }} />
            </div>
          </div>

          <aside className="v2-pod chr-forces">
            <div
              className="v2-bridge h"
              style={{ left: -27, width: 28, top: 44, height: 44 }}
              aria-hidden="true"
            >
              <i className="tl" />
              <i className="tr" />
              <i className="bl" />
              <i className="br" />
            </div>
            <span className="v2-tab alt">Forces</span>
            <div className="chr-forcelist" dangerouslySetInnerHTML={{ __html: forcesHtml }} />
          </aside>
        </section>

        <section className="v2-pod chr-combat" aria-label="Combat data">
          <div
            className="v2-bridge v"
            style={{ top: -27, height: 28, left: 110, width: 84 }}
            aria-hidden="true"
          >
            <i className="tl" />
            <i className="tr" />
            <i className="bl" />
            <i className="br" />
          </div>
          <span className="v2-tab">Combat</span>
          <div className="chr-combat-head">
            <span className="cap">Combat Data</span>
          </div>
          <div className="chr-tabs" role="tablist" aria-label="Combat data sections">
            <button
              className={`chr-tabbtn ${combatTab === "skills" ? "is-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={combatTab === "skills"}
              onClick={() => setCombatTab("skills")}
            >
              Skills
            </button>
            <button
              className={`chr-tabbtn ${combatTab === "traits" ? "is-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={combatTab === "traits"}
              onClick={() => setCombatTab("traits")}
            >
              Traits
            </button>
            {hasEx && (
              <button
                className={`chr-tabbtn ${combatTab === "ex" ? "is-active" : ""}`}
                type="button"
                role="tab"
                aria-selected={combatTab === "ex"}
                onClick={() => setCombatTab("ex")}
              >
                EX Abilities
              </button>
            )}
          </div>
          <div className="chr-tabpanels">
            <div className={`chr-tabpanel ${combatTab === "skills" ? "is-active" : ""}`} role="tabpanel">
              <div className="chr-rows">
                {skillGroups.length ? (
                  skillGroups.map((group, i) => (
                    <SkillCard key={i} group={group} characterRarity={character.rarity} />
                  ))
                ) : (
                  <p className="cap">No skills recorded</p>
                )}
              </div>
            </div>
            <div className={`chr-tabpanel ${combatTab === "traits" ? "is-active" : ""}`} role="tabpanel">
              <div className="chr-rows">
                {traitGroups.length ? (
                  traitGroups.map((group, i) => <TraitCard key={i} group={group} />)
                ) : (
                  <p className="cap">No traits recorded</p>
                )}
              </div>
            </div>
            {hasEx && (
              <div className={`chr-tabpanel ${combatTab === "ex" ? "is-active" : ""}`} role="tabpanel">
                <div className="chr-rows chr-ex-grid">
                  {exAbilities.map((ability, i) => (
                    <ExCard key={i} ability={ability} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="v2-dockbar chr-dock">
          {prev ? (
            <Link className="page-btn" href={`/characters/${prev.id}`} title={`${prev.name} · ${prev.title}`}>
              &larr; Prev
            </Link>
          ) : (
            <span className="page-btn is-disabled">&larr; Prev</span>
          )}
          <Link className="page-btn chr-dock-back" href="/characters">
            Archive
          </Link>
          {next ? (
            <Link className="page-btn" href={`/characters/${next.id}`} title={`${next.name} · ${next.title}`}>
              Next &rarr;
            </Link>
          ) : (
            <span className="page-btn is-disabled">Next &rarr;</span>
          )}
          <span className="upp">
            Record {recordIndex} / {recordTotal}
          </span>
        </div>
      </div>
    </main>
  )
}
