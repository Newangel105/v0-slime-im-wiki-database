// Layout specs generated 1:1 from the game's own UI prefabs
// (UILottery / UILotteryExchangeList / UILotteryPickUpList). Geometry comes
// straight from each prefab's RectTransform tree; sprites are the real
// in-game atlas sprites extracted to /public/UI/summon. Nothing here is
// hand-authored — regenerate with scripts/flatten_screen.py.
import tradeWindow from "./trade-window.json"
import charaDetailsWindow from "./chara-details-window.json"
import charaDetailsRow from "./chara-details-row.json"
import tradeRow from "./trade-row.json"
import mainBottomButtons from "./main-bottom-buttons.json"
import mainCharaDetailBtn from "./main-charadetail-btn.json"
import mainChangeBtn from "./main-change-btn.json"
import mainDecisionOnce from "./main-decision-once.json"
import mainDecisionContinuous from "./main-decision-continuous.json"
import mainDecisionInfoContinuous from "./main-decision-info-continuous.json"
import mainExchangePoints from "./main-exchange-points.json"
import mainRateBtn from "./main-rate-btn.json"
import lotteryCharacterAppear from "./lottery-character-appear.json"
import lotteryPromotion from "./lottery-promotion.json"
import lotteryTextAnnounce from "./lottery-text-announce.json"
import lotteryMovie from "./lottery-movie.json"
import lotteryResult from "./lottery_result.json"
import lotteryCard from "./lottery_card.json"
import lotteryViewRules from "./lottery-view-rules.json"

export type PrefabNode = {
  name: string
  z: number
  x: number
  y: number
  w: number
  h: number
  img?: string
  iw?: number
  ih?: number
  border?: [number, number, number, number] // Unity m_Border: left, bottom, right, top
  sliced?: boolean
  tint?: [number, number, number, number] // rgba 0..1
  text?: {
    v: string
    size?: number | null
    color?: { r?: number; g?: number; b?: number; a?: number; rgba?: number } | number[] | null
    align?: number | null
  }
}

export type PrefabSpec = {
  prefab: string
  root: string
  canvas: [number, number]
  nodes: PrefabNode[]
}

export const SPECS = {
  tradeWindow: tradeWindow as PrefabSpec,
  charaDetailsWindow: charaDetailsWindow as PrefabSpec,
  charaDetailsRow: charaDetailsRow as PrefabSpec,
  tradeRow: tradeRow as PrefabSpec,
  mainBottomButtons: mainBottomButtons as PrefabSpec,
  mainCharaDetailBtn: mainCharaDetailBtn as PrefabSpec,
  mainChangeBtn: mainChangeBtn as PrefabSpec,
  mainDecisionOnce: mainDecisionOnce as PrefabSpec,
  mainDecisionContinuous: mainDecisionContinuous as PrefabSpec,
  mainDecisionInfoContinuous: mainDecisionInfoContinuous as PrefabSpec,
  mainExchangePoints: mainExchangePoints as PrefabSpec,
  mainRateBtn: mainRateBtn as PrefabSpec,
  lotteryCharacterAppear: lotteryCharacterAppear as PrefabSpec,
  lotteryPromotion: lotteryPromotion as PrefabSpec,
  lotteryTextAnnounce: lotteryTextAnnounce as PrefabSpec,
  lotteryMovie: lotteryMovie as PrefabSpec,
  lotteryResult: lotteryResult as PrefabSpec,
  lotteryCard: lotteryCard as PrefabSpec,
}

export const SUMMON_UI_BASE = "/UI/summon"

// --- Lottery view rules (per ViewRarity asset/visibility rules) ---------
// Transcribed 1:1 from the full UILottery* prefab tree dumps
// (C:/Users/Angel105/Documents/cenas/_work/prefab_out/) and from the IL2CPP
// enums UILotteryCharacterAppear.RarityType / UILotteryPromotion.Entity.ViewRarity
// / UICommonData.RarityType. Nothing here is hand-invented; the JSON literally
// records which GameObject names exist as siblings inside the prefab and which
// ViewRarity activates each one (the in-game IL2CPP Set() does the swap).
export type CharacterAppearViewRarity = "R" | "SR" | "SSR" | "SSRUltimate" | "UREx" | "URUltimate"
export type PromotionViewRarity = "R" | "SR" | "SSR" | "SSRUltimatePlusPU"
export type ResultCardRarityKey = "_3" | "_4" | "_5" | "_5_6_Ultimate" | "_5_6_UltimatePlus" | "_6_Epic"

export type NameplateSprites = { base: string; line: string; rimuru: string; star: string }
export type CharacterAppearBg = { bg: string; magicCircle: string }

export type LotteryViewRules = {
  characterAppear: {
    rarities: CharacterAppearViewRarity[]
    starCount: Record<CharacterAppearViewRarity, number>
    frameURUltimate_visible_for: CharacterAppearViewRarity[]
    addURUltimateEffectContainer_visible_for: CharacterAppearViewRarity[]
    gradationUltimate_visible_for: CharacterAppearViewRarity[]
    gradationSSR_visible_for: CharacterAppearViewRarity[]
    gradation_visible_for: CharacterAppearViewRarity[]
    shadow_tint_per_rarity: Record<CharacterAppearViewRarity, [number, number, number, number]>
    nameplate_sprites_per_rarity: Record<CharacterAppearViewRarity, NameplateSprites>
    background_per_rarity: Record<CharacterAppearViewRarity, CharacterAppearBg>
  }
  promotion: {
    rarities: PromotionViewRarity[]
    text_groups_per_rarity: Record<PromotionViewRarity, string>
    particle_per_rarity: Record<PromotionViewRarity, string[]>
    color_gradient_atlas_per_rarity: Record<PromotionViewRarity, string | null>
  }
  textAnnounce: {
    tmp_field: string
  }
  movie: {
    branch_rule: { source: string; frontend_must: string }
    movie_path_pattern: string
  }
  result: {
    title_label: string
    card_in_effects_per_rarity: Record<ResultCardRarityKey, string>
    card_short_effects_per_rarity: Record<ResultCardRarityKey, string>
    modal_btn_decision: {
      normal_sprite: string
      paid_sprite: string
    }
  }
  rarity_resolution: {
    characterAppear_RarityType: Record<CharacterAppearViewRarity, { rarity: (number | null)[]; arousal_type?: (number | null)[] | null }>
    promotion_ViewRarity: Record<PromotionViewRarity, { rarity: number[]; arousal_type?: (number | null)[]; and_is_pickup?: boolean }>
    card_RarityType: Record<ResultCardRarityKey, { rarity: number | number[]; arousal_type?: (number | null)[] }>
  }
}

export const VIEW_RULES = lotteryViewRules as unknown as LotteryViewRules
