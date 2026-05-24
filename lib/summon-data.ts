import fs from "node:fs"
import path from "node:path"
import { cache } from "react"

// Mirrors `XIUIThumbReward.ThumbType` enum (`dump.cs:517627`). Determines
// which sub-set of `XIUIThumbReward`'s SerializeFields gets activated when
// the card renders: `Chara` → battle PC (baseImageChara/rarityChara/
// limitBreakChara/icElement/icAttackType); `Bless` → Protector
// (baseImageBless/frameImageBless/IcElementBless + IcElementBless2). The
// dispatch is in `XIUIThumbReward.Set` (RVA 0xA1EF0F8) → `SetChara` /
// `SetBless` / `SetItem` / ... per `thumbType`. Upstream maps each summon
// pull's `MasterRewardType` (2 = Pc, 3 = BlessPc, ...) to this enum via
// `MasterRewardType.ToThumbType` (`dump.cs:296687`).
export type SummonThumbType =
  | "Chara"
  | "Bless"
  | "Item"
  | "Equip"
  | "Skill"
  | "SkillEnhanceMaterial"
  | "Cooking"
  | "Engrave"
  | "Barrier"

export type SummonCharacter = {
  master_pc_id: number
  name: string
  affiliation_name: string
  rarity: number | null
  element: string | null
  attack_type: string | null
  character_role: string | null
  ultimate_type: string | null
  weapon_type?: string | null
  tactics_type?: string | null
  master_strategy_type_group_label?: string | null
  master_character_tactics_type?: string | null
  // S1 (2026-05-22 audit): XIUIThumbReward dispatches Chara vs Bless vs
  // Item etc. via this enum. Currently always "Chara" (the summon generator
  // only emits MasterRewardType=2/Pc rewards; MasterRewardType=3/BlessPc
  // rewards are dropped at generation — see deliverables blocker list).
  // Optional+default-"Chara" because existing summon.generated.json files
  // predate the field.
  thumb_type?: SummonThumbType
  forces?: Array<{
    label?: string | null
    name?: string | null
    group?: string | null
    icon_path?: string | null
  }>
  ui_thumb?: {
    base_rarity?: number | null
    display_rarity?: number | null
    rarity_index?: number | null
    arousal_type?: string | null
    arousal_type_raw?: number | null
    limit_break_count?: number | null
    max_level?: number | null
    master_pc_arousal_group_id?: number | null
    master_enhanced_statusboard_id?: number | null
  } | null
  // For Bless (Protector) pulls — XIUIThumbReward.Bless has TWO element icon
  // slots (IcElementBless + IcElementBless2), populated from
  // MasterBlessPc.master_leader_skill_element_type (primary) and
  // master_leader_skill_element_type_2 (secondary). Element NAMES (e.g.
  // "Fire", "Magic") — the website's `elementIconSources` resolver turns
  // them into atlas sprite URLs. Empty for Chara.
  bless_element_icons?: {
    primary?: string | null
    secondary?: string | null
  } | null
  images: {
    icon?: string | null
    full?: string | null
    card?: string | null
  }
}

export type SummonBucket = {
  master_ogc_lottery_rate_id: number
  master_ogc_lottery_rate_group_id: number
  master_ogc_lottery_reward_group_id: number
  rate: number
  rate_percent: number
  show_rarity: number
  release_label: string
  label: string
  is_featured: boolean
  characters: SummonCharacter[]
  reward_rows_resolved: number
}

export type SummonLottery = {
  master_ogc_lottery_id: number
  master_ogc_lottery_shop_id: number
  master_ogc_lottery_rate_group_id: number
  replace_rate_group_step: string | null
  replace_master_ogc_lottery_rate_group_id: string | null
  reward_count: number
  consume_type: number
  consume_item_id: number
  gem_cost: number
  ticket_cost: number
  limit_draw_count: number
  limit_daily_draw_count: number
  point: number
  release_label: string | null
  consume_item: {
    master_lottery_ticket_id: number
    rarity: number | null
    gold: number | null
    icon_path: string | null
    icon_sources: string[]
    max_limit: number | null
    release_label: string | null
    is_pickup: boolean | null
  } | null
  replacement_rate_groups: Record<string, number>
  rate_groups: Record<string, SummonBucket[]>
}

export type SummonPointSelection = {
  master_lottery_point_selection_id: number
  master_ogc_lottery_shop_id: number
  selection_point: number
  master_reward_group_id: number
  release_label: string | null
  limit_count: number
  reward_rows?: Array<{
    master_reward_id: number
    master_reward_group_id: number
    reward_type: number
    reward_item_id: number
    quantity: number
    receive_type?: number
    release_label?: string | null
    item?: {
      master_exchange_item_id: number
      name: string | null
      description: string | null
      rarity: number | null
      icon_path: string | null
      icon_sources: string[]
      max_limit: number | null
      release_label: string | null
    } | null
  }>
  character?: SummonCharacter | null
  ticket?: {
    master_lottery_ticket_id: number
    rarity: number | null
    gold: number | null
    icon_path: string | null
    icon_sources: string[]
    max_limit: number | null
    release_label: string | null
    is_pickup: boolean | null
  } | null
}

export type SummonBanner = {
  master_ogc_lottery_shop_id: number
  sort: number
  display_type: number
  display_time: number
  release_label: string
  release_month: number
  banner_path: string | null
  logo_path: string | null
  info_panel_path: string | null
  movie_path: string | null
  character_details_ids_raw: string | null
  pickup_animation_character_details_ids: number[]
  featured_character_ids: number[]
  featured_characters: SummonCharacter[]
  detail_character_ids: number[]
  detail_characters?: SummonCharacter[]
  top_images: Array<{
    master_lottery_top_image_id: number
    master_ogc_lottery_shop_id: number
    image_type: number
    image_path: string | null
    sort: number
    release_label: string | null
  }>
  assets?: {
    banner?: string[]
    logo?: string[]
    info_panel?: string[]
    character?: string[]
    login_notice?: string[]
    background?: string[]
    top_panel?: string[]
    top_movie_image?: string[]
  }
  movie?: {
    path: string | null
    cache_key: string | null
    sources: string[]
    available: boolean
  }
  lotteries: SummonLottery[]
  point_items: Array<Record<string, unknown>>
  point_selections?: SummonPointSelection[]
  animation_group: {
    master_ogc_lottery_animation_group_group_id: number
    rows: Array<Record<string, unknown>>
    assets_by_animation_type: Record<string, Array<Record<string, unknown>>>
  }
}

export type SummonPayload = {
  meta: {
    generated_at: string
    stage_root: string
    latest_release_months: number[]
    missing_tables: string[]
    limitations: string[]
  }
  pc_lottery_messages?: Record<string, {
    master_pc_id?: number
    lottery_message?: string | null
    voice_path?: string | null
    movie_path?: string | null
    release_label?: string | null
    is_play_movie?: boolean | null
    movie?: {
      path: string | null
      cache_key: string | null
      sources: string[]
      available: boolean
    } | null
    voice?: {
      path: string | null
      stem: string | null
      sources: string[]
      available: boolean
    } | null
  }>
  define_values?: Record<string, number>
  define_release_labels?: Record<string, string>
  lottery_movie_define_assets?: Record<string, {
    master_define_asset_id?: number
    define_name?: string | null
    asset_path?: string | null
    address?: string | null
    release_label?: string | null
  }>
  ui_assets?: {
    gem_icon?: string[]
    question_icon?: string[]
    character_details_icon?: string[]
    switch_icon?: string[]
    trade_icon?: string[]
    close_icon?: string[]
    exchange_item_icon?: string[]
    carousel_arrow_left?: string[]
    carousel_arrow_right?: string[]
  }
  banners: SummonBanner[]
}

// Lazy-loaded so webpack doesn't try to bundle this 55 MB JSON into the
// build output — that was blowing Vercel's 8 GB build heap. Reading via fs
// at request time keeps the JSON out of webpack entirely. `React.cache`
// memoizes per server request, and the file is read once per server
// process after that (Node caches the parsed result through this closure).
let cached: SummonPayload | null = null

export const getSummonData = cache((): SummonPayload => {
  if (cached) return cached
  const filepath = path.join(process.cwd(), "summon.generated.json")
  const raw = fs.readFileSync(filepath, "utf-8")
  cached = JSON.parse(raw) as SummonPayload
  return cached
})
