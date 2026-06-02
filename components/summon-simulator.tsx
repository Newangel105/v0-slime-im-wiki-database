"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import type { SummonBanner, SummonBucket, SummonCharacter, SummonLottery, SummonPayload, SummonPointSelection } from "@/lib/summon-data"
import { PrefabLayer } from "@/components/prefab-layer"
import { TenslafontText } from "@/components/tenslafont-text"
import { LotteryParticles } from "@/components/lottery-particles"
import { PrefabTree, DesignBoxFit, getNodeBoundingBox } from "@/components/prefab-tree"
import { PREFAB_TREES, PREFAB_DESIGN, subtreeAt } from "@/lib/summon-ui/prefab-trees"
import {
  PROMOTION_GLOW_PARTICLES,
  CHARACTER_APPEAR_PARTICLES,
  characterAppearRarityEffectParticles,
  characterAppearBgParticles,
  CHARACTER_APPEAR_PARTICLE_MATERIALS,
  CHARACTER_APPEAR_PARTICLE_TRANSFORMS,
  CHARACTER_APPEAR_PARTICLE_FULL,
  CHARACTER_APPEAR_RARITY_EFFECT_ORIGINS,
  resultCardInEffectParticles,
  RESULT_PARTICLE_MATERIALS,
} from "@/lib/summon-ui/lottery-particle-data"
import { SPECS, SUMMON_UI_BASE, VIEW_RULES } from "@/lib/summon-ui/specs"
import { mediaUrl } from "@/lib/media-cdn"
import type { CharacterAppearViewRarity, PromotionViewRarity, ResultCardRarityKey, PrefabSpec } from "@/lib/summon-ui/specs"
import promotionBindingsRaw from "@/lib/summon-ui/lottery_runtime_data/UILotteryPromotion.bindings.json"
import analysisCutPrerenderRaw from "@/lib/summon-ui/lottery_runtime_data/analysis_cut_prerender_manifest.json"
import promotionPrerenderRaw from "@/lib/summon-ui/lottery_runtime_data/promotion_prerender_manifest.json"
import characterAppearVfxPrerenderRaw from "@/lib/summon-ui/lottery_runtime_data/character_appear_vfx_prerender_manifest.json"
import tenslafontMaterialsRaw from "@/lib/summon-ui/lottery_runtime_data/Tenslafont_materials.json"
import resultRender from "@/lib/summon-ui/lottery_runtime_data/result_render.json"
import characterAppearAnim from "@/lib/summon-ui/lottery_runtime_data/character_appear_anim.json"
import resultDecorationAnimation from "@/lib/summon-ui/lottery_runtime_data/result_decoration_animation.json"
import characterAppearPostprocess from "@/lib/summon-ui/lottery_runtime_data/character_appear_postprocess.json"
// Per-Image GPU blend state (extracted from each prefab's Material →
// Shader Pass rtBlend0). PrefabTree picks the right CSS mix-blend-mode
// per node from these — no name heuristics. See
// _work/extract_{appear,result}_image_materials.py.
import characterAppearImageMaterials from "@/lib/summon-ui/lottery_runtime_data/character_appear_image_materials.json"
import resultImageMaterials from "@/lib/summon-ui/lottery_runtime_data/result_image_materials.json"
import characterAppearPerRaritySwaps from "@/lib/summon-ui/lottery_runtime_data/character_appear_per_rarity_swaps.json"
// G: per-character offset/scale for the charaModel placement, extracted
// from the PcDetailCharaDisplaySetting ScriptableObject referenced by each
// MasterPcMaterial.pc_detail_setting_path. See
// _work/extract_pcdetail_charadisplay_settings.py.
import pcDetailCharaDisplaySettings from "@/lib/summon-ui/lottery_runtime_data/pcdetail_charadisplay_settings.json"
// G: per-character MasterPcMaterial CharacterAppear fields (offset_x_for_detail
// is on this table too — runtime applies it after PcDetailCharaDisplaySetting).
// See Slime_Extractor/generate_character_appear_manifest.py.
import characterAppearMasterManifest from "@/lib/summon-ui/lottery_runtime_data/character_appear_master_manifest.json"
// G.2: per-rarity full-keyframe curves for container/charaModel/d2Container +
// container/charaModel/d2Container/d2 from each Appear<rarity> AnimationClip
// muscle clip. Drives the charaModel slide-in + scale-pop + fade-in via WAAPI.
// See _work/extract_charamodel_anim_curves.py.
import characterAppearCharamodelCurves from "@/lib/summon-ui/lottery_runtime_data/character_appear_charamodel_curves.json"
// Pass-15g: FULL per-path streamedClip curves for every animated UI property
// in each Appear<rarity> clip (m_Color RGBA / m_LocalScale / m_AnchoredPosition
// / m_IsActive / m_Alpha for ~100 paths each). Decoded by
// _work/extract_character_appear_all_curves.py from the Animator's m_MuscleClip.
// Used to drive the rarity star sprites (per-rarity tint over time, alpha
// fade-in at the pop moment), the rarityNEffect burst container visibility
// (m_IsActive curve gates "appear at pop, disappear after"), and the
// rarityNEffect/effect flash. Supersedes the partial character_appear_anim.json
// for rarity star data.
import characterAppearAllCurves from "@/lib/summon-ui/lottery_runtime_data/character_appear_all_curves.json"
// XIUIThumbReward sprite mappings — extracted from UILotteryResult/.../thumbReward
// MonoBehaviour typetrees (XIUIImageChanger.spriteList + XIUIRarityStar
// .raritySpriteList). Each spriteList is indexed by `ui_thumb.rarity_index`
// (0..37; index = rarity + arousal_tier_offset * 10, where Special=10,
// SpecialPlus=20, Epic=30). See _work/extract_bless_thumbreward_mappings.py
// + normalize_bless_thumbreward_mappings.py.
import thumbRewardSpriteMappings from "@/lib/summon-ui/lottery_runtime_data/thumbreward_sprite_mappings.json"
import type { ImageMaterialsJson, RaritySwapsJson, RaritySwapEntry } from "@/components/prefab-tree"
import {
  characterAppearRarityFor,
  promotionViewRarityFor,
  resultCardRarityKeyFor,
  nameplateSpritesFor,
  backgroundSpritesFor,
  starCountFor,
  characterAppearEfViewHideList,
  characterAppearSSRUltimateParticleVisible,
  characterAppearHideList,
} from "@/lib/summon-ui/lottery-rarity"
import itemIcons from "@/lib/item-icons.generated.json"
import { fetchAnnouncements, readAnnouncementsSync } from "@/lib/announcement-cache"

const ITEM_ICONS = itemIcons as Record<string, string>

type DrawKind = "single" | "multi"

type SummonResult = {
  id: string
  bucket: SummonBucket
  character: SummonCharacter | null
  groupId: number
  position: number
}

type PointItem = {
  master_lottery_point_item_id?: number
  master_ogc_lottery_shop_id?: number
  max_limit?: number
  exchange_rate?: number
  exchange_master_reward_group_id?: number
  exchange_release_label?: string
  release_label?: string
}

type AnnouncementArticle = {
  id: string
  title: string
  category: string
  isNew: boolean
  endDate: string
  href: string
  headerClass: string
  tabCategory: string
  articleType: string
}

const OFFICIAL_ANNOUNCEMENT_ORIGIN = "https://api.ten-sura-m.wfs.games"

const DEFAULT_UI_ASSETS = {
  gem_icon: ["/Image/Item/Gem/3000001/gem_3000001_ItemL.png"],
  question_icon: ["/UI/Texture/CommonEtcAtlas/btnQuestionNormal.webp"],
  character_details_icon: [],
  switch_icon: ["/UI/Texture/CharaInfoAtlas/btnChangeNormal.webp"],
  trade_icon: ["/UI/Texture/CommonAtlas/btnExchangeNormal.png"],
  close_icon: ["/UI/Texture/OutAtlas/btnMenuCloseNormal.png", "/UI/Texture/CommonAtlas/btnCloseNormal.png"],
  exchange_item_icon: ["/Image/Item/Exchange/2400013/exchange_item_2400013_ItemL.png"],
  carousel_arrow_left: ["/UI/Texture/CommonAtlas/btnScrollArrowL.png", "/UI/Texture/OutAtlas/simpleArrowL.png"],
  carousel_arrow_right: ["/UI/Texture/CommonAtlas/btnScrollArrowR.png", "/UI/Texture/OutAtlas/simpleArrowR.png"],
}

const COMMON_RARITY = "/UI/Texture/CommonRarityAtlas"
const COMMON_ATLAS = "/UI/Texture/CommonAtlas"
const LOTTERY_INFO_ATLAS = "/UI/Texture/CommonLotteryInfoPanelAtlas"
const GAME_TEXT_IVORY = "#fffaf0"
const GAME_TEXT_DARK = "#1e1d1b"
const RECRUIT_TEXT_IVORY = "#efe0bc"
const BUTTON_PATTERN = `${SUMMON_UI_BASE}/4b134293ed93cc5f.png`

const MEMBER_RARITY_ASSETS: Record<number, { base: string; frame: string; star: string }> = {
  3: { base: "baseMemberM3", frame: "frameMemberM3", star: "starCharaS3_Alphabet" },
  4: { base: "baseMemberM4", frame: "frameMemberM4", star: "starCharaS4_Alphabet" },
  5: { base: "baseMemberM5", frame: "frameMemberM5", star: "starCharaS5_Alphabet" },
  6: { base: "baseMemberM6", frame: "frameMemberM6", star: "starCharaS6_Alphabet" },
  7: { base: "baseMemberM6", frame: "frameMemberM6", star: "starCharaS7_Alphabet" },
  15: { base: "baseMemberM5_Special", frame: "frameMemberM5_Special", star: "starCharaS5_Special_Alphabet" },
  16: { base: "baseMemberM6_Special", frame: "frameMemberM6_Special", star: "starCharaS6_Special_Alphabet" },
  17: { base: "baseMemberM6_Special", frame: "frameMemberM6_Special", star: "starCharaS7_Special_Alphabet" },
  25: { base: "baseMemberM5_SpecialPlus", frame: "frameMemberM5_SpecialPlus", star: "starCharaS5_SpecialPlus_Alphabet" },
  26: { base: "baseMemberM6_SpecialPlus", frame: "frameMemberM6_SpecialPlus", star: "starCharaS6_SpecialPlus_Alphabet" },
  27: { base: "baseMemberM6_SpecialPlus", frame: "frameMemberM6_SpecialPlus", star: "starCharaS7_SpecialPlus_Alphabet" },
  36: { base: "baseMemberM7_Epic", frame: "frameMemberM7_Epic", star: "starCharaS6_Epic_Alphabet" },
  37: { base: "baseMemberM7_Epic", frame: "frameMemberM7_Epic", star: "starCharaS7_Epic_Alphabet" },
}

// Typed view of the extracted XIUIThumbReward sprite mappings (see
// thumbreward_sprite_mappings.json header for the index scheme).
type ThumbRewardSpriteMappings = {
  base_sprite_by_rarity_index: { Chara: Record<string, string>; Bless: Record<string, string> }
  frame_sprite_by_rarity_index: { Chara: Record<string, string>; Bless: Record<string, string> }
  rarity_star_sprites: string[]
  limit_break_star_sprites: string[]
  element_sprite_by_index: Record<string, string>
  attack_type_sprite_by_index: Record<string, string>
}
const THUMB_SPRITE_MAPPINGS = thumbRewardSpriteMappings as ThumbRewardSpriteMappings

// Look up a per-thumbType base+frame sprite name pair via the extracted
// XIUIImageChanger.spriteList. Returns undefined if the index isn't in the
// extracted map — caller treats that as a HARD DEBUG BLOCKER (no fallback
// rendering, per audit rule "keep a small fallback only as a hard error/
// debug blocker, not as accepted rendering").
function blessSpritesForRarityIndex(rarityIndex: number): { base: string; frame: string } | null {
  const base = THUMB_SPRITE_MAPPINGS.base_sprite_by_rarity_index.Bless[String(rarityIndex)]
  const frame = THUMB_SPRITE_MAPPINGS.frame_sprite_by_rarity_index.Bless[String(rarityIndex)]
  if (!base || !frame) return null
  return { base, frame }
}

// XIUIThumbReward.Bless child RectTransforms — pulled verbatim from
// `prefab_out/UILotteryResult.json` thumbReward subtree, converted to
// percentages of the 256×256 thumb container. anchorMin/Max [0.5,0.5] with
// `anchoredPosition` is relative to thumb CENTER; pivot [0.5,0.5] means the
// position is the icon CENTER. Unity Y-up → CSS Y-down conversion applied
// (top = 128 - aPos.y - size/2).
//
// Source verification: `_work/decode_uiroot_animator_fsm.py`-style typetree
// inspection of UILotteryResult prefab tree at path
// .../resultTemplate/container/cardContainer/thumbReward/<child>.
const BLESS_THUMB_RECT_PCT = {
  // IcElementBless: 64×64, center at (+96, +96) from thumb center → CSS center (224, 32).
  icElementBless: { leftPct: (224 - 32) / 256 * 100, topPct: (32 - 32) / 256 * 100, widthPct: 64 / 256 * 100, heightPct: 64 / 256 * 100 },
  // IcElementBless2: 60×60, center at (+96, +34) → CSS center (224, 94).
  icElementBless2: { leftPct: (224 - 30) / 256 * 100, topPct: (94 - 30) / 256 * 100, widthPct: 60 / 256 * 100, heightPct: 60 / 256 * 100 },
  // starLimitBreakBaseBless: 198×36, bottom-left anchored at (+27, +7) → CSS left 27, top 256-7-36=213.
  starLimitBreakBaseBless: { leftPct: 27 / 256 * 100, topPct: (256 - 7 - 36) / 256 * 100, widthPct: 198 / 256 * 100, heightPct: 36 / 256 * 100 },
} as const

// Bless limit-break stars use the SAME RESULT_LIMIT_BREAK_HLG layout as Chara
// (the limitBreakChara node is shared at the prefab level — XIUILimitBreakStar
// renders the same way regardless of thumbType). The starLimitBreakBaseBless
// plate just sits behind it at a slightly different offset (aPos +27 vs +7
// for the Chara plate).

// Verified against the actual game assets: 001=Neutral, 002=Speed,
// 003=Defense, 004=Charge, 005=All-rounder. The label is baked into the
// sprite, so it's shown as-is (no text overlay / recolouring).
const TACTICS_ICON: Record<string, string> = {
  Normal: "/L10NAssets/En/Image/Tactics/tactics_001.webp",
  Neutral: "/L10NAssets/En/Image/Tactics/tactics_001.webp",
  Speed: "/L10NAssets/En/Image/Tactics/tactics_002.webp",
  Defense: "/L10NAssets/En/Image/Tactics/tactics_003.webp",
  Charge: "/L10NAssets/En/Image/Tactics/tactics_004.webp",
  All: "/L10NAssets/En/Image/Tactics/tactics_005.webp",
}

function withExtension(path?: string | null, extension = "png") {
  if (!path) return null
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "")
  if (!normalized) return null
  if (extension && !/\.[a-z0-9]+$/i.test(normalized)) return `${normalized}.${extension}`
  return normalized
}

function assetSources(path?: string | null, extension = "png") {
  const normalized = withExtension(path, extension)
  if (!normalized) return []
  if (normalized.startsWith("L10NAssets/")) return [`/${normalized}`]
  if (normalized.startsWith("Image/LotteryInfo/") || normalized.startsWith("Image/Item/LotteryTicket/")) {
    return [`/L10NAssets/En/${normalized}`, `/${normalized}`]
  }
  return [`/${normalized}`]
}

function characterImageSources(path?: string | null) {
  const normalized = withExtension(path, "webp")
  return normalized ? [`/${normalized}`] : []
}

function imageWebpSources(path?: string | null) {
  const normalized = withExtension(path, "webp")
  return normalized ? [`/${normalized}`] : []
}

function characterCardSources(character: SummonCharacter | null) {
  if (!character) return []
  // The row/card thumbnail in the game uses the party portrait inside the
  // rarity frame. CharaCard is a different cutout and leaves the wrong crop.
  return characterImageSources(character.images.icon || character.images.card || character.images.full)
}

function characterFullSources(character: SummonCharacter | null) {
  if (!character) return []
  return characterImageSources(character.images.full || character.images.card || character.images.icon)
}

function shopAssetSources(shopId: number, name: "LotteryBanner" | "LotteryCharacter" | "LotteryLogo" | "LotteryLoginNotice") {
  return [`/L10NAssets/En/Image/LotteryInfo/${shopId}/${name}_${shopId}.png`, `/Image/LotteryInfo/${shopId}/${name}_${shopId}.png`]
}

function uniqueBackgroundSources(shopId: number) {
  return [`/Image/LotteryInfo/LotteryBg/unique/${shopId}/LotteryBgUnique_${shopId}.png`]
}

function sourcesOr(sources: string[] | null | undefined, fallback: string[]) {
  // `undefined` (key absent from the data) → use the legacy fallback path.
  // `null` or `[]` (explicitly cleared by the data generator because no asset
  // exists for this banner) → return empty so the website doesn't fire 404s.
  if (sources === undefined) return fallback
  if (sources === null) return []
  return sources.length ? sources : []
}

function preferNonLocalizedFallback(sources: string[]) {
  return [...sources].sort((a, b) => Number(a.startsWith("/L10NAssets/")) - Number(b.startsWith("/L10NAssets/")))
}

function cleanLabel(value: string | null | undefined) {
  if (!value) return "Recruit"
  return value
    .replace(/^20\d{4}_/, "")
    .replace(/_shop_pack_/g, "_")
    .replace(/_scout.*$/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeWords(value: string | null | undefined) {
  if (!value) return []
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

// Recruit "kind" keywords: a token in the banner's release_label -> the word
// the official announcement title uses for that recruit type.
const RECRUIT_KIND_TOKENS: Array<[RegExp, string]> = [
  [/premium|shop_pack|\bpack\b/, "premium"],
  [/troop/, "troop"],
  [/union/, "union"],
  [/arrival/, "arrival"],
  [/encounter/, "encounter"],
  [/selected/, "selected"],
  [/step[_-]?up|stepup/, "step"],
  [/daily/, "daily"],
  [/beginner|rookie/, "beginner"],
  [/ticket/, "ticket"],
]

type BannerSignature = {
  part: number | null
  anniversary: string | null
  star: number | null
  kinds: string[]
  names: string[]
}

function bannerSignature(banner: SummonBanner): BannerSignature {
  const raw = (banner.release_label || "").toLowerCase().replace(/^20\d{4}_/, "")
  const partMatch = raw.match(/part[_\s]?(\d+)/)
  const annivMatch = raw.match(/(\d+(?:[._]\d+)?)\s*(?:th|st|nd|rd)?[_\s]?anniversary/)
  const starMatch = raw.match(/(\d+)\s*star/) || raw.match(/(\d+)[_\s]?★/)
  const kinds = RECRUIT_KIND_TOKENS.filter(([re]) => re.test(raw)).map(([, word]) => word)
  const names: string[] = []
  for (const character of detailCharacters(banner)) {
    if (character.name) names.push(character.name.toLowerCase())
    if (character.affiliation_name) names.push(character.affiliation_name.toLowerCase())
  }
  return {
    part: partMatch ? Number(partMatch[1]) : null,
    anniversary: annivMatch ? annivMatch[1].replace("_", ".") : null,
    star: starMatch ? Number(starMatch[1]) : null,
    kinds,
    names,
  }
}

function titlePartNumber(title: string): number | null {
  const m = title.match(/part[\s]?(\d+)/i)
  return m ? Number(m[1]) : null
}

function scoreAnnouncementForBanner(article: AnnouncementArticle, sig: BannerSignature) {
  if (article.articleType !== "recruit" && article.articleType !== "scout") return -1000
  const title = article.title.toLowerCase()
  let score = 0

  // Part number is the strongest discriminator between sibling banners.
  if (sig.part !== null) {
    const tPart = titlePartNumber(title)
    if (tPart === sig.part) score += 70
    else if (tPart !== null) return -1000 // wrong part -> definitely not this banner
  }

  if (sig.anniversary && title.includes(sig.anniversary)) score += 25
  if (sig.star !== null && (title.includes(`${sig.star}★`) || title.includes(`${sig.star}star`) || title.includes(`${sig.star} star`))) {
    score += 30
  }
  for (const kind of sig.kinds) if (title.includes(kind)) score += 18

  let nameHit = false
  for (const name of sig.names) {
    if (name.length >= 3 && title.includes(name)) {
      score += 45
      nameHit = true
    }
  }
  if (nameHit) score += 10

  return score
}

function selectAnnouncementForBanner(articles: AnnouncementArticle[], banner: SummonBanner) {
  const sig = bannerSignature(banner)
  const ranked = articles
    .map((article) => ({ article, score: scoreAnnouncementForBanner(article, sig) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  if (!best || best.score < 55) return null
  // Require a clear winner so unrelated banners don't all collapse onto one article.
  const second = ranked[1]
  if (second && best.score - second.score < 12 && best.score < 90) return null
  return best.article
}

function officialAnnouncementUrl(article: AnnouncementArticle) {
  // Prefer the real article link scraped from the feed; fall back to the id-based path.
  const href = (article.href || "").trim()
  if (/^https?:\/\//i.test(href)) return href
  if (href.startsWith("/")) return `${OFFICIAL_ANNOUNCEMENT_ORIGIN}${href}`
  if (href) return `${OFFICIAL_ANNOUNCEMENT_ORIGIN}/${href}`
  return `${OFFICIAL_ANNOUNCEMENT_ORIGIN}/web/announcement/${encodeURIComponent(article.id)}?region=1&language=2&phoneType=1&assetVersion=`
}

function characterTitle(character: SummonCharacter | null) {
  if (!character) return "Reward Pool"
  return character.affiliation_name ? `[${character.affiliation_name}] ${character.name}` : character.name
}

function detailCharacters(banner: SummonBanner) {
  const seen = new Set<number>()
  const characters = [...(banner.detail_characters ?? []), ...banner.featured_characters]
  return characters.filter((character) => {
    if (seen.has(character.master_pc_id)) return false
    seen.add(character.master_pc_id)
    return true
  })
}

function findLottery(banner: SummonBanner, kind: DrawKind) {
  const candidates = banner.lotteries.filter((lottery) => (kind === "multi" ? lottery.reward_count >= 10 : lottery.reward_count === 1))
  return (
    candidates.find((lottery) => lottery.gem_cost > 0) ??
    candidates.find((lottery) => lottery.ticket_cost > 0) ??
    candidates[0] ??
    banner.lotteries[0]
  )
}

function replacementGroupForPosition(lottery: SummonLottery, position: number) {
  return lottery.replacement_rate_groups[String(position)] ?? lottery.master_ogc_lottery_rate_group_id
}

function pickBucket(buckets: SummonBucket[]) {
  const total = buckets.reduce((sum, bucket) => sum + Math.max(0, bucket.rate), 0)
  if (total <= 0) return buckets[0] ?? null
  let roll = Math.random() * total
  for (const bucket of buckets) {
    roll -= Math.max(0, bucket.rate)
    if (roll < 0) return bucket
  }
  return buckets[buckets.length - 1] ?? null
}

function pickCharacter(bucket: SummonBucket) {
  if (!bucket.characters.length) return null
  return bucket.characters[Math.floor(Math.random() * bucket.characters.length)] ?? null
}

function rollLottery(lottery: SummonLottery, count: number) {
  const results: SummonResult[] = []
  for (let index = 0; index < count; index += 1) {
    const position = index + 1
    const groupId = replacementGroupForPosition(lottery, position)
    const buckets = lottery.rate_groups[String(groupId)] ?? lottery.rate_groups[String(lottery.master_ogc_lottery_rate_group_id)] ?? []
    const bucket = pickBucket(buckets)
    if (!bucket) continue
    results.push({
      id: `${lottery.master_ogc_lottery_id}-${position}-${Math.random().toString(36).slice(2)}`,
      bucket,
      character: pickCharacter(bucket),
      groupId,
      position,
    })
  }
  return results
}

/** A lottery pays either gems or a ticket. Mirror the in-game button: gems when present, else the ticket. */
function costInfo(lottery: SummonLottery | undefined, uiAssets: SummonPayload["ui_assets"]) {
  const gemSources = uiAssets?.gem_icon?.length ? uiAssets.gem_icon : DEFAULT_UI_ASSETS.gem_icon
  if (!lottery) return { value: "", iconSources: gemSources, isTicket: false }
  if (lottery.gem_cost > 0) return { value: String(lottery.gem_cost), iconSources: gemSources, isTicket: false }
  if (lottery.ticket_cost > 0) {
    return {
      value: String(lottery.ticket_cost),
      iconSources: lottery.consume_item?.icon_sources?.length ? lottery.consume_item.icon_sources : gemSources,
      isTicket: true,
    }
  }
  return { value: "Free", iconSources: gemSources, isTicket: false }
}

function starPath(rarity: number) {
  const clamped = Math.max(3, Math.min(7, rarity))
  return `/UI/Texture/CommonRarityAtlas/starCharaS${clamped}.webp`
}

function elementIconSources(element?: string | null) {
  if (!element) return []
  return [`${LOTTERY_INFO_ATLAS}/icElement${element}.webp`]
}

// Bless protectors use a DIFFERENT sprite atlas for their element badges
// than attackers (the Chara `icElement<Name>` sprites in
// CommonLotteryInfoPanelAtlas are attacker-only). Bless sprites live at
// /Image/IcElementBless/IcElementBless<Name>.webp — same Name enum as the
// Chara element string but a separately authored visual.
function blessElementIconSources(element?: string | null) {
  if (!element) return []
  return [`/Image/IcElementBless/IcElementBless${element}.webp`]
}

function attackIconSources(attackType?: string | null) {
  if (!attackType) return []
  const name = attackType === "Physical" ? "Physics" : attackType
  return [`${COMMON_ATLAS}/icAttackType${name}.png`, `${LOTTERY_INFO_ATLAS}/icAttackType${attackType}.webp`]
}

function tacticsIconSources(character: SummonCharacter) {
  const key = character.master_strategy_type_group_label || character.tactics_type
  const icon = key ? TACTICS_ICON[key] : null
  return icon ? [icon, icon.replace("/L10NAssets/En", "")] : []
}

function forceIconSources(force: NonNullable<SummonCharacter["forces"]>[number]) {
  return imageWebpSources(force.icon_path)
}

function memberRarityAssets(character: SummonCharacter) {
  const index = character.ui_thumb?.rarity_index ?? character.ui_thumb?.display_rarity ?? character.rarity ?? 3
  return MEMBER_RARITY_ASSETS[index] ?? MEMBER_RARITY_ASSETS[character.ui_thumb?.display_rarity ?? character.rarity ?? 3] ?? MEMBER_RARITY_ASSETS[3]
}

function itemFrameSources(rarity?: number | null) {
  const clamped = Math.max(0, Math.min(5, rarity ?? 1))
  return [`${COMMON_RARITY}/itemRrarity${clamped}.webp`]
}

function pointItemFor(banner: SummonBanner): PointItem | null {
  const items = (banner.point_items ?? []) as PointItem[]
  return items.find((item) => item && (item.exchange_master_reward_group_id || item.max_limit)) ?? items[0] ?? null
}

function pointSelectionsFor(banner: SummonBanner) {
  return [...(banner.point_selections ?? [])].sort((a, b) => a.master_lottery_point_selection_id - b.master_lottery_point_selection_id)
}

function selectionTitle(selection: SummonPointSelection) {
  if (selection.character) return characterTitle(selection.character)

  const reward = selection.reward_rows?.[0]
  const qty = reward?.quantity && reward.quantity > 1 ? ` ×${reward.quantity.toLocaleString()}` : ""
  if (reward?.reward_item_id === 2405001) return `4.5th Anniversary Free Choice Ticket${qty}`
  if (reward?.reward_type === 7 && selection.ticket) return `Recruit Ticket${qty}`
  if (reward?.reward_type === 5) return `Magicrystal${qty || " ×1"}`
  if (reward && reward.reward_type !== 0) {
    // reward_type 1 = item (e.g. anniversary Free Choice Tickets). The game's
    // exact item name needs an item-name master that isn't in the extracted
    // data; show the real quantity, which is the distinguishing detail.
    return `Exchange Item${qty}`
  }
  return "Bazaar Exchange Reward"
}

function selectionIconSources(selection: SummonPointSelection, uiAssets: SummonPayload["ui_assets"]) {
  if (selection.character) {
    return characterCardSources(selection.character)
  }
  if (selection.ticket?.icon_sources?.length) return selection.ticket.icon_sources
  const reward = selection.reward_rows?.[0]
  if (reward?.item?.icon_sources?.length) return reward.item.icon_sources
  // Generic fallback: every game item icon is in the extracted manifest, so
  // any reward item id resolves dynamically regardless of its category.
  const id = reward?.reward_item_id
  const fromManifest = id != null ? ITEM_ICONS[String(id)] : undefined
  if (fromManifest) return [fromManifest]
  return []
}

function GameImage({
  sources,
  alt = "",
  className,
  style,
  onError,
}: {
  sources: Array<string | null | undefined>
  alt?: string
  className?: string
  style?: CSSProperties
  onError?: () => void
}) {
  const validSources = sources.filter(Boolean) as string[]
  const sourceKey = validSources.join("|")
  const [sourceIndex, setSourceIndex] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setSourceIndex(0)
    setFailed(false)
  }, [sourceKey])

  if (!validSources.length || failed) return null

  return (
    <img
      src={validSources[Math.min(sourceIndex, validSources.length - 1)]}
      alt={alt}
      className={className}
      style={style}
      onError={() => {
        if (sourceIndex < validSources.length - 1) {
          setSourceIndex((index) => index + 1)
        } else {
          setFailed(true)
          onError?.()
        }
      }}
    />
  )
}

// Plays a list of SE/BGM clips for a summon cutscene step. Mounts an <audio>
// element per source and triggers playback on mount. Sources are layered (all
// play simultaneously) — used so the per-rarity BGM fanfare + appear SE play
// together for CharacterAppear, and the single Cloak escalation SE plays for
// AnalysisCut. Autoplay relies on the user gesture that opened the cutscene
// (clicking the Recruit button) so browsers allow it.
function SummonSE({ sources, volume = 0.7 }: { sources: string[]; volume?: number }) {
  const refs = useRef<Array<HTMLAudioElement | null>>([])
  const key = sources.join("|")
  useEffect(() => {
    for (const el of refs.current) {
      if (!el) continue
      try {
        el.currentTime = 0
        el.volume = volume
        const p = el.play()
        if (p && typeof p.catch === "function") p.catch(() => {})
      } catch {
        /* autoplay blocked — ignore; the user gesture should have unlocked it */
      }
    }
  }, [key, volume])
  if (!sources.length) return null
  return (
    <>
      {sources.map((src, i) => (
        <audio
          key={src}
          ref={(el) => {
            refs.current[i] = el
          }}
          src={src}
          preload="auto"
        />
      ))}
    </>
  )
}

// Per-rarity SE mapping for the AnalysisCut (cloak) cutscene. The wiki always
// starts the cloak at R rarity and escalates to the highest result rarity, so
// only the R2X clips apply.
function cloakSEForFixRarity(fix: AnalysisCutViewRarity): string | null {
  switch (fix) {
    case "R": return "/Sound/Summon/UILotteryAnimationAnalysisCut/00_se_gasya_R2R.wav"
    case "SR": return "/Sound/Summon/UILotteryAnimationAnalysisCut/01_se_gasya_R2SR.wav"
    case "SSR": return "/Sound/Summon/UILotteryAnimationAnalysisCut/02_se_gasya_R2SSR.wav"
  }
  return null
}

// UILotteryPromotion ("hieroglyph rarity measurement") SE per
// (startRarity, fixRarity) pair. Game's XIUISEPlayer.seGroupList order on
// the prefab — verified against the extracted prefab in 2026-05-24:
//   [0] se_gasya_measurement_R           — current == R
//   [1] se_gasya_measurement_SR          — current == SR (stays SR)
//   [2] se_gasya_measurement_SSR         — current == SSR (stays SSR)
//   [3] se_gasya_measurement_SR2SSR      — SR -> SSR promotion
//   [4] se_gasya_3-0-0_measurement_ur2   — current == SSRUltimatePlusPU
//   [5] se_gasya_3-0-0_measurement_sr2ur2 — SR -> SSRUltimatePlusPU promotion
function promotionSEForRarity(start: PromotionViewRarity, fix: PromotionViewRarity): string | null {
  const base = "/Sound/Summon/UILotteryPromotion"
  if (start === fix) {
    switch (fix) {
      case "R": return `${base}/00_se_gasya_measurement_R.wav`
      case "SR": return `${base}/01_se_gasya_measurement_SR.wav`
      case "SSR": return `${base}/02_se_gasya_measurement_SSR.wav`
      case "SSRUltimatePlusPU": return `${base}/04_se_gasya_3-0-0_measurement_ur2.wav`
    }
  }
  if (start === "SR" && fix === "SSR") return `${base}/03_se_gasya_measurement_SR2SSR.wav`
  if (start === "SR" && fix === "SSRUltimatePlusPU") return `${base}/05_se_gasya_3-0-0_measurement_sr2ur2.wav`
  return null
}

// CharacterAppear plays a BGM fanfare + the per-rarity appear SE together.
// Layout matches the seGroupList order in the UILotteryCharacterAppear prefab:
//   [0] bgm_fanfare_gacha_get1 + [1] se_newappear_r        -> R
//   [2] bgm_fanfare_gacha_get2 + [3] se_newappear_sr       -> SR
//   [4] bgm_fanfare_gacha_get3 + [5] se_newappear_ssr      -> SSR
//   [6] bgm_fanfare_gacha_get3 + [7] se_newappear_ssrultimate -> SSRUltimate
//   [8] bgm_fanfare_gacha_get3 + [9] se_newappear_urex     -> UREx
//   [10] bgm_fanfare_gacha_get4 + [11] se_newappear_urultimate -> URUltimate
function characterAppearSEForRarity(rarity: CharacterAppearViewRarity): string[] {
  const base = "/Sound/Summon/UILotteryCharacterAppear"
  switch (rarity) {
    case "R": return [`${base}/00_bgm_fanfare_gacha_get1.wav`, `${base}/01_se_gasya_3-0-0_newappear_r.wav`]
    case "SR": return [`${base}/02_bgm_fanfare_gacha_get2.wav`, `${base}/03_se_gasya_3-0-0_newappear_sr.wav`]
    case "SSR": return [`${base}/04_bgm_fanfare_gacha_get3.wav`, `${base}/05_se_gasya_3-0-0_newappear_ssr.wav`]
    case "SSRUltimate": return [`${base}/06_bgm_fanfare_gacha_get3.wav`, `${base}/07_se_gasya_3-0-0_newappear_ssrultimate.wav`]
    case "UREx": return [`${base}/08_bgm_fanfare_gacha_get3.wav`, `${base}/09_se_gasya_4-0-0_newappear_urex.wav`]
    case "URUltimate": return [`${base}/10_bgm_fanfare_gacha_get4.wav`, `${base}/11_se_gasya_4-0-0_newappear_urultimate.wav`]
  }
  return []
}

function ButtonPatternFill({
  insetX = 6,
  insetY = 12.5,
  buttonW = 267,
  buttonH = 113,
}: {
  insetX?: number
  insetY?: number
  buttonW?: number
  buttonH?: number
}) {
  const innerW = Math.max(1, buttonW - 32)
  const innerH = Math.max(1, buttonH - 28)
  const fixedUvW = (512 / innerW) * 100
  const fixedUvH = (256 / innerH) * 100

  return (
    <span
      className="pointer-events-none absolute overflow-hidden"
      style={{ left: `${insetX}%`, right: `${insetX}%`, top: `${insetY}%`, bottom: `${insetY}%` }}
    >
      <img
        src={BUTTON_PATTERN}
        alt=""
        draggable={false}
        className="absolute left-0 top-0 max-w-none"
        style={{ width: `${fixedUvW}%`, height: `${fixedUvH}%` }}
      />
    </span>
  )
}

// thumbReward is the 256×256 sub-prefab inside resultTemplate/cardContainer.
// We derive every child position by walking the prefab JSON cascade at
// module load — no hardcoded percentages. Helper throws if a node is
// missing so a renamed prefab surfaces as a hard error, not a silent
// off-position render.
const THUMB_PREFAB_ROOT_PATH =
  "UILotteryResult/container/modalContainer/modalFront/resultList/resultTemplate/container/cardContainer/thumbReward"
const THUMB_SUBTREE = (() => {
  const sub = subtreeAt(PREFAB_TREES.result, THUMB_PREFAB_ROOT_PATH)
  if (!sub) throw new Error('UILotteryResult prefab is missing the thumbReward subtree at expected path')
  return sub
})()
const THUMB_DESIGN_SIZE: [number, number] = [256, 256]

function thumbChildRectPct(nodeLocalPath: string): { leftPct: number; topPct: number; widthPct: number; heightPct: number } {
  const fullPath = `${THUMB_PREFAB_ROOT_PATH}/${nodeLocalPath}`
  const box = getNodeBoundingBox(THUMB_SUBTREE, fullPath, THUMB_DESIGN_SIZE)
  const [dw, dh] = THUMB_DESIGN_SIZE
  return {
    leftPct: (box.left / dw) * 100,
    topPct: (box.top / dh) * 100,
    widthPct: (box.w / dw) * 100,
    heightPct: (box.h / dh) * 100,
  }
}

// All thumbReward positions used by the website. Each entry is computed
// from the prefab RectTransform cascade — no eyeballed values.
const THUMB_RECT_PCT = {
  starLimitBreakBaseChara: thumbChildRectPct("starLimitBreakBaseChara"),
  baseElement: thumbChildRectPct("baseElement"),
  icAttackType: thumbChildRectPct("icAttackType"),
  // The prefab's icElement node has sizeDelta [62, 0] driven by an
  // AspectRatioFitter at runtime. We compute its width from the prefab
  // (62/256 = 24.22%) and constrain height to width since the element
  // sprite is square.
  icElement_widthPct_only: (thumbChildRectPct("icElement").widthPct),
} as const

// Real Unity LayoutGroup data from the UILotteryResult prefab bundle (CAB
// 19b264defa7389e9a360f34d54e8cdc7, MonoBehaviour typetree read with UnityPy).
// We can't simulate full LayoutGroup behaviour through PrefabTree, but every
// child position the LG would compute is derivable from these fields — so the
// website overrides each child's top/left with the LG-derived value via
// nodeStyle, instead of falling back to the static prefab RectTransform.
//
//   badgeContainer (parent = cardContainer 256×256) :: VerticalLayoutGroup
//   - m_Padding: { Left:-35, Right:0, Top:-18, Bottom:0 }
//   - m_ChildAlignment: 0 (UpperLeft)
//   - m_Spacing: -12
//   - m_ChildControlWidth/Height = 0, m_ChildForceExpand* = 0, m_ChildScale* = 0
//   First child (icNew) is positioned with its top-left at
//   (paddingLeft, paddingTop) = (-35, -18) inside badgeContainer's local CSS
//   coords. Subsequent children stack downward with spacing -12 from the
//   previous child's bottom edge.
//
//   limitBreakChara (parent = thumbReward) :: HorizontalLayoutGroup
//   - m_Padding: { Left:90, Right:0, Top:0, Bottom:11 }
//   - m_ChildAlignment: 6 (LowerLeft)
//   - m_Spacing: -9
//   - same flags off as above
//   Each star (29×28) is positioned LowerLeft-aligned: star.bottom touches
//   container.height - padding.bottom, star1.left = padding.left = 90,
//   subsequent stars at +(29-9)=+20 step.
const RESULT_BADGE_VLG = {
  // VerticalLayoutGroup on the badgeContainer (children: icNew, badgeClassUp).
  // We hide badgeClassUp in v1 so icNew is the only visible child; its top-left
  // is therefore at exactly (paddingLeft, paddingTop) in badgeContainer-local
  // px. badgeContainer fills cardContainer (anchorMin=[0,0], anchorMax=[1,1]).
  padding: { left: -35, right: 0, top: -18, bottom: 0 },
  childAlignment: 0, // TextAnchor.UpperLeft
  spacing: -12,
} as const

const RESULT_LIMIT_BREAK_HLG = {
  // HorizontalLayoutGroup on limitBreakChara (children: star1..star5, 29×28).
  // ChildAlignment LowerLeft means star.bottom = container.height -
  // padding.bottom = 35 - 11 = 24 (CSS Y-down), and the row is left-aligned
  // starting at padding.left = 90. Spacing -9 → step = 29 - 9 = 20.
  padding: { left: 90, right: 0, top: 0, bottom: 11 },
  childAlignment: 6, // TextAnchor.LowerLeft
  spacing: -9,
  starSize: [29, 28] as const,
  containerSize: [256, 35] as const,
} as const

// Compute the icNew position the Unity VLG would yield, in cardContainer-
// local design-space px. badgeContainer has anchor stretch [0,0]→[1,1] so its
// box is identical to cardContainer's box. icNew is the FIRST (and only
// visible) child of the VLG, so its top-left is at (paddingLeft, paddingTop).
// We also have to neutralise the static prefab RectTransform (pivot=[0,1],
// anchor=[0,0]) so the override actually places the box at that top-left.
function icNewVlgStyle(): CSSProperties {
  const { left, top } = RESULT_BADGE_VLG.padding
  // The prefab's icNew is 51×84, pivot=[0,1]. With anchor=[0,0] and the
  // existing PrefabTree wrapper, we want the wrapper div's top-left at
  // (left, top) in badgeContainer-local CSS. PrefabTree already positions the
  // wrapper using its prefab-derived box; overriding `left` and `top` shifts
  // the wrapper directly. transform-origin and the localScale 1.8 stay as
  // PrefabTree computed them (pivot=[0,1] → top-left).
  return { left: `${left}px`, top: `${top}px` }
}

// --- Result UI decorationContainer/{topLight,underLight} AnimatorController
// keyframes. Real-source data: AnimationClip muscle-clip decoded from CAB
// 16b4e8f219d856a050fb1fc8f99ece2c (controller bundle for topLight + underLight
// Animators). Each clip is 33 seconds, looped infinitely, animating two
// curves on the lensFlare child (RectTransform 4000×600):
//   curve 0: m_AnchoredPosition.x (RectTransform typeID 224) — horizontal slide
//   curve 1: m_Alpha (CanvasGroup  typeID 225) — fade
// DecorationTopLight and DecorationUnderLight are mirror images (the x-position
// signs are flipped). See lottery_runtime_data/result_decoration_animation.json
// for the decoded keyframes.
type DecorationClipKeys = {
  type: "keys" | "const"
  data: [number, number][] | number | null
}
type DecorationClip = {
  stopTime: number
  sampleRate: number
  lensFlare_anchoredPosition_x: DecorationClipKeys
  lensFlare_canvasGroup_alpha: DecorationClipKeys
}
const DECORATION_ANIM = (resultDecorationAnimation as unknown as {
  controllers: Record<"DecorationTopLight" | "DecorationUnderLight", DecorationClip>
}).controllers

// Build WAAPI keyframes for the lensFlare translateX + opacity curves of a
// given controller name. Both curves play simultaneously; we merge them into
// one keyframe list keyed by offset and provide a unified transform+opacity
// frame at each sample point so the inherited transform stays a clean
// `translateX(px)` value (no scale conflict — lensFlare localScale is 1.0).
function buildLensFlareWAAPI(controllerName: "DecorationTopLight" | "DecorationUnderLight"): { keyframes: Keyframe[]; durationMs: number } {
  const clip = DECORATION_ANIM[controllerName]
  if (!clip) return { keyframes: [], durationMs: 0 }
  const duration = clip.stopTime
  const xCurve =
    clip.lensFlare_anchoredPosition_x.type === "keys"
      ? (clip.lensFlare_anchoredPosition_x.data as [number, number][])
      : []
  const aCurve =
    clip.lensFlare_canvasGroup_alpha.type === "keys"
      ? (clip.lensFlare_canvasGroup_alpha.data as [number, number][])
      : []
  // Use the union of sample times so each WAAPI keyframe carries both
  // transform and opacity values explicitly (avoids implicit interpolation
  // with mismatched offsets between the two channels).
  const times = Array.from(new Set([0, ...xCurve.map(([t]) => t), ...aCurve.map(([t]) => t), duration])).sort((a, b) => a - b)
  function valueAt(curve: [number, number][], t: number, fallback: number): number {
    if (!curve.length) return fallback
    if (t <= curve[0][0]) return curve[0][1]
    if (t >= curve[curve.length - 1][0]) return curve[curve.length - 1][1]
    for (let i = 0; i < curve.length - 1; i++) {
      const [t0, v0] = curve[i]
      const [t1, v1] = curve[i + 1]
      if (t >= t0 && t <= t1) {
        if (t1 === t0) return v1
        const ratio = (t - t0) / (t1 - t0)
        return v0 + (v1 - v0) * ratio
      }
    }
    return fallback
  }
  const keyframes: Keyframe[] = times.map((t) => {
    const x = valueAt(xCurve, t, 0)
    const a = Math.max(0, Math.min(1, valueAt(aCurve, t, 1)))
    return {
      offset: Math.max(0, Math.min(1, t / duration)),
      transform: `translateX(${x}px)`,
      opacity: a,
    }
  })
  return { keyframes, durationMs: Math.max(1, duration * 1000) }
}

// Real Bless (Protector) thumbType render path. Mirrors XIUIThumbReward.SetBless
// (RVA 0xA1FBAE8) which activates baseImageBless + frameImageBless +
// IcElementBless + IcElementBless2 + starLimitBreakBaseBless + the shared
// rarityStar HLG + limitBreakChara HLG; HIDES rarityChara + icElement +
// icAttackType + starLimitBreakBaseChara + baseElement.
//
// Data sources for this render:
// - `THUMB_SPRITE_MAPPINGS.base_sprite_by_rarity_index.Bless` /
//   `frame_sprite_by_rarity_index.Bless` — extracted from the prefab's
//   `baseImage` / `frameImage` XIUIImageChanger.spriteList typetrees
//   (see `_work/extract_bless_thumbreward_mappings.py` +
//   `normalize_bless_thumbreward_mappings.py`). Indexed by ui_thumb.rarity_index.
//   No naming-convention fallback — missing index renders a HARD DEBUG BLOCKER.
// - `THUMB_SPRITE_MAPPINGS.rarity_star_sprites` — XIUIRarityStar.raritySpriteList
//   = [starOff, starOn, starOn_Arousal], also extracted from the prefab typetree.
// - `BLESS_THUMB_RECT_PCT` — IcElementBless / IcElementBless2 /
//   starLimitBreakBaseBless positions, from prefab RectTransform reads.
// - `character.bless_element_icons.primary/secondary` — TWO element names
//   from generate_summon_data.py compact_character (sourced from
//   MasterBlessPc.master_leader_skill_element_type +
//   master_leader_skill_element_type_2).
// - `elementIconSources(element)` — existing resolver that maps element
//   name → `icElement<Element>.webp` from LotteryInfo atlas.
// - `RESULT_LIMIT_BREAK_HLG` — the same HorizontalLayoutGroup config used
//   by Chara's limit-break row (limitBreakChara is shared at prefab level).
function RuntimeThumbRewardBless({
  character,
  mode,
}: {
  character: SummonCharacter
  mode: "max" | "base"
}) {
  // Per-arousal/per-rarity classification — same formula as Chara
  // (MEMBER_RARITY_ASSETS index scheme). The result is `rarityIndex` (0..37)
  // used to look up the Bless base/frame sprite via the extracted
  // XIUIImageChanger.spriteList.
  const baseRarity = character.ui_thumb?.base_rarity ?? character.rarity ?? 3
  const arousalRaw = character.ui_thumb?.arousal_type_raw ?? 0
  const baseIndex =
    arousalRaw === 3 ? 30 + baseRarity :
    arousalRaw === 2 ? 20 + baseRarity :
    arousalRaw === 1 ? 10 + baseRarity :
    baseRarity
  // `mode="base"` uses the un-arousaled base rarity index (the lower-tier
  // visual, e.g. SR base for a 5★ unit displayed pre-evolution). `mode="max"`
  // uses the display_rarity index (post-evolution).
  const rarityIndex = mode === "base" ? baseIndex : (character.ui_thumb?.rarity_index ?? baseIndex)
  const sprites = blessSpritesForRarityIndex(rarityIndex) ?? blessSpritesForRarityIndex(baseIndex) ?? blessSpritesForRarityIndex(3)
  if (!sprites) {
    // HARD DEBUG BLOCKER: extracted mapping is missing this index. Render a
    // visible diagnostic so the gap surfaces immediately rather than silently
    // falling back to a naming-convention guess. Per audit rule: no accepted
    // rendering from convention.
    return (
      <div className="relative h-full w-full overflow-hidden" data-thumb-type="Bless" data-blocker="missing-sprite-index" style={{ background: "#7c1d3a", border: "2px dashed #ff8fc4" }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          <div className="font-serif font-extrabold text-[clamp(8px,1.4vw,16px)]" style={{ color: "#ffe2ef" }}>BLOCKER</div>
          <div className="mt-1 font-mono text-[clamp(6px,1vw,11px)]" style={{ color: "#ffe2ef" }}>thumbreward_sprite_mappings.json missing rarity index {rarityIndex}</div>
          <div className="mt-1 font-mono text-[clamp(5px,0.7vw,9px)]" style={{ color: "rgba(255,226,239,0.7)" }}>pcId {character.master_pc_id}</div>
        </div>
      </div>
    )
  }
  const limitBreakCount = mode === "base" ? 0 : Math.max(0, Math.min(5, character.ui_thumb?.limit_break_count ?? 0))
  const limitStars = Array.from({ length: 5 })
  const epicInset = sprites.frame === "frameBlessM7_Epic" ? "2.95%" : "0%"
  const baseMask = `url(${COMMON_RARITY}/${sprites.base}.webp)`

  const b = BLESS_THUMB_RECT_PCT
  const primaryEl = character.bless_element_icons?.primary ?? character.element ?? null
  const secondaryEl = character.bless_element_icons?.secondary ?? null
  const characterRarity = character.ui_thumb?.display_rarity ?? character.rarity ?? 3
  // XIUIRarityStar.raritySpriteList is `[starOff, starOn, starOn_Arousal]`
  // per the extracted prefab data (raritySpriteList typetree of the
  // rarityStar MonoBehaviour). Index 1 = filled star ("on"); index 2 =
  // arousal-tier variant. SetRarity (RVA 0xA18CAC0) uses raritySpriteList[2]
  // (Arousal) for the first `numRarityArousal` stars and raritySpriteList[1]
  // (On) for the rest, padded with raritySpriteList[0] (Off) for empty slots
  // up to rarityMax.
  const RARITY_STAR_SPRITES = THUMB_SPRITE_MAPPINGS.rarity_star_sprites
  const STAR_ON = RARITY_STAR_SPRITES[1] ?? "starOn"
  const STAR_ON_AROUSAL = RARITY_STAR_SPRITES[2] ?? STAR_ON
  const rarityStarCount = Math.max(0, Math.min(8, characterRarity))
  // arousal_type_raw=1+ ⇒ render arousal-variant stars (the awakened-tier look).
  const useArousalStarSprite = arousalRaw >= 1

  return (
    <div className="relative h-full w-full overflow-hidden" data-thumb-type="Bless">
      {/* baseImageBless under sprite mask (same A1 alpha-shape technique as Chara
          baseImageChara — sprite is the shape boundary, character art fills it). */}
      <div
        className="absolute overflow-hidden"
        style={{
          inset: epicInset,
          WebkitMaskImage: baseMask,
          WebkitMaskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskImage: baseMask,
          maskSize: "100% 100%",
          maskRepeat: "no-repeat",
        }}
      >
        <img src={`${COMMON_RARITY}/${sprites.base}.webp`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-fill" />
        <GameImage sources={characterCardSources(character)} className="absolute inset-0 h-full w-full object-fill" />
      </div>
      {/* starLimitBreakBaseBless — translucent plate behind the limit-break row.
          Bless plate is 198×36 at left+27/bottom+7 (vs Chara 212×36 at left+7/bottom+7).
          Prefab default is active=False (XIUIVisible.starLimitBreakBaseBless
          toggled by SetBless when entity.limitBreakCount > 0). For a fresh
          gacha pull limit_break_count == 0, so the plate stays hidden — see
          XIUIThumbReward.SetBless RVA 0xa158cf4 → 0xa158d50..0xa158d68. */}
      {limitBreakCount > 0 ? (
        <img
          src={`${COMMON_RARITY}/starLimitBreakBaseBless.webp`}
          alt=""
          draggable={false}
          className="absolute object-fill"
          style={{
            left: `${b.starLimitBreakBaseBless.leftPct}%`,
            top: `${b.starLimitBreakBaseBless.topPct}%`,
            width: `${b.starLimitBreakBaseBless.widthPct}%`,
            height: `${b.starLimitBreakBaseBless.heightPct}%`,
          }}
        />
      ) : null}
      {/* frameImageBless over everything (gives the Bless-coloured border). */}
      <img src={`${COMMON_RARITY}/${sprites.frame}.webp`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-fill" />
      {/* Element icons (Bless has TWO — primary at top-right, secondary just
          below it). aPos values from the prefab; CSS-y flipped.
          Sprite path: /Image/IcElementBless/IcElementBless<Name>.webp (the
          BLESS atlas, NOT CommonLotteryInfoPanelAtlas which is attacker-only). */}
      {primaryEl ? (
        <GameImage
          sources={blessElementIconSources(primaryEl)}
          className="absolute object-contain"
          style={{
            left: `${b.icElementBless.leftPct}%`,
            top: `${b.icElementBless.topPct}%`,
            width: `${b.icElementBless.widthPct}%`,
            height: `${b.icElementBless.heightPct}%`,
          }}
        />
      ) : null}
      {secondaryEl ? (
        <GameImage
          sources={blessElementIconSources(secondaryEl)}
          className="absolute object-contain"
          style={{
            left: `${b.icElementBless2.leftPct}%`,
            top: `${b.icElementBless2.topPct}%`,
            width: `${b.icElementBless2.widthPct}%`,
            height: `${b.icElementBless2.heightPct}%`,
          }}
        />
      ) : null}
      {/* Bless icAttackType: NOT RENDERED. Audit status:
          ─ VERIFIED (libil2cpp.so RVA 0xa158d34): SetBless DOES call
            XIUIImageChanger.ChangeByIndex on this.icAttackType (+0x100)
            with entity+0x38 as the index.
          ─ NOT VERIFIED: which Sprite[] is at the XIUIImageChanger
            SerializeField `spriteList` (+0x60 of the MonoBehaviour)
            for the icAttackType node specifically. The current prefab
            extraction (lib/summon-ui/prefab_trees/UILotteryResult.tree.json)
            captures RectTransform + image.img IDLE-frame data only —
            MonoBehaviour SerializeFields like spriteList are NOT in the
            extract. Resolving requires a UnityPy pass over the original
            UILotteryResult AssetBundle (located in Shared/, hash-named).
          ─ USER-REPORTED: Bless physical/magic icon differs from the
            Chara icAttackTypePhysics.png / icAttackTypeMagic.png sprites
            the website already ships for attackers. Until the spriteList
            extraction confirms what the Bless variant actually IS,
            rendering nothing here is the only data-driven choice. */}
      {/* rarityStar — Bless uses the SAME combined alphabet sprite as Chara
          (starCharaS<N>_Alphabet.png from CommonRarityAtlas). Earlier version
          rendered a manual row of N small stars from raritySpriteList[1|2],
          which does NOT match the in-game look — protectors use the
          attacker alphabet sprite at the bottom-left bottom-half row.
          The alphabet sprite name comes from MEMBER_RARITY_ASSETS[rarityIndex]
          .star, shared with Chara (same MEMBER_RARITY_ASSETS lookup table
          covers both, arousal-aware variants included). */}
      {(() => {
        const starAssets = MEMBER_RARITY_ASSETS[rarityIndex] ?? MEMBER_RARITY_ASSETS[baseIndex] ?? MEMBER_RARITY_ASSETS[3]
        if (!starAssets) return null
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${COMMON_RARITY}/${starAssets.star}.webp`}
            alt=""
            draggable={false}
            className="absolute bottom-0 left-0 h-[40%] w-1/2 object-contain"
            style={{ left: `${b.starLimitBreakBaseBless.leftPct}%` }}
          />
        )
      })()}
      {/* Limit-break stars (XIUILimitBreakStar HLG).
          VERIFIED CHAIN (via _work/verify_lb_full.py against libil2cpp.so):
          1. XIUIThumbReward.SetBless (RVA 0xa158cf4) → ldr x0,[x19,#0x108]
             + bl 0x6304? routes through to XIUILimitBreakStar.Set(entity).
          2. XIUILimitBreakStar.Set (RVA 0xa0e96f8) body at 0xa0e97c0+:
             only swaps the raritySpriteList (this+0x38) and stars[]
             (this+0x40) field pointers + tail-calls OnDefaultFinished.
             NO per-star sprite-paint loop in the IL2CPP code — verified
             by walking every instruction 0xa0e97c0..0xa0e99e8.
          3. The limitBreakChara GameObject's prefab scripts list is
             ['XIUILimitBreakStar', 'HorizontalLayoutGroup'] — NO Animator
             component on this node, so the `animator` field at 0x48 is
             effectively unused for the result-template usage.
          Therefore: stars[] Image components keep their prefab-default
          enabled state, which for empty slots is Image.enabled=false.
          For a fresh gacha pull (limit_break_count == 0) the row stays
          empty — rendering NO sprites here is the data-driven match. */}
      {limitBreakCount > 0
        ? (() => {
            const [thumbW, thumbH] = THUMB_DESIGN_SIZE
            const hlg = RESULT_LIMIT_BREAK_HLG
            const [, contH] = hlg.containerSize
            const [starW, starH] = hlg.starSize
            const containerTop = thumbH - contH
            const starTopInContainer = contH - hlg.padding.bottom - starH
            const stepX = starW + hlg.spacing
            return (
              <>
                {limitStars.slice(0, limitBreakCount).map((_, index) => {
                  const starLeftInContainer = hlg.padding.left + index * stepX
                  const starLeftPct = ((starLeftInContainer) / thumbW) * 100
                  const starTopPct = ((containerTop + starTopInContainer) / thumbH) * 100
                  const starWidthPct = (starW / thumbW) * 100
                  const starHeightPct = (starH / thumbH) * 100
                  return (
                    <span
                      key={index}
                      className="absolute"
                      style={{ left: `${starLeftPct}%`, top: `${starTopPct}%`, width: `${starWidthPct}%`, height: `${starHeightPct}%` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${COMMON_RARITY}/starLimitBreakOn.webp`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain" />
                    </span>
                  )
                })}
              </>
            )
          })()
        : null}
    </div>
  )
}

function RuntimeThumbReward({
  character,
  itemSources,
  itemRarity,
  mode = "max",
}: {
  character?: SummonCharacter | null
  itemSources?: string[]
  itemRarity?: number | null
  mode?: "max" | "base"
}) {
  if (!character) {
    return (
      <div className="relative h-full w-full">
        <GameImage sources={itemFrameSources(itemRarity)} className="absolute inset-0 h-full w-full object-fill" />
        <GameImage sources={itemSources ?? []} className="absolute inset-[10%] h-[80%] w-[80%] object-contain" />
      </div>
    )
  }

  // S1 (2026-05-22 audit): XIUIThumbReward.Set (RVA 0xA1EF0F8) dispatches
  // on `thumbType` to SetChara/SetBless/SetItem/... Each variant uses a
  // DIFFERENT sub-set of the prefab's SerializeFields (baseImageBless +
  // frameImageBless + IcElementBless + IcElementBless2 for Bless vs
  // baseImageChara + rarityChara + icElement + icAttackType for Chara).
  // Today's data only ships Chara (the generator drops MasterRewardType=3
  // BlessPc rewards at build time — see summon_website_mismatch.md Â§8.7
  // and the deliverables blocker list). When `thumb_type === "Bless"`
  // we render an explicitly DISTINCT placeholder so it's clear Protector
  // rendering is not yet wired — per audit rule "do not fake Protector
  // cards using Chara layout".
  const thumbType = character.thumb_type ?? "Chara"
  if (thumbType === "Bless") {
    return <RuntimeThumbRewardBless character={character} mode={mode} />
  }

  const baseRarity = character.ui_thumb?.base_rarity ?? character.rarity ?? 3
  const arousalRaw = character.ui_thumb?.arousal_type_raw ?? 0
  const baseIndex =
    arousalRaw === 3 ? 30 + baseRarity :
    arousalRaw === 2 ? 20 + baseRarity :
    arousalRaw === 1 ? 10 + baseRarity :
    baseRarity
  const assets = mode === "base"
    ? MEMBER_RARITY_ASSETS[baseIndex] ?? memberRarityAssets(character)
    : memberRarityAssets(character)
  const limitBreakCount = mode === "base" ? 0 : Math.max(0, Math.min(5, character.ui_thumb?.limit_break_count ?? 0))
  const limitStars = Array.from({ length: 5 })
  const epicInset = assets.frame === "frameMemberM7_Epic" ? "2.95%" : "0%"
  const baseMask = `url(${COMMON_RARITY}/${assets.base}.webp)`

  // Pre-resolved prefab positions. Each comment lists the prefab path the
  // value was derived from so future audits can verify by re-running
  // thumbChildRectPct(...).
  const r = THUMB_RECT_PCT
  // The icElement node has 0 height in the prefab (AspectRatioFitter sizes
  // it at runtime). We constrain it to a square based on its width and
  // anchor it to its prefab top-right anchor cell.
  const elementIconSizePct = r.icElement_widthPct_only
  // Element icon anchor in the prefab is [1,1] anchoredPosition [-36,-36]
  // pivot [0.5,0.5] sizeDelta [62,0]. Right edge = 36-62/2 = 5 px from
  // right edge of thumb. Top edge = 36-62/2 = 5 px from top edge.
  const elementIconBoxRightPct = (5 / 256) * 100
  const elementIconBoxTopPct = (5 / 256) * 100

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="absolute overflow-hidden"
        style={{
          inset: epicInset,
          WebkitMaskImage: baseMask,
          WebkitMaskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskImage: baseMask,
          maskSize: "100% 100%",
          maskRepeat: "no-repeat",
        }}
      >
        <img src={`${COMMON_RARITY}/${assets.base}.webp`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-fill" />
        <GameImage sources={characterCardSources(character)} className="absolute inset-0 h-full w-full object-fill" />
      </div>
      {/* starLimitBreakBaseChara — the translucent plate. Box from prefab. */}
      <img
        src={`${COMMON_RARITY}/starLimitBreakBaseChara.webp`}
        alt=""
        draggable={false}
        className="absolute object-fill"
        style={{
          left: `${r.starLimitBreakBaseChara.leftPct}%`,
          top: `${r.starLimitBreakBaseChara.topPct}%`,
          width: `${r.starLimitBreakBaseChara.widthPct}%`,
          height: `${r.starLimitBreakBaseChara.heightPct}%`,
        }}
      />
      <img src={`${COMMON_RARITY}/${assets.frame}.webp`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-fill" />
      {/* baseElement is the website-side composite background plate for the
          element badge. We anchor it to the prefab's icElement top-right
          5-px inset since the website uses a single combined sprite rather
          than the prefab's separate baseElement (center) + icElement (top-
          right) layout. Width is derived from the prefab's icElement box. */}
      <img
        src={`${COMMON_RARITY}/baseElementMemberM.webp`}
        alt=""
        draggable={false}
        className="absolute object-fill"
        style={{
          right: `${elementIconBoxRightPct}%`,
          top: `${elementIconBoxTopPct}%`,
          width: `${elementIconSizePct}%`,
          // The composite plate is ~2× the icon height so it spans the
          // element-icon + attack-icon stack the prefab draws separately.
          height: `${elementIconSizePct * 2}%`,
        }}
      />
      <GameImage
        sources={elementIconSources(character.element)}
        className="absolute object-contain"
        style={{
          right: `${elementIconBoxRightPct}%`,
          top: `${elementIconBoxTopPct}%`,
          width: `${elementIconSizePct}%`,
          height: `${elementIconSizePct}%`,
        }}
      />
      <GameImage
        sources={attackIconSources(character.attack_type)}
        className="absolute object-contain"
        style={{
          left: `${r.icAttackType.leftPct}%`,
          top: `${r.icAttackType.topPct}%`,
          width: `${r.icAttackType.widthPct}%`,
          height: `${r.icAttackType.heightPct}%`,
        }}
      />
      {/* starCharaS<N>_Alphabet is a website-side combined sprite that
          replaces the prefab's separate rarityChara + rarityStar/star1..8
          nodes (we don't render the prefab's per-star sub-nodes because the
          combined alphabet sprite is what the game's CommonRarityAtlas
          actually ships). Box matches the prefab's starLimitBreakBaseChara
          left half + spans the chara stars row. */}
      <img
        src={`${COMMON_RARITY}/${assets.star}.webp`}
        alt=""
        draggable={false}
        className="absolute bottom-0 left-0 h-[40%] w-1/2 object-contain"
        style={{ left: `${r.starLimitBreakBaseChara.leftPct}%` }}
      />
      {/* Limit-break stars: the prefab's `limitBreakChara` container is a
          256×35 RectTransform anchored to thumbReward's bottom-left, with a
          HorizontalLayoutGroup the website now mirrors exactly. The five
          star children are 29×28 each, the HLG ChildAlignment is LowerLeft
          (TextAnchor enum value 6), padding is { left: 90, top: 0, right: 0,
          bottom: 11 }, spacing is -9. ChildControl/ForceExpand/Scale flags
          are all 0, so each star keeps its own RectTransform size.
          Real-source: `MonoBehaviour HorizontalLayoutGroup` on the
          limitBreakChara GameObject, typetree-read from CAB
          19b264defa7389e9a360f34d54e8cdc7 — see RESULT_LIMIT_BREAK_HLG above.
          XIUILimitBreakStar.Set (RVA 0xa0e96f8) only fills `stars[]` up to
          numRarity; empty slots are left invisible (no OFF placeholder). For
          a fresh gacha pull limit_break_count == 0, the whole row stays
          empty — match that by only rendering ON stars, no OFF outlines. */}
      {limitBreakCount > 0
        ? (() => {
            const [thumbW, thumbH] = THUMB_DESIGN_SIZE
            const hlg = RESULT_LIMIT_BREAK_HLG
            const [, contH] = hlg.containerSize
            const [starW, starH] = hlg.starSize
            const containerTop = thumbH - contH
            const starTopInContainer = contH - hlg.padding.bottom - starH
            const stepX = starW + hlg.spacing
            return (
              <>
                {limitStars.slice(0, limitBreakCount).map((_, index) => {
                  const starLeftInContainer = hlg.padding.left + index * stepX
                  const starLeftPct = ((starLeftInContainer) / thumbW) * 100
                  const starTopPct = ((containerTop + starTopInContainer) / thumbH) * 100
                  const starWidthPct = (starW / thumbW) * 100
                  const starHeightPct = (starH / thumbH) * 100
                  return (
                    <span
                      key={index}
                      className="absolute"
                      style={{
                        left: `${starLeftPct}%`,
                        top: `${starTopPct}%`,
                        width: `${starWidthPct}%`,
                        height: `${starHeightPct}%`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${COMMON_RARITY}/starLimitBreakOn.webp`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain" />
                    </span>
                  )
                })}
              </>
            )
          })()
        : null}
    </div>
  )
}

function ForceIconStrip({ character }: { character: SummonCharacter }) {
  const forces = (character.forces ?? []).filter((force) => force.icon_path).slice(0, 5)
  if (!forces.length) return null
  return (
    <div className="flex h-full items-center gap-[1.5%]">
      {forces.map((force) => (
        <GameImage key={`${force.group}-${force.label}-${force.icon_path}`} sources={forceIconSources(force)} className="h-full w-auto object-contain" />
      ))}
    </div>
  )
}

function DrawButton({
  label,
  cost,
  iconSources,
  subLabel,
  disabled,
  onClick,
}: {
  label: string
  cost: string
  iconSources: string[]
  subLabel?: string
  disabled?: boolean
  onClick: () => void
}) {
  // btnDecisionOnce / btnDecisionContinuous prefab. Normal (gold) gem state;
  // the pink "paid" state + æœ‰å„Ÿ label are hidden (only used for paid-currency
  // banners). count = the main "Recruit xN" label; cost = gem amount; icon =
  // the consume-item icon (slotted from real game data).
  const spec = subLabel ? SPECS.mainDecisionContinuous : SPECS.mainDecisionOnce
  return (
    <div className="relative w-[clamp(220px,17.2vw,370px)]">
      <button
        onClick={onClick}
        disabled={disabled}
        className="relative block w-full bg-transparent p-0 text-left transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PrefabLayer
          spec={spec}
          hide={["paid", "label", "countPaid"]}
          text={{
            count: label,
            cost,
          }}
          textStyle={{
            count: {
              color: RECRUIT_TEXT_IVORY,
              WebkitTextStroke: "0.35px rgba(50,25,0,0.95)",
              textShadow: "0 1px 2px rgba(32,16,0,0.98), 0 0 1px rgba(32,16,0,0.98)",
            },
            cost: {
              color: RECRUIT_TEXT_IVORY,
              WebkitTextStroke: "0.3px rgba(50,25,0,0.9)",
              textShadow: "0 1px 2px rgba(32,16,0,0.98), 0 0 1px rgba(32,16,0,0.98)",
            },
          }}
          slots={{
            icon: <GameImage sources={iconSources} className="h-full w-full object-contain" />,
          }}
        />
      </button>
      {subLabel && (
        <PrefabLayer
          spec={SPECS.mainDecisionInfoContinuous}
          className="pointer-events-none absolute left-0 w-full"
          style={{ top: "15.8%" }}
          hide={["balloon", "textBalloon"]}
          text={{
            textBadge: subLabel,
          }}
          textStyle={{
            textBadge: { color: GAME_TEXT_DARK, textShadow: "none", fontWeight: 900 },
          }}
        />
      )}
    </div>
  )
}

function OverlayShell({
  title,
  subtitle,
  logoSources,
  onClose,
  children,
  footer,
}: {
  title?: string
  subtitle?: string
  logoSources?: string[]
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#070b1c]/88 px-4 pb-4 pt-3 backdrop-blur-[2px] sm:px-10">
      {/* subtle in-game blue glow top/bottom */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#3b62c8]/35 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#3b62c8]/35 to-transparent" />

      {title ? (
        <>
          <div className="relative mx-auto flex w-full max-w-6xl items-center justify-center pb-2">
            <div className="text-center">
              <h2 className="font-serif text-3xl font-black tracking-wide text-[#ffe6a6] drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] sm:text-4xl">
                {title}
              </h2>
              {subtitle && <div className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-[#aab6f0]">{subtitle}</div>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 rotate-45 place-items-center border-2 border-[#aab6f0]/70 bg-[#121a38]/95 shadow-[0_0_12px_rgba(120,150,240,0.5)] transition hover:bg-[#28335f] sm:h-12 sm:w-12"
            >
              <span className="-rotate-45 text-2xl font-black leading-none text-foreground">×</span>
            </button>
          </div>
          <div className="mx-auto mb-3 h-px w-full max-w-6xl bg-gradient-to-r from-transparent via-[#aab6f0]/60 to-transparent" />
        </>
      ) : (
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-3 z-10 grid h-11 w-11 rotate-45 place-items-center border-2 border-[#aab6f0]/70 bg-[#121a38]/95 shadow-[0_0_12px_rgba(120,150,240,0.5)] transition hover:bg-[#28335f] sm:right-8 sm:h-12 sm:w-12"
        >
          <span className="-rotate-45 text-2xl font-black leading-none text-foreground">×</span>
        </button>
      )}

      <div className={`relative mx-auto flex w-full ${title ? "max-w-6xl" : "max-w-[1064px]"} min-h-0 flex-1 flex-col`}>
        {title && logoSources?.length ? (
          <div className="mb-2 flex justify-center sm:justify-start">
            <GameImage sources={logoSources} className="h-10 max-w-[220px] object-contain opacity-90" />
          </div>
        ) : null}
        <div className={`min-h-0 flex-1 ${title ? "image-scroll overflow-auto" : "overflow-hidden"}`}>{children}</div>
        {footer && <div className="mt-3 border-t border-[#aab6f0]/25 pt-3 text-center text-[13px] font-semibold text-[#9aa6e0]">{footer}</div>}
      </div>
    </div>
  )
}

function CharacterDetailsPanel({
  banner,
  onClose,
  onOpenRates,
}: {
  banner: SummonBanner
  onClose: () => void
  onOpenRates: () => void
}) {
  const characters = detailCharacters(banner)

  return (
    <OverlayShell
      title="Char. Details"
      onClose={onClose}
      footer={
        <div className="flex flex-col items-center gap-2">
          <p className="max-w-4xl text-left text-[16px] font-black leading-snug text-[#f66b54]">
            * Shown with characters at max enhancement. (Excludes additional enhancements)
            <br />* Only some characters included in the recruit are shown.
            <br />* To see the available characters, go to "Recruit Details/Drop Rates".
          </p>
          <button
            onClick={() => {
              onClose()
              onOpenRates()
            }}
            className="rounded-[3px] border border-[#ffe06a]/80 bg-[#2a2208] px-5 py-2 text-sm font-black text-[#ffe9a8] shadow-[0_0_8px_rgba(255,213,66,0.35)]"
          >
            Recruit Details/Drop Rates
          </button>
        </div>
      }
    >
      {characters.length === 0 ? (
        <div className="grid place-items-center py-16 text-sm font-bold text-[#9aa6e0]">No featured characters listed for this recruitment.</div>
      ) : (
        <div className="space-y-4">
          {characters.map((character) => {
            const imageSources = characterCardSources(character)
            return (
              <div
                key={character.master_pc_id}
                className="grid min-h-[128px] grid-cols-[104px_minmax(0,1fr)_auto] items-center gap-4 rounded-[4px] border border-[#aab6f0]/20 bg-[#0c1130]/75 px-4 py-3"
              >
                <div className="relative grid h-[104px] w-[104px] place-items-center overflow-hidden rounded-[3px] bg-gradient-to-b from-[#26305a] to-[#0a0f26]">
                  <GameImage sources={imageSources} className="h-full w-full object-contain" />
                  {character.rarity ? (
                    <span className="absolute bottom-1 left-1 rounded-sm bg-black/70 px-1.5 py-0.5 text-xs font-black text-[#ffe06a]">★{character.rarity}</span>
                  ) : null}
                </div>
                <div className="min-w-0">
                  {character.affiliation_name ? (
                    <div className="truncate font-serif text-base font-bold text-[#ffe6a6]">[ {character.affiliation_name} ]</div>
                  ) : null}
                  <div className="truncate font-serif text-2xl font-black leading-tight text-foreground drop-shadow-[0_2px_1px_rgba(0,0,0,0.9)] sm:text-[28px]">
                    {character.name}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-bold">
                    {character.element ? (
                      <span className="flex items-center gap-1.5 rounded-[3px] border border-[#aab6f0]/25 bg-[#11173a]/80 px-2 py-1 text-foreground">
                        <GameImage sources={elementIconSources(character.element)} className="h-5 w-5 object-contain" />
                        {character.element}
                      </span>
                    ) : null}
                    {character.attack_type ? (
                      <span className="flex items-center gap-1.5 rounded-[3px] border border-[#aab6f0]/25 bg-[#11173a]/80 px-2 py-1 text-foreground">
                        <GameImage sources={attackIconSources(character.attack_type)} className="h-5 w-5 object-contain" />
                        {character.attack_type}
                      </span>
                    ) : null}
                    {character.character_role ? (
                      <span className="rounded-[3px] border border-[#7a4fd6]/60 bg-[#3a256f]/70 px-2 py-1 text-[#d8c8ff]">{character.character_role}</span>
                    ) : null}
                    {character.ultimate_type ? (
                      <span className="rounded-[3px] border border-[#aab6f0]/25 bg-[#11173a]/80 px-2 py-1 text-slate-200">{character.ultimate_type}</span>
                    ) : null}
                  </div>
                </div>
                <a
                  href={`/characters/${character.master_pc_id}`}
                  className="justify-self-end rounded-[2px] border-2 border-[#87e5dd] bg-[#00816f]/95 px-8 py-3 text-xl font-black text-foreground shadow-[inset_0_0_12px_rgba(255,255,255,0.22),0_3px_8px_rgba(0,0,0,0.55)] transition hover:brightness-110"
                >
                  Info
                </a>
              </div>
            )
          })}
        </div>
      )}
    </OverlayShell>
  )
}

// Shared modal backdrop: the in-game look is a dark blue-tinted translucent
// veil over the summon page (which stays visible behind it) — NOT an opaque
// dim or CSS blur. The window's own magic-circle / blue-glow chrome comes from
// the prefab sprites (mask + modalCorner + sage).
function GameModalBackdrop({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 overflow-hidden">
      {/* In-game the scene behind the modal is heavily darkened to a near-solid
          deep navy; the page's geometric pattern only barely reads through.
          Two layers: a strong navy fill + a subtle radial so the centre isn't
          dead flat (matches the reference's faint blue glow). */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{ background: "rgba(5, 9, 22, 0.93)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 36%, rgba(40,66,128,0.30) 0%, rgba(8,13,32,0.05) 55%, rgba(0,0,0,0) 100%)",
        }}
      />
      {children}
    </div>
  )
}

function CharacterDetailsPrefabPanel({
  banner,
  onClose,
  onOpenRates,
}: {
  banner: SummonBanner
  onClose: () => void
  onOpenRates: () => void
}) {
  const characters = detailCharacters(banner)

  return (
    <GameModalBackdrop onClose={onClose}>
      <div className="absolute inset-x-0 top-[3.5%] h-[90%]" onClick={(e) => e.stopPropagation()}>
        <PrefabLayer
          spec={SPECS.charaDetailsWindow}
          fill
          className="absolute inset-0"
          hide={["label1", "label2", "mask", "cornerDR", "cornerDL", "cornerUR", "cornerUL", "deco1", "deco2"]}
          onNodeClick={{
            btnClose: onClose,
            btnDetail: () => {
              onClose()
              onOpenRates()
            },
            label: () => {
              onClose()
              onOpenRates()
            },
          }}
          nodeStyle={{
            btnDetail: { left: "71.7%", width: "20.4%" },
            label: { left: "72.9%", width: "18%" },
          }}
        slots={{
          btnDetail: <ButtonPatternFill insetX={4.35} insetY={16.67} buttonW={368} buttonH={84} />,
        }}
          text={{
            title: "Char. Details",
            warning: (
              <span style={{ display: "block", paddingLeft: "9%", paddingRight: "8%" }}>
                {"* Shown with characters at max enhancement. (Excludes additional enhancements)\n" +
                  "* Only some characters included in the recruit are shown.\n" +
                  "* To see the available characters, go to “Recruit Details/Drop Rates”."}
              </span>
            ),
            label: "Recruit Details/Drop Rates",
          }}
        />
        <div
          className="summon-list-scroll image-scroll absolute overflow-y-auto"
          style={{ left: "15.3%", top: "20.3%", width: "69.4%", height: "43%" }}
        >
          {characters.length === 0 ? (
            <div className="grid h-full place-items-center text-sm font-bold text-[#9aa6e0]">
              No featured characters listed for this recruitment.
            </div>
          ) : (
            <div className="flex flex-col gap-[0.6%] pr-2">
              {characters.map((character) => (
                <CharacterDetailsPrefabRow key={character.master_pc_id} character={character} />
              ))}
            </div>
          )}
        </div>
      </div>
    </GameModalBackdrop>
  )
}

function CharacterDetailsPrefabRow({ character }: { character: SummonCharacter }) {
  const title = character.affiliation_name ? `[ ${character.affiliation_name} ]` : ""
  // tactics tag uses the real game field (Charge / Attack / Defense …); the
  // colored capsule is part of the tactics icon asset, so we don't recolour.
  const tacticsIcons = tacticsIconSources(character)
  const ultimate = character.ultimate_type || ""
  const [rowW, rowH] = SPECS.charaDetailsRow.canvas
  const THUMB = (rowH / rowW) * 100
  const ATTACK_SPRITE = `${SUMMON_UI_BASE}/9df7a5929db2ef54.png`

  function openInfo() {
    window.location.href = `/characters/${character.master_pc_id}`
  }

  return (
    <div
      className="relative w-full shrink-0 overflow-hidden"
      style={{ aspectRatio: `${SPECS.charaDetailsRow.canvas[0]} / ${SPECS.charaDetailsRow.canvas[1]}` }}
    >
      <PrefabLayer
        spec={SPECS.charaDetailsRow}
        fill
        className="absolute inset-0"
        hide={[
          "baseImage", "frameImage", "image", "highlight", "baseElement", "rarityChara",
          "lv", "param", "num", "lvBase", "lvEngrave", "numLove",
          "target0", "target1", "target2",
          "star1", "star2", "star3", "star4", "star5", "star6", "star7", "star8",
          "limitBreakMax", "attack", "label#1",
        ]}
        text={{
          nickname: title,
          charaName: character.name,
          "label#1": "",
          "label#2": "Info",
        }}
        onNodeClick={{ btnDetail: openInfo, "label#2": openInfo }}
        nodeStyle={{
          base: { top: "0%", height: "100%" },
          lineV: { top: "61.9%", height: "32.4%" },
        }}
        slots={{
          btnDetail: <ButtonPatternFill insetX={5.99} insetY={12.39} buttonW={267} buttonH={113} />,
        }}
      />
      {/* character card — runtime-laid-out sub-prefab → row's leading square */}
      <div
        className="pointer-events-none absolute"
        style={{ left: "0%", top: "0%", width: `${THUMB}%`, height: "100%" }}
      >
        <RuntimeThumbReward character={character} />
      </div>
      {/* Dynamic row tags placed back into the prefab's own strategy /
          ultimateLabelType / categoryList band. */}
      {tacticsIcons.length ? (
          <div
            className="pointer-events-none absolute"
          style={{ left: "14.529%", top: "68.1%", width: "13.412%", height: "22.857%" }}
          >
          <GameImage sources={tacticsIcons} className="h-full w-full object-contain" />
        </div>
      ) : null}
      {ultimate ? (
        <span
          className="pointer-events-none absolute block overflow-hidden"
        style={{ left: "28.118%", top: "69.15%", width: "13.176%", height: "21.905%" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ATTACK_SPRITE} alt="" className="h-full w-full object-fill" />
          <span
            className="font-serif font-black leading-none text-foreground"
            style={{
              position: "absolute",
              left: "29%",
              right: "10%",
              top: "13%",
              bottom: "13%",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              fontSize: "clamp(9px,0.9vw,16px)",
            }}
          >
            {ultimate}
          </span>
        </span>
      ) : null}
      <div
        className="pointer-events-none absolute"
        style={{ left: "43.3%", top: "64.7%", width: "27.2%", height: "25.4%" }}
      >
        <ForceIconStrip character={character} />
      </div>
    </div>
  )
}

// Reformat the announcement feed's end date ("Ends: 5:59 UTC 6/12 (Fri)")
// into the exact in-game string ("Ends: 05:59 UTC , 06/12/2026"). The year
// isn't in the feed text, so derive it from the banner's release_month
// (YYYYMM); if the end month is before the release month it rolled into the
// next year.
function formatInGameEndDate(raw: string, releaseMonth?: number): string | null {
  const t = raw.match(/(\d{1,2}):(\d{2})/)
  const d = raw.match(/(\d{1,2})\/(\d{1,2})/)
  if (!t || !d) return raw.trim() || null
  const hh = t[1].padStart(2, "0")
  const mm = t[2]
  const mon = parseInt(d[1], 10)
  const day = parseInt(d[2], 10)
  let year = new Date().getUTCFullYear()
  if (releaseMonth && releaseMonth > 100000) {
    const ry = Math.floor(releaseMonth / 100)
    const rm = releaseMonth % 100
    year = mon < rm ? ry + 1 : ry
  }
  const MM = String(mon).padStart(2, "0")
  const DD = String(day).padStart(2, "0")
  return `Ends: ${hh}:${mm} UTC , ${MM}/${DD}/${year}`
}

function daysLeftFromAnnouncementEndDate(raw: string, releaseMonth?: number): number | null {
  const t = raw.match(/(\d{1,2}):(\d{2})/)
  const d = raw.match(/(\d{1,2})\/(\d{1,2})/)
  if (!t || !d) return null
  const hour = parseInt(t[1], 10)
  const minute = parseInt(t[2], 10)
  const month = parseInt(d[1], 10)
  const day = parseInt(d[2], 10)
  if (![hour, minute, month, day].every(Number.isFinite)) return null
  let year = new Date().getUTCFullYear()
  if (releaseMonth && releaseMonth > 100000) {
    const releaseYear = Math.floor(releaseMonth / 100)
    const releaseMonthNumber = releaseMonth % 100
    year = month < releaseMonthNumber ? releaseYear + 1 : releaseYear
  }
  const end = Date.UTC(year, month - 1, day, hour, minute)
  const diff = Math.ceil((end - Date.now()) / 86400000)
  return diff > 0 ? diff : null
}

// Banner end-date strip — sourced from the official announcement feed (same
// real game data the Recruit Details panel uses), matched to this banner.
// Announcements are cached in localStorage via lib/announcement-cache so the
// page fetches /api/events at most once per 6h per browser, no matter how
// many banners are switched through.
function BannerEndDate({ banner }: { banner: SummonBanner }) {
  // Always initialise to null so SSR and the first client render match — the
  // cache lookup happens in useEffect after hydration, and the localStorage
  // read is instant for repeat visits.
  const [endDate, setEndDate] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setEndDate(null)
    // Synchronous localStorage read first (no network on cache hit).
    const cached = readAnnouncementsSync()
    if (cached) {
      const a = selectAnnouncementForBanner(cached as AnnouncementArticle[], banner)
      if (a?.endDate) setEndDate(formatInGameEndDate(a.endDate, banner.release_month))
      return () => {
        cancelled = true
      }
    }
    // Cache miss — fetch once, then evaluate.
    fetchAnnouncements()
      .then((articles) => {
        if (cancelled) return
        const a = selectAnnouncementForBanner(articles as AnnouncementArticle[], banner)
        if (a?.endDate) setEndDate(formatInGameEndDate(a.endDate, banner.release_month))
      })
      .catch(() => {
        /* no end-date available — render nothing (game hides it too) */
      })
    return () => {
      cancelled = true
    }
  }, [banner])

  if (!endDate) return null
  // In-game: a wide, almost-transparent dark bar (the banner sparkle shows
  // through it) under the logo, white serif text with a heavy shadow.
  return (
    <div
      className="mt-0 flex items-center justify-center overflow-hidden rounded-[2px] bg-black/35 px-1 py-0.5"
      style={{
        marginLeft: "3.7%",
        width: "94.5%",
      }}
    >
      <span
        className="block w-full whitespace-nowrap text-center text-[clamp(8px,0.95vw,17px)] font-bold tracking-wide text-foreground"
        style={{
          fontFamily: '"Times New Roman", Georgia, serif',
          textShadow: "0 2px 4px rgba(0,0,0,1), 0 0 3px rgba(0,0,0,1)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {endDate}
      </span>
    </div>
  )
}

function OfficialAnnouncement({ banner }: { banner: SummonBanner }) {
  const [article, setArticle] = useState<AnnouncementArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAnnouncement() {
      setError(null)
      setArticle(null)

      // Try the synchronous cache first — no spinner if we already have data.
      const cached = readAnnouncementsSync()
      if (cached) {
        const selected = selectAnnouncementForBanner(cached as AnnouncementArticle[], banner)
        setArticle(selected)
        setLoading(false)
        if (!selected) setError("No recruit announcement was found in the official feed for this banner.")
        return
      }

      setLoading(true)
      try {
        const articles = await fetchAnnouncements()
        if (cancelled) return
        const selected = selectAnnouncementForBanner(articles as AnnouncementArticle[], banner)
        setArticle(selected)
        if (!selected) {
          setError("No recruit announcement was found in the official feed for this banner.")
        }
      } catch {
        if (!cancelled) setError("Could not load the official announcement feed.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAnnouncement()
    return () => {
      cancelled = true
    }
  }, [banner])

  if (loading) {
    return <div className="grid h-full place-items-center rounded-[4px] border border-[#aab6f0]/20 bg-[#0b1024]/80 font-bold text-[#aab6f0]">Loading recruit announcement...</div>
  }

  if (error || !article) {
    return (
      <div className="grid h-full place-items-center rounded-[4px] border border-[#aab6f0]/20 bg-[#0b1024]/80 px-6 text-center font-bold text-[#9aa6e0]">
        {error || "No recruit announcement is available for this banner yet."}
      </div>
    )
  }

  // The embedded page renders its own magenta "Recruit" header, period and
  // overview, and scrolls internally (its scrollbar is the API's own). We just
  // frame it dark and mask the thin white body edge + native scrollbar gutter
  // so no white shows. Same template across every banner.
  // Serve the official announcement page directly (its own styling/layout is
  // correct as-is). Dark frame around it; the X comes from the overlay shell.
  return (
    <div className="h-full w-full overflow-hidden rounded-[4px] border border-[#aab6f0]/25 bg-[#1b1a18]">
      <iframe
        title={article.title || "Recruit Announcement"}
        src={`/api/recruit-article?src=${encodeURIComponent(officialAnnouncementUrl(article))}`}
        className="h-full w-full border-0 bg-[#1b1a18]"
        style={{ colorScheme: "dark" }}
      />
    </div>
  )
}

function RatePanel({ banner, onClose }: { banner: SummonBanner; onClose: () => void }) {
  return (
    <GameModalBackdrop onClose={onClose}>
      <div className="absolute left-[7%] right-[7%] top-[7%] bottom-[7%]" onClick={(e) => e.stopPropagation()}>
        <div className="absolute inset-0 border border-[#8aa2df]/45 bg-[#07102a]/92 shadow-[0_0_30px_rgba(70,112,220,0.35)]" />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-[-2.5%] top-[-6%] z-10 w-[7%] max-w-[92px] min-w-[54px] transition hover:brightness-110"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${SUMMON_UI_BASE}/f4534b60c6bdea02.png`} alt="" className="h-full w-full object-contain" />
        </button>
        <div className="absolute inset-[2%] overflow-hidden bg-[#1b1a18]">
          <OfficialAnnouncement banner={banner} />
        </div>
      </div>
    </GameModalBackdrop>
  )
}

function TradePanel({
  banner,
  pointItem,
  bazaarPoints,
  uiAssets,
  onClose,
}: {
  banner: SummonBanner
  pointItem: PointItem
  bazaarPoints: number
  uiAssets: SummonPayload["ui_assets"]
  onClose: () => void
}) {
  void pointItem
  const selections = pointSelectionsFor(banner)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    // Synchronous read from the shared announcement cache; only fetch when
    // the localStorage cache is missing or stale.
    const cached = readAnnouncementsSync()
    if (cached) {
      const a = selectAnnouncementForBanner(cached as AnnouncementArticle[], banner)
      setDaysLeft(a?.endDate ? daysLeftFromAnnouncementEndDate(a.endDate, banner.release_month) : null)
      return () => {
        cancelled = true
      }
    }
    setDaysLeft(null)
    fetchAnnouncements()
      .then((articles) => {
        if (cancelled) return
        const a = selectAnnouncementForBanner(articles as AnnouncementArticle[], banner)
        if (a?.endDate) setDaysLeft(daysLeftFromAnnouncementEndDate(a.endDate, banner.release_month))
      })
      .catch(() => {
        /* no release window available */
      })
    return () => {
      cancelled = true
    }
  }, [banner])

  // UILotteryExchangeList prefab — exact chrome (modal frame/title/close/
  // points header/divider/footer). The modal stretches full-screen-width with
  // a fixed canvas-height in game, so we fill a landscape box and let the
  // prefab's anchored %s map onto it. The scrollable list sits in the prefab's
  // own exhangeList band (between the lineH divider and the notification).
  if (!selections.length) return null
  return (
    <GameModalBackdrop onClose={onClose}>
      <div className="absolute inset-x-0 top-[3.5%] h-[90%]" onClick={(e) => e.stopPropagation()}>
        <PrefabLayer
          spec={SPECS.tradeWindow}
          fill
          className="absolute inset-0"
          hide={["label1", "label2", "mask", "cornerDR", "cornerDL", "cornerUR", "cornerUL", "deco1", "deco2"]}
          onNodeClick={{ btnClose: onClose }}
          nodeStyle={{
            // In-game the Bazaar-Pts banner is a fixed-size short pill, not a
            // %-of-modal width — constrain so it doesn't stretch on the wide
            // modal (real darkFrame sprite unchanged). The label box is made
            // identical to the pill box so the text sits centred inside it.
            numPossessionContainer: { width: "17%" },
            labelNumPossession: { left: "9.26%", width: "17%" },
          }}
          text={{
            title: "Trade",
            labelNumPossession: `Bazaar Pts: ${bazaarPoints.toLocaleString()}`,
            notification:
              <span style={{ display: "block", paddingLeft: "10%", paddingRight: "10%" }}>
                Convert previously acquired characters into character-specific memory stones or contract stones.
              </span>,
          }}
        />
        <div
          className="summon-list-scroll image-scroll absolute overflow-y-auto"
          style={{ left: "16%", top: "22.5%", width: "72%", height: "57%" }}
        >
          <div className="flex flex-col gap-[clamp(8px,1.1vh,12px)] pr-2">
            {selections.map((selection) => (
              <TradeRow
                key={selection.master_lottery_point_selection_id}
                selection={selection}
                uiAssets={uiAssets}
                title={selectionTitle(selection)}
                limit={selection.limit_count}
                required={selection.selection_point}
                have={bazaarPoints}
                daysLeft={daysLeft}
              />
            ))}
          </div>
        </div>
      </div>
    </GameModalBackdrop>
  )
}

function TradeRow({
  selection,
  uiAssets,
  title,
  limit,
  required,
  have,
  daysLeft,
}: {
  selection: SummonPointSelection
  uiAssets: SummonPayload["ui_assets"]
  title: string
  limit: number
  required: number
  have: number
  daysLeft: number | null
}) {
  void limit
  const canTrade = required > 0 && have >= required
  const imageSources = selectionIconSources(selection, uiAssets)
  const reward = selection.reward_rows?.[0]
  // UILotteryExchangeList itemTemplate prefab. Keep the prefab's row
  // background + divider + name / Bazaar-Pts / days-left labels + the green
  // exchange button; hide the runtime character-card overlay (level / limit
  // break / love / "already owned" states we have no wiki data for). The
  // thumbnail is a runtime-laid-out sub-prefab, so the card sits in the row's
  // leading square (left edge → nameLabel start, full row height).
  const [rowW, rowH] = SPECS.tradeRow.canvas
  const THUMB = (rowH / rowW) * 100
  return (
    <div
      className="relative w-full shrink-0 overflow-hidden"
      data-can-trade={canTrade ? "true" : "false"}
      style={{ aspectRatio: `${SPECS.tradeRow.canvas[0]} / ${SPECS.tradeRow.canvas[1]}` }}
    >
      {/* The game row background starts behind the reward icon. The prefab
          dark plate only covers the text/button band in our extracted layout,
          so draw the full-row plate ourselves and keep the icon clipped inside it. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(34,38,45,0.92) 0%, rgba(42,43,43,0.90) 30%, rgba(41,42,40,0.88) 100%)",
        }}
      />
      <PrefabLayer
        spec={SPECS.tradeRow}
        fill
        className="absolute inset-0"
        hide={[
          "base", "bg", "background", "frame", "border", "outline",
          "baseImage", "frameImage", "image", "highlight", "baseElement", "rarityChara",
          "lv", "param", "num", "numLove", "lvBase", "lvEngrave", "btnCountLabel", "topLabel",
          "target0", "target1", "target2", "alreadyBadge", "alreadyLabel",
          "star1", "star2", "star3", "star4", "star5", "star6", "star7", "star8",
          "limitBreakMax",
        ]}
        nodeStyle={{
          // Centre "Trade" inside the green button and mute the disabled state
          // to match the in-game unavailable exchange button.
          btnExchangeCount: canTrade
            ? {}
            : { filter: "brightness(0.72) saturate(0.72)", opacity: 0.82 },
          label: {
            left: "80.77%",
            top: "32.97%",
            width: "17.93%",
            height: "60.54%",
            opacity: canTrade ? 1 : 0.68,
          },
        }}
        slots={{
          btnExchangeCount: (
            <span className="pointer-events-none absolute inset-0" style={{ opacity: canTrade ? 1 : 0.52 }}>
              <ButtonPatternFill insetX={5.97} insetY={12.5} buttonW={268} buttonH={112} />
            </span>
          ),
        }}
        textStyle={{
          nameLabel: {
            color: GAME_TEXT_IVORY,
            textShadow: "0 2px 2px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)",
          },
          daysLeftLabel: {
            color: GAME_TEXT_IVORY,
            textShadow: "0 2px 2px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)",
          },
          label: {
            color: canTrade ? GAME_TEXT_IVORY : "rgba(255,250,240,0.62)",
            textShadow: "0 2px 2px rgba(0,0,0,0.95)",
          },
        }}
        text={{
          nameLabel: title,
          pointsLabel: (
            <span style={{ color: "#d74739", textShadow: "0 2px 2px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)" }}>
              Bazaar Pts: {required.toLocaleString()}
            </span>
          ),
          daysLeftLabel: daysLeft != null ? `Days left: ${daysLeft}` : "",
          label: "Trade",
        }}
        onNodeClick={canTrade ? { label: () => {} } : undefined}
      />
      <div
        className="pointer-events-none absolute"
        style={{ left: "1.15%", top: "6.25%", width: `${THUMB * 0.875}%`, height: "87.5%" }}
      >
        {selection.character ? (
          // Trade list shows the character's BASE rarity (6★ here), not the
          // max-enhanced display rarity — from game data, not hardcoded.
          <RuntimeThumbReward character={selection.character} mode="base" />
        ) : (
          <RuntimeThumbReward itemSources={imageSources} itemRarity={reward?.item?.rarity ?? null} />
        )}
      </div>
    </div>
  )
}

// Days remaining from a release window label like "2026-06-12 ..." or a
// "start~end" range. Returns null when it can't be parsed (the game hides it).
function releaseDaysLeft(label: string): number | null {
  const dates = label.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g)
  if (!dates || !dates.length) return null
  const end = new Date(dates[dates.length - 1].replace(/\//g, "-"))
  if (Number.isNaN(end.getTime())) return null
  const diff = Math.ceil((end.getTime() - Date.now()) / 86400000)
  return diff > 0 ? diff : null
}

// Stage 3 — LotteryResultState: the RESULT grid. Title + tiles (each pull as
// its real card with the rarity cardGlow + NEW badge) + Bazaar-Pts header +
// Return / Recruit-more, over the banner's own background.
const RESULT_CARD_DYNAMIC_NODES = [
  "baseImage",
  "frameImage",
  "baseElement",
  "star1",
  "star2",
  "star3",
  "star4",
  "star5",
  "star6",
  "star7",
  "star8",
  "limitBreakMax",
  "rarityChara",
  "lv",
  "param",
  "num",
  "lvBase",
  "lvEngrave",
  "numLove",
  "target0",
  "target1",
  "target2",
  "image",
  "highlight",
]

function LotteryResultCard({ result }: { result: SummonResult }) {
  const rarity = result.bucket?.show_rarity || result.character?.rarity || 3
  return (
    <div className="relative aspect-square w-full">
      <div className="absolute inset-0">
        {result.character ? (
          <RuntimeThumbReward character={result.character} mode="base" />
        ) : (
          <RuntimeThumbReward itemSources={[]} itemRarity={rarity} />
        )}
      </div>
      <PrefabLayer
        spec={SPECS.lotteryCard}
        fill
        className="pointer-events-none absolute inset-0"
        hide={RESULT_CARD_DYNAMIC_NODES}
        replace={["cardGlow"]}
        slots={{
          cardGlow: (
            <img
              src={`${SUMMON_UI_BASE}/${resultGlow(result)}`}
              alt=""
              className="h-full w-full object-contain"
              draggable={false}
            />
          ),
        }}
      />
      <span className="absolute left-[-2%] top-[-2%] z-20 rounded-[2px] bg-[#f0c14b] px-[6%] py-[2%] font-serif text-[clamp(9px,1.2vw,13px)] font-black italic leading-none text-[#3a2403] shadow-[0_2px_3px_rgba(0,0,0,0.65)]">
        NEW
      </span>
    </div>
  )
}

function ResultsPanel({
  banner,
  results,
  bazaarPoints,
  bgSources,
  onRecruitMore,
  onClose,
}: {
  banner: SummonBanner
  results: SummonResult[]
  bazaarPoints: number
  bgSources: string[]
  onRecruitMore: () => void
  onClose: () => void
}) {
  const cols = results.length > 1 ? 5 : 1
  return (
    <div className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-black">
      <GameImage sources={bgSources} className="absolute inset-0 h-full w-full object-cover opacity-55" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#040616]/85 via-[#050a1e]/70 to-[#040616]/90" />

      <div className="relative mt-[2.5%] text-center">
        <h2 className="font-serif text-[clamp(28px,4vw,52px)] font-black tracking-[0.15em] text-[#f3ead2] drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
          RESULT
        </h2>
        <div className="mx-auto mt-1 h-px w-[70%] bg-gradient-to-r from-transparent via-[#9fb6ff]/60 to-transparent" />
      </div>

      <div className="image-scroll relative mx-auto mt-[2%] grid w-[88%] flex-1 content-center gap-[1.4%] overflow-y-auto pb-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {results.map((result) => {
          const rarity = result.bucket?.show_rarity || result.character?.rarity || 3
          return (
            <div key={result.id} className="relative mx-auto" style={{ width: "min(13vw,150px)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${SUMMON_UI_BASE}/${resultGlow(result)}`}
                alt=""
                className="pointer-events-none absolute -inset-[28%] h-[156%] w-[156%] object-contain"
              />
              <div className="relative" style={{ aspectRatio: "204 / 248" }}>
                {result.character ? (
                  <RuntimeThumbReward character={result.character} mode="base" />
                ) : (
                  <RuntimeThumbReward
                    itemSources={[]}
                    itemRarity={rarity}
                  />
                )}
              </div>
              <span className="absolute -left-1 -top-1 rounded-[2px] bg-[#f0c14b] px-1.5 py-0.5 text-[10px] font-black italic text-[#3a2403] shadow">
                NEW
              </span>
            </div>
          )
        })}
      </div>

      <div className="relative mb-[2.5%] flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex items-center gap-2 px-6 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SUMMON_UI_BASE}/d72b247029db0fe5.png`} alt="" className="absolute inset-0 h-full w-full" style={{ objectFit: "fill" }} />
            <span className="relative font-serif text-lg font-bold text-foreground drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
              Bazaar Pts: {bazaarPoints.toLocaleString()}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={onClose}
            className="relative font-serif text-2xl font-black tracking-wide text-foreground"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SUMMON_UI_BASE}/ea3e009e9f47436a.png`} alt="" className="absolute inset-0 h-full w-full" style={{ objectFit: "fill" }} />
            <span className="relative block px-12 py-3 drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">Return</span>
          </button>
          <button
            onClick={onRecruitMore}
            className="relative font-serif text-2xl font-black tracking-wide text-foreground transition hover:brightness-110"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SUMMON_UI_BASE}/079863ce6e7dace8.png`} alt="" className="absolute inset-0 h-full w-full" style={{ objectFit: "fill" }} />
            <span className="relative block px-10 py-3 drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
              Recruit x{results.length} More
            </span>
          </button>
        </div>
      </div>

      <button
        onClick={onClose}
        className="absolute right-6 top-4 font-serif text-2xl font-bold italic tracking-wide text-foreground drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] transition hover:text-foreground/70"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  )
}

// ResultCardWrapper drives the per-card "In" animation from the decoded
// resultTemplate Animator's In clip (CAB-1b2709493d2b9e2f1606716859e9976d,
// see result_template_animation.json). The clip's 0.533s duration animates
// 8 bindings — two CanvasGroup m_Alpha curves (0 → 0.9/1.0) and one
// m_AnchoredPosition.x curve (0 → 1.0) plus two m_IsActive toggles. The
// path-hash mapping for those bindings isn't resolved (the controller's
// TOS is in the dep bundle's AnimatorController object, not the clip), so
// we reproduce the clip's user-visible character — opacity 0 → 1 with a
// short translateX slide-in — using the clip's stopTime and key shape
// 1:1 from the muscle-clip extraction. Each card plays the same clip with
// no stagger (the In clip itself doesn't define one and there's no
// IL2CPP-side per-card delay in XIUILotteryResultList.EntitySetCallBack).
const RESULT_TEMPLATE_IN_DURATION_MS = 533
function ResultCardWrapper({
  x,
  y,
  w,
  h,
  cardIndex,
  children,
}: {
  x: number
  y: number
  w: number
  h: number
  cardIndex: number
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Keyframes derived 1:1 from the In clip's streamed samples:
    //   - CanvasGroup m_Alpha at binding[12]: 0 → 0.9 (0.0s → 0.533s)
    //   - RectTransform m_AnchoredPosition.x at binding[16]: 0 → 1.0 unit
    //     (the unit factor isn't decoded; in Unity the curve drives a
    //     pixel value via a UI Animator. We map "1.0 unit" → 12 px slide
    //     based on the clip's typical per-card slide range — same
    //     order of magnitude the Unity ResultUI uses for its card-flip-in
    //     drift. If this differs from the real game it's the next thing
    //     to tune from data, NOT screenshots.)
    const anim = el.animate(
      [
        { opacity: 0, transform: "translateX(-12px)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      {
        duration: RESULT_TEMPLATE_IN_DURATION_MS,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)", // ease-out — matches Unity's default In transition
        fill: "both",
      },
    )
    return () => anim.cancel()
  }, [cardIndex])
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
        opacity: 0,
      }}
    >
      {children}
    </div>
  )
}

function ResultsPanelPrefab({
  banner,
  results,
  bazaarPoints,
  bgSources,
  uiAssets,
  onRecruitMore,
  onClose,
}: {
  banner: SummonBanner
  results: SummonResult[]
  bazaarPoints: number
  bgSources: string[]
  uiAssets?: SummonPayload["ui_assets"]
  onRecruitMore: () => void
  onClose: () => void
}) {
  // Resolve the cost data shown above the Recruit button. The Result UI
  // re-uses the same lottery the player just pulled (size-matched to the
  // results length: x10 → multi, x1 → single). This mirrors the main
  // banner's Recruit buttons identically — same DrawButton component, same
  // cost helper, same sprite-driven look (per user: "literally the same
  // one as the one in the main page banners that says Recruit x10 or
  // Recruit x1 that has the 300 crystals").
  const recruitKind: DrawKind = results.length >= 10 ? "multi" : "single"
  const recruitLottery = banner?.lotteries?.length ? findLottery(banner, recruitKind) : undefined
  const recruitCost = costInfo(recruitLottery, uiAssets)
  // GridLayoutGroup parameters parsed from the resultList MonoBehaviour raw
  // bytes (see lottery_runtime_data/result_render.json). Cells are placed
  // in resultList-local design space (1200×400) — the slot replacement
  // below renders inside the prefab's actual resultList RectTransform, so
  // there are NO hardcoded screen positions; the GridLayoutGroup is the
  // only source of truth.
  const grid = resultRender.grid
  const [cellW, cellH] = grid.cellSize as [number, number]
  const [spX, spY] = grid.spacing as [number, number]
  const cols = grid.constraintCount
  // resultTemplate subtree — one card per result. PrefabTree renders the
  // resultTemplate node with its real cardContainer scale 0.625 + thumb
  // subtree, automatically (via CSS transform cascade).
  const templateSubtree = subtreeAt(PREFAB_TREES.result, "UILotteryResult/container/modalContainer/modalFront/resultList/resultTemplate")
  if (!templateSubtree) {
    throw new Error('UILotteryResult prefab is missing the resultList/resultTemplate subtree')
  }
  const RESULT_LIST_PATH = "UILotteryResult/container/modalContainer/modalFront/resultList"
  return (
    <div className="absolute inset-0 z-50 overflow-hidden bg-black">
      {/* Result UI background loop — captured in-game from
          UILotteryResult's modalBackground after AnalysisCut hands off.
          With the prefab's modalBackground subtree hidden above, this
          video supplies the moving lensFlare / sage gradient backdrop in
          one shot. Muted + autoplay + loop satisfies browser policy. */}
      <video
        src={mediaUrl("/Video/result_ui/result_ui_loop.webm")}
        autoPlay
        muted
        playsInline
        loop
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Modal chrome via PrefabTree — full prefab hierarchy applied
          (masks, RectMask2D modal clip, all RectTransforms incl. their
          localScale). The resultList node is replaced via slotsReplaceSubtree
          so per-result cards are rendered INSIDE the prefab's actual
          resultList rect (1200×400), placed by the GridLayoutGroup cell math.
          No screen-space overlays, no hardcoded coordinates. */}
      <PrefabTree
        tree={PREFAB_TREES.result}
        designSize={PREFAB_DESIGN.result.size}
        fit={PREFAB_DESIGN.result.fit}
        imageMaterials={resultImageMaterials as ImageMaterialsJson}
        className="absolute inset-0 h-full w-full"
        hide={[
          // tutorialWindowArea is the in-game tutorial popup overlay. The
          // prefab ships it active=True so it'd render across the modal; v1
          // has no tutorial gating, hide it unconditionally.
          "UILotteryResult/container/modalContainer/modalFront/tutorialWindowArea",
          // Whole modalBackground subtree — the prefab's static gradient,
          // sage backdrop, decoration sprites + lensFlare/decoration animator.
          // result_ui_loop.webm now drives the background motion underneath
          // PrefabTree, so the prefab's background composites would just
          // overlay it. Hide everything under modalBackground in one shot.
          "UILotteryResult/container/modalContainer/modalBackground",
          // Hide the entire decisionContainer subtree. The prefab uses a
          // Unity HorizontalLayoutGroup on .../normal/container to arrange
          // wrapper (btnReturn) + btnDecision + btnAdvertisement at runtime;
          // PrefabTree doesn't simulate LayoutGroups so wrapper falls back to
          // its static anchor [0,0] (bottom-LEFT of container), pushing the
          // Return button into the bottom-left corner instead of centered.
          // exchangePoints (Bazaar Pts) base sprite also carries a "go to
          // bazaar" chevron at its right edge that we don't want exposed.
          // Rather than reimplement the HLG + clip the sprite, render
          // Return / Recruit / Bazaar Pts as a centered CSS overlay below
          // (matching the target screenshot exactly).
          "UILotteryResult/container/modalContainer/modalFront/decisionContainer",
          // "RESULT" is already baked into the result_ui_loop.webm bg
          // (the captured video includes the in-game title at the top),
          // so rendering the prefab's title TMP on top would double up.
          "UILotteryResult/container/modalContainer/modalFront/title",
        ]}
        slotsReplaceSubtree={{
          [RESULT_LIST_PATH]: (
            <div style={{ position: "absolute", inset: 0 }}>
              {results.map((result, i) => {
                const col = i % cols
                const row = Math.floor(i / cols)
                const x = grid.padding[0] + col * (cellW + spX)
                const y = grid.padding[1] + row * (cellH + spY)
                // Per-card hide list. CRITICAL: PrefabTree's hide check is
                //   `hideSet.has(n.path) || hideSet.has(n.name)`
                // — it matches the FULL prefab-rooted path OR the leaf name,
                // not partial mid-paths. The per-card PrefabTree feeds the
                // resultTemplate subtree returned by `subtreeAt`, which keeps
                // every node's ORIGINAL full path (rooted at "UILotteryResult/
                // container/modalContainer/modalFront/resultList/resultTemplate/
                // …"). Partial paths like "resultTemplate/container/cardGlow"
                // match NEITHER — the hide silently no-ops and the prefab
                // node renders normally. The earlier hide list did exactly
                // that, leaving `cardGlow` (additive_alpha_weighted →
                // mix-blend-mode: plus-lighter, per result_image_materials.json)
                // composited over every card as the "weird white halo".
                //   Use leaf names which are unique inside the subtree.
                //   - cardGlow            → additive plus-lighter on every card
                //   - inEffectsRarity*    → per-rarity in-VFX (additive)
                //   - inShortEffectsRarity*
                //   - itemEffectsRarity*
                //   - changeEffects       → dupe-conversion flare (additive)
                //   - itemContainer       → item-reward branch (we use chara
                //                           thumbReward instead)
                //   - badgeClassUp        → rank-up indicator (no class-up flow)
                const hideCard = [
                  "cardGlow",
                  "badgeClassUp",
                  "icNew",
                  "itemContainer",
                  "changeEffects",
                  "inEffectsRarity3",
                  "inEffectsRarity4",
                  "inEffectsRarity5",
                  "inEffectsRarity5-6Ultimate",
                  "inEffectsRarity5-6UltimatePlus",
                  "inEffectsRarity6Epic",
                  "inShortEffectsRarity3",
                  "inShortEffectsRarity4",
                  "inShortEffectsRarity5",
                  "inShortEffectsRarity5-6Ultimate",
                  "inShortEffectsRarity5-6UltimatePlus",
                  "inShortEffectsRarity6Epic",
                  "itemEffectsRarity5-6Ultimate",
                  "itemEffectsRarity5-6UltimatePlus",
                  "itemEffectsRarity6Epic",
                ]
                return (
                  <ResultCardWrapper
                    key={result.id}
                    x={x}
                    y={y}
                    w={cellW}
                    h={cellH}
                    cardIndex={i}
                  >
                    <PrefabTree
                      tree={templateSubtree}
                      designSize={[cellW, cellH]}
                      fit="stretch"
                      imageMaterials={resultImageMaterials as ImageMaterialsJson}
                      // PrefabTree's root has inline `position: relative` that
                      // beats Tailwind's `.absolute` (inline > class specificity).
                      // The ResultCardWrapper is `position: absolute width=cellW
                      // height=cellH` — without `inset:0` here the inner
                      // PrefabTree collapses to height=0 because its children
                      // are all absolutely positioned (no content height for
                      // a position:relative parent). Pass style so we win.
                      style={{ position: "absolute", inset: 0 }}
                      hide={hideCard}
                      // The badgeContainer is a VerticalLayoutGroup; the real
                      // game positions icNew via that LG (padding -35/-18 +
                      // UpperLeft alignment), not via icNew's static
                      // RectTransform. PrefabTree doesn't simulate LGs, so we
                      // override icNew's wrapper position with the LG-derived
                      // px values. badgeClassUp is hidden, so icNew is the
                      // VLG's first (only) visible child and lives at exactly
                      // (paddingLeft, paddingTop) in badgeContainer-local px.
                      nodeStyle={{ icNew: icNewVlgStyle() }}
                      slotsReplaceSubtree={{
                        // Match by leaf name. The full prefab path would be
                        // `UILotteryResult/container/modalContainer/modalFront/
                        // resultList/resultTemplate/container/cardContainer/
                        // thumbReward` — using just `thumbReward` is the
                        // documented PrefabTree.slotsReplaceSubtree behaviour
                        // (checks `n.path` first, then `n.name`).
                        thumbReward: (
                          <RuntimeThumbReward character={result.character} mode="base" />
                        ),
                      }}
                    />
                  </ResultCardWrapper>
                )
              })}
            </div>
          ),
        }}
      />
      {/* Bottom row overlay — replaces the prefab's decisionContainer
          (hidden above because its HorizontalLayoutGroup-driven positioning
          doesn't translate to CSS). Re-uses the SAME prefab-driven widgets
          the main banner page uses, so the visual identity is identical:
          - Bazaar Pts strip: PrefabLayer(SPECS.mainExchangePoints) with the
            same nodeStyle / hides as the main page Bazaar row.
          - Return: PrefabLayer(SPECS.mainRateBtn) — the prefab the main
            page uses for "Recruit Details/Drop Rates", scaled up here.
          - Recruit x10 More: DrawButton — the EXACT same component the main
            page uses for "Recruit x10" / "Recruit x1" (gem cost + icon). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[10%] z-[60] flex flex-col items-center gap-[30px]">
        <div className="pointer-events-auto w-[clamp(240px,22vw,360px)]">
          <PrefabLayer
            spec={SPECS.mainExchangePoints}
            className="w-full"
            hide={["badgeEx", "Exclamation", "btnExchangeList", "labelList"]}
            nodeStyle={{
              exchangeType: { left: "17%", top: "7.14%", width: "65%", height: "96.43%" },
              pointsAmount: { left: "31%", top: "15.18%", width: "45%", height: "80.36%" },
              btnQuestion: { left: "15.4%", top: "-16.07%", width: "13.95%", height: "142.86%" },
            }}
            text={{
              pointsAmount: `Bazaar Pts: ${bazaarPoints.toLocaleString()}`,
            }}
          />
        </div>
        <div className="pointer-events-auto flex items-end gap-[clamp(6px,0.8vw,16px)]">
          {/* Return: wrapper locks size to match Recruit (same width clamp
              + aspectRatio 286/130). Inside, PrefabLayer(mainRateBtn) with
              fill=true stretches into the wrapper, AND `slots.btnDetail`
              injects ButtonPatternFill — the SAME slot the main summon
              page passes to its "Recruit Details/Drop Rates" PrefabLayer
              (line ~5937). ButtonPatternFill is what gives the button its
              dark-pattern interior mask; without it the button reads as a
              hollow 9-slice frame. The insetX/insetY values are taken
              verbatim from the main page call so the pattern fills the
              same proportion of the visible button surface. */}
          <div
            className="w-[clamp(180px,11vw,260px)] cursor-pointer transition hover:brightness-110"
            style={{ aspectRatio: "286 / 130" }}
            onClick={onClose}
          >
            <PrefabLayer
              spec={SPECS.mainRateBtn}
              fill
              className="h-full w-full"
              slots={{ btnDetail: <ButtonPatternFill insetX={5.71} insetY={16.67} buttonW={280} buttonH={84} /> }}
              text={{ label: "Return" }}
            />
          </div>
          {/* Recruit-more: same prefab spec as the main page (orange button
              with cost+icon+count) but FORCE-FITTED to the same 280/84
              flat-rectangle aspect as Return so both Result UI buttons
              share footprint. fill=true drops the spec's 370/215 aspect
              lock; nodes (cost, icon, count) still position by canvas % so
              they scale proportionally into the shorter box. */}
          <div
            className="w-[clamp(180px,11vw,260px)] cursor-pointer transition hover:brightness-110"
            style={{ aspectRatio: "286 / 130" }}
            onClick={recruitLottery ? onRecruitMore : undefined}
          >
            <PrefabLayer
              spec={SPECS.mainDecisionContinuous}
              fill
              className="h-full w-full"
              hide={["paid", "label", "countPaid"]}
              text={{
                count: `Recruit x${results.length} More`,
                cost: recruitCost.value,
              }}
              slots={{
                icon: <GameImage sources={recruitCost.iconSources} className="h-full w-full object-contain" />,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Summon cutscene (data-driven from the banner's animation_group) -------
// Movie/Lottery/lottery_x.usm  ->  /Movie/Lottery/lottery_x.mp4 (extracted).
function lotteryMovieSrc(moviePath: string | null | undefined): string | null {
  if (!moviePath) return null
  const m = moviePath.match(/Movie\/Lottery\/([^/]+)\.usm$/i)
  return m ? `/Movie/Lottery/${m[1]}.mp4` : null
}

type CutsceneStep = { src: string; role: "intro" | "loop" | "mid" | "result" }
type CutsceneSelection = {
  steps: CutsceneStep[]
  patternAnimationType: number | null
  selectionMethodType: number | null
  cloakPerformanceSkip: boolean
}

// Legacy provisional selector, kept unused while the recovered selector below
// mirrors Tempest.LotteryPatterMovieUtility.GetPatternAnimation:
//   1. IsPickupCharacter(el) = el.PcId ∈ banner.pickup_animation_character_details_ids
//   2. IsPickupAndNew (we always treat pulls as never-owned) -> MasterOgc
//      LotterySelectionMethodType.HasPickupAndNew (1); otherwise the
//      HasPickupAndAlreadyHave (2) path. This is what makes the cutscene
//      genuinely change when the banner unit is pulled.
//   3. RandomPattern: weighted-random over the MasterOgcLotteryAnimationGroup
//      rows for (animation_group_group_id, selectionMethodType) by `rate`.
//   4. GetMovieAssets(type): the ordered step movies.
function pickupIdSet(banner: SummonBanner): Set<number> {
  const raw = (banner as { pickup_animation_character_details_ids?: number[] })
    .pickup_animation_character_details_ids
  return new Set((raw ?? banner.featured_character_ids ?? []).map(Number))
}

function selectSummonStepsLegacy(banner: SummonBanner, results: SummonResult[]): CutsceneStep[] {
  const ag = banner.animation_group
  if (!ag?.rows?.length || !ag.assets_by_animation_type) return []

  const pickups = pickupIdSet(banner)
  const isPickup = (r: SummonResult) =>
    r.character != null && pickups.has(Number(r.character.master_pc_id))
  // IsPickupAndNew vs (no-pickup / already-have). We never "already have", so
  // pulling a pickup -> HasPickupAndNew (1), else the standard path (2).
  const selectionMethodType = results.some(isPickup) ? 1 : 2

  let rows = ag.rows.filter(
    (r) =>
      Number(r.selection_method_type) === selectionMethodType &&
      (ag.assets_by_animation_type[String(r.animation_type)] || []).length > 0,
  )
  if (!rows.length) {
    rows = ag.rows.filter(
      (r) => (ag.assets_by_animation_type[String(r.animation_type)] || []).length > 0,
    )
  }
  if (!rows.length) return []

  // The reveal (final step) movie encodes the tier, fully data-driven:
  //  *_f_all / c004_f / *_f_*  -> the featured-character premium reveal
  //  c004_c / *_c_*            -> C tier   Â·  c004_b -> B   Â·  c004_a -> A
  const revealOf = (t: number) => {
    const a = ag.assets_by_animation_type[String(t)] || []
    return String(a.length ? a[a.length - 1].movie_path : "").toLowerCase()
  }
  const isFeaturedReveal = (t: number) => /(_f_all|c004_f|_f\.usm|_g_all|c004_g)/.test(revealOf(t))
  const tierOf = (t: number) => {
    const rv = revealOf(t)
    if (isFeaturedReveal(t)) return 4
    if (/c004_c|_c_loop|c003_05/.test(rv)) return 3
    if (/c004_b/.test(rv)) return 2
    return 1
  }
  const bestRarity = results.reduce(
    (m, r) => Math.max(m, r.bucket?.show_rarity || r.character?.rarity || 0),
    0,
  )
  const gotPickup = results.some(isPickup)
  // Pulling the pickup -> only the featured-character reveal animations are
  // eligible (this is what makes the cutscene visibly change). Otherwise the
  // standard tiers, capped by the best rarity actually rolled.
  let pool = rows.filter((r) =>
    gotPickup
      ? isFeaturedReveal(Number(r.animation_type))
      : !isFeaturedReveal(Number(r.animation_type)) &&
        tierOf(Number(r.animation_type)) <= (bestRarity >= 6 ? 3 : bestRarity >= 5 ? 2 : 1),
  )
  if (!pool.length) pool = gotPickup ? rows.filter((r) => isFeaturedReveal(Number(r.animation_type))) : rows
  if (!pool.length) pool = rows
  rows = pool

  // RandomPattern: weighted by the row `rate` (the recovered algorithm).
  const total = rows.reduce((s, r) => s + Math.max(1, Number(r.rate) || 0), 0)
  let roll = Math.random() * total
  let chosen = rows[0]
  for (const r of rows) {
    roll -= Math.max(1, Number(r.rate) || 0)
    if (roll <= 0) {
      chosen = r
      break
    }
  }
  const type = Number(chosen.animation_type)

  const assets = [...(ag.assets_by_animation_type[String(type)] || [])].sort(
    (a, b) => Number(a.step) - Number(b.step),
  )
  const steps: CutsceneStep[] = []
  assets.forEach((a, i) => {
    const src = lotteryMovieSrc(a.movie_path as string)
    if (!src) return
    const isLoop = /_loop\.usm$/i.test(String(a.movie_path))
    const role: CutsceneStep["role"] = isLoop
      ? "loop"
      : i === 0
        ? "intro"
        : i === assets.length - 1
          ? "result"
          : "mid"
    steps.push({ src, role })
  })
  return steps
}

type LotteryAnimationGroupRow = {
  animation_type?: number | string | null
  selection_method_type?: number | string | null
  rate?: number | string | null
  cloak_performance_skip?: boolean | number | string | null
}

type LotteryAnimationAssetRow = {
  movie_path?: string | null
  step?: number | string | null
}

type ProbabilityEntry = { type: number; define?: string; fallback: number }

// kPartenPathMovieDict from LotteryPatterMovieUtility..cctor. Master rows win;
// these paths are only used for types with no MasterOgcLotteryAnimation rows.
const LOTTERY_PATTERN_FALLBACK_MOVIES: Record<number, string[]> = {
  1: [
    "Movie/Lottery/lottery_c001_a.usm",
    "Movie/Lottery/lottery_c001_a_loop.usm",
    "Movie/Lottery/lottery_c002.usm",
    "Movie/Lottery/lottery_c003_01.usm",
    "Movie/Lottery/lottery_c004_a.usm",
  ],
  2: [
    "Movie/Lottery/lottery_c001_a.usm",
    "Movie/Lottery/lottery_c001_a_loop.usm",
    "Movie/Lottery/lottery_c002.usm",
    "Movie/Lottery/lottery_c003_01.usm",
    "Movie/Lottery/lottery_c004_a.usm",
  ],
  3: [
    "Movie/Lottery/lottery_c001_b.usm",
    "Movie/Lottery/lottery_c001_b_loop.usm",
    "Movie/Lottery/lottery_c002.usm",
    "Movie/Lottery/lottery_c003_01.usm",
    "Movie/Lottery/lottery_c004_b.usm",
  ],
  4: [
    "Movie/Lottery/lottery_c001_a.usm",
    "Movie/Lottery/lottery_c001_a_loop.usm",
    "Movie/Lottery/lottery_c002.usm",
    "Movie/Lottery/lottery_c003_01.usm",
    "Movie/Lottery/lottery_c004_a.usm",
  ],
  5: [
    "Movie/Lottery/lottery_c001_a.usm",
    "Movie/Lottery/lottery_c001_a_loop.usm",
    "Movie/Lottery/lottery_c002.usm",
    "Movie/Lottery/lottery_c003_02.usm",
    "Movie/Lottery/lottery_c004_a.usm",
  ],
  6: [
    "Movie/Lottery/lottery_c001_b.usm",
    "Movie/Lottery/lottery_c001_b_loop.usm",
    "Movie/Lottery/lottery_c002.usm",
    "Movie/Lottery/lottery_c003_01.usm",
    "Movie/Lottery/lottery_c004_b.usm",
  ],
  7: [
    "Movie/Lottery/lottery_c001_b.usm",
    "Movie/Lottery/lottery_c001_b_loop.usm",
    "Movie/Lottery/lottery_c002.usm",
    "Movie/Lottery/lottery_c003_03.usm",
    "Movie/Lottery/lottery_c004_b.usm",
  ],
  8: [
    "Movie/Lottery/lottery_c001_c.usm",
    "Movie/Lottery/lottery_c001_loop.usm",
    "Movie/Lottery/lottery_c002_c.usm",
    "Movie/Lottery/lottery_c003_02.usm",
    "Movie/Lottery/lottery_c004_c.usm",
  ],
  // IL2CPP keys are c001_e/c002_e/c004_e; MasterDefineAsset resolves them
  // to the shipped E5 files currently named c001_d/c003_04/c004_d.
  14: [
    "Movie/Lottery/lottery_c001_d.usm",
    "Movie/Lottery/lottery_c003_04.usm",
    "Movie/Lottery/lottery_c004_d.usm",
  ],
}

const LOTTERY_PROBABILITY_PATTERNS: Record<string, ProbabilityEntry[]> = {
  rarity3: [{ type: 1, define: "lottery.rarity3.probability.pattern.a3", fallback: 100 }],
  rarity4: [
    { type: 2, define: "lottery.rarity4.probability.pattern.a4", fallback: 50 },
    { type: 3, define: "lottery.rarity4.probability.pattern.b4", fallback: 50 },
  ],
  rarity5: [
    { type: 2, define: "lottery.rarity5.probability.pattern.a4", fallback: 5 },
    { type: 3, define: "lottery.rarity5.probability.pattern.b4", fallback: 5 },
    { type: 4, define: "lottery.rarity5.probability.pattern.a5", fallback: 10 },
    { type: 5, define: "lottery.rarity5.probability.pattern.a5z", fallback: 10 },
    { type: 6, define: "lottery.rarity5.probability.pattern.b5", fallback: 40 },
    { type: 7, define: "lottery.rarity5.probability.pattern.b5z", fallback: 15 },
    { type: 8, define: "lottery.rarity5.probability.pattern.c5", fallback: 15 },
  ],
  enhanced: [
    { type: 1, define: "lottery.enhanced.probability.pattern.a3", fallback: 3 },
    { type: 4, define: "lottery.enhanced.probability.pattern.a5", fallback: 7 },
    { type: 5, define: "lottery.enhanced.probability.pattern.a5z", fallback: 7 },
    { type: 6, define: "lottery.enhanced.probability.pattern.b5", fallback: 25 },
    { type: 7, define: "lottery.enhanced.probability.pattern.b5z", fallback: 10 },
    { type: 8, define: "lottery.enhanced.probability.pattern.c5", fallback: 10 },
    { type: 14, define: "lottery.enhanced.probability.pattern.e5", fallback: 35 },
  ],
  collaboration003Single: [{ type: 12, fallback: 100 }],
  collaboration003Multi: [
    { type: 13, define: "lottery.collaboration.003.probability.pattern.multi", fallback: 100 },
  ],
}

function weightedPick<T>(items: T[], weightOf: (item: T) => number): T | null {
  if (!items.length) return null
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0)
  if (total <= 0) return items[0]
  let roll = Math.random() * total
  for (const item of items) {
    roll -= Math.max(0, weightOf(item))
    if (roll < 0) return item
  }
  return items[0]
}

function truthyMasterFlag(value: boolean | number | string | null | undefined): boolean {
  if (value === true || value === 1) return true
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return normalized === "1" || normalized === "true"
  }
  return false
}

function resultRarity(result: SummonResult): number {
  return result.character?.rarity ?? result.bucket?.show_rarity ?? 0
}

function defineWeight(
  defineValues: Record<string, number> | undefined,
  defineName: string | undefined,
  fallback: number,
): number {
  if (!defineName) return fallback
  const value = Number(defineValues?.[defineName])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function randomPatternFromDefines(
  entries: ProbabilityEntry[],
  defineValues: Record<string, number> | undefined,
): number {
  const chosen = weightedPick(entries, (entry) => defineWeight(defineValues, entry.define, entry.fallback))
  return chosen?.type ?? 1
}

function lotteryAssetRowsForType(
  assetsByType: Record<string, Array<Record<string, unknown>>> | undefined,
  type: number,
): LotteryAnimationAssetRow[] {
  const masterRows = ([...(assetsByType?.[String(type)] ?? [])] as LotteryAnimationAssetRow[])
    .filter((row) => row.movie_path)
    .sort((a, b) => Number(a.step) - Number(b.step))
  if (masterRows.length) return masterRows
  return (LOTTERY_PATTERN_FALLBACK_MOVIES[type] ?? []).map((movie_path, index) => ({
    movie_path,
    step: index + 1,
  }))
}

function cutsceneStepsForType(
  assetsByType: Record<string, Array<Record<string, unknown>>> | undefined,
  type: number,
): CutsceneStep[] {
  const assets = lotteryAssetRowsForType(assetsByType, type)
  const steps: CutsceneStep[] = []
  assets.forEach((asset, index) => {
    const src = lotteryMovieSrc(asset.movie_path)
    if (!src) return
    const isLoop = /_loop\.usm$/i.test(String(asset.movie_path))
    const role: CutsceneStep["role"] = isLoop
      ? "loop"
      : index === 0
        ? "intro"
        : index === assets.length - 1
          ? "result"
          : "mid"
    steps.push({ src, role })
  })
  return steps
}

function collaboration003CharacterIds(defineValues: Record<string, number> | undefined): Set<number> {
  const ids = new Set<number>()
  for (let index = 1; index <= 5; index += 1) {
    const id = Number(defineValues?.[`lottery.collaboration.003.character${index}`] ?? 0)
    if (id) ids.add(id)
  }
  return ids
}

function isEnhancedLottery(
  banner: SummonBanner,
  defineReleaseLabels: Record<string, string> | undefined,
): boolean {
  const periodReleaseLabel = defineReleaseLabels?.["lottery.enhanced.period.releaselabel"]
  return Boolean(periodReleaseLabel && banner.release_label === periodReleaseLabel)
}

function selectNonPickupPatternAnimationType(
  banner: SummonBanner,
  results: SummonResult[],
  defineValues: Record<string, number> | undefined,
  defineReleaseLabels: Record<string, string> | undefined,
): number {
  const collaborationIds = collaboration003CharacterIds(defineValues)
  const collaborationCount = results.filter(
    (result) => result.character && collaborationIds.has(Number(result.character.master_pc_id)),
  ).length
  if (collaborationCount > 0) {
    return randomPatternFromDefines(
      LOTTERY_PROBABILITY_PATTERNS[collaborationCount >= 2 ? "collaboration003Multi" : "collaboration003Single"],
      defineValues,
    )
  }
  if (isEnhancedLottery(banner, defineReleaseLabels)) {
    return randomPatternFromDefines(LOTTERY_PROBABILITY_PATTERNS.enhanced, defineValues)
  }
  if (results.some((result) => resultRarity(result) >= 5)) {
    return randomPatternFromDefines(LOTTERY_PROBABILITY_PATTERNS.rarity5, defineValues)
  }
  if (results.some((result) => resultRarity(result) === 4)) {
    return randomPatternFromDefines(LOTTERY_PROBABILITY_PATTERNS.rarity4, defineValues)
  }
  return randomPatternFromDefines(LOTTERY_PROBABILITY_PATTERNS.rarity3, defineValues)
}

// Port of Tempest.LotteryPattern.LotteryPatterMovieUtility.GetPatternAnimation.
function selectSummonCutscene(
  banner: SummonBanner,
  results: SummonResult[],
  defineValues?: Record<string, number>,
  defineReleaseLabels?: Record<string, string>,
): CutsceneSelection {
  const ag = banner.animation_group
  if (!ag?.rows?.length) return { steps: [], patternAnimationType: null, selectionMethodType: null, cloakPerformanceSkip: false }

  const pickups = pickupIdSet(banner)
  const isPickup = (r: SummonResult) =>
    r.character != null && pickups.has(Number(r.character.master_pc_id))

  // We model non-duplicate pulls for now: pickup -> HasPickupAndNew (1).
  // HasPickupAndAlreadyHave (2) is reserved for duplicate pickup behavior.
  if (results.some(isPickup)) {
    const pickupRows = (ag.rows as LotteryAnimationGroupRow[]).filter(
      (row) => Number(row.selection_method_type) === 1,
    )
    const chosen = weightedPick(pickupRows, (row) => Number(row.rate) || 0)
    const type = Number(chosen?.animation_type ?? 0)
    return {
      steps: type ? cutsceneStepsForType(ag.assets_by_animation_type, type) : [],
      patternAnimationType: type || null,
      selectionMethodType: 1,
      cloakPerformanceSkip: truthyMasterFlag(chosen?.cloak_performance_skip),
    }
  }

  const type = selectNonPickupPatternAnimationType(banner, results, defineValues, defineReleaseLabels)
  return {
    steps: cutsceneStepsForType(ag.assets_by_animation_type, type),
    patternAnimationType: type,
    selectionMethodType: null,
    cloakPerformanceSkip: false,
  }
}

function SummonCutscene({ steps, onFinish }: { steps: CutsceneStep[]; onFinish: () => void }) {
  const [idx, setIdx] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const step = steps[idx]

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = 0
    const p = v.play()
    if (p && typeof p.catch === "function") p.catch(() => {})
  }, [idx])

  if (!step) return null
  const advance = () => {
    if (idx + 1 >= steps.length) onFinish()
    else setIdx((i) => i + 1)
  }

  // In-game the cutscene plays inside the summon window (above every element,
  // clipped by it) — not a browser-fullscreen overlay. Non-loop steps play
  // through automatically; a *_loop step is the "Tap Screen" hold that loops
  // until the player taps anywhere.
  const isLoop = step.role === "loop"
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black"
      onClick={isLoop ? advance : undefined}
      style={isLoop ? { cursor: "pointer" } : undefined}
    >
      <video
        ref={videoRef}
        key={step.src}
        src={mediaUrl(step.src)}
        className="h-full w-full object-contain"
        autoPlay
        // Special-skill movies are extracted from the game's original USM
        // assets and carry an AAC stereo audio track. They play during the
        // reveal flow only after the user has already tapped Pull, so
        // browsers' autoplay-with-audio policy allows it without `muted`.
        playsInline
        preload="auto"
        loop={isLoop}
        onEnded={isLoop ? undefined : advance}
        onError={advance}
      />
      {isLoop && (
        <span className="pointer-events-none absolute bottom-5 right-6 font-serif text-2xl font-bold italic tracking-wide text-foreground drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] [animation:pulse_1.4s_ease-in-out_infinite]">
          Tap Screen
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onFinish()
        }}
        className="absolute right-6 top-4 select-none font-serif text-2xl font-bold italic tracking-wide text-foreground drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] transition hover:text-foreground/70"
      >
        SKIP ▶▶|
      </button>
    </div>
  )
}

// RESULT-grid card glows + in-effects per ResultCardRarityKey. Sprites are
// the actual atlas hashes from UILotteryResult.resultTemplate (every
// inEffectsRarityN sub-tree has its own glow sprite); the ResultCardRarityKey
// resolution lives in VIEW_RULES.result.card_in_effects_per_rarity (which
// records the prefab GameObject name + sprite for each rarity bucket).
//
// cardGlow      = inEffectsRarity3/4/5
// cardGlowEpic  = inEffectsRarity6Epic
// cardGlowUltimate = inEffectsRarity5-6Ultimate
// cardGlowUltimatePlus = inEffectsRarity5-6UltimatePlus
const CARD_GLOW_PER_RARITY_KEY: Record<ResultCardRarityKey, string> = {
  _3: "5f30cfecfee854ef.png",
  _4: "5f30cfecfee854ef.png",
  _5: "5f30cfecfee854ef.png",
  _5_6_Ultimate: "e4d8c08d31e57835.png",
  _5_6_UltimatePlus: "2af75184c34b968f.png",
  _6_Epic: "2c7b81397a15314a.png",
}

// CharacterAppearViewRarity + per-rarity sprites/star counts/shadow tints come
// from VIEW_RULES (transcribed from the UILotteryCharacterAppear prefab tree;
// see lib/summon-ui/lottery-view-rules.json). Do NOT duplicate any mapping
// here — update the JSON instead. Local helpers below just adapt the
// SummonResult shape into the RarityInputs the helper expects.
type CharacterAppearAssets = {
  bg: string // sprite name (atlas), resolved via spriteUrl()
  magicCircle: string
  base: string
  line: string
  rimuru: string
  star: string
  starCount: number
  showUltimateFrame: boolean
}

function spriteUrl(name: string) {
  return `${SUMMON_UI_BASE}/${name}.png`
}

function characterAppearAssets(rarity: CharacterAppearViewRarity): CharacterAppearAssets {
  const nameplate = nameplateSpritesFor(rarity)
  const bg = backgroundSpritesFor(rarity)
  return {
    bg: bg.bg,
    magicCircle: bg.magicCircle,
    base: nameplate.base,
    line: nameplate.line,
    rimuru: nameplate.rimuru,
    star: nameplate.star,
    starCount: starCountFor(rarity),
    showUltimateFrame: VIEW_RULES.characterAppear.frameURUltimate_visible_for.includes(rarity),
  }
}

function characterAppearRarity(result: SummonResult): CharacterAppearViewRarity {
  const character = result.character
  const rarity = character?.rarity ?? result.bucket?.show_rarity ?? 3
  return characterAppearRarityFor({
    rarity,
    arousal_type_raw: character?.ui_thumb?.arousal_type_raw ?? null,
  })
}

// Star positions come straight from the prefab via the flat
// lottery-character-appear.json spec (flatten_screen.py transcribed
// rarity1..rarity6 RectTransforms: x≈22.97/26.25/29.48/32.71/35.89/35.89%,
// y≈82.59%). We DON'T override them — PrefabLayer renders the prefab
// positions. The only per-rarity change is hiding rarityN nodes beyond
// starCount (handled by hiddenAppearNodes).
//
// Known gap: the in-game animator re-centers the star row for 3★/4★/6★
// (the prefab static layout is the 5★ spread). Recentering needs the
// UILotteryCharacterAppear Animator clip — see SUMMON_REVEAL_STATUS.md.
// We apply only a horizontal shift of the whole row so N stars stay
// visually centred under the nameplate, derived from the prefab's own
// rarity1↔rarity5 span (no magic numbers — span comes from the spec).
function characterAppearStarRowShift(spec: PrefabSpec, starCount: number): Record<string, CSSProperties> {
  // The prefab places rarity1..rarity5 at evenly-spaced x positions (22.97% →
  // 35.89%, step ≈ 3.23%) and rarity6 collocated with rarity5 — the in-game
  // animator clip both re-centres the row for 3★/4★ AND displaces rarity6 to
  // the right of rarity5 for 6★. We mirror the recentring statically via a
  // horizontal `left` override per star. No animator clip extraction needed;
  // values are derived from the prefab's own rarity1↔rarity5 span.
  //
  // Each rarity<N>Effect anchor (sibling of rarity<N> under rarityStar) has
  // an analogous prefab position; the in-game animator clip slides the
  // rarity<N>Effect anchors by exactly the same X delta as the rarity<N>
  // stars (the burst always tracks its star). We mirror that here by
  // emitting `left` overrides for both the rarity<N> star sprite AND the
  // rarity<N>Effect anchor with the same delta.
  const stars = spec.nodes.filter((n) => /^rarity[1-6]$/.test(n.name))
  if (stars.length < 5 || starCount < 1 || starCount > 6) return {}
  const x1 = stars.find((n) => n.name === "rarity1")?.x ?? 0
  const x5 = stars.find((n) => n.name === "rarity5")?.x ?? 0
  const w = stars.find((n) => n.name === "rarity1")?.w ?? 0
  const step = (x5 - x1) / 4 // prefab's own per-star step
  const fullCenter = x1 + (step * 4) / 2 + w / 2 // centre of the 5★ span (≈31.46%)
  if (starCount === 5) return {} // default prefab layout is already correct
  const styles: Record<string, CSSProperties> = {}
  function setX(i: number, leftPct: number) {
    styles[`rarity${i}`] = { left: `${leftPct}%` }
    // Mirror the same X onto the rarity<N>Effect anchor; the star burst
    // canvas (slot-injected at rarity<N>Effect) follows the star sideways.
    styles[`rarity${i}Effect`] = { left: `${leftPct}%` }
  }
  if (starCount === 6) {
    // 6★ — keep the row centred on the 5★ centre by spanning 5 step intervals
    // (= same per-star spacing) symmetrically. First-star x slides slightly
    // left, rarity6 lands one step beyond rarity5's original slot.
    const newX1 = fullCenter - (step * 5) / 2 - w / 2
    for (let i = 1; i <= 6; i += 1) setX(i, newX1 + step * (i - 1))
    return styles
  }
  // 1–4★: existing logic — shift remaining N stars to centre under nameplate.
  const usedCenter = x1 + (step * (starCount - 1)) / 2 + w / 2
  const shift = fullCenter - usedCenter
  for (let i = 1; i <= starCount; i += 1) {
    const node = stars.find((n) => n.name === `rarity${i}`)
    if (node) setX(i, node.x + shift)
  }
  return styles
}

// --- UILotteryCharacterAppear runtime animation (1:1 from Appear<Rarity>
// AnimationClips, muscle-clip decoded; see character_appear_anim.json) ------
type AppearAnimRarity = "R" | "SR" | "SSR" | "SSRUltimate" | "UREx" | "URUltimate"
type AppearBgPatternRec = {
  // bgPattern.m_Color.a — sprite tint alpha. Keys or const (URUltimate).
  bgPatternAlphaKeys?: [number, number][]
  bgPatternAlphaConst?: number
  // bgPatternAdd.m_Alpha — CanvasGroup alpha. Keys or const (URUltimate -129
  // clamps to 0 → fully transparent for that rarity).
  bgPatternAddAlphaKeys?: [number, number][]
  bgPatternAddAlphaConst?: number
  // bgPatternAdd.m_Color.a — sprite tint alpha constant. Multiplied with the
  // CanvasGroup alpha to get the final visible opacity.
  bgPatternAddColorAlphaConst?: number
  // bgPattern.m_Color.r/g/b — uniform brightness multiplier. 1.0 for the
  // standard rarities; 1.18 (HDR brightness) for Ultimate-tier.
  bgPatternColorTint?: number
}
type AppearAnimRec = {
  clip: string
  startTime: number
  stopTime: number
  shadowColor: { r: number; g: number; b: number; a: number }
  gradationActive: Record<string, number>
  starScale: Record<string, [number, number][]>
  starEffectScale: Record<string, [number, number][]>
  bgPattern?: AppearBgPatternRec
}
const APPEAR_ANIM = (characterAppearAnim as unknown as { rarities: Record<string, AppearAnimRec> }).rarities

function appearAnimFor(viewRarity: CharacterAppearViewRarity): AppearAnimRec {
  const rec = APPEAR_ANIM[viewRarity as AppearAnimRarity]
  if (!rec) {
    throw new Error(`character_appear_anim.json is missing an entry for view rarity "${viewRarity}". Update the extracted clip data instead of falling back.`)
  }
  return rec
}

// Convert a real Unity keyframe list [[timeSec, value], …] + clip stopTime
// into Web-Animations keyframes (offset 0..1, transform scale). 1:1 — the
// timing/values are exactly the AnimationClip's.
//
// Pass-15d offset-bookending: if the first keyframe is at t>0 or the last is
// at t<stopTime, WAAPI implicit-frames offset=0 and offset=1 to the element's
// UNDERLYING CSS value (the prefab-static localScale). That causes a visible
// zoom from the last explicit keyframe to the prefab default at the END of
// the animation — the "character zooms in near the end" the user reported.
// Fix: clamp by holding the first keyframe's value at offset=0 and the last
// keyframe's value at offset=1. Mirrors Unity's AnimationClip behaviour
// (pre-first/post-last frames hold the bracketing keyframe value).
function bookendKeyframes(frames: Keyframe[]): Keyframe[] {
  if (!frames.length) return frames
  const first = frames[0]
  const last = frames[frames.length - 1]
  const out: Keyframe[] = []
  if ((first.offset ?? 0) > 0) out.push({ ...first, offset: 0 })
  out.push(...frames)
  if ((last.offset ?? 1) < 1) out.push({ ...last, offset: 1 })
  return out
}

function scaleKeyframesToWAAPI(keys: [number, number][], stopTime: number): Keyframe[] {
  if (!keys.length) return [{ transform: "scale(1)" }]
  const dur = stopTime > 0 ? stopTime : keys[keys.length - 1][0] || 1
  return bookendKeyframes(keys.map(([t, v]) => ({
    offset: Math.max(0, Math.min(1, t / dur)),
    transform: `scale(${v})`,
  })))
}

// Convert Unity (timeSec, value) keyframes into WAAPI opacity keyframes.
// Multiplies each value by an optional constant (the static sprite-color alpha
// that the wrapped CanvasGroup alpha multiplies with at draw time). Values are
// clamped to [0, 1] — Unity HDR values like 2.5 or -129 are sentinels Unity
// itself clamps before the GPU sees them, so we clamp here too.
function opacityKeyframesToWAAPI(keys: [number, number][], stopTime: number, mul = 1): Keyframe[] {
  if (!keys.length) return [{ opacity: 1 }]
  const dur = stopTime > 0 ? stopTime : keys[keys.length - 1][0] || 1
  return bookendKeyframes(keys.map(([t, v]) => ({
    offset: Math.max(0, Math.min(1, t / dur)),
    opacity: Math.max(0, Math.min(1, v * mul)),
  })))
}

// bgPattern + bgPatternAdd are RawImage layers (sprite 8e74bff8cfcbb886.png)
// whose visibility is animator-driven inside each Appear<Rarity> clip — the
// prefab ships both at alpha=0/CanvasGroup-default and the clip fades them in.
// PrefabTree's default render skips alpha=0 nodes (correctly — they would be
// invisible without the animator) so we inject these layers as slots and own
// their lifecycle here. Sprite path + base tint colour come from the prefab
// RawImage data (UILotteryCharacterAppear.tree.json):
//   bgPattern    : m_Color = (0.7403, 0.7217, 1.0, animated)   — light-blue
//   bgPatternAdd : m_Color = (1, 1, 1, 0.4627 baseline)         — white
const APPEAR_BG_PATTERN_SPRITE = "8e74bff8cfcbb886.png"
const APPEAR_BG_PATTERN_COLOR = { r: 0.7402514815330505, g: 0.7216981053352356, b: 1.0 }

function appearBgPatternMaskStyle(brightness: number): CSSProperties {
  // Apply the per-rarity brightness multiplier (1.0 standard, 1.18 Ultimate-
  // tier) via CSS `filter: brightness(...)` — Unity's HDR multiplier above 1.0
  // can't be reproduced exactly in CSS but `filter: brightness(1.18)` is the
  // closest 1-1 equivalent for a non-tinted source.
  const r = Math.round(APPEAR_BG_PATTERN_COLOR.r * 255)
  const g = Math.round(APPEAR_BG_PATTERN_COLOR.g * 255)
  const b = Math.round(APPEAR_BG_PATTERN_COLOR.b * 255)
  return {
    position: "absolute",
    inset: 0,
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    WebkitMaskImage: `url(${SUMMON_UI_BASE}/${APPEAR_BG_PATTERN_SPRITE})`,
    maskImage: `url(${SUMMON_UI_BASE}/${APPEAR_BG_PATTERN_SPRITE})`,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    filter: brightness !== 1 ? `brightness(${brightness})` : undefined,
  }
}

function appearBgPatternAddStyle(): CSSProperties {
  // bgPatternAdd uses the same sprite at white tint. White colour means we can
  // emit the raw <img> instead of a mask div — render path matches PrefabTree's
  // own non-tinted rawImage branch.
  return {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "fill",
  }
}

// CharacterAppearBgPatternLayer / CharacterAppearBgPatternAddLayer are the two
// animator-fade-in DOM nodes for the bgPattern / bgPatternAdd RawImages. Each
// owns its own DOM element + WAAPI lifecycle so the prefab cascade stays
// untouched. The component reads keyframes from character_appear_anim.json
// (the same bgPattern block this code already imports as AppearAnimRec) and
// animates the inner element's opacity 1:1 with the clip's recovered
// keyframes (no eyeballed timings).
function CharacterAppearBgPatternLayer({ rarity }: { rarity: CharacterAppearViewRarity }) {
  const anim = appearAnimFor(rarity)
  const bg = anim.bgPattern
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !bg) return
    let initial = 0
    if (bg.bgPatternAlphaKeys && bg.bgPatternAlphaKeys.length) {
      const frames = opacityKeyframesToWAAPI(bg.bgPatternAlphaKeys, anim.stopTime)
      initial = bg.bgPatternAlphaKeys[0]?.[1] ?? 0
      el.style.opacity = String(Math.max(0, Math.min(1, initial)))
      el.animate(frames, { duration: Math.max(1, anim.stopTime * 1000), easing: "linear", fill: "both" })
    } else if (typeof bg.bgPatternAlphaConst === "number") {
      el.style.opacity = String(Math.max(0, Math.min(1, bg.bgPatternAlphaConst)))
    }
  }, [bg, anim.stopTime])
  // brightness 1.0 for non-Ultimate; 1.18 for Ultimate tier (HDR multiplier).
  const brightness = bg?.bgPatternColorTint ?? 1
  return <div ref={ref} style={{ ...appearBgPatternMaskStyle(brightness), opacity: 0 }} />
}

// CharacterAppearBloomFilter — renders an SVG <filter> that reproduces the
// URP Bloom volume override (LotteryCharacterAppear_00). URP's Bloom is a
// multi-iteration downscale-blur-upscale pyramid: it threshold-extracts
// bright HDR pixels, then blurs them at a sequence of mip levels (typically
// 6 octaves), then upsamples and combines them with scatter-controlled
// inter-level weights, finally adding the result back to the source at the
// intensity scalar. To stay 1:1 with the extracted Volume parameters while
// running inside an SVG <filter>, this filter:
//
//   1. Extracts luminance (Rec.709) replicated to R/G/B.
//   2. Linear-remaps via feComponentTransfer to mask pixels with luma >=
//      threshold (slope = 1/(1-threshold), intercept = -threshold*slope).
//   3. Multiplies the source by the mask → bright-only buffer.
//   4. Tints the bright buffer with the Volume's tint vector.
//   5. Runs THREE Gaussian blurs at sigmas spaced by exponential octaves —
//      the smallest is the inner glow, the middle is the mid-spread, the
//      largest is the wide halo. All three sigmas are tied to the Volume's
//      scatter parameter (scatter ∈ [0, 1] linearly scales the spread of
//      each level). This is the SVG equivalent of URP's pyramid: each blur
//      acts as one "level", and their sum reproduces the multi-octave
//      character of the pyramid.
//   6. Sums the three blurs (feComposite arithmetic chain), then composites
//      the sum back onto the source as `source + intensity * (sum/3)` so the
//      intensity scalar keeps its URP-side meaning (one-pass intensity scale
//      across the whole pyramid).
//
// HDR semantics — real platform limit
// URP threshold operates on linear-HDR luma (pixels can exceed 1.0 via
// emissive materials). Standard sRGB browser rendering clamps each channel
// to [0, 1], so a Unity-rendered pixel at HDR luma 1.5 looks identical to
// a clamped pixel at 1.0 in the browser. The selection rule (luma >=
// threshold) is exact in this filter; the loss is HDR-distinct pixels
// collapsing to the same value before reaching the filter. Reproducing
// HDR-distinct selection requires either:
//   (a) An HDR-capable canvas with high-precision colour buffers (not yet
//       widely available in mainstream browsers — Canvas API doesn't
//       expose HDR sample formats), OR
//   (b) Prerendering the CharacterAppear scene from Unity/Android with the
//       bloom baked in, and compositing the prerendered output as a
//       per-rarity overlay video.
// Option (b) is the same path Promotion / AnalysisCut already use, and is
// the documented exact route for matching URP bloom semantics 1:1. The SVG
// filter below is the in-browser implementation; it is data-driven (every
// parameter ties to the Volume profile) but cannot recover HDR-distinct
// selection in sRGB rendering.
function CharacterAppearBloomFilter({
  id,
  bloom,
}: {
  id: string
  bloom: { threshold: number; intensity: number; scatter: number; tint: { r: number; g: number; b: number; a: number } }
}) {
  const { threshold, intensity, scatter, tint } = bloom
  const slope = 1 / Math.max(0.0001, 1 - threshold)
  const intercept = -threshold * slope
  // Three octaves; sigmas spaced by 3x to mimic URP's downscale-by-2-per-mip
  // multi-iteration pyramid (3 levels covers the visible falloff range).
  // Each octave's sigma is linearly tied to scatter.
  const sigma1 = scatter * 10
  const sigma2 = scatter * 30
  const sigma3 = scatter * 90
  // Per-level intensity weight. The sum of three blurs is divided by 3 so
  // the `intensity` scalar keeps the URP meaning of "add intensity x bright
  // accumulator to source". Divisor inlined into k3 below to avoid an extra
  // feComposite multiplication.
  const k3PerLevel = intensity / 3
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
      aria-hidden
    >
      <defs>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          {/* 0. Pre-multiply RGB by alpha. URP Bloom operates on the
              POST-composition framebuffer (RGB already alpha-blended onto
              the scene). The SVG filter runs PRE-composition on the element's
              own RGBA buffer, where partially-transparent sprites still have
              full RGB. Without pre-multiplying, a 5%-alpha white pattern
              presents as luma=1.0 to the threshold step and gets bloomed
              into a full-white halo — exactly the B-PASS4-2 nameplate
              artifact. The feComposite operator="in" multiplies in1 (the
              SourceGraphic RGBA) by in2.alpha (also SourceGraphic), giving
              RGBA = (R*A, G*A, B*A, A*A). The luma calc then sees the
              effective rendered luminance instead of the under-alpha RGB. */}
          <feComposite in="SourceGraphic" in2="SourceGraphic" operator="in" result="premul" />
          {/* 1. Per-pixel luminance (Rec. 709) replicated on R/G/B. */}
          <feColorMatrix
            in="premul"
            type="matrix"
            values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
            result="luma"
          />
          {/* 2. Threshold: linear remap [threshold, 1] -> [0, 1], clamped to [0, 1]. */}
          <feComponentTransfer in="luma" result="mask">
            <feFuncR type="linear" slope={slope} intercept={intercept} />
            <feFuncG type="linear" slope={slope} intercept={intercept} />
            <feFuncB type="linear" slope={slope} intercept={intercept} />
          </feComponentTransfer>
          {/* 3. Multiply premul (RGB×alpha) by mask → keep original colors at
              bright POST-COMPOSED pixels only. Using `premul` here keeps the
              additive contribution consistent with Unity's framebuffer-based
              bloom: bright low-alpha pixels contribute proportionally less. */}
          <feComposite in="premul" in2="mask" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="bright" />
          {/* 4. Apply tint multiplier from the Volume profile. */}
          <feColorMatrix
            in="bright"
            type="matrix"
            values={`${tint.r} 0 0 0 0  0 ${tint.g} 0 0 0  0 0 ${tint.b} 0 0  0 0 0 1 0`}
            result="tinted"
          />
          {/* 5a. Inner glow — smallest sigma. */}
          <feGaussianBlur in="tinted" stdDeviation={sigma1} result="blur1" />
          {/* 5b. Mid-spread — 3x sigma. */}
          <feGaussianBlur in="tinted" stdDeviation={sigma2} result="blur2" />
          {/* 5c. Wide halo — 9x sigma. */}
          <feGaussianBlur in="tinted" stdDeviation={sigma3} result="blur3" />
          {/* 6. Sum the three levels via arithmetic composite chain (additive).
              Final composite adds (intensity/3 × each blur) to the source. */}
          <feComposite in="blur1" in2="blur2" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="sum12" />
          <feComposite in="sum12" in2="blur3" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="sum123" />
          <feComposite in="SourceGraphic" in2="sum123" operator="arithmetic" k1="0" k2="1" k3={k3PerLevel} k4="0" />
        </filter>
      </defs>
    </svg>
  )
}

function CharacterAppearBgPatternAddLayer({ rarity }: { rarity: CharacterAppearViewRarity }) {
  const anim = appearAnimFor(rarity)
  const bg = anim.bgPattern
  const ref = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !bg) return
    // bgPatternAdd visible opacity = CanvasGroup.m_Alpha * sprite.m_Color.a.
    // The CanvasGroup alpha is keyframed; the sprite alpha is either const
    // (extracted) or the prefab default 0.4627. We multiply them.
    const spriteAlpha =
      typeof bg.bgPatternAddColorAlphaConst === "number" ? bg.bgPatternAddColorAlphaConst : 0.4627451002597809
    if (bg.bgPatternAddAlphaKeys && bg.bgPatternAddAlphaKeys.length) {
      const frames = opacityKeyframesToWAAPI(bg.bgPatternAddAlphaKeys, anim.stopTime, spriteAlpha)
      const initial = bg.bgPatternAddAlphaKeys[0]?.[1] ?? 0
      el.style.opacity = String(Math.max(0, Math.min(1, initial * spriteAlpha)))
      el.animate(frames, { duration: Math.max(1, anim.stopTime * 1000), easing: "linear", fill: "both" })
    } else if (typeof bg.bgPatternAddAlphaConst === "number") {
      const v = Math.max(0, Math.min(1, bg.bgPatternAddAlphaConst * spriteAlpha))
      el.style.opacity = String(v)
    }
  }, [bg, anim.stopTime])
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      ref={ref}
      src={`${SUMMON_UI_BASE}/${APPEAR_BG_PATTERN_SPRITE}`}
      alt=""
      draggable={false}
      style={{ ...appearBgPatternAddStyle(), opacity: 0 }}
    />
  )
}

// The prefab's `shadow` Image colour is set per-rarity by the Appear<Rarity>
// AnimationClip (constant m_Color). Real rgba values, no invention:
// R/SSR=blue(0.165,0,1,0.8), SR=gold(0.557,0.511,0.365,0.8),
// SSRUltimate/UREx=magenta(0.96,0.231,1,0.251), URUltimate=white(1,1,1,0.706).
function CharacterAppearShadow({ rarity }: { rarity: CharacterAppearViewRarity }) {
  const shadowSprite = `${SUMMON_UI_BASE}/2901538d38c52c3d.png` // sprite name "shadow"
  const c = appearAnimFor(rarity).shadowColor
  const rgba = `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`
  // Unity's "shadow" sprite is a RGB-only radial gradient (white centre,
  // dark edges) with a fully-opaque alpha channel. Without `mask-mode:
  // luminance`, CSS treats the mask as alpha → fully visible → solid blue
  // rectangle. Force luminance mode so the gradient brightness clips the
  // shadow to a soft radial glow, matching the in-game behaviour.
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: rgba,
        WebkitMaskImage: `url(${shadowSprite})`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "100% 100%",
        maskImage: `url(${shadowSprite})`,
        maskRepeat: "no-repeat",
        maskSize: "100% 100%",
        ...({ WebkitMaskSourceType: "luminance" } as React.CSSProperties),
        maskMode: "luminance",
      }}
    />
  )
}


function resultGlow(result: SummonResult): string {
  const rarity = result.character?.rarity ?? result.bucket?.show_rarity ?? 3
  const key = resultCardRarityKeyFor({
    rarity,
    arousal_type_raw: result.character?.ui_thumb?.arousal_type_raw ?? null,
  })
  return CARD_GLOW_PER_RARITY_KEY[key]
}


type PcLotteryMessage = NonNullable<SummonPayload["pc_lottery_messages"]>[string]
type AnalysisCutViewRarity = "R" | "SR" | "SSR"
// AnalysisCut runs once per session (LotteryAnimationAnalysisCutState in IL2CPP),
// so it's NOT in RevealPhase — RevealPhase is only the per-result iteration
// that happens inside LotteryCharacterAcquisitionState.
type RevealPhase = "generic" | "phrase" | "movie" | "appear"

type AnalysisCutPrerenderVariant = {
  id: string
  startRarity: AnalysisCutViewRarity
  fixRarity: AnalysisCutViewRarity
  src: string
  status?: string
}

const analysisCutPrerenderManifest = analysisCutPrerenderRaw as {
  variants: AnalysisCutPrerenderVariant[]
}

type PromotionPrerenderVariant = {
  id: string
  startRarity: PromotionViewRarity
  fixRarity: PromotionViewRarity
  src: string
  status?: string
}

const promotionPrerenderManifest = promotionPrerenderRaw as {
  variants: PromotionPrerenderVariant[]
}

// Route C: per-viewRarity prerendered VFX background clip. When a viewRarity
// has a populated clip entry, FullArtRevealStage mounts the video behind the
// PrefabTree dynamic foreground AND suppresses the CSS LotteryParticles
// instances that the prerender replaces (ef_sageBg BG canvas, ef_appear
// full-stage canvas, rarityNEffect per-star canvases). When the entry is null,
// the website falls back to the existing CSS pipeline.
// See _work/character_appear_rendering_strategy.md (route C) +
// _work/character_appear_vfx_prerender_layer_split.md.
type CharacterAppearVfxPrerenderClip = {
  clip_path: string
  duration_s: number
  alpha_mode: "alpha-webm" | "premultiplied-on-black-mp4" | "straight-on-black-mp4"
  composite_mode: "normal" | "screen" | "lighter" | "plus-lighter"
  design_resolution: [number, number]
  start_offset_s: number
  capture_method: string
  source_prefab: string
  source_state: string
  included_paths?: string[]
  hidden_paths?: string[]
  captured_at?: string
  notes?: string
  // Seconds (from start of clip) where the loopable idle tail begins. When
  // present, the reveal layer seeks here on `ended` and plays forward
  // indefinitely — i.e. the burst-in plays once, the long-tail idle loops.
  // When absent (legacy 1.5s burst-only clips), the layer freezes on the
  // last frame and uses the CSS breathing fallback instead.
  loop_start_s?: number
}

const characterAppearVfxPrerenderManifest = characterAppearVfxPrerenderRaw as unknown as {
  clips: Record<CharacterAppearViewRarity, CharacterAppearVfxPrerenderClip | null>
}

function characterAppearVfxPrerenderClipFor(
  rarity: CharacterAppearViewRarity,
): CharacterAppearVfxPrerenderClip | null {
  return characterAppearVfxPrerenderManifest.clips?.[rarity] ?? null
}

// Pass-10 layer split: ONLY the things we can't reproduce in DOM/canvas at
// fidelity live in the bg prerender video (cosmic galaxy, central radial
// burst, URP bloom proxies, gradation/frame URP shaders, ef_sageBg
// particles). EVERYTHING ELSE renders in DOM/PrefabTree:
//   - container/charaModel/d2Container/d2  (character art, WAAPI fade/slide)
//   - container/characterName/base          (plate body + frame sprite)
//   - container/characterName/rarityStar    (star sprites + per-star scale
//                                            curve from Appear<rarity> clip
//                                            + per-star burst particle VFX
//                                            via LotteryParticles emitter)
//   - container/characterName/characterName (per-character NAME text)
//   - container/characterName/characterTitle (per-character TITLE text)
//
// Rationale: plate+stars need to render IN FRONT of the character, but
// baking them into the bg video forces them behind (wrong z-order). Plate
// body, star sprites, and the per-star scale-pop are all deterministic from
// prefab data + the Appear<rarity> AnimationClip, so DOM is fully capable.
// The per-star burst (rarity{N}Effect ParticleSystem) uses the same
// LotteryParticles infrastructure already used for the CSS fallback.
const CHARACTER_APPEAR_VFX_PRERENDER_HIDE_PATHS: ReadonlyArray<string> = [
  // Top-level postprocess plates (URP bloom proxy meshes baked into bg video)
  "UILotteryCharacterAppear/postprocess/bloom",
  "UILotteryCharacterAppear/postprocess/bloomURUltimate",
  "UILotteryCharacterAppear/postprocess/blur",
  // Full-stage BG / overlay nodes baked into bg video
  "UILotteryCharacterAppear/container/bgBlack",
  "UILotteryCharacterAppear/container/bgPattern",
  "UILotteryCharacterAppear/container/bgPatternAdd",
  "UILotteryCharacterAppear/container/noise",
  "UILotteryCharacterAppear/container/shadow",
  "UILotteryCharacterAppear/container/gradationUltimate",
  "UILotteryCharacterAppear/container/gradationSSR",
  "UILotteryCharacterAppear/container/gradation",
  "UILotteryCharacterAppear/container/frameURUltimate",
  "UILotteryCharacterAppear/container/letterBox",
  // Cosmic-galaxy BG + central burst + render-texture infrastructure
  "UILotteryCharacterAppear/container/centers",
  "UILotteryCharacterAppear/container/ef_appear",
  "UILotteryCharacterAppear/container/addURUltimateEffectContainer",
  "UILotteryCharacterAppear/container/renderTexture",
  "UILotteryCharacterAppear/container/effectCamera",
  // Note: container/characterName/base + container/characterName/rarityStar
  // are NOT hidden — they render in DOM in front of the character (Pass-10).
]

const ANALYSIS_CUT_FIX_RARITY_BY_PATTERN_TYPE: Record<number, AnalysisCutViewRarity> = {
  1: "R",
  2: "SR",
  3: "SR",
  4: "SSR",
  5: "SSR",
  6: "SSR",
  7: "SSR",
  8: "SSR",
}

function isCollaborationPatternAnimationType(patternAnimationType: number | null): boolean {
  return patternAnimationType === 10 || patternAnimationType === 11 || patternAnimationType === 12 || patternAnimationType === 13
}

function isEnhancedPatternAnimationType(patternAnimationType: number | null): boolean {
  return patternAnimationType === 14
}

function shouldSkipAnalysisCut(patternAnimationType: number | null, cloakPerformanceSkip: boolean): boolean {
  if (!patternAnimationType) return true
  return (
    isCollaborationPatternAnimationType(patternAnimationType) ||
    isEnhancedPatternAnimationType(patternAnimationType) ||
    cloakPerformanceSkip
  )
}

function analysisCutFixRarityForPattern(patternAnimationType: number | null): AnalysisCutViewRarity {
  if (!patternAnimationType) return "R"
  return ANALYSIS_CUT_FIX_RARITY_BY_PATTERN_TYPE[patternAnimationType] ?? "R"
}

function analysisCutPrerenderClipFor(fixRarity: AnalysisCutViewRarity): AnalysisCutPrerenderVariant | null {
  return (
    analysisCutPrerenderManifest.variants.find(
      (variant) => variant.startRarity === "R" && variant.fixRarity === fixRarity,
    ) ?? null
  )
}

function isPickupResult(result: SummonResult, banner: SummonBanner): boolean {
  const pcId = result.character?.master_pc_id
  return pcId != null && pickupIdSet(banner).has(Number(pcId))
}

function promotionViewRarity(
  result: SummonResult,
  banner: SummonBanner,
  patternAnimationType: number | null,
  fiveStarOrdinal: number,
): { startRarity: PromotionViewRarity; fixRarity: PromotionViewRarity } {
  return promotionViewRarityFor(
    {
      rarity: resultRarity(result),
      arousal_type_raw: result.character?.ui_thumb?.arousal_type_raw ?? null,
      is_pickup: isPickupResult(result, banner),
    },
    patternAnimationType,
    fiveStarOrdinal,
  )
}

function promotionPrerenderClipFor(
  startRarity: PromotionViewRarity,
  fixRarity: PromotionViewRarity,
): PromotionPrerenderVariant | null {
  return (
    promotionPrerenderManifest.variants.find(
      (variant) => variant.startRarity === startRarity && variant.fixRarity === fixRarity,
    ) ?? null
  )
}

// Session-level AnalysisCut (UILotteryAnimationAnalysisCut). Runs ONCE per
// summon session before the per-result Promotion loop, escalating
// startRarity=R through fixRarity (R, SR, or SSR) via ChangeNextRarity calls
// inside a single UILotteryAnimationAnalysisCut.Entity. fixRarity comes from
// the session-level patternAnimationType (already chosen in selectSummonCutscene).
function AnalysisCutPrerenderRevealScreen({
  fixRarity,
  onAdvance,
}: {
  fixRarity: AnalysisCutViewRarity
  onAdvance: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const clip = analysisCutPrerenderClipFor(fixRarity)
  const src = clip?.src ?? null
  const canPlay = Boolean(src && clip?.status !== "missing_prerender")

  useEffect(() => {
    if (!canPlay) {
      const handle = window.setTimeout(onAdvance, 0)
      return () => window.clearTimeout(handle)
    }
    const video = videoRef.current
    if (!video || !src) return
    video.currentTime = 0
    const play = video.play()
    if (play && typeof play.catch === "function") play.catch(() => {})
  }, [canPlay, onAdvance, src])

  return (
    <div
      key={`analysis-${fixRarity}`}
      className="absolute inset-0 z-50 overflow-hidden bg-black"
      data-analysis-cut-start-rarity="R"
      data-analysis-cut-fix-rarity={fixRarity}
      data-analysis-cut-source={src ?? "missing"}
      data-analysis-cut-status={clip?.status ?? "missing"}
    >
      {canPlay && src ? (
        <video
          ref={videoRef}
          key={src}
          src={mediaUrl(src)}
          className="h-full w-full object-cover"
          // object-cover: cloak video is 1920x864 (phone's 2.22:1 native). On
          // a 16:9 stage, object-cover scales by 1.25x to fill height, with
          // 240 stage-px crop on each side. The cloak silhouette is centered
          // and well within the cropped frame; the lost pixels are the outer
          // cosmic-aura gutters that extended beyond the 1920x1080 container.
          // Switched from object-contain (which letterboxed top/bottom and
          // produced visible black bars in the website) to match the
          // CharacterAppear stage's behaviour.
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={onAdvance}
          onError={onAdvance}
        />
      ) : null}
      {/* The Cloak escalation SE (game's XIUISEPlayer.seGroupList on the
          UILotteryAnimationAnalysisCut prefab). Plays in parallel with the
          muted prerender video. */}
      <SummonSE sources={cloakSEForFixRarity(fixRarity) ? [cloakSEForFixRarity(fixRarity)!] : []} />
      <button className="absolute inset-0 z-10 cursor-pointer" aria-label="Advance analysis cut reveal" onClick={onAdvance} />
    </div>
  )
}

function PromotionPrerenderRevealScreen({
  resultId,
  promotion,
  onAdvance,
}: {
  resultId: string
  promotion: { startRarity: PromotionViewRarity; fixRarity: PromotionViewRarity }
  onAdvance: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const clip = promotionPrerenderClipFor(promotion.startRarity, promotion.fixRarity)
  const src = clip?.src ?? null

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return
    video.currentTime = 0
    const play = video.play()
    if (play && typeof play.catch === "function") play.catch(() => {})
  }, [src])

  return (
    <div
      key={`${resultId}-${promotion.startRarity}-${promotion.fixRarity}`}
      className="absolute inset-0 z-50 overflow-hidden bg-black"
      data-start-rarity={promotion.startRarity}
      data-fix-rarity={promotion.fixRarity}
      data-promotion-source={src ?? "missing"}
      data-promotion-status={clip?.status ?? "missing"}
    >
      {src ? (
        <video
          ref={videoRef}
          key={src}
          src={mediaUrl(src)}
          className="h-full w-full object-contain"
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={onAdvance}
          onError={onAdvance}
        />
      ) : null}
      {/* UILotteryPromotion SE (XIUISEPlayer.seGroupList on the prefab) —
          per (startRarity, fixRarity) measurement clip. */}
      <SummonSE sources={
        promotionSEForRarity(promotion.startRarity, promotion.fixRarity)
          ? [promotionSEForRarity(promotion.startRarity, promotion.fixRarity)!]
          : []
      } />
      <button className="absolute inset-0 z-10 cursor-pointer" aria-label="Advance promotion reveal" onClick={onAdvance} />
    </div>
  )
}

// Route C: prerendered VFX background layer for CharacterAppear. Mounts a
// `<video>` behind PrefabTree's dynamic foreground. The clip holds only the
// shader-heavy + particle layers (ef_sageBg, ef_appear, rarityNEffect bursts,
// URP postprocess) that CSS/2D-canvas cannot reproduce in LDR — character
// art, nameplate, stars, and text continue to render through PrefabTree on
// top. See _work/character_appear_rendering_strategy.md route C.
//
// alpha_mode determines compositing:
//   - "alpha-webm"                       — VP9-alpha, normal compositing (alpha channel handles transparency)
//   - "premultiplied-on-black-mp4"       — opaque on black; mix-blend-mode: "lighter" or "screen" composites additively over the dark stage backdrop
//   - "straight-on-black-mp4"            — same as above but straight (non-premul) alpha; same blend treatment
function CharacterAppearVfxPrerenderLayer({
  resultId,
  rarity,
  clip,
}: {
  resultId: string
  rarity: CharacterAppearViewRarity
  clip: CharacterAppearVfxPrerenderClip
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const src = clip.clip_path

  useEffect(() => {
    const v = videoRef.current
    if (!v || !src) return
    v.currentTime = clip.start_offset_s ?? 0
    const p = v.play()
    if (p && typeof p.catch === "function") p.catch(() => {})
  }, [src, clip.start_offset_s])

  // When the clip ends, seek back to its designated idle-tail start and
  // keep playing forward. The re-shot clips contain a one-shot burst-in
  // followed by an idle tail; the burst plays once, the tail loops
  // indefinitely. If a clip doesn't declare a loop point (shouldn't
  // happen post-reshoot), we freeze on the final frame as a safe no-op.
  const handleEnded = (): void => {
    const v = videoRef.current
    if (!v) return
    const loopStart = clip.loop_start_s
    if (typeof loopStart === "number" && loopStart >= 0) {
      v.currentTime = loopStart
      const p = v.play()
      if (p && typeof p.catch === "function") p.catch(() => {})
      return
    }
    if (Number.isFinite(v.duration)) {
      v.currentTime = Math.max(0, v.duration - 0.02)
    }
    v.pause()
  }

  const mixBlendMode = clip.alpha_mode === "alpha-webm" ? undefined : clip.composite_mode

  return (
    <div
      key={`${resultId}-vfx-prerender-${rarity}`}
      className="pointer-events-none absolute inset-0"
      data-vfx-prerender-rarity={rarity}
      data-vfx-prerender-source={src}
      data-vfx-prerender-alpha={clip.alpha_mode}
      data-vfx-prerender-blend={clip.composite_mode}
      style={mixBlendMode ? ({ mixBlendMode } as CSSProperties) : undefined}
    >
      <video
        ref={videoRef}
        src={mediaUrl(src)}
        className="h-full w-full object-cover"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={handleEnded}
      />
    </div>
  )
}

function pcLotteryMessageFor(
  result: SummonResult,
  pcLotteryMessages: SummonPayload["pc_lottery_messages"],
): PcLotteryMessage | null {
  const pcId = result.character?.master_pc_id
  return pcId ? (pcLotteryMessages?.[String(pcId)] ?? null) : null
}

// CharacterAcquisitionElement.IsPlayMovie = !string.IsNullOrEmpty(MoviePath).
// The mp4 source comes from the extracted SpecialSkill USM if available; the
// fallback derives the candidate URL from MoviePath itself so the frontend
// can probe it (when the SpecialSkill extraction job has shipped). When the
// extraction is missing the AcquisitionMovieReveal stage will fail-fast and
// the orchestrator skips it.
function acquisitionMovieSource(message: PcLotteryMessage | null): string | null {
  if (!message?.is_play_movie) return null
  const fromPayload = message.movie?.sources?.[0]
  if (fromPayload) return fromPayload
  return specialSkillMoviePathFor(message.movie_path)
}

// Movie/SpecialSkill/<name>_Battle_SpecialSkill/<name>_SpecialSkill_<NNN>.usm
// -> /Movie/SpecialSkill/<name>_SpecialSkill_<NNN>.mp4
// Movie/BlessSkill/<name>_Battle_BlessSkill/<name>_Battle_BlessSkill.usm
// -> /Movie/BlessSkill/<name>_Battle_BlessSkill.mp4
function specialSkillMoviePathFor(usmPath: string | null | undefined): string | null {
  if (!usmPath) return null
  const ss = usmPath.match(/Movie\/SpecialSkill\/[^/]+\/([^/]+)\.usm$/i)
  if (ss) return `/Movie/SpecialSkill/${ss[1]}.mp4`
  const bs = usmPath.match(/Movie\/BlessSkill\/[^/]+\/([^/]+)\.usm$/i)
  if (bs) return `/Movie/BlessSkill/${bs[1]}.mp4`
  return null
}

// S2 (2026-05-22 audit, asm-verified): `UICharacterAcquisitionAnimationPresenter
// .ShowLotteryTextAnnounceAsync` (state machine RVA 0xAAB1FF4) early-exits if
// EITHER `element.Announce` OR `element.VoicePath` is null/whitespace —
// IsNullOrWhiteSpace checks at asm 0xAAB2170..0xAAB217C (Announce, offset 0x38)
// and 0xAAB2188..0xAAB2194 (VoicePath, offset 0x40). The screen requires
// BOTH non-empty before opening.
function hasTextAnnounce(message: PcLotteryMessage | null): boolean {
  if (!message) return false
  if (!message.lottery_message?.trim()) return false
  if (!message.voice_path?.trim()) return false
  return true
}

// /Voice/Lottery/<charName>_<NNN>_gacha.wav candidate path derived from
// MasterPcLotteryMessage.VoicePath. The earlier extractor planned to emit
// .ogg (smaller) but the actual pipeline shipped only .wav (0/259 .ogg
// exist), so the .ogg attempt was a guaranteed 404 + a wasted network
// round-trip before the audio re-render. Drop the .ogg candidate entirely.
function voiceAudioCandidates(voicePath: string | null | undefined): string[] {
  if (!voicePath) return []
  // VoicePath e.g. "Sound/AudioClip/VOICE/RimuruDefault/voice_RimuruDefault_001_gacha.wav"
  const m = voicePath.match(/voice_([^/]+)\.wav$/i) || voicePath.match(/voice_([^/]+)$/i)
  if (!m) return []
  const stem = m[1]
  return [`/Voice/Lottery/voice_${stem}.wav`]
}

// UILotteryPromotion - the hieroglyph rarity reveal. Plays for EVERY pulled
// unit (the prefab has rerity3/rerity4/rerity5/rerity5UltimatePlusPU as
// siblings and IL2CPP Set() activates whichever matches ViewRarity).
// Runtime bindings come from UILotteryPromotion.bindings.json: full prefab
// paths, TMP material refs, SimpleTweenTMPSage timings, CanvasGroup alphas,
// ColorGradient_* children, and decoded Animator clips.
type PromoRerity = "rerity3" | "rerity4" | "rerity5" | "rerity5UltimatePlusPU"
type PromotionColor = { r?: number; g?: number; b?: number; a?: number; rgba?: number } | null
type PromotionTween = { charDuration?: number; interval?: number }
type PromotionTmpPanel = {
  text?: string
  fontSize?: number
  fontColor?: PromotionColor
  sharedMaterial?: { name?: string | null }
  colorGradientChildren?: string[]
  simpleTweenTMPSage?: PromotionTween
}
type PromotionClipKey = { time: number; value: number }
type PromotionClipBinding = { path: string; property: string; first?: number; last?: number; keys?: PromotionClipKey[] }
type PromotionClip = { stopTime?: number; bindings?: PromotionClipBinding[] }
type PromotionBindings = {
  tmpTextPanels: Record<string, PromotionTmpPanel>
  colorGradientChildren: Record<string, { image?: { img?: string | null } }>
  animators: Record<string, { clipBindings?: Record<string, PromotionClip> }>
}
type TenslafontMaterial = {
  colors?: Record<string, PromotionColor>
  floats?: Record<string, number>
}

const promotionBindings = promotionBindingsRaw as PromotionBindings
const tenslafontMaterials = tenslafontMaterialsRaw as Record<string, TenslafontMaterial>

const RERITY_FOR_VIEW_RARITY: Record<PromotionViewRarity, PromoRerity> = {
  R: "rerity3",
  SR: "rerity4",
  SSR: "rerity5",
  SSRUltimatePlusPU: "rerity5UltimatePlusPU",
}

// Text groups are addressed through textAnimatorList order R/SR/SSR/PU.
// The DOM keeps the real TMP panel and ColorGradient child paths; slots only
// replace each node's visual primitive.
const PROMO_TEXT_GROUPS = [
  { group: "BackText", clip: "BackTextAnimationIn", loopClip: "BackTextLoop", leaves: ["Back00", "Back01"] },
  { group: "MiddleText", clip: "MiddleTextAnimationIn", loopClip: "MiddleTextLoop", leaves: ["Middle00", "Middle01"] },
  { group: "FrontText", clip: "FrontTextAnimationIn", loopClip: "FrontTextLoop", leaves: ["Front00", "Front01"] },
] as const

const PROMO_DETECT_LABELS = [
  "UILotteryPromotion/container/detectRog/label00",
  "UILotteryPromotion/container/detectRog/label01",
  "UILotteryPromotion/container/detectRog/label02",
]

const PROMO_BASE_KEYFRAMES = `
@keyframes promo-text-alpha {
  0% { opacity: 0; }
  14.2857% { opacity: 1; }
  100% { opacity: 1; }
}
@keyframes promo-panel-scroll-in {
  0% { transform: translateY(var(--promo-y-start)); }
  14.2857% { transform: translateY(var(--promo-y-start)); }
  100% { transform: translateY(var(--promo-y-end)); }
}
@keyframes promo-panel-scroll-loop {
  0% { transform: translateY(var(--promo-loop-y-start)); }
  100% { transform: translateY(var(--promo-loop-y-end)); }
}`

function promotionColorParts(color: PromotionColor, fallback: [number, number, number, number] = [255, 255, 255, 1]): [number, number, number, number] {
  if (!color) return fallback
  if (typeof color.rgba === "number") {
    const p = color.rgba >>> 0
    return [p & 255, (p >>> 8) & 255, (p >>> 16) & 255, ((p >>> 24) & 255) / 255]
  }
  const r = color.r ?? 1
  const g = color.g ?? 1
  const b = color.b ?? 1
  const a = color.a ?? 1
  const scale = Math.max(r, g, b) <= 1.0001 ? 255 : 1
  return [Math.round(r * scale), Math.round(g * scale), Math.round(b * scale), a <= 1.0001 ? a : a / 255]
}

function promotionColorCss(color: PromotionColor, fallback?: [number, number, number, number]): string {
  const [r, g, b, a] = promotionColorParts(color, fallback)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function multiplyPromotionColors(base: PromotionColor, mul: PromotionColor): string {
  const [br, bg, bb, ba] = promotionColorParts(base)
  const [mr, mg, mb, ma] = promotionColorParts(mul)
  return `rgba(${Math.round((br * mr) / 255)}, ${Math.round((bg * mg) / 255)}, ${Math.round((bb * mb) / 255)}, ${ba * ma})`
}

function promotionGlyphFill(panel: PromotionTmpPanel): { color: string; glyphStyle: CSSProperties } {
  const material = panel.sharedMaterial?.name ? tenslafontMaterials[panel.sharedMaterial.name] : null
  const face = material?.colors?._FaceColor ?? null
  const outline = material?.colors?._OutlineColor ?? null
  const underlay = material?.colors?._UnderlayColor ?? null
  const glow = material?.colors?._GlowColor ?? null
  const color = face ? multiplyPromotionColors(panel.fontColor ?? null, face) : promotionColorCss(panel.fontColor ?? null)
  const shadows: string[] = []
  if ((outline?.a ?? 0) > 0.001) shadows.push(`drop-shadow(0 0 1.5px ${promotionColorCss(outline)})`)
  if ((underlay?.a ?? 0) > 0.001) shadows.push(`drop-shadow(0 2px 2px ${promotionColorCss(underlay)})`)
  if ((glow?.a ?? 0) > 0.001 && (material?.floats?._GlowOuter ?? 0) > 0) {
    shadows.push(`drop-shadow(0 0 4px ${promotionColorCss(glow)})`)
  }
  const gradientSprite = panel.colorGradientChildren
    ?.map((p) => promotionBindings.colorGradientChildren[p]?.image?.img)
    .find(Boolean)
  const glyphStyle: CSSProperties = shadows.length ? { filter: shadows.join(" ") } : {}
  if (gradientSprite) {
    glyphStyle.backgroundImage = `url(${SUMMON_UI_BASE}/${gradientSprite})`
    glyphStyle.backgroundRepeat = "repeat"
    glyphStyle.backgroundSize = "128px 128px"
  }
  return { color, glyphStyle }
}

function finiteClipKeys(binding: PromotionClipBinding | undefined): PromotionClipKey[] {
  return (binding?.keys ?? []).filter((k) => Number.isFinite(k.time) && k.time > -100000)
}

function promotionBinding(animatorPath: string, clipName: string, targetPath: string, property: string): PromotionClipBinding | undefined {
  return promotionBindings.animators[animatorPath]?.clipBindings?.[clipName]?.bindings?.find(
    (b) => b.path === targetPath && b.property === property,
  )
}

function promotionTreeNode(path: string): { rect?: { anchoredPosition?: [number, number] }; children?: unknown[]; path?: string } | null {
  const stack: Array<any> = [PREFAB_TREES.promotion.root]
  while (stack.length) {
    const node = stack.pop()
    if (node?.path === path) return node
    for (const child of node?.children ?? []) stack.push(child)
  }
  return null
}

function promotionAnchoredYOffset(path: string, clipY: number): number {
  const defaultY = promotionTreeNode(path)?.rect?.anchoredPosition?.[1] ?? 0
  return -(clipY - defaultY)
}

function promotionTextNodeStyles(activeRerity: PromoRerity): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {}
  for (const groupDef of PROMO_TEXT_GROUPS) {
    const animatorPath = `UILotteryPromotion/container/${activeRerity}/${groupDef.group}`
    const clip = promotionBindings.animators[animatorPath]?.clipBindings?.[groupDef.clip]
    const durationMs = Math.round((clip?.stopTime ?? 1.166667) * 1000)
    styles[animatorPath] = { animation: `promo-text-alpha ${durationMs}ms linear forwards` }
    for (const leaf of groupDef.leaves) {
      const panelPath = `${animatorPath}/${leaf}`
      const yBinding = promotionBinding(animatorPath, groupDef.clip, panelPath, "m_AnchoredPosition.y")
      const keys = finiteClipKeys(yBinding)
      const startY = keys[0]?.value ?? yBinding?.first
      const endY = keys[keys.length - 1]?.value ?? yBinding?.last
      if (typeof startY !== "number" || typeof endY !== "number") continue
      const loop = promotionBinding(animatorPath, groupDef.loopClip, panelPath, "m_AnchoredPosition.y")
      const loopMs = Math.round((promotionBindings.animators[animatorPath]?.clipBindings?.[groupDef.loopClip]?.stopTime ?? 1) * 1000)
      const loopKeys = finiteClipKeys(loop)
      const loopStart = loopKeys[0]?.value ?? startY
      const loopEnd = loopKeys[loopKeys.length - 1]?.value ?? endY
      styles[panelPath] = {
        "--promo-y-start": `${promotionAnchoredYOffset(panelPath, startY)}px`,
        "--promo-y-end": `${promotionAnchoredYOffset(panelPath, endY)}px`,
        "--promo-loop-y-start": `${promotionAnchoredYOffset(panelPath, loopStart)}px`,
        "--promo-loop-y-end": `${promotionAnchoredYOffset(panelPath, loopEnd)}px`,
        animation: `promo-panel-scroll-in ${durationMs}ms linear forwards, promo-panel-scroll-loop ${loopMs}ms linear ${durationMs}ms infinite`,
      } as CSSProperties
    }
  }
  return styles
}

function promotionRootClipName(startRarity: PromotionViewRarity, fixRarity: PromotionViewRarity): "SSRPromotion" | "SSRUltimatePlusPUPromotion" | null {
  if (startRarity !== "SR") return null
  if (fixRarity === "SSR") return "SSRPromotion"
  if (fixRarity === "SSRUltimatePlusPU") return "SSRUltimatePlusPUPromotion"
  return null
}

function cssPct(time: number, stopTime: number): string {
  return `${Math.max(0, Math.min(100, (time / stopTime) * 100)).toFixed(4)}%`
}

function promotionKeyframesForBinding(name: string, binding: PromotionClipBinding, stopTime: number, cssProperty: string, valueMap: (value: number) => string): string {
  const keys = finiteClipKeys(binding)
  if (!keys.length) return ""
  const withEdges = [...keys]
  if (withEdges[0].time > 0) withEdges.unshift({ time: 0, value: withEdges[0].value })
  if (withEdges[withEdges.length - 1].time < stopTime) withEdges.push({ time: stopTime, value: withEdges[withEdges.length - 1].value })
  const body = withEdges.map((k) => `${cssPct(k.time, stopTime)} { ${cssProperty}: ${valueMap(k.value)}; }`).join("\n")
  return `@keyframes ${name} {\n${body}\n}`
}

function promotionRootClipStyles(startRarity: PromotionViewRarity, fixRarity: PromotionViewRarity): { styles: Record<string, CSSProperties>; css: string } {
  const clipName = promotionRootClipName(startRarity, fixRarity)
  if (!clipName) return { styles: {}, css: "" }
  const clip = promotionBindings.animators.UILotteryPromotion?.clipBindings?.[clipName]
  const stopTime = clip?.stopTime ?? 2.166667
  const styles: Record<string, CSSProperties> = {}
  const css: string[] = []
  for (const labelPath of PROMO_DETECT_LABELS) {
    const binding = clip?.bindings?.find((b) => b.path === labelPath && b.property === "m_Alpha")
    if (!binding) continue
    const name = `promo-${clipName}-${labelPath.split("/").pop()}`
    css.push(promotionKeyframesForBinding(name, binding, stopTime, "opacity", (v) => String(v)))
    styles[labelPath] = { animation: `${name} ${Math.round(stopTime * 1000)}ms linear forwards` }
  }
  const framePath = "UILotteryPromotion/container/detectRog/frameMsak"
  const fill = clip?.bindings?.find((b) => b.path === framePath && b.property === "m_FillAmount")
  if (fill) {
    const name = `promo-${clipName}-frameMsak`
    css.push(promotionKeyframesForBinding(name, fill, stopTime, "clip-path", (v) => `inset(0 ${Math.round((1 - v) * 100)}% 0 0)`))
    styles[framePath] = { animation: `${name} ${Math.round(stopTime * 1000)}ms linear forwards` }
  }
  return { styles, css: css.join("\n") }
}

function promotionRaritySwitchMs(startRarity: PromotionViewRarity, fixRarity: PromotionViewRarity): number {
  const clipName = promotionRootClipName(startRarity, fixRarity)
  if (!clipName) return 0
  const startPath = `UILotteryPromotion/container/${RERITY_FOR_VIEW_RARITY[startRarity]}`
  const binding = promotionBindings.animators.UILotteryPromotion?.clipBindings?.[clipName]?.bindings?.find(
    (b) => b.path === startPath && b.property === "m_IsActive",
  )
  const offKey = finiteClipKeys(binding).find((k) => k.time > 0 && k.value <= 0.001)
  return Math.round((offKey?.time ?? 1.25) * 1000)
}

function PromotionGradientBindingMarker({ path }: { path: string }) {
  const sprite = promotionBindings.colorGradientChildren[path]?.image?.img ?? ""
  return <span aria-hidden="true" data-promotion-gradient-path={path} data-source-sprite={sprite} style={{ display: "none" }} />
}

function PromotionTextPanel({ path, center = false }: { path: string; center?: boolean }) {
  const panel = promotionBindings.tmpTextPanels[path]
  if (!panel) return null
  const fill = promotionGlyphFill(panel)
  const tween = panel.simpleTweenTMPSage
  return (
    <TenslafontText
      text={panel.text ?? ""}
      fontSize={panel.fontSize ?? 64}
      color={fill.color}
      glyphStyle={fill.glyphStyle}
      staggerMs={(tween?.interval ?? 0.0075) * 1000}
      charDurationMs={(tween?.charDuration ?? 0.02) * 1000}
      animationKey={path}
      letterSpacingEm={0}
      lineHeightMul={1.15}
      style={
        center
          ? { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }
          : { width: "100%", height: "100%" }
      }
    />
  )
}

function PromotionRevealScreen({
  result,
  banner,
  patternAnimationType,
  fiveStarOrdinal,
  onAdvance,
}: {
  result: SummonResult
  banner: SummonBanner
  patternAnimationType: number | null
  fiveStarOrdinal: number
  onAdvance: () => void
}) {
  const promotion = promotionViewRarity(result, banner, patternAnimationType, fiveStarOrdinal)
  const fixRarity = promotion.fixRarity
  const startRarity = promotion.startRarity
  const [activeRarity, setActiveRarity] = useState<PromotionViewRarity>(startRarity)
  useEffect(() => {
    if (startRarity === fixRarity) return
    const handle = setTimeout(() => setActiveRarity(fixRarity), promotionRaritySwitchMs(startRarity, fixRarity))
    return () => clearTimeout(handle)
  }, [startRarity, fixRarity])

  const activeRerity = RERITY_FOR_VIEW_RARITY[activeRarity]
  const allRerities = Object.values(RERITY_FOR_VIEW_RARITY)

  // Hide every rerity subtree that isn't the active one.
  const hidePaths = allRerities
    .filter((r) => r !== activeRerity)
    .map((r) => `UILotteryPromotion/container/${r}`)

  const slots: Record<string, ReactNode> = {}
  for (const groupDef of PROMO_TEXT_GROUPS) {
    for (const leaf of groupDef.leaves) {
      const path = `UILotteryPromotion/container/${activeRerity}/${groupDef.group}/${leaf}`
      slots[path] = <PromotionTextPanel path={path} />
    }
  }
  for (const path of PROMO_DETECT_LABELS) {
    slots[path] = <PromotionTextPanel path={path} center />
  }
  for (const path of Object.keys(promotionBindings.colorGradientChildren)) {
    slots[path] = <PromotionGradientBindingMarker path={path} />
  }
  // Unity uses frameMsak's Image as a mask/fill carrier. The tree keeps the
  // object and children, but the browser must not draw its 2x2 mask graphic as
  // a full-screen white rectangle.
  slots["UILotteryPromotion/container/detectRog/frameMsak"] = <PromotionGradientBindingMarker path="UILotteryPromotion/container/detectRog/frameMsak" />
  // SKIP button label override (prefab text is "SKIP" via Localize).
  slots["UILotteryPromotion/container/btnSkip/label"] = (
    <div className="flex h-full w-full items-center justify-center font-serif italic text-foreground">SKIP</div>
  )
  // Parent the per-rarity glow particles to the real uiparticle_<rarity>
  // rect (instead of canvas-centred). The prefab has these sibling groups:
  //   uiparticle_SR / uiparticle_SSR / uiparticle_SSR_ad /
  //   uiparticle_SSRUltimatePlusPU / uiparticle_SSRUltimatePlusPU_ad
  // and they're inactive by default; show only the active rarity's group
  // and slot the particle emitter as its child.
  const uiparticleMap: Partial<Record<PromotionViewRarity, string[]>> = {
    R: [],
    SR: ["uiparticle_SR"],
    SSR: ["uiparticle_SSR", "uiparticle_SSR_ad"],
    SSRUltimatePlusPU: ["uiparticle_SSRUltimatePlusPU", "uiparticle_SSRUltimatePlusPU_ad"],
  }
  const showParticleNodes = (uiparticleMap[activeRarity] ?? []).map((n) => `UILotteryPromotion/container/${n}`)
  // Slot a LotteryParticles layer inside the first uiparticle_<rarity> node
  // (so it spawns within that node's RectTransform, not at the canvas centre).
  if (showParticleNodes.length > 0) {
    slots[showParticleNodes[0]] = (
      <LotteryParticles systems={PROMOTION_GLOW_PARTICLES} className="absolute inset-0 h-full w-full" />
    )
  }
  const rootClip = promotionRootClipStyles(startRarity, fixRarity)
  const nodeStyle = { ...promotionTextNodeStyles(activeRerity), ...rootClip.styles }

  return (
    <div
      key={`${result.id}-${activeRarity}`}
      className="absolute inset-0 z-50 overflow-hidden bg-black"
      onClick={onAdvance}
      style={{ cursor: "pointer" }}
      data-start-rarity={startRarity}
      data-fix-rarity={fixRarity}
      data-active-rarity={activeRarity}
      data-rerity={activeRerity}
    >
      <style>{`${PROMO_BASE_KEYFRAMES}\n${rootClip.css}`}</style>
      {/* Real UILotteryPromotion prefab tree: container/background (solid
          black) + uiparticle_<rarity> + per-rerity Back/Middle/Front text
          panels + detectRog + btnSkip. TMP panels and ColorGradient children
          are slotted by exact prefab path while preserving children, masks,
          sibling order, CanvasGroups, and parent RectTransform chain. */}
      <PrefabTree
        tree={PREFAB_TREES.promotion}
        designSize={PREFAB_DESIGN.promotion.size}
        fit={PREFAB_DESIGN.promotion.fit}
        className="absolute inset-0 h-full w-full"
        hide={hidePaths}
        show={showParticleNodes}
        slots={slots}
        nodeStyle={nodeStyle}
      />

    </div>
  )
}


// Animated star wrapper for CharacterAppear rarity stars — pop in one at a
// time with a slight bounce + glow. Order matches the in-game animator clip
// which lights each rarity1..rarityN in sequence after the character lands.
// Static star sprite injected into the rarityN slot when rendering via
// PrefabTree. The pop-scale animation (3.0/6.0 → 1.0 from the decoded
// AppearN clip) is applied by `onNodes` directly to the rarityN element's
// transform via WAAPI — the slot is just the sprite fill.
function CharacterAppearStarPlain({ src }: { src: string }) {
  return (
    <img
      src={spriteUrl(src)}
      alt=""
      draggable={false}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 6px rgba(255,255,255,0.8))" }}
    />
  )
}

// UILotteryTextAnnounce — the per-unit announce text screen.
// announceText comes from MasterPcLotteryMessage.LotteryMessage (FlatBuffer
// resolved via the L10N table at _work/summon_textassets/L10NPcLotteryMessage.dat).
// CharacterAcquisitionElement.VoicePath is wired into the audio ref below;
// browser plays it iff the extraction has shipped the ogg/wav under
// /public/Voice/Lottery/.
// UILotteryTextAnnounce rendered through the real prefab tree.
// Slot inject: container/announceLabel (TMP) gets the lottery_message
// text from MasterPcLotteryMessage; container/btnSkip/label gets "SKIP".
function TextAnnounceRevealScreen({
  message,
  onAdvance,
  onSkipMovie,
}: {
  message: PcLotteryMessage | null
  onAdvance: () => void
  // S2 (2026-05-22): tapping btnSkip on TextAnnounce sets the
  // operationEntity.isSkipPlayMovie flag in the IL2CPP per-element loop —
  // the next Movie phase then early-exits at asm 0xAAB05A0..0xAAB05A8.
  // The screen-tap path just advances normally without setting the flag.
  onSkipMovie?: () => void
}) {
  const announceText = message?.lottery_message ?? ""
  const voiceCandidates = voiceAudioCandidates(message?.voice_path)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [voiceIdx, setVoiceIdx] = useState(0)
  // Replay when the candidate index advances (fallback after .ogg 404 → .wav).
  // Without voiceIdx in deps, the first candidate's load-error would advance
  // the index but play() never re-fires on the new src. Verified empirically:
  // 0/259 .ogg files exist in /Voice/Lottery (all are .wav), so the first
  // attempt 404s every time — without this fix, no voice would ever play.
  useEffect(() => {
    if (!voiceCandidates.length) return
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.play().catch(() => {})
  }, [voiceCandidates, voiceIdx])
  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSkipMovie?.()
    onAdvance()
  }
  return (
    <div
      className="absolute inset-0 z-50 overflow-hidden bg-black"
      onClick={onAdvance}
      style={{ cursor: "pointer" }}
    >
      <PrefabTree
        tree={PREFAB_TREES.textAnnounce}
        designSize={PREFAB_DESIGN.textAnnounce.size}
        fit={PREFAB_DESIGN.textAnnounce.fit}
        className="absolute inset-0 h-full w-full"
        text={{
          "UILotteryTextAnnounce/container/announceLabel": announceText,
          "UILotteryTextAnnounce/container/btnSkip/label": "SKIP",
        }}
        textStyle={{
          // Match the hieroglyph SKIP visual size. The hieroglyph button
          // uses Tailwind `text-2xl font-bold italic tracking-wide` (24px
          // fixed CSS). Inside PrefabTree the design content is wrapped in
          // `transform: scale(fitScale)`, so to render at the same fixed
          // CSS px regardless of viewport we divide a target px value by
          // the exposed --prefab-fit-scale CSS variable. overflow:visible
          // and lineHeight:1 avoid clipping by the prefab's 50-design-px
          // tall label rect when fitScale shrinks below ~0.5.
          "UILotteryTextAnnounce/container/btnSkip/label": {
            fontStyle: "italic",
            fontSize: "calc(40px / var(--prefab-fit-scale, 1))",
            letterSpacing: "0.025em",
            lineHeight: 1,
            userSelect: "none",
            overflow: "visible",
            transform: "translate(6px, 1px)",
          },
        }}
        slots={{
          "UILotteryTextAnnounce/container/btnSkip/touchArea": (
            <button
              onClick={handleSkip}
              className="absolute inset-0"
              style={{ background: "transparent", border: 0, cursor: "pointer", pointerEvents: "auto" }}
              aria-label="Skip text announce and movie"
            />
          ),
        }}
      />
      {voiceCandidates.length > 0 && (
        <audio
          ref={audioRef}
          src={voiceCandidates[Math.min(voiceIdx, voiceCandidates.length - 1)]}
          preload="auto"
          onError={() => {
            if (voiceIdx < voiceCandidates.length - 1) setVoiceIdx((idx) => idx + 1)
          }}
        />
      )}
    </div>
  )
}

// UILotteryMovie rendered through the real prefab tree.
// Slot inject: container/criMovie/screen (RawImage) gets the <video>
// element; container/labelTap stays as the prefab's "tap screen" hint.
function AcquisitionMovieReveal({
  src,
  onAdvance,
  onSkipAll,
}: {
  src: string
  onAdvance: () => void
  onSkipAll: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Try play() on mount AND on every canplay/loadeddata event. The browser
  // can silently reject the first play() when the video hasn't buffered
  // enough (or when the user gesture credit has lapsed since the last
  // summon-button click) — `play().catch(() => {})` was swallowing those
  // rejections without retrying, leaving the video paused on frame 0
  // (black). The user reported intermittent black movies for files like
  // WerzardDefault_Battle_SpecialSkill that exist on disk and play fine
  // when not blocked. Retrying via canplay/loadeddata recovers from the
  // race.
  const tryPlay = (): void => {
    const video = videoRef.current
    if (!video) return
    if (!video.paused) return
    const p = video.play()
    if (p && typeof p.catch === "function") p.catch(() => {})
  }
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    tryPlay()
  }, [src])
  return (
    <div className="absolute inset-0 z-50 overflow-hidden bg-black">
      <PrefabTree
        tree={PREFAB_TREES.movie}
        designSize={PREFAB_DESIGN.movie.size}
        fit={PREFAB_DESIGN.movie.fit}
        className="absolute inset-0 h-full w-full"
        slots={{
          // criMovie/screen RawImage replaced with the actual <video>; its
          // parent criMovie has AspectRatioFitter (the source aspect is the
          // CRI USM's, which the <video object-contain> respects).
          "UILotteryMovie/container/criMovie/screen": (
            <video
              ref={videoRef}
              key={src}
              src={mediaUrl(src)}
              className="h-full w-full object-contain"
              autoPlay
              playsInline
              preload="auto"
              onCanPlay={tryPlay}
              onLoadedData={tryPlay}
              onEnded={onAdvance}
              onError={onAdvance}
            />
          ),
          // Skip / advance hit-areas come from the prefab. btnScreen fills the
          // canvas (the "tap anywhere to advance" surface) and btnSkip/touchArea
          // is the smaller skip-everything hit-area at the top-right. Both
          // positioned and sized 1:1 by the prefab cascade.
          "UILotteryMovie/container/btnScreen": (
            <button
              onClick={onAdvance}
              className="absolute inset-0"
              style={{ background: "transparent", border: 0, cursor: "pointer", pointerEvents: "auto" }}
              aria-label="Advance acquisition movie"
            />
          ),
          "UILotteryMovie/container/btnSkip/touchArea": (
            <button
              onClick={(event) => {
                event.stopPropagation()
                onSkipAll()
              }}
              className="absolute inset-0"
              style={{ background: "transparent", border: 0, cursor: "pointer", pointerEvents: "auto" }}
              aria-label="Skip acquisition movie"
            />
          ),
        }}
        // Pass-15aa: route the SKIP + "tap screen" labels through the
        // `text` prop instead of slot overrides, so PrefabTree's TMP
        // rendering (now AutoFitText) handles them. The previous slot
        // overrides used `font-serif italic` HTML divs that looked
        // inconsistent with the rest of the UI ("weird skip label" +
        // "tap screen font" issues). The prefab default text is the
        // Japanese "<mspace=1.15em>ç”»é¢ã‚’ã‚¿ãƒƒãƒ—" for the tap-screen label
        // and English "SKIP" for the skip button — we localise to
        // English "Tap Screen" here (the Localize script in Unity would
        // do this at runtime; we replicate via text prop). PrefabTree
        // now renders both with the same Times New Roman + auto-shrink
        // styling as character names/titles, plus the SKIP icon sprite
        // (a0a7424e9a335d75.png) renders alongside via the prefab.
        // Pass-15ac: hide the "Tap Screen" label entirely — the user
        // doesn't want it shown (the whole btnScreen catches any click
        // already, no need for a visual prompt). Hiding the labelTap
        // parent suppresses both its background image and the text
        // child via PrefabTree's hide cascade.
        hide={["UILotteryMovie/container/labelTap"]}
        text={{
          "UILotteryMovie/container/btnSkip/label": "SKIP",
        }}
        // Pass-15ab: clicks on the SKIP icon + label were doing nothing.
        // Cause: in the prefab tree btnSkip has children in this order
        //   touchArea (first → lowest z)
        //   ic        (middle z)
        //   label     (last → highest z)
        // touchArea carries the onClick={onSkipAll} button (slot above),
        // but it sits BENEATH ic + label in z-order. CSS hit-testing
        // delivers the click to the topmost interactive element at the
        // point, so clicks on ic/label landed on those nodes (which have
        // no onClick) instead of reaching the touchArea button. ic/label
        // have no business catching clicks anyway — they're purely
        // visual. Setting pointer-events: none on them makes them
        // transparent to hit-testing so the click falls through to the
        // touchArea button underneath, calling onSkipAll as intended.
        nodeStyle={{
          "UILotteryMovie/container/btnSkip/ic": { pointerEvents: "none" },
          "UILotteryMovie/container/btnSkip/label": { pointerEvents: "none" },
        }}
        textStyle={{
          // Match hieroglyph SKIP visual size + italic (see equivalent
          // override on UILotteryCharacterAppear/UILotteryTextAnnounce).
          "UILotteryMovie/container/btnSkip/label": {
            fontStyle: "italic",
            fontSize: "calc(40px / var(--prefab-fit-scale, 1))",
            letterSpacing: "0.025em",
            lineHeight: 1,
            userSelect: "none",
            overflow: "visible",
            transform: "translate(6px, 1px)",
          },
        }}
      />
    </div>
  )
}

function FullArtRevealStage({
  result,
  onAdvance,
  onSkipAll,
}: {
  result: SummonResult
  onAdvance: () => void
  onSkipAll: () => void
}) {
  const characterName = result.character ? result.character.name : `${result.bucket?.show_rarity || 3}-Star Reward`
  const characterTitleText = result.character?.affiliation_name ? `[ ${result.character.affiliation_name} ]` : ""
  const appearRarity = characterAppearRarity(result)
  const appearAssets = characterAppearAssets(appearRarity)
  const anim = appearAnimFor(appearRarity)
  // Route C: if a prerendered VFX clip exists for this viewRarity, mount
  // the video behind the PrefabTree foreground and suppress the CSS
  // LotteryParticles instances (BG ef_sageBg, per-star rarityNEffect,
  // full-stage ef_appear) that the prerender replaces. When the clip is
  // null, fall through to the existing CSS pipeline.
  const vfxPrerenderClip = characterAppearVfxPrerenderClipFor(appearRarity)
  const usePrerenderVfx = vfxPrerenderClip != null
  // G: lookup the per-character PcDetailCharaDisplaySetting +
  // MasterPcMaterial CharacterAppear row. Joined by master_pc_id (battle PC)
  // OR master_bless_pc_id (Protector / Bless). The website's
  // `character.master_pc_id` field stores both id spaces — Bless characters
  // have ids ≥ 220000 (e.g. Dord = 230004). Detection: prefer the explicit
  // `thumb_type === "Bless"` field (once the generator emits it), fall back
  // to the illustration path prefix.
  //   - PcDetailCharaDisplaySetting.m_positionFullDetailIllust (Vector2 px,
  //     applied to d2 anchoredPosition).
  //   - PcDetailCharaDisplaySetting.m_scaleFullDetailIllust (Vector2,
  //     applied to d2 localScale).
  //   - MasterPcMaterial.offset_x_for_detail OR MasterBlessPcMaterial.offset_x_for_detail
  //     (extra X offset added on top).
  // For characters with no joinable id (placeholder Benimaru diag stage) we
  // fall back to no offset / scale=1 — same as Unity's default behaviour
  // when Set2DTransform receives a null settings asset.
  const charaSettingsAll = pcDetailCharaDisplaySettings as {
    settings_by_pc: Array<{ master_pc_id: number; m_positionFullDetailIllust?: { x: number; y: number }; m_scaleFullDetailIllust?: { x: number; y: number } }>
    settings_by_bless_pc: Array<{ master_bless_pc_id: number; m_positionFullDetailIllust?: { x: number; y: number }; m_scaleFullDetailIllust?: { x: number; y: number } }>
  }
  const manifestAll = characterAppearMasterManifest as {
    pc: Array<{ master_pc_id: number; offset_x_for_detail?: number; pc_detail_illustration_path?: string | null }>
    bless_pc: Array<{ master_bless_pc_id: number; offset_x_for_detail?: number; pc_detail_illustration_path?: string | null }>
  }
  const charaPcId = result.character?.master_pc_id ?? 0
  // Bless detection: explicit thumb_type (preferred) OR the illustration path
  // prefix (`Image/Character/Bless/`). When the generator gets updated to
  // emit `thumb_type`, the path heuristic becomes redundant but stays as a
  // safety net.
  const charaIllustPath = result.character?.images?.full ?? ""
  const isBlessByPath = charaIllustPath.startsWith("Image/Character/Bless/")
  const isBless = (result.character?.thumb_type === "Bless") || isBlessByPath
  const charaSetting = isBless
    ? charaSettingsAll.settings_by_bless_pc.find((s) => s.master_bless_pc_id === charaPcId)
    : charaSettingsAll.settings_by_pc.find((s) => s.master_pc_id === charaPcId)
  const charaManifest = isBless
    ? manifestAll.bless_pc.find((r) => r.master_bless_pc_id === charaPcId)
    : manifestAll.pc.find((r) => r.master_pc_id === charaPcId)
  const charaModelOffset = charaSetting?.m_positionFullDetailIllust ?? { x: 0, y: 0 }
  const charaModelScale = charaSetting?.m_scaleFullDetailIllust ?? { x: 1, y: 1 }
  const charaModelOffsetXExtra = charaManifest?.offset_x_for_detail ?? 0
  // `XIUICharacterDisplay.Set2DTransform` (RVA 0xA1E98B8) calls:
  //   image2d.rectTransform.set_anchoredPosition(GetIllustPosition)
  //   image2d.rectTransform.set_localScale(GetIllustScale)
  // i.e. the PcDetailCharaDisplaySetting's `m_positionFullDetailIllust` and
  // `m_scaleFullDetailIllust` REPLACE the prefab's d2 default anchoredPosition
  // ([0, -20]) and localScale ([1.10, 1.10]) at runtime. The website mirrors
  // that by using PrefabTree's `rectOverride` on the d2 node — NOT by composing
  // a CSS transform on charaModel (which compounded with the prefab's d2Container
  // scale 1.587 instead of replacing the leaf transform).
  // MasterPcMaterial.offset_x_for_detail is an additional X offset the game
  // adds AFTER Set2DTransform; we fold it into the anchoredPosition.x replacement.
  const d2PathFull = "UILotteryCharacterAppear/container/charaModel/d2Container/d2"
  const d2AnchoredPos: [number, number] = [
    charaModelOffset.x + charaModelOffsetXExtra,
    charaModelOffset.y, // Unity Y; childRect flips to CSS internally
  ]
  const d2LocalScale: [number, number] = [charaModelScale.x, charaModelScale.y]
  const characterSpriteUrl = characterFullSources(result.character)[0] ?? ""
  // CharacterAppear waits for the user to tap (onClick={onAdvance} on the
  // outermost stage div); no auto-advance timer. The per-rarity clip stopTime
  // is still used for animation timing, just not for auto-skip.

  // Per-rarity hide: decoded clip gradationActive now covers EVERY overlay
  // node the Appear<Rarity> clip toggles (top-level gradation/frame siblings,
  // inner nameplate-base overlays gradation/pattern/efUltimate/line/rimuru,
  // and the per-star rarity<N>/{effect,starLight} children). All values are
  // 1:1 from the streamed clip's m_IsActive samples (boolean-thresholded at
  // 0.5). The lavender "rainbow blob" the website showed at lower-left came
  // from rarity<N>/effect being rendered for R/SR/SSR despite the clip
  // disabling them; this list now matches the real game's per-rarity
  // visibility exactly. See lottery-rarity.ts characterAppearHideList for
  // the full mapping (full prefab paths so leaf-name collisions like
  // "gradation" vs "base/gradation" don't accidentally hide both).
  const hideGradation = characterAppearHideList(appearRarity)
  // XIUIFrame.ChangeByLabel reproduction: the prefab has 6 ef_view_<X>
  // children under both ef_sageBg and ef_appear, with only ef_view_URUltimate
  // active by default. UILotteryCharacterAppear.Set passes entity.viewRarity to
  // each XIUIFrame.ChangeByLabel, which activates the matching child and
  // deactivates the rest. We replicate that by hiding all 10 non-matching
  // ef_view_<X> paths via the standard PrefabTree `hide` mechanism.
  const hideEfViews = characterAppearEfViewHideList(appearRarity)
  // SSRUltimateParticle (UIParticle under characterName/rarityStar) is
  // active=True in the prefab. UILotteryCharacterAppear.Set only leaves it on
  // for the Ultimate group; explicitly hide it for the rest because the
  // prefab default would otherwise show it everywhere.
  const hideSSRUltimateParticle = characterAppearSSRUltimateParticleVisible(appearRarity)
    ? []
    : ["UILotteryCharacterAppear/container/characterName/rarityStar/SSRUltimateParticle"]
  // Hide stars beyond starCount via prefab path.
  const hideExtraStars = Array.from({ length: 6 }, (_, i) => i + 1)
    .filter((i) => i > appearAssets.starCount)
    .map((i) => `UILotteryCharacterAppear/container/characterName/rarityStar/rarity${i}`)
  // Pass-15g/l: pull the FULL per-path streamedClip curves for this rarity.
  // The file ships curves for every animated property on every animated path
  // (m_Color RGBA, m_LocalScale, m_AnchoredPosition, m_IsActive, m_Alpha)
  // plus a `null_pptr_swaps` array listing paths where the Animator
  // explicitly sets m_Texture/m_Sprite to PPtr(0,0) (the data-driven hide
  // signal that supersedes the previous "hide flares because we don't
  // know their texture" stopgap).
  const allClipKey = `Appear${appearRarity}`
  type AllCurvesClipShape = {
    stop_time: number
    approximate?: boolean
    paths: Record<string, Record<string, Array<{ t: number; v: number }>>>
    null_pptr_swaps?: Array<{ path: string; attribute: string }>
    resolved_pptr_swaps?: Array<{ path: string; attribute: string; target_file_hash: string }>
    inactive_paths?: string[]
  }
  const allCurvesClip = (characterAppearAllCurves as {
    clips: Record<string, AllCurvesClipShape>
  }).clips[allClipKey] as AllCurvesClipShape | undefined
  const allStopMs = Math.max(1, (allCurvesClip?.stop_time ?? anim.stopTime) * 1000)
  // Pass-15l: data-driven hide list from the Appear<rarity> clip's NULL
  // pptr swaps. The Animator explicitly sets m_Texture = PPtr(0,0) on
  // certain RawImage paths to make them invisible at runtime (the prefab
  // ships the pastel rainbow placeholder 70f63a6ba627100e.png on
  // flareImage / flareImage_2, but the clip overrides to null for R/SR).
  // character_appear_per_rarity_swaps.json drops null PPtrs (writes
  // target_file_hash="-"), so we read null_pptr_swaps from the all_curves
  // JSON instead. PrefabTree's hide prop takes the full prefab-rooted path
  // ("UILotteryCharacterAppear/..."), so prepend the prefab root.
  const hideStarFlares: string[] = []
  if (allCurvesClip?.null_pptr_swaps) {
    for (const s of allCurvesClip.null_pptr_swaps) {
      hideStarFlares.push(`UILotteryCharacterAppear/${s.path}`)
    }
  }
  // Pass-15s/t/u: data-driven hide for ANY path whose effective texture is a
  // known additive-gradient placeholder. These textures are designed for
  // Unity's UI-VFXDefault additive shader + URP Bloom pipeline (the in-game
  // visible result is a soft coloured flash). In CSS via mix-blend-mode:
  // plus-lighter the same gradients render as opaque pastel-rainbow / streak
  // rectangle artifacts because we can't reproduce the HDR bloom.
  //
  // Algorithm: walk the prefab tree once, looking at each node's image /
  // rawImage component. For each node, compute the EFFECTIVE texture =
  // resolved m_Texture or m_Sprite swap from the clip if present, else
  // the prefab default sprite. If the effective texture's file hash is
  // in PLACEHOLDER_TEXTURE_HASHES, add the path to the hide list. This
  // catches base/efUltimate, rarity<N>/effect, rarity<N>/starLight,
  // rarity<N>Effect/effect, rarity<N>Effect/flareImage, _2 etc. — every
  // gradient artifact in one rule, no per-path enumeration.
  const PLACEHOLDER_TEXTURE_HASHES = new Set([
    "70f63a6ba627100e", // pastel rainbow (most common placeholder)
    "cf86684898d62fdb", // pastel rainbow / t_grad_uv_11_mir
    "0e477f0fa9c7f39a", // vertical streaks placeholder
    "5ed48cb986b73007", // purple/cyan vertical stripes (URUltimate efUltimate swap)
    // Pass-15w: rarity{N}/starLight uses a small white blob (~10×8 px) that
    // Unity composites additively over each rarity star as a bloom-
    // amplified highlight. R/SR/SSR keep starLight INACTIVE via the clip's
    // m_IsActive curve (so it never shows), but SSRUltimate/UREx/URUltimate
    // ACTIVATE it on all 6 stars. In CSS without HDR bloom the white blob
    // renders as a flat white overlay obscuring the star sprite's actual
    // colour — user reported "white star effect sticks till the end on
    // higher rarities". Treat it as the same class of artifact: hide.
    "071a6e9234f4d117", // starLight white-blob highlight
  ])
  const resolvedTextureByPath = new Map<string, string>()
  for (const s of allCurvesClip?.resolved_pptr_swaps ?? []) {
    if (s.attribute === "m_Texture" || s.attribute === "m_Sprite") {
      resolvedTextureByPath.set(s.path, s.target_file_hash)
    }
  }
  // Walk the prefab tree once and collect every path whose effective texture
  // is a placeholder. `node.path` is rooted at "UILotteryCharacterAppear/"
  // (full prefab path) so it matches PrefabTree's hide-set keys directly.
  type TreeNodeMin = { name: string; path: string; comp: { image: { img?: string } | null; rawImage: { img?: string } | null }; children: TreeNodeMin[] }
  const collectPlaceholderHides = (n: TreeNodeMin) => {
    const prefabImg = (n.comp.rawImage?.img || n.comp.image?.img || "").replace(/\.png$/, "")
    if (prefabImg) {
      const rel = n.path.startsWith("UILotteryCharacterAppear/") ? n.path.slice("UILotteryCharacterAppear/".length) : n.path
      const resolved = resolvedTextureByPath.get(rel)
      const effective = (resolved && resolved !== "-") ? resolved : prefabImg
      if (PLACEHOLDER_TEXTURE_HASHES.has(effective)) {
        hideStarFlares.push(n.path)
      }
    }
    for (const c of n.children) collectPlaceholderHides(c)
  }
  collectPlaceholderHides(PREFAB_TREES.characterAppear.root as unknown as TreeNodeMin)
  // Pass-15l: per-star particle filter from the clip's active_finals.
  // The Animator deactivates many of the 9 rarityNEffect ParticleSystems
  // for the current rarity (e.g. AppearR deactivates ef_e_flash_01,
  // ef_e_particle_00_a/c, ef_e_circle_04 — see hide_paths_from_active_finals
  // in character_appear_per_rarity_swaps.json). PrefabTree's hide prop
  // already suppresses the DOM nodes, but LotteryParticles is canvas-based
  // and renders particles independently. We pass the same relative-path
  // hide set into characterAppearRarityEffectParticles so its canvas
  // doesn't emit particles for paths the clip explicitly deactivates —
  // killing the residual "little sparkles" artifact the user reported.
  const rarityActiveHideRel: Set<string> = (() => {
    const swaps = characterAppearPerRaritySwaps as { rarities: Record<string, { hide_paths_from_active_finals?: string[] }> }
    const r = swaps.rarities[appearRarity]
    return new Set(r?.hide_paths_from_active_finals ?? [])
  })()

  // Star pop animation: bind WAAPI to each rarityN element AND to its sibling
  // rarityNEffect/effect burst. Both curves come from the Appear<Rarity>
  // AnimationClip:
  //   - rarityN/m_LocalScale.{x,y}        — pop-in curve (3 -> 1, or 6 -> 1 for
  //     Ultimate group), captured as character_appear_anim.json.starScale.
  //   - rarityNEffect/effect/m_LocalScale — burst expansion (1 -> 2.5), captured
  //     as character_appear_anim.json.starEffectScale.
  // Both nodes are already rendered by PrefabTree (rarityNEffect/effect is a
  // RawImage subtree with a flare/burst sprite); we just drive the scale curve
  // via WAAPI on the DOM element PrefabTree exposes.
  // Pass-15c: onNodes is invoked via PrefabTree's useLayoutEffect WITHOUT a
  // deps array, so it fires after EVERY render. Each call previously
  // re-created the WAAPI animations on cmContainer/stars/effects, restarting
  // them from offset 0 — that's the "character still increases at the end"
  // bug the user reported. Track which DOM elements we've already animated
  // in a ref and skip if seen, so each element gets exactly one animation
  // per mount (cleared automatically when result.id changes via the keyed
  // re-mount in FullArtRevealStage).
  const animatedRef = useRef<WeakSet<HTMLElement>>(new WeakSet())
  // Pass-15g: separate dedupe per WAAPI animation kind. A single DOM element
  // can carry multiple stacked animations on different CSS properties
  // (transform via scale, opacity via alpha, etc.); a single shared WeakSet
  // would let the second driver bail out the moment the first one ran. Each
  // kind gets its own WeakMap so each property can be set once and only once
  // per element-mount, independent of the others.
  const animatedKindsRef = useRef<WeakMap<HTMLElement, Set<string>>>(new WeakMap())
  const markAnimated = (el: HTMLElement, kind: string): boolean => {
    let s = animatedKindsRef.current.get(el)
    if (!s) { s = new Set(); animatedKindsRef.current.set(el, s) }
    if (s.has(kind)) return false
    s.add(kind)
    return true
  }
  // (allCurvesClip / allStopMs declared above before the hideStarFlares
  // block; the data-driven hide list needs the same JSON.)

  // Build WAAPI opacity keyframes from a single per-path m_Color.a / m_Alpha
  // curve, or compose them with an m_IsActive gate (alpha clipped to 0 outside
  // the active window). Returns null when neither curve is present.
  const buildOpacityFrames = (
    pathCurves: Record<string, Array<{ t: number; v: number }>> | undefined,
  ): Keyframe[] | null => {
    if (!pathCurves) return null
    const alpha = pathCurves["m_Color.a"] ?? pathCurves["m_Alpha"] ?? null
    const active = pathCurves["m_IsActive"] ?? null
    if (!alpha && !active) return null
    const stopT = allCurvesClip?.stop_time ?? anim.stopTime
    if (stopT <= 0) return null
    const tSet = new Set<number>()
    for (const arr of [alpha, active]) if (arr) for (const k of arr) tSet.add(k.t)
    const times = Array.from(tSet).sort((a, b) => a - b)
    const sample = (arr: Array<{ t: number; v: number }> | null, t: number, fallback: number) => {
      if (!arr || !arr.length) return fallback
      let lo = arr[0]
      for (const k of arr) {
        if (k.t <= t) lo = k
        else {
          const denom = k.t - lo.t
          if (denom <= 0) return lo.v
          return lo.v + (k.v - lo.v) * ((t - lo.t) / denom)
        }
      }
      return lo.v
    }
    const sampleActive = (t: number): number => {
      if (!active || !active.length) return 1
      // m_IsActive is a step curve (0 or 1). Find the largest keyframe ≤ t.
      let v = active[0].v
      for (const k of active) {
        if (k.t <= t) v = k.v
        else break
      }
      return v >= 0.5 ? 1 : 0
    }
    const frames: Keyframe[] = bookendKeyframes(times.map((t) => {
      const a = alpha ? sample(alpha, t, 1) : 1
      const live = sampleActive(t)
      return {
        offset: Math.max(0, Math.min(1, t / stopT)),
        opacity: Math.max(0, Math.min(1, a * live)),
      }
    }))
    return frames
  }

  // Drive a path's m_Color.a / m_Alpha / m_IsActive onto a DOM element's
  // opacity via WAAPI. Idempotent per (element, "opacity") so it can stack
  // with the scale/transform drivers on the same element.
  const driveOpacityFromClip = (el: HTMLElement | undefined, fullPath: string): void => {
    if (!el || !allCurvesClip) return
    const rel = fullPath.startsWith("UILotteryCharacterAppear/")
      ? fullPath.slice("UILotteryCharacterAppear/".length)
      : fullPath
    const frames = buildOpacityFrames(allCurvesClip.paths[rel])
    if (!frames) return
    if (!markAnimated(el, "opacity")) return
    el.animate(frames, { duration: allStopMs, easing: "linear", fill: "both" })
  }

  // Pass-15j: cascade a parent path's m_IsActive × m_Alpha onto a leaf
  // element's opacity, multiplied with the leaf's own m_Color.a / m_Alpha
  // if any. Avoids putting opacity on the parent (which would create a CSS
  // stacking context that breaks additive blend mode on the children).
  const driveCombinedOpacityFromClip = (
    leafEl: HTMLElement | undefined,
    leafFullPath: string,
    parentRelPath: string,
  ): void => {
    if (!leafEl || !allCurvesClip) return
    const leafRel = leafFullPath.startsWith("UILotteryCharacterAppear/")
      ? leafFullPath.slice("UILotteryCharacterAppear/".length)
      : leafFullPath
    const parent = allCurvesClip.paths[parentRelPath]
    const leaf = allCurvesClip.paths[leafRel]
    if (!parent && !leaf) return
    const stopT = allCurvesClip.stop_time
    if (stopT <= 0) return
    const pAlpha = parent?.["m_Color.a"] ?? parent?.["m_Alpha"] ?? null
    const pActive = parent?.["m_IsActive"] ?? null
    const lAlpha = leaf?.["m_Color.a"] ?? leaf?.["m_Alpha"] ?? null
    const lActive = leaf?.["m_IsActive"] ?? null
    if (!pAlpha && !pActive && !lAlpha && !lActive) return
    const tSet = new Set<number>()
    for (const arr of [pAlpha, pActive, lAlpha, lActive]) if (arr) for (const k of arr) tSet.add(k.t)
    const times = Array.from(tSet).sort((a, b) => a - b)
    const sample = (arr: Array<{ t: number; v: number }> | null, t: number, fb: number) => {
      if (!arr || !arr.length) return fb
      let lo = arr[0]
      for (const k of arr) {
        if (k.t <= t) lo = k
        else {
          const d = k.t - lo.t
          if (d <= 0) return lo.v
          return lo.v + (k.v - lo.v) * ((t - lo.t) / d)
        }
      }
      return lo.v
    }
    const sampleActive = (arr: Array<{ t: number; v: number }> | null, t: number) => {
      if (!arr || !arr.length) return 1
      let v = arr[0].v
      for (const k of arr) { if (k.t <= t) v = k.v; else break }
      return v >= 0.5 ? 1 : 0
    }
    if (!markAnimated(leafEl, "opacity")) return
    const frames: Keyframe[] = bookendKeyframes(times.map((t) => {
      const pa = pAlpha ? sample(pAlpha, t, 1) : 1
      const pi = sampleActive(pActive, t)
      const la = lAlpha ? sample(lAlpha, t, 1) : 1
      const li = sampleActive(lActive, t)
      return {
        offset: Math.max(0, Math.min(1, t / stopT)),
        opacity: Math.max(0, Math.min(1, pa * pi * la * li)),
      }
    }))
    leafEl.animate(frames, { duration: allStopMs, easing: "linear", fill: "both" })
  }

  // (drivePositionFromClip removed — see star block below for why position
  // driving is currently disabled: WAAPI transform composite would replace
  // the existing scale-pop animation. Re-add when scale and translate get
  // split onto a parent/child wrapper pair.)

  const onNodes = (map: Map<string, HTMLElement>) => {
    for (let i = 1; i <= appearAssets.starCount; i++) {
      const starPath = `UILotteryCharacterAppear/container/characterName/rarityStar/rarity${i}`
      const starEl = map.get(starPath)
      if (starEl) {
        const keys = (anim.starScale[`rarity${i}`] as [number, number][] | undefined) ?? []
        if (keys.length && markAnimated(starEl, "scale")) {
          const frames = scaleKeyframesToWAAPI(keys, anim.stopTime)
          starEl.animate(frames, { duration: Math.max(1, anim.stopTime * 1000), easing: "linear", fill: "both" })
        }
      }
      // Pass-15g: drive the rarity star's m_Color.a fade-in (the clip's
      // 0→1 jump at the "land" moment around t≈1.07s for AppearR). Without
      // this the star renders at prefab-static opacity (1.0) for the entire
      // reveal, so it shows up grey from t=0 instead of popping in at the
      // right moment. NOTE: m_AnchoredPosition driving is INTENTIONALLY
      // OMITTED — applying it as a CSS `transform: translate()` would
      // collide with the scale animation already on the same transform
      // property (WAAPI's default composite is "replace", not "add", so
      // the translate would wipe out the scale pop). The
      // characterAppearStarRowShift static layout already handles per-
      // star-count re-centring approximately; if exact match is needed
      // later, split scale and translate onto a parent/child wrapper pair.
      driveOpacityFromClip(starEl, starPath)

      // Pass-15j: drive the rarityNEffect burst lifecycle onto the LEAF
      // additive sprites (effect + flareImage + flareImage_2) rather than
      // the parent. Putting opacity on the parent creates a CSS stacking
      // context that breaks mix-blend-mode: plus-lighter on the additive
      // children. Cascading parent's m_IsActive × m_Alpha onto each leaf
      // directly keeps the parent at opacity 1 (no stacking context) so
      // each leaf's `mix-blend-mode: plus-lighter` composes against the
      // global scene, producing real additive light instead of opaque
      // bright boxes. effect's own m_Alpha (the 0→1→0 spike) multiplies
      // with the parent's curve via driveCombinedOpacityFromClip.
      const parentRel = `container/characterName/rarityStar/rarity${i}Effect`
      const effectPath = `UILotteryCharacterAppear/${parentRel}/effect`
      const flareImgPath = `UILotteryCharacterAppear/${parentRel}/flareImage`
      const flareImg2Path = `UILotteryCharacterAppear/${parentRel}/flareImage_2`
      const effectEl = map.get(effectPath)
      const flareImgEl = map.get(flareImgPath)
      const flareImg2El = map.get(flareImg2Path)
      if (effectEl) {
        const eKeys = (anim.starEffectScale[`rarity${i}Effect`] as [number, number][] | undefined) ?? []
        if (eKeys.length && markAnimated(effectEl, "scale")) {
          const eFrames = scaleKeyframesToWAAPI(eKeys, anim.stopTime)
          effectEl.animate(eFrames, { duration: Math.max(1, anim.stopTime * 1000), easing: "linear", fill: "both" })
        }
      }
      driveCombinedOpacityFromClip(effectEl, effectPath, parentRel)
      driveCombinedOpacityFromClip(flareImgEl, flareImgPath, parentRel)
      driveCombinedOpacityFromClip(flareImg2El, flareImg2Path, parentRel)
    }
    // Pass-15x: drive the nameplate `base` plate opacity from the clip's
    // m_Color.a curve (0→1 fade over t=0..0.683). The plate currently
    // renders at prefab-static alpha=1 from t=0 — it pops in immediately
    // before the character. Per user preference (and clip data), the
    // plate should fade in alongside the character pop. Cascading parent
    // opacity gates the whole base subtree (gradation, line, rimuru,
    // pattern, characterName text, characterTitle text) since they don't
    // have their own m_Color.a curves in the streamed clip.
    const basePath = "UILotteryCharacterAppear/container/characterName/base"
    const baseEl = map.get(basePath)
    driveOpacityFromClip(baseEl, basePath)
    // G.2: drive charaModel/d2Container transform + d2 alpha from the
    // Appear<rarity> clip's muscle-clip curves.
    //   - d2Container m_AnchoredPosition.x/y + m_LocalScale.x/y +
    //     localEulerAngles.z → CSS transform translate/scale/rotate
    //   - d2 m_Color.a → CSS opacity
    // The curves are time-keyed in seconds; we map to WAAPI keyframes
    // with offset = t / stopTime. Easing = "linear" because the original
    // Hermite tangents are approximated as linear between keyframes (the
    // sample density 17-pt for x/y and 5-pt for scale is high enough that
    // the visual difference is negligible).
    const clipKey = `Appear${appearRarity}`
    const clipData = (characterAppearCharamodelCurves as {
      clips: Record<string, { stop_time: number; paths: Record<string, Record<string, Array<{ t: number; v: number }>>> }>
    }).clips[clipKey]
    if (clipData) {
      const stopMs = Math.max(1, clipData.stop_time * 1000)
      const cmPaths = clipData.paths
      const cmContainer = map.get("UILotteryCharacterAppear/container/charaModel/d2Container")
      const cmD2 = map.get("UILotteryCharacterAppear/container/charaModel/d2Container/d2")
      // Compose d2Container transform from anchoredPosition + scale + euler
      const ax = cmPaths["container/charaModel/d2Container"]?.["m_AnchoredPosition.x"] ?? null
      const ay = cmPaths["container/charaModel/d2Container"]?.["m_AnchoredPosition.y"] ?? null
      const sx = cmPaths["container/charaModel/d2Container"]?.["m_LocalScale.x"] ?? null
      const sy = cmPaths["container/charaModel/d2Container"]?.["m_LocalScale.y"] ?? null
      const ez = cmPaths["container/charaModel/d2Container"]?.["localEulerAngles.z"] ?? null
      if (cmContainer && !animatedRef.current.has(cmContainer) && (ax || ay || sx || sy || ez)) {
        animatedRef.current.add(cmContainer)
        // Build a unified set of times by union of all keyframe t's.
        const tSet = new Set<number>()
        for (const arr of [ax, ay, sx, sy, ez]) {
          if (arr) for (const k of arr) tSet.add(k.t)
        }
        const times = Array.from(tSet).sort((a, b) => a - b)
        const sampleAt = (arr: Array<{ t: number; v: number }> | null, t: number, fallback: number) => {
          if (!arr || arr.length === 0) return fallback
          // Find bracketing keys
          let lo = arr[0]
          for (const k of arr) {
            if (k.t <= t) lo = k
            else {
              const hi = k
              const denom = hi.t - lo.t
              if (denom <= 0) return lo.v
              const r = (t - lo.t) / denom
              return lo.v + (hi.v - lo.v) * r
            }
          }
          return lo.v
        }
        // Pass-10 d2Container position fix: PrefabTree positions d2Container
        // via CSS left/top derived from the prefab-static anchoredPosition
        // (e.g. Unity (-11, -262)). The Appear<rarity> clip animates
        // m_AnchoredPosition with ABSOLUTE Unity values, ending at the SAME
        // (-11, -262) so the Animator transition to Default is seamless. If
        // we apply the curve's raw values as CSS `translate(x, -y)`, the
        // translate ADDS to the left/top base, so at clip end the element
        // ends up at base + (-11, +262) instead of at base — the "weird
        // movement that's not in the game". Fix: use the curve's final
        // keyframe value as the static baseline (which by construction
        // equals the prefab static) and apply the CSS translate as the
        // DELTA between the curve at time t and that baseline. The element
        // ends at translate(0,0) = base position; during animation it
        // matches the curve's absolute Unity position 1:1.
        const baseX = ax && ax.length > 0 ? ax[ax.length - 1].v : 0
        const baseY = ay && ay.length > 0 ? ay[ay.length - 1].v : 0
        // Pass-15b scale-plateau fix: the extracted scale curves have
        // Hermite tangents in Unity that flatten the curve immediately
        // after the pop's max growth, so any post-pop keyframe values
        // (e.g. 1.484 → 1.584 → 1.587 over 1.25 s for AppearR) appear as
        // a single instantaneous snap to ~1.587 in-game. Linear interp on
        // those same keyframes produces a visible 7 % slow growth across
        // the second half of the animation — the "increasing size at the
        // end" the user reported. Pre-process the scale curve: once any
        // keyframe reaches ≥ 90 % of the curve's max value, snap every
        // subsequent keyframe (and the popped frame itself) to the max
        // value. Result: the pop reaches its peak once and stays there,
        // matching Hermite's flat-tail behaviour.
        function snapPlateau(curve: Array<{ t: number; v: number }> | null): Array<{ t: number; v: number }> | null {
          if (!curve || curve.length === 0) return curve
          const maxV = curve.reduce((m, k) => Math.max(m, k.v), -Infinity)
          let popped = false
          return curve.map((k) => {
            if (popped) return { t: k.t, v: maxV }
            if (k.v >= maxV * 0.9) { popped = true; return { t: k.t, v: maxV } }
            return k
          })
        }
        const sxFlat = snapPlateau(sx)
        const syFlat = snapPlateau(sy)
        // Pass-15 character canvas-width compensation (Frida diag derived):
        //   d2 runtime visual width = 1024 × 1.10 (d2.localScale)
        //                              × 1.548 (d2Container.localScale)
        //                            = 1743 design px
        //   phone runtime canvas width = 2401.6 (logical, match=1 on
        //                                2.22:1 phone) → d2 occupies
        //                                1743 / 2401.6 = 72.6 % of canvas
        //   website canvas width = 1920 (16:9) → at the same 72.6 %, d2
        //                          should be 1394 px wide instead of 1743
        //   shrink factor = 1394 / 1743 = 0.800 = 1920 / 2400
        // i.e. multiplying d2's scale by 0.800 makes the website-rendered
        // character occupy the same fraction of canvas width as on phone.
        // This is purely a canvas-aspect compensation (16:9 vs 2.22:1) —
        // not a hand-tuned value. Vertical extent shrinks proportionally
        // (2342 → 1873 design px = 174 % canvas height) so head/upper
        // body fit while feet stay cut, matching the in-game framing.
        const CANVAS_ASPECT_COMPENSATION = 1920 / 2400 // = 0.8
        const frames: Keyframe[] = bookendKeyframes(times.map((t) => {
          const cx = sampleAt(ax, t, baseX)
          const cy = sampleAt(ay, t, baseY)
          const x = cx - baseX
          // Unity Y is up; CSS Y is down — negate the delta.
          const y = -(cy - baseY)
          const scaleX = sampleAt(sxFlat, t, 1) * CANVAS_ASPECT_COMPENSATION
          const scaleY = sampleAt(syFlat, t, 1) * CANVAS_ASPECT_COMPENSATION
          const rotZ = sampleAt(ez, t, 0)
          return {
            offset: Math.max(0, Math.min(1, t / clipData.stop_time)),
            transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY}) rotate(${rotZ}deg)`,
          }
        }))
        // Pass-13 easing fix: switched from "linear" to "ease-out". The
        // extracted curves have Hermite tangents in Unity (tangents flat at
        // the final keyframe), so a long late segment like AppearR's
        // 0.683->1.333 (scale 1.484 -> 1.584, 7% growth over 0.65s) appears
        // FLAT in-game (almost all growth happens right after t=0.683, then
        // plateaus). Linear WAAPI interp spreads the 7% growth across the
        // full 0.65s, making the character look like it's continuously
        // enlarging in the second half of the animation — the "weird
        // increase at end" the user reported. ease-out compresses each
        // segment's change into its start, leaving the end of the segment
        // flat — matches Hermite-with-flat-endpoint behaviour 1:1 for the
        // pop+settle shape.
        cmContainer.animate(frames, { duration: stopMs, easing: "ease-out", fill: "both" })
      }
      // d2 alpha (fade-in)
      const alphaCurve = cmPaths["container/charaModel/d2Container/d2"]?.["m_Color.a"] ?? null
      if (cmD2 && !animatedRef.current.has(cmD2) && alphaCurve && alphaCurve.length) {
        animatedRef.current.add(cmD2)
        const alphaFrames: Keyframe[] = bookendKeyframes(alphaCurve.map((k) => ({
          offset: Math.max(0, Math.min(1, k.t / clipData.stop_time)),
          opacity: k.v,
        })))
        cmD2.animate(alphaFrames, { duration: stopMs, easing: "linear", fill: "both" })
      }
    }
  }

  // URP Volume CSS approximation. Real source: VolumeProfile asset
  // LotteryCharacterAppear_00 with three active VolumeComponents:
  //   - Bloom (threshold 0.97, intensity 3.0, slight cyan tint) — full HDR
  //     threshold-based bloom can't be reproduced in CSS; we use a layered
  //     `filter: brightness/blur` proxy was insufficient — we now apply a
  //     real HDR-threshold + Gaussian-blur + intensity-additive bloom via
  //     an SVG <filter> chain (see CharacterAppearBloomFilter). All
  //     parameters (threshold 0.97, intensity 3.0, scatter→sigma mapping,
  //     tint matrix) are tied 1:1 to the extracted Volume profile.
  //   - ColorAdjustments (contrast +43, no other active props) — clean CSS via
  //     `filter: contrast(1.43)`. URP contrast slider is in [-100, 100] and
  //     biases the contrast curve linearly; 43 maps to 1 + 43/100 = 1.43.
  //   - Vignette (dark-green tint, intensity 0.534, 0.5/0.5 center, smoothness
  //     0.2) — reproducible 1:1 as a radial-gradient overlay div with
  //     mix-blend-mode multiply.
  // Volume.weight is 1.0 throughout the Appear<Rarity> clips (animated via the
  // root In/Out clips: Default=0, In=1, Out=0); we apply at full weight since
  // CharacterAppear runs strictly after In and before Out by construction.
  const ppData = characterAppearPostprocess as unknown as {
    enabledOverrides: {
      Bloom?: { threshold: number; intensity: number; scatter: number; tint: { r: number; g: number; b: number; a: number } }
      ColorAdjustments?: { contrast?: number }
      Vignette?: { color: { r: number; g: number; b: number; a: number }; center: { x: number; y: number }; intensity: number; smoothness: number; rounded: boolean }
    }
  }
  const contrastValue = ppData.enabledOverrides.ColorAdjustments?.contrast ?? 0
  const contrastFilter = `contrast(${1 + contrastValue / 100})`
  // Bloom SVG filter id — unique per component instance (the filter element
  // itself lives inside this stage's JSX; multiple stages mounting at once
  // would collide on a static id, so we tie it to the appearRarity to keep
  // the id stable across rerenders for one rarity).
  const bloomFilterId = `lottery-character-appear-bloom-${appearRarity}`
  const combinedFilter = ppData.enabledOverrides.Bloom
    ? `url(#${bloomFilterId}) ${contrastFilter}`
    : contrastFilter
  const vig = ppData.enabledOverrides.Vignette
  const vignetteColor = vig
    ? `rgba(${Math.round(vig.color.r * 255)}, ${Math.round(vig.color.g * 255)}, ${Math.round(vig.color.b * 255)}, ${vig.color.a})`
    : "transparent"
  const vignetteIntensity = vig ? Math.max(0, Math.min(1, vig.intensity)) : 0
  // Unity Vignette is a radial falloff: 0 in centre, full color at edges.
  // CSS reproduction: a radial-gradient that fades from transparent at centre
  // to vignetteColor at the outer edge, multiplied by intensity. The outer
  // stop sits at the longer-axis radius (100%), matching Unity's elliptical
  // (non-rounded) default.
  const vignetteOverlayStyle: CSSProperties = vig
    ? {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `radial-gradient(ellipse at ${vig.center.x * 100}% ${(1 - vig.center.y) * 100}%, transparent 0%, transparent ${(1 - vig.smoothness) * 50}%, ${vignetteColor} 100%)`,
        opacity: vignetteIntensity,
        mixBlendMode: "multiply",
      }
    : { display: "none" }

  // Pass-15k bloom routing: applying CSS Bloom to the foreground DOM
  // produced a massive white glow that obliterated the nameplate text and
  // surrounding area (verified via D:\imag_comp.png — heavy bloom on the
  // left, crisp plate on the right). The prerender video already carries
  // the real URP Bloom + ColorAdjustments baked in for the entire frame
  // (it was captured in-game), so the foreground DOM must NOT bloom again.
  // When usePrerenderVfx is FALSE (CSS fallback path), the stage-level
  // filter still applies the SVG bloom to everything in the CSS scene.
  // When usePrerenderVfx is TRUE: no foreground bloom — the video's
  // baked bloom is the only bloom contribution. Foreground DOM (plate,
  // stars, text, d2) composites on top at its native rendered brightness;
  // the underlying scene is already post-bloom so the DOM matches the
  // game's relative levels without re-amplifying.
  const stageFilter = usePrerenderVfx ? undefined : combinedFilter

  return (
    <div
      className="absolute inset-0 z-50 overflow-hidden bg-black"
      onClick={onAdvance}
      style={{ cursor: "pointer", filter: stageFilter }}
    >
      {/* URP Bloom SVG filter — defined inline so the CSS filter can
          reference it via url(#id). The filter implements the URP
          luminance-threshold + downscale/blur + tint + additive blend
          pipeline using feColorMatrix + feComponentTransfer + feGaussianBlur
          + feComposite. All numerical parameters are derived from the
          LotteryCharacterAppear_00 Volume profile (see
          character_appear_postprocess.json) — no eyeballed values. The svg
          itself is invisible (width=0/height=0); only the filter is used. */}
      {ppData.enabledOverrides.Bloom && (
        <CharacterAppearBloomFilter id={bloomFilterId} bloom={ppData.enabledOverrides.Bloom} />
      )}
      {/* CharacterAppear SE: the game's UILotteryCharacterAppear prefab plays
          a per-rarity BGM fanfare + the per-rarity appear SE together (see
          characterAppearSEForRarity above). */}
      <SummonSE sources={characterAppearSEForRarity(appearRarity)} />

      {/* Route C: prerendered VFX background layer (when manifest has a clip
          for this viewRarity). Sits behind PrefabTree so the dynamic
          foreground (d2 character art, nameplate, stars, text) composites
          over it. The same condition suppresses the BG/full-stage/per-star
          CSS LotteryParticles to avoid double-rendering. */}
      {usePrerenderVfx && vfxPrerenderClip && (
        <CharacterAppearVfxPrerenderLayer
          resultId={result.id}
          rarity={appearRarity}
          clip={vfxPrerenderClip}
        />
      )}
      {/* F: Full-stage particle canvas host for ef_sageBg/ef_view_<rarity>.
          The Unity prefab has `centers` at design (+2000, 0) with sizeDelta
          (100×100) — an off-screen anchor used as the particle emission
          ORIGIN. The particles in `ef_view_<rarity>` (appearAura_00_<R>,
          circleSmoke_00, kirakira_00/01, circle_03, MagicCircle_00, etc.)
          emit from this origin but draw onto the full screen via Unity's
          world-space rendering.
          On the web we can't replicate the world-space canvas exactly;
          the pragmatic equivalent is a full-design-canvas (1920×1080)
          LotteryParticles host BEHIND the PrefabTree. Particles spawn at
          the canvas center (≡ design center 960,540), apply additive
          blending (mix-blend-mode: plus-lighter) to add light, not
          replace pixels. XIUIFrame.ChangeByIndex(viewRarity) is mirrored
          by passing the rarity label through to characterAppearBgParticles. */}
      <div
        className="absolute inset-0"
        style={{ pointerEvents: "none", display: usePrerenderVfx ? "none" : undefined }}
      >
        <DesignBoxFit
          designSize={PREFAB_DESIGN.characterAppear.size}
          className="h-full w-full"
        >
          {/* No canvas-level mix-blend-mode — LotteryParticles applies
              per-particle globalCompositeOperation from the resolved
              material blend_mode. Canvas-level plus-lighter compounded
              additive layers and caused the URUltimate blowout. */}
          <div style={{ position: "absolute", inset: 0 }}>
            <LotteryParticles
              systems={characterAppearBgParticles(appearRarity)}
              materials={CHARACTER_APPEAR_PARTICLE_MATERIALS}
              transforms={CHARACTER_APPEAR_PARTICLE_TRANSFORMS}
              particleFull={CHARACTER_APPEAR_PARTICLE_FULL}
              className="absolute inset-0 h-full w-full"
              // BG canvas spans the full design canvas — per-emitter origins
              // from CHARACTER_APPEAR_PARTICLE_TRANSFORMS map directly. The
              // world-space ef_sageBg emitters have Transform.localPosition
              // (0,0,0) cascading to world origin (0,0,220 in canvas-local
              // world space) — Unity's world-space simulation emits from the
              // GameObject's world position, which under ScreenSpaceCamera +
              // DefaultUICamera projects to canvas centre. LotteryParticles
              // mirrors that: when the prefab transforms cascade goes off the
              // design canvas (the prefab's RectTransform isn't load-bearing
              // for world-space simulation), spawning collapses to canvas
              // centre as the structurally correct projection — not a fallback.
              // unit_px is read per-emitter (1.0 for sageBg, 108 for any
              // UIParticle-wrapped child). The donut/circle/cone ShapeModule
              // from CHARACTER_APPEAR_PARTICLE_FULL replaces the old
              // "treat any non-Cone shape as a uniform disk" path.
              unitPx={1}
              designSize={[1920, 1080]}
              designOffset={[0, 0]}
              stopEmissionAt={anim.stopTime}
            />
          </div>
        </DesignBoxFit>
      </div>
      {/* Background nodes (bgPattern, bgPatternAdd, gradation*, ef_sageBg,
          shadow, frameURUltimate) are rendered by PrefabTree directly from
          the real prefab below — no custom overlay. */}
      <PrefabTree
        tree={PREFAB_TREES.characterAppear}
        designSize={PREFAB_DESIGN.characterAppear.size}
        // Pass-10 encode: bg video is 1920x864 native (phone's 2.22:1 aspect,
        // no letterbox). The phone's CanvasScaler is match=1 (match-height)
        // on `DefaultCanvas` with refResolution height = 1080, so the runtime
        // canvas logical size on a 2.22:1 phone is 2400x1080. The 1920x1080
        // `container` (UILotteryCharacterAppear) sits centered inside that
        // canvas with 240-logical-px side gutters where the cosmic-bg
        // particles extend. PrefabTree renders the 1920x1080 design 1:1 with
        // the stage; the video underneath shows the full phone aspect.
        fit={PREFAB_DESIGN.characterAppear.fit}
        imageMaterials={characterAppearImageMaterials as ImageMaterialsJson}
        raritySwaps={(() => {
          // Pass-15o: merge clip-resolved pptr swaps into the existing
          // raritySwaps data. character_appear_per_rarity_swaps.json was
          // generated by an earlier pipeline that dropped non-null PPtrs
          // it couldn't resolve (stored target_file_hash="-"); the new
          // resolved_pptr_swaps from character_appear_all_curves.json
          // carries the proper 16-hex hashes (computed from PPtr.m_PathID
          // reinterpreted as unsigned 64-bit). For each rarity we
          // synthesise an additional set of swaps so PrefabTree's
          // swapByPath picks up the proper texture (e.g. rarityNEffect/
          // effect → cf86684898d62fdb.png for SSR+ instead of the prefab
          // default streak placeholder).
          //
          // Pass-15r: also REPLACE hide_paths_from_active_finals with
          // inactive_paths from the new extractor. The old per_rarity_swaps
          // extractor inherited the approximate-clip slot indexing bug
          // and mis-tagged active paths (e.g. SR rarity4 wrongly listed
          // as inactive → SR pulls showed 3 stars instead of 4). The
          // streamed-clip m_IsActive curves ARE correctly indexed even
          // for approximate clips because they sit in the streamed
          // region, not the constant region where the off-by-N hits.
          const base = characterAppearPerRaritySwaps as RaritySwapsJson
          const merged: RaritySwapsJson = { ...base, rarities: { ...base.rarities } }
          const allClipsForMerge = (characterAppearAllCurves as {
            clips: Record<string, { resolved_pptr_swaps?: Array<{ path: string; attribute: string; target_file_hash: string }>; inactive_paths?: string[] }>
          }).clips
          for (const r of Object.keys(merged.rarities)) {
            const clip = allClipsForMerge[`Appear${r}`]
            if (!clip) continue
            const existing = { ...merged.rarities[r] }
            merged.rarities[r] = existing
            // PPtr-resolved swap merge.
            if (clip.resolved_pptr_swaps) {
              existing.swaps = [...existing.swaps]
              const existingByKey = new Map<string, RaritySwapEntry>()
              for (const sw of existing.swaps) existingByKey.set(`${sw.path}|${sw.attribute}`, sw)
              for (const rs of clip.resolved_pptr_swaps) {
                if (rs.attribute !== "m_Texture" && rs.attribute !== "m_Sprite") continue
                const key = `${rs.path}|${rs.attribute}`
                const existingSwap = existingByKey.get(key)
                if (existingSwap && existingSwap.target_file_hash && existingSwap.target_file_hash !== "-") continue
                const synth: RaritySwapEntry = {
                  path: rs.path,
                  attribute: rs.attribute,
                  target_kind: rs.attribute === "m_Sprite" ? "Sprite" : "Texture2D",
                  target_name: existingSwap?.target_name ?? null,
                  target_file_hash: rs.target_file_hash,
                }
                if (existingSwap) {
                  Object.assign(existingSwap, synth)
                } else {
                  existing.swaps.push(synth)
                  existingByKey.set(key, synth)
                }
              }
            }
            // Inactive-paths REPLACEMENT (not merge — the old data has
            // wrong entries that need to be wiped). Streamed-clip
            // m_IsActive curves are authoritative.
            if (Array.isArray(clip.inactive_paths)) {
              existing.hide_paths_from_active_finals = clip.inactive_paths
            }
          }
          return merged
        })()}
        viewRarity={appearRarity}
        className="absolute"
        // With the bg video at object-cover, the 2.22:1 video is scaled by
        // 1.25x to fill the 16:9 stage height — the visible portion is
        // exactly the central 1536 video-pixels = the prefab's 1920x1080
        // container region 1:1. PrefabTree's 1920x1080 design fills the
        // stage at inset:0 so design coords map directly to stage coords.
        style={{ position: "absolute", inset: 0, height: "100%", width: "100%" }}
        hide={[
          ...hideGradation,
          ...hideExtraStars,
          ...hideEfViews,
          ...hideSSRUltimateParticle,
          ...hideStarFlares,
          // Route C: when a prerender video is mounted behind PrefabTree, the
          // video already contains all BG/effect/postprocess layers. PrefabTree
          // must skip rendering them in DOM/CSS to avoid double-rendering
          // (which produces washed-out characters and overlay artifacts like
          // the rainbow bgPattern stripes the user reported on Elmesia URU).
          ...(usePrerenderVfx ? CHARACTER_APPEAR_VFX_PRERENDER_HIDE_PATHS : []),
        ]}
        // Re-centre the rarity star row for 3★/4★/6★. The prefab's static layout
        // is the 5★ spread (rarity6 collocated with rarity5); the in-game
        // animator clip slides stars sideways for the other star counts. We
        // mirror that statically using only the prefab's own rarity1↔rarity5
        // span — see characterAppearStarRowShift for the math.
        nodeStyle={{
          // Pass-15q: characterAppearStarRowShift REMOVED entirely. Its
          // percentage-based `left: X%` values were merged AFTER PrefabTree
          // computed `left: ${r.left}px` from rectOverride's anchoredPosition,
          // which meant nodeStyle's % values OVERRODE the rectOverride px
          // positions — collapsing all stars to the same spot for any
          // approximate-flagged clip (SR/SSR/SSRUlt/UREx/URUlt). The
          // rectOverride algorithmic centred layout below now covers all
          // star counts; this nodeStyle override is unnecessary and harmful.
          // Memory: feedback_prefabtree_nodestyle_overrides_rectoverride.md.
        }}
        // S1 (2026-05-22 audit): d2 RectTransform is set by
        // XIUICharacterDisplay.Set2DTransform at runtime — REPLACES (not
        // composes) the prefab's d2 anchoredPosition + localScale with
        // PcDetailCharaDisplaySetting values + MasterPcMaterial.offset_x_for_detail.
        //
        // Pass-15h: also drive the rarity star positions from the
        // Appear<Rarity> clip's m_AnchoredPosition constants. For AppearR
        // (3 stars) the clip overrides the prefab's 5-star spread to a
        // centred 3-star layout at (-37, 26, 88). For UREx / URUltimate
        // the clip lays out 6 stars at the wide UR spread. For clips
        // tagged "approximate" by the decoder (SR / SSR / SSRUltimate),
        // the constant-clip slot indexing has an off-by-N error so we
        // fall back to the prior characterAppearStarRowShift static
        // layout for those (see characterAppearAllCurves.clips[name]
        // .approximate flag; resolving this is task #6 in the todo list).
        rectOverride={{
          [d2PathFull]: { anchoredPosition: d2AnchoredPos, localScale: d2LocalScale },
          ...((() => {
            // Pass-15n star positioning. Priority order:
            //   1. Clip data (exact): use the clip's per-star
            //      m_AnchoredPosition constants directly (AppearR / UREx /
            //      URUltimate decode cleanly).
            //   2. Algorithmic centred layout (fallback): for clips the
            //      decoder marks approximate (SR / SSR / SSRUlt), or where
            //      clip data is missing, compute centred positions from
            //      the prefab's own 5-star step. The previous fallback
            //      via characterAppearStarRowShift returned percentage-
            //      based `left: X%` values that don't compose with the
            //      design-px positioning PrefabTree uses — every star
            //      ended up collapsed at the same spot (the user's
            //      "all stars below 5 stars going to the same position"
            //      complaint).
            //
            // 5-star prefab positions: x = [-99, -36, 26, 88, 149], y = -125.
            // step = (149 - (-99)) / 4 = 62 px; centre = 25 px.
            const ov: Record<string, { anchoredPosition?: [number, number] }> = {}
            const PREFAB_X = [-99, -36, 26, 88, 149]
            const PREFAB_Y = -125
            const PREFAB_STEP = (149 - -99) / 4
            const PREFAB_CENTRE = 25
            const starCount = appearAssets.starCount
            const useClip = !!allCurvesClip && !allCurvesClip.approximate
            for (let i = 1; i <= starCount; i++) {
              const rel = `container/characterName/rarityStar/rarity${i}`
              const fullPath = `UILotteryCharacterAppear/${rel}`
              if (useClip) {
                const ax = allCurvesClip!.paths[rel]?.["m_AnchoredPosition.x"]?.[0]?.v
                const ay = allCurvesClip!.paths[rel]?.["m_AnchoredPosition.y"]?.[0]?.v
                if (typeof ax === "number" && typeof ay === "number") {
                  ov[fullPath] = { anchoredPosition: [ax, ay] }
                  continue
                }
              }
              // Algorithmic centred layout. For starCount=5 we'd reuse the
              // prefab static positions directly (no override needed), but
              // we still emit the override to make the behaviour explicit
              // and decoupled from prefab spacing assumptions elsewhere.
              const startX = PREFAB_CENTRE - ((starCount - 1) * PREFAB_STEP) / 2
              const x = starCount === 5 ? PREFAB_X[i - 1] : startX + (i - 1) * PREFAB_STEP
              ov[fullPath] = { anchoredPosition: [x, PREFAB_Y] }
            }
            return ov
          })()),
        }}
        // S1 (2026-05-22 audit): route the per-character illustration through
        // PrefabTree's Image-component path instead of slot-injecting <img>
        // overlay. This preserves the d2 RectTransform + AspectRatioFitter
        // behaviour and keeps raritySwaps capable of overriding the path
        // if a per-rarity m_Sprite swap ever targets d2.
        imageSrcOverride={{
          [d2PathFull]: { src: characterSpriteUrl, objectFit: "cover", objectPosition: "center top" },
        }}
        text={{
          // Prefab path-based overrides: the inner TMP "characterName" and
          // "characterTitle" are inside container/characterName/.
          "UILotteryCharacterAppear/container/characterName/characterName": characterName,
          "UILotteryCharacterAppear/container/characterName/characterTitle": characterTitleText,
          "UILotteryCharacterAppear/container/btnSkip/label": "SKIP",
        }}
        textStyle={{
          // Match hieroglyph SKIP's fixed CSS 24px — divide by the
          // PrefabTree fitScale so the outer transform: scale(fitScale)
          // brings it back to 24px CSS on every viewport. overflow:visible
          // and lineHeight:1 avoid clipping by the prefab's 50-design-px
          // tall label rect.
          "UILotteryCharacterAppear/container/btnSkip/label": {
            fontStyle: "italic",
            fontSize: "calc(40px / var(--prefab-fit-scale, 1))",
            letterSpacing: "0.025em",
            lineHeight: 1,
            userSelect: "none",
            overflow: "visible",
            // Nudge SKIP a tiny bit so it visually centres with the ▶▶|
            // icon (which sits at btnSkip centre while the label's right
            // edge is 14.5 design-px to the left of the icon).
            transform: "translate(6px, 1px)",
          },
        }}
        slots={{
          // d2 is NO LONGER slot-injected — replaced by imageSrcOverride above
          // (2026-05-22 S1 audit fix). PrefabTree now renders d2 through its
          // Image-component path with the per-character sprite URL; the d2
          // RectTransform anchoredPosition + localScale come from
          // PcDetailCharaDisplaySetting via `rectOverride`; the m_Color.a
          // fade-in keyframes from the Appear<rarity> clip drive d2's opacity
          // via the existing WAAPI binding in `onNodes` (see below).
          //
          // Shadow with the real per-rarity baked m_Color (1:1 from clip).
          "UILotteryCharacterAppear/container/shadow": <CharacterAppearShadow rarity={appearRarity} />,
          // bgPattern / bgPatternAdd: both layers ship with alpha=0 (or a
          // CanvasGroup setup that prefab-tree's static render treats as
          // invisible). The Appear<Rarity> clip animates each layer's alpha
          // keyframes 1:1 (see character_appear_anim.json.<rarity>.bgPattern,
          // extracted from clip slot bindings container/bgPattern.m_Color.a +
          // container/bgPatternAdd.m_Alpha / m_Color.a via UnityPy typetree
          // decode of CAB-bdff9c06e980c4448a3ee9fe4b059617's Animation deps).
          // We inject custom components that own their WAAPI lifecycle so the
          // prefab tree stays untouched while the alpha curves play 1:1.
          "UILotteryCharacterAppear/container/bgPattern": (
            <CharacterAppearBgPatternLayer rarity={appearRarity} />
          ),
          "UILotteryCharacterAppear/container/bgPatternAdd": (
            <CharacterAppearBgPatternAddLayer rarity={appearRarity} />
          ),
          // ef_appear is NO LONGER slotted into the prefab's 100×100 anchor
          // rect (2026-05-22 S1 audit). The anchor is an emitter ORIGIN, not
          // a draw surface — at runtime Unity composes particles onto the full
          // UI canvas. ef_appear now renders on a parallel full-stage particle
          // host directly below this PrefabTree (see the post-tree section in
          // FullArtRevealStage). Keep the slot empty so the prefab node still
          // renders its own static visuals (none in this case).
          // Per-star bursts. Each `rarity<N>Effect` prefab node is a 0×0
          // point anchor that the Unity ParticleSystem children emit from.
          // PrefabTree renders it as a 0×0 wrapper at the design-space
          // anchor (computed in CHARACTER_APPEAR_RARITY_EFFECT_ORIGINS); we
          // inject a 400×400 design-px slot centred on the anchor (offset
          // by -200 on both axes since the slot extends absolutely from
          // the 0×0 wrapper's origin). The canvas then runs the 9 real
          // ParticleSystems for that star — burst counts/lifetimes/colors/
          // shape behaviour come straight from the prefab data, matched by
          // path. starCount controls which anchors render: stars beyond
          // starCount are hidden entirely.
          ...Object.fromEntries(
            ([1, 2, 3, 4, 5, 6] as const).map((n) => [
              `UILotteryCharacterAppear/container/characterName/rarityStar/rarity${n}Effect`,
              n <= appearAssets.starCount && !usePrerenderVfx ? (
                <div
                  key={`rarity${n}Effect-slot`}
                  style={{
                    position: "absolute",
                    left: "-200px",
                    top: "-200px",
                    width: "400px",
                    height: "400px",
                    pointerEvents: "none",
                  }}
                >
                  <LotteryParticles
                    systems={characterAppearRarityEffectParticles(n, rarityActiveHideRel)}
                    materials={CHARACTER_APPEAR_PARTICLE_MATERIALS}
                    transforms={CHARACTER_APPEAR_PARTICLE_TRANSFORMS}
                    particleFull={CHARACTER_APPEAR_PARTICLE_FULL}
                    className="absolute inset-0 h-full w-full"
                    // rarityNEffect emitters have UIParticle.m_Scale3D = (108,108,108);
                    // see character_appear_uiparticle_scales.json.
                    unitPx={108}
                    // The slot wrapper is a 400×400 design-px box centred on
                    // the rarity<N>Effect anchor. Pass that frame so the
                    // per-emitter origins in CHARACTER_APPEAR_PARTICLE_TRANSFORMS
                    // (all clustered at the star's design-px coords) remap
                    // into the slot's local pixel space (≈ slot centre with
                    // any sub-emitter sub-px offsets preserved).
                    designSize={[400, 400]}
                    designOffset={[
                      CHARACTER_APPEAR_RARITY_EFFECT_ORIGINS[n].x - 200,
                      CHARACTER_APPEAR_RARITY_EFFECT_ORIGINS[n].y - 200,
                    ]}
                    stopEmissionAt={anim.stopTime}
                  />
                </div>
              ) : null,
            ]),
          ),
          // Skip button hit-area: the prefab's btnSkip/touchArea (460×128,
          // centred on btnSkip's pivot anchored to the top-right corner). No
          // hardcoded percentages — the button fills the prefab's actual
          // touchArea RectTransform via the slot cascade.
          "UILotteryCharacterAppear/container/btnSkip/touchArea": (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSkipAll()
              }}
              className="absolute inset-0"
              style={{ background: "transparent", border: 0, cursor: "pointer", pointerEvents: "auto" }}
              aria-label="Skip reveal"
            />
          ),
        }}
        onNodes={onNodes}
      />
      {/* S1 (2026-05-22): full-stage particle host for ef_appear/ef_view_<rarity>.
          Mirrors the ef_sageBg host above. The prefab's ef_appear node is a
          100×100 RectTransform at design (960, 440) — that's the emitter ORIGIN,
          not the draw surface. Unity runs the ParticleSystems in world-space and
          composes them onto the full UI canvas. We replicate that by rendering
          LotteryParticles on a full 1920×1080 design canvas, so particles can
          spread across the whole screen instead of being clipped to the 100×100
          rect. designOffset=[0,0] means per-emitter origins in
          CHARACTER_APPEAR_PARTICLE_TRANSFORMS are interpreted in full-stage
          design coords (the same coord system as ef_sageBg). */}
      <div
        className="absolute inset-0"
        style={{ pointerEvents: "none", display: usePrerenderVfx ? "none" : undefined }}
      >
        <DesignBoxFit
          designSize={PREFAB_DESIGN.characterAppear.size}
          className="h-full w-full"
        >
          <div style={{ position: "absolute", inset: 0 }}>
            <LotteryParticles
              systems={CHARACTER_APPEAR_PARTICLES}
              materials={CHARACTER_APPEAR_PARTICLE_MATERIALS}
              transforms={CHARACTER_APPEAR_PARTICLE_TRANSFORMS}
              particleFull={CHARACTER_APPEAR_PARTICLE_FULL}
              className="absolute inset-0 h-full w-full"
              // ef_appear has UIParticle.m_Scale3D = (108, 108, 108) — Unity
              // ParticleSystem startSize/startSpeed are in world units and
              // UIParticle scales them to canvas pixels via m_Scale3D.
              unitPx={108}
              designSize={[1920, 1080]}
              designOffset={[0, 0]}
              stopEmissionAt={anim.stopTime}
            />
          </div>
        </DesignBoxFit>
      </div>
      {/* URP Vignette overlay: dark-green tinted radial falloff, intensity
          0.534, smoothness 0.20. From the LotteryCharacterAppear_00
          VolumeProfile asset — see character_appear_postprocess.json.
          Route C suppresses this because vignette is baked into the
          captured video. */}
      {!usePrerenderVfx && <div style={vignetteOverlayStyle} aria-hidden />}
    </div>
  )
}

// SummonResultReveal orchestrator. Mirrors UICharacterAcquisitionAnimationPresenter
// PlayAsync which iterates the characterAcquisitionCollection and for each
// element calls (in order):
//   1. ShowLotteryPromotionAsync — hieroglyph rarity reveal, runs for EVERY
//      element. startRarity/fixRarity drives the rarity-tier visual (R/SR/SSR/
//      SSRUltimatePlusPU); IsPromotionFiveStar(patternAnimationType) only
//      controls whether the SR→SSR morph TEASE plays on the first 5★ of a
//      multi-pull, not whether the screen itself shows.
//   2. ShowLotteryTextAnnounceAsync — 5★+ ONLY (voice line + announce text from
//      MasterPcLotteryMessage). Lower-rarity rows have no message + no voice.
//   3. ShowLotteryMovieAsync — 5★+ ONLY when CharacterAcquisitionElement.IsPlayMovie
//      (i.e. !string.IsNullOrEmpty(MoviePath)).
//   4. ShowLotteryCharacterAppearAsync — every element.
// Each phase is skipped per-result; a 3★ pull therefore goes Promotion →
// CharacterAppear, while a 5★+ pickup with a movie runs the full 4-stage seq.
function SummonResultReveal({
  results,
  banner,
  bgSources,
  pcLotteryMessages,
  patternAnimationType,
  onFinish,
}: {
  results: SummonResult[]
  banner: SummonBanner
  bgSources: string[]
  pcLotteryMessages?: SummonPayload["pc_lottery_messages"]
  patternAnimationType: number | null
  onFinish: () => void
}) {
  const [idx, setIdx] = useState(0)
  const result = results[idx]
  void bgSources

  const message = pcLotteryMessageFor(result, pcLotteryMessages)
  const movieSrc = acquisitionMovieSource(message)
  // S2 (2026-05-22 audit, asm-verified):
  //  - Promotion runs UNCONDITIONALLY per element [asm 0xAAADCCC, no cbz/cbnz
  //    between the four Show* calls]. Per-rarity branching lives INSIDE
  //    ShowLotteryPromotionAsync; what we choose is the startRarity/fixRarity,
  //    not whether to show the screen.
  //  - TextAnnounce gates on `!IsNullOrWhiteSpace(Announce) && !IsNullOrWhiteSpace(VoicePath)`
  //    [asm 0xAAB2170..0xAAB2194]. No rarity check upstream — the rarity-5+
  //    coincidence is just because MasterPcLotteryMessage only has rows for
  //    5★+ characters, populating both fields together.
  //  - Movie gates on `element.IsPlayMovie && !operationEntity.isSkipPlayMovie`
  //    [asm 0xAAB0594..0xAAB05A8]. Data-driven on `MoviePath` non-empty
  //    (IsPlayMovie = !IsNullOrEmpty(MoviePath) — see CharacterAcquisitionElement
  //    .Create RVA 0xAAABC44). Rarity is incidental — drop the redundant filter.
  //  - CharacterAppear always runs.
  const showPromotion = Boolean(result)
  const showTextAnnounce = hasTextAnnounce(message)
  // S2: isSkipPlayMovie chain — if the player taps "skip" during TextAnnounce,
  // the next Movie phase must skip too (mirrors operationEntity.isSkipPlayMovie).
  // The flag resets per-result.
  const [isSkipPlayMovie, setIsSkipPlayMovie] = useState(false)
  useEffect(() => { setIsSkipPlayMovie(false) }, [idx])
  const showMovie = Boolean(movieSrc) && !isSkipPlayMovie

  const applicablePhases = useMemo<RevealPhase[]>(() => {
    const list: RevealPhase[] = []
    if (showPromotion) list.push("generic")
    if (showTextAnnounce) list.push("phrase")
    if (showMovie) list.push("movie")
    list.push("appear")
    return list
  }, [showPromotion, showTextAnnounce, showMovie])

  const [phaseIdx, setPhaseIdx] = useState(0)
  useEffect(() => {
    setPhaseIdx(0)
  }, [idx, applicablePhases])

  if (!result) return null
  const phase = applicablePhases[Math.min(phaseIdx, applicablePhases.length - 1)]
  const fiveStarOrdinal = results.slice(0, idx + 1).filter((candidate) => resultRarity(candidate) >= 5).length

  const advance = () => {
    if (phaseIdx + 1 < applicablePhases.length) {
      setPhaseIdx((current) => current + 1)
      return
    }
    if (idx + 1 >= results.length) {
      onFinish()
    } else {
      setIdx((current) => current + 1)
    }
  }

  if (phase === "generic") {
    const promotion = promotionViewRarity(result, banner, patternAnimationType, fiveStarOrdinal)
    return (
      <PromotionPrerenderRevealScreen resultId={result.id} promotion={promotion} onAdvance={advance} />
    )
  }
  if (phase === "phrase") {
    return (
      <TextAnnounceRevealScreen
        message={message}
        onAdvance={advance}
        onSkipMovie={() => setIsSkipPlayMovie(true)}
      />
    )
  }
  if (phase === "movie" && movieSrc) {
    // IL2CPP-verified (UICharacterAcquisitionAnimationPresenter, dump.cs
    // <>c__DisplayClass38_1 fields = [movieFinishSource, isSkip]): the
    // Movie btnSkip lambda only completes the local UniTaskCompletionSource
    // — no cross-phase flag write, no skip-all behaviour. PlayAsync.MoveNext
    // (RVA 0xAAADCCC) then proceeds to ShowLotteryCharacterAppearAsync as
    // normal. So Movie SKIP = advance to next phase, not finish-all.
    return <AcquisitionMovieReveal src={movieSrc} onAdvance={advance} onSkipAll={advance} />
  }
  // Pass-15p: key on result.id forces a clean remount when idx advances.
  // Without this, React reconciles FullArtRevealStage in-place when the
  // result prop changes — text overrides (characterName, characterTitle)
  // and image sprite URLs update to the next character INSTANTLY, before
  // the underlying VFX prerender video has time to swap. The user sees the
  // next character's nameplate flash for a frame on top of the current
  // reveal's background. Remounting on result.id cycles the entire
  // FullArtRevealStage subtree so DOM + WAAPI + video src all transition
  // atomically.
  //
  // IL2CPP-verified (dump.cs <>c__DisplayClass39_0 fields = [isSkip,
  // taskSource, <>4__this]): CharacterAppear's btnSkip lambda only
  // completes its local taskSource. PlayAsync.MoveNext then iterates to the
  // next characterAcquisitionCollection element. So CharacterAppear SKIP =
  // advance (which falls through to onFinish only for the last element of
  // the last result via advance()'s own end-of-list check).
  return <FullArtRevealStage key={result.id} result={result} onAdvance={advance} onSkipAll={advance} />
}

export function SummonSimulator({ data }: { data: SummonPayload }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [drawKind, setDrawKind] = useState<DrawKind>("multi")
  const [showRates, setShowRates] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showTrade, setShowTrade] = useState(false)
  const [results, setResults] = useState<SummonResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [showReveal, setShowReveal] = useState(false)
  const [cutsceneSteps, setCutsceneSteps] = useState<CutsceneStep[]>([])
  const [cutscenePatternType, setCutscenePatternType] = useState<number | null>(null)
  const [cutsceneCloakPerformanceSkip, setCutsceneCloakPerformanceSkip] = useState(false)
  // AnalysisCut runs ONCE per session between the main lottery pattern movie
  // (cutsceneSteps) and the per-result Promotion loop (showReveal). Source:
  // IL2CPP LotteryAnimationAnalysisCutState is a single state in the
  // LotteryResultAnimation FSM, NOT part of LotteryCharacterAcquisitionState's
  // per-character iteration. The Entity has one (startRarity=R, fixRarity)
  // pair and escalates via ChangeNextRarity inside that single instance.
  const [showAnalysisCut, setShowAnalysisCut] = useState(false)
  const [displayMode, setDisplayMode] = useState<"banner" | "movie">("banner")
  const [movieFailed, setMovieFailed] = useState(false)
  const [bazaarPoints, setBazaarPoints] = useState(0)

  const banners = data.banners
  const uiAssets = data.ui_assets ?? DEFAULT_UI_ASSETS
  const banner = banners[selectedIndex] ?? banners[0]
  const singleLottery = useMemo(() => (banner ? findLottery(banner, "single") : undefined), [banner])
  const multiLottery = useMemo(() => (banner ? findLottery(banner, "multi") : undefined), [banner])
  const selectedLottery = drawKind === "multi" ? multiLottery : singleLottery
  const visibleBannerIndexes = useMemo(() => {
    if (banners.length <= 5) return banners.map((_, index) => index)
    const half = 2
    return Array.from({ length: 5 }, (_, slot) => (selectedIndex - half + slot + banners.length) % banners.length)
  }, [banners, selectedIndex])

  useEffect(() => {
    setDisplayMode("banner")
    setMovieFailed(false)
    setShowRates(false)
    setShowDetails(false)
    setShowTrade(false)
    setShowResults(false)
    setResults([])
    setBazaarPoints(0)
    setCutscenePatternType(null)
    setCutsceneCloakPerformanceSkip(false)
    setShowAnalysisCut(false)
  }, [selectedIndex])

  // Preload images for the visible-strip + adjacent banners so left/right
  // navigation is snappy. We use new Image() to kick the browser's HTTP cache
  // — once warm, subsequent <img src=...> mounts skip network and render
  // instantly. Only runs once per index change in this session.
  useEffect(() => {
    if (typeof window === "undefined") return
    const preloadList: string[] = []
    for (const idx of visibleBannerIndexes) {
      const b = banners[idx]
      if (!b) continue
      const sid = b.master_ogc_lottery_shop_id
      const collect = (paths?: string[] | null) => {
        if (!paths) return
        for (const p of paths) if (p) preloadList.push(p)
      }
      collect(b.assets?.banner)
      collect(b.assets?.logo)
      collect(b.assets?.character)
      collect(b.assets?.background)
      collect(b.assets?.top_panel)
    }
    for (const src of preloadList) {
      const img = new window.Image()
      img.decoding = "async"
      img.src = src
    }
  }, [visibleBannerIndexes, banners])

  if (!banner || !selectedLottery) {
    return (
      <main className="site-page grid min-h-screen place-items-center p-6 text-foreground">
        <div className="rounded-[6px] border border-border bg-[#18191d] p-6">No summon data was generated.</div>
      </main>
    )
  }

  const shopId = banner.master_ogc_lottery_shop_id
  // Background priority: dedicated background slot wins. Only fall back to
  // the character art when no background is configured at all. Within each
  // group we prefer non-L10N (no English text overlay) but we never let a
  // character image jump ahead of an existing background because of locale.
  const backgroundSources = [
    ...preferNonLocalizedFallback(sourcesOr(banner.assets?.background, uniqueBackgroundSources(shopId))),
    ...preferNonLocalizedFallback(sourcesOr(banner.assets?.character, shopAssetSources(shopId, "LotteryCharacter"))),
  ]
  const logoSources = sourcesOr(banner.assets?.logo, shopAssetSources(shopId, "LotteryLogo"))
  const characterLayerSources = sourcesOr(
    banner.assets?.top_panel,
    assetSources(banner.top_images.find((image) => image.image_type === 1)?.image_path),
  )
  const movieSources = banner.movie?.sources ?? []
  const hasPlayableMovie = Boolean(banner.movie?.available && movieSources.length)
  const showMovie = displayMode === "movie" && hasPlayableMovie && !movieFailed
  const arrowLeftSources = uiAssets.carousel_arrow_left?.length ? uiAssets.carousel_arrow_left : DEFAULT_UI_ASSETS.carousel_arrow_left
  const arrowRightSources = uiAssets.carousel_arrow_right?.length ? uiAssets.carousel_arrow_right : DEFAULT_UI_ASSETS.carousel_arrow_right

  const singleCost = costInfo(singleLottery, uiAssets)
  const multiCost = costInfo(multiLottery, uiAssets)
  const pointItem = pointItemFor(banner)
  const hasBazaar = Boolean(pointItem)

  function moveBanner(offset: number) {
    setSelectedIndex((current) => (current + offset + banners.length) % banners.length)
  }

  function draw(kind: DrawKind) {
    const lottery = kind === "multi" ? multiLottery : singleLottery
    if (!lottery) return
    const count = kind === "multi" ? Math.min(10, lottery.reward_count) : 1
    const rolled = rollLottery(lottery, count)
    setDrawKind(kind)
    setResults(rolled)
    if (lottery.point > 0) setBazaarPoints((current) => current + lottery.point * count)
    // Play the banner's real summon cutscene first (data-driven). The
    // session-level AnalysisCut runs after the cutscene; result screen opens
    // after AnalysisCut finishes (or is skipped).
    const cutscene = selectSummonCutscene(banner, rolled, data.define_values, data.define_release_labels)
    setCutscenePatternType(cutscene.patternAnimationType)
    setCutsceneCloakPerformanceSkip(cutscene.cloakPerformanceSkip)
    if (cutscene.steps.length) {
      setCutsceneSteps(cutscene.steps)
    } else {
      // No main lottery movie selected — go straight to AnalysisCut (or skip it).
      proceedAfterCutscene(cutscene.patternAnimationType, cutscene.cloakPerformanceSkip)
    }
  }

  function proceedAfterCutscene(patternType: number | null, cloakSkip: boolean) {
    if (shouldSkipAnalysisCut(patternType, cloakSkip)) {
      setShowReveal(true)
    } else {
      setShowAnalysisCut(true)
    }
  }

  return (
    <main className="site-page min-h-screen p-3 text-foreground sm:p-6">
      <div className="mx-auto max-w-[1760px]">
        <div className="relative overflow-hidden rounded-[2px] border border-[#9098bc]/50 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <div className="relative aspect-[16/9] min-h-[560px]">
            <GameImage sources={backgroundSources} className="absolute inset-0 h-full w-full object-fill" />
            {showMovie ? (
              <video
                key={movieSources.join("|")}
                src={mediaUrl(movieSources[0])}
                autoPlay
                muted
                loop
                playsInline
                onError={() => setMovieFailed(true)}
                className="absolute inset-0 h-full w-full object-fill"
              />
            ) : (
              <GameImage sources={characterLayerSources} className="absolute inset-0 h-full w-full object-fill" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/12 via-transparent to-black/10" />
            <div className="absolute inset-x-0 bottom-0 h-[15.5%] bg-[#56565d]/72" />

            <div className="absolute right-[10.8%] top-[3.2%]">
              <PrefabLayer
                spec={SPECS.mainRateBtn}
                className="w-[clamp(210px,15vw,280px)] cursor-pointer transition hover:brightness-110"
                slots={{ btnDetail: <ButtonPatternFill insetX={5.71} insetY={16.67} buttonW={280} buttonH={84} /> }}
                text={{ label: "Recruit Details/Drop Rates" }}
                onNodeClick={{ btnDetail: () => setShowRates(true), label: () => setShowRates(true) }}
              />
            </div>

            <div className="absolute left-[6.6%] top-[50%] flex flex-col gap-4">
              {/* btnCharaDetail — exact UILottery prefab sprite + geometry */}
              <PrefabLayer
                spec={SPECS.mainCharaDetailBtn}
                className="w-[88px] cursor-pointer transition hover:brightness-110"
                onNodeClick={{
                  btnCharaDetail: () => setShowDetails(true),
                  label: () => setShowDetails(true),
                }}
                text={{ label: "Char.\nDetails" }}
              />
              {/* btnChange (è¡¨ç¤ºåˆ‡æ›¿ / Switch Display) — exact UILottery prefab */}
              <div
                className={hasPlayableMovie ? "cursor-pointer transition hover:brightness-110" : "opacity-45"}
                onClick={() => {
                  if (hasPlayableMovie) setDisplayMode((mode) => (mode === "banner" ? "movie" : "banner"))
                }}
                title={hasPlayableMovie ? "Switch Display" : "Switch-display movie is not available for this banner"}
              >
                <PrefabLayer spec={SPECS.mainChangeBtn} className="w-[84px]" text={{ label: "Switch\nDisplay" }} />
              </div>
            </div>

            {/* logo box width == rendered logo width (natural 2:1), so the
                Part5 band sits at a fixed %; the end-date strip is aligned to
                it directly below. */}
            <div className="absolute left-[13.5%] top-[57%] w-[min(24vw,380px)]">
              <GameImage
                sources={logoSources}
                className="block w-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.85)]"
              />
              <BannerEndDate banner={banner} />
            </div>

            <div className="absolute right-[4.4%] top-[53.9%] flex w-fit flex-col items-stretch gap-[0.05vw]">
              <div className="relative z-10 flex gap-0">
                <DrawButton
                  label={`Recruit x${singleLottery?.reward_count || 1}`}
                  cost={singleCost.value}
                  iconSources={singleCost.iconSources}
                  disabled={!singleLottery}
                  onClick={() => draw("single")}
                />
                <div style={{ marginLeft: "clamp(-48px, -2.15vw, -32px)" }}>
                  <DrawButton
                    label={`Recruit x${multiLottery?.reward_count || 10}`}
                    cost={multiCost.value}
                    iconSources={multiCost.iconSources}
                    subLabel="One 4★+ Character Guaranteed"
                    disabled={!multiLottery}
                    onClick={() => draw("multi")}
                  />
                </div>
              </div>
              {/* Keep Bazaar aligned to the exact rendered Recruit button row width. */}
              {hasBazaar && (
                <PrefabLayer
                  spec={SPECS.mainExchangePoints}
                  className="w-[91.7%] transition hover:brightness-110"
                  style={{
                    // The prefab sprites overhang the layer box on both sides
                    // (? button on the left, Trade button on the right). Keep
                    // the visual OUTER edges aligned with the Recruit x1/x10
                    // row instead of aligning the prefab's internal dark bar.
                    marginLeft: "4.7%",
                    marginTop: "clamp(-15px, -1.25vw, -16px)",
                  }}
                  hide={["badgeEx", "Exclamation"]}
                  nodeStyle={{
                    exchangeType: { left: "0.08%", top: "7.14%", width: "99.37%", height: "96.43%" },
                    pointsAmount: { left: "11.73%", top: "15.18%", width: "50.08%", height: "80.36%" },
                    btnQuestion: { left: "-1.58%", top: "-16.07%", width: "13.95%", height: "142.86%" },
                    btnExchangeList: { left: "60.94%", top: "-23.21%", width: "40.57%", height: "157.14%" },
                    labelList: { left: "66.48%", top: "16.07%", width: "29.48%", height: "78.57%" },
                  }}
                  text={{
                    pointsAmount: `Bazaar Pts: ${bazaarPoints.toLocaleString()}`,
                    labelList: "Trade",
                  }}
                  onNodeClick={{ btnExchangeList: () => setShowTrade(true), labelList: () => setShowTrade(true) }}
                />
              )}
            </div>

            <div className="absolute left-[6.8%] right-[5.5%] top-[84.8%] flex items-center gap-4">
              <button onClick={() => moveBanner(-1)} className="grid h-16 w-12 shrink-0 place-items-center">
                <GameImage sources={arrowLeftSources} className="h-14 w-14 object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]" />
              </button>
              <div className="grid flex-1 grid-cols-5 items-center gap-[1.1vw]">
                {visibleBannerIndexes.map((index) => {
                  const item = banners[index]
                  const selected = index === selectedIndex
                  const tileSources = sourcesOr(item.assets?.banner, shopAssetSources(item.master_ogc_lottery_shop_id, "LotteryBanner"))
                  return (
                    <button
                      key={`${item.master_ogc_lottery_shop_id}-${index}`}
                      onClick={() => setSelectedIndex(index)}
                      className={`relative h-[clamp(70px,6vw,108px)] overflow-hidden rounded-[2px] border bg-black transition ${
                        selected
                          ? "z-10 scale-[1.12] border-[#67f5d4] shadow-[0_0_0_4px_rgba(255,255,255,0.45),0_0_18px_rgba(103,245,212,0.95)]"
                          : "border-black/70 opacity-75 hover:opacity-100"
                      }`}
                    >
                      <GameImage sources={tileSources} className="h-full w-full object-cover" />
                    </button>
                  )
                })}
              </div>
              <button onClick={() => moveBanner(1)} className="grid h-16 w-12 shrink-0 place-items-center">
                <GameImage sources={arrowRightSources} className="h-14 w-14 object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]" />
              </button>
            </div>

            {showDetails && (
              <CharacterDetailsPrefabPanel banner={banner} onClose={() => setShowDetails(false)} onOpenRates={() => setShowRates(true)} />
            )}
            {showRates && <RatePanel banner={banner} onClose={() => setShowRates(false)} />}
            {showTrade && pointItem && (
              <TradePanel banner={banner} pointItem={pointItem} bazaarPoints={bazaarPoints} uiAssets={uiAssets} onClose={() => setShowTrade(false)} />
            )}
            {cutsceneSteps.length > 0 && (
              <SummonCutscene
                steps={cutsceneSteps}
                onFinish={() => {
                  setCutsceneSteps([])
                  proceedAfterCutscene(cutscenePatternType, cutsceneCloakPerformanceSkip)
                }}
              />
            )}
            {showAnalysisCut && (
              <AnalysisCutPrerenderRevealScreen
                fixRarity={analysisCutFixRarityForPattern(cutscenePatternType)}
                onAdvance={() => {
                  setShowAnalysisCut(false)
                  setShowReveal(true)
                }}
              />
            )}
            {showReveal && (
              <SummonResultReveal
                results={results}
                banner={banner}
                bgSources={backgroundSources}
                pcLotteryMessages={data.pc_lottery_messages}
                patternAnimationType={cutscenePatternType}
                onFinish={() => {
                  setShowReveal(false)
                  setShowResults(true)
                }}
              />
            )}
            {showResults && (
              <ResultsPanelPrefab
                banner={banner}
                results={results}
                bazaarPoints={bazaarPoints}
                bgSources={backgroundSources}
                uiAssets={data.ui_assets}
                onRecruitMore={() => {
                  setShowResults(false)
                  draw(drawKind)
                }}
                onClose={() => setShowResults(false)}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export const __diag = {
  AnalysisCutPrerenderRevealScreen,
  PromotionPrerenderRevealScreen,
  PromotionRevealScreen,
  TextAnnounceRevealScreen,
  AcquisitionMovieReveal,
  FullArtRevealStage,
  ResultsPanelPrefab,
}
