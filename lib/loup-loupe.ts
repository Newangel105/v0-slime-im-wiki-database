import { cache } from "react"

export type LoupLoupeReward = {
  master_reward_id: number
  master_reward_group_id: number
  reward_type: number
  reward_type_label: string
  reward_item_id: number
  display_name: string
  icon_path: string
  description: string
  quantity: number
  receive_type: number
  receive_type_label: string
  release_label: string
}

export type LoupLoupeSourceBuffEffect = {
  master_buff_effect_id: number
  label: string
  display_label: string
  target_search_label: string
  target_label: string
  target_badge?: string
  target_type: number
  target_type_label?: string
  parameter_type: number
  parameter_type_label: string
  value_type: number
  value_type_label: string
  value_display?: string
  value: number
  max_value: number
  increase_type: number
  increase_value: number
  max_increase_value: number
  increase_additionl: number
  master_category_group_for_skill_label: string
  skill_count_turn_from_start: number
  skill_count_until_custom_turn: number
  skill_count_from_custom_turn: number
  is_temporary: boolean
  turn: number
  buff_type: number
  buff_type_label: string
  asset_path: string
  se_path: string
  passive_skill_execute_condition_label: string
  release_label: string
}

export type LoupLoupeSourceAttackEffect = {
  master_attack_effect_id: number
  label: string
  display_label: string
  master_attack_type: number
  master_attack_type_label: string
  master_element_type: number
  master_element_type_label: string
  target_search_label: string
  target_label: string
  target_badge?: string
  target_type: number
  master_attack_culc_type: number
  value: number
  master_attack_base_type: number
  base_value: number
  is_active_damage_skill: boolean
  asset_path: string
  se_path: string
  passive_skill_execute_condition_label: string
  release_label: string
}

export type LoupLoupeEffect = {
  master_tower_effect_id: number
  master_tower_effect_label: string
  description_label: string
  description_value: number
  attack_effect_label: string
  buff_effect_label: string
  condition_effect_label: string
  card_effect_label: string
  system_effect_label: string
  is_init_turn_only: boolean
  effect_value_type: number
  effect_value_type_label: string
  buff_type: number
  buff_type_label: string
  tower_buff_type: number
  tower_buff_type_label: string
  effect_title?: string
  effect_target_label?: string
  effect_target_badge?: string
  effect_parameter_label?: string
  effect_amount_label?: string
  effect_summary?: string
  effect_details?: string[]
  source_buff_effect?: LoupLoupeSourceBuffEffect | null
  source_attack_effect?: LoupLoupeSourceAttackEffect | null
  limit_action_count: number
  release_label: string
}

export type LoupLoupeQuest = {
  master_quest_id: number
  master_chapter_id: number
  number: number
  master_quest_type: number
  master_quest_type_label: string
  quest_name: string
  bg_image_path: string
  scene_name: string
  pre_novel_script: string
  post_novel_script: string
  recommend_master_element_type: number
  recommend_master_element_type_label: string
  recommend_master_attack_type: number
  recommend_master_attack_type_label: string
  recommend_ep: number
  reward_user_exp: number
  reward_gold: number
  reward_pc_exp: number
  release_label: string
}

export type LoupLoupeTreasure = {
  master_tower_treasure_id: number
  master_tower_treasure_group_id: number
  drop_rate: number
  master_reward_group_id: number
  master_tower_treasure_grade: number
  master_tower_treasure_grade_label: string
  release_label: string
  rewards: LoupLoupeReward[]
}

export type LoupLoupeWarpPoint = {
  master_tower_warp_point_id: number
  master_tower_warp_point_group_id: number
  warp_point_color: number
  warp_point_color_label: string
  warp_number: number
  release_label: string
}

export type LoupLoupeEvent = {
  master_tower_map_event_id: number
  master_tower_map_event_type: number
  master_tower_map_event_type_label: string
  first_treasure_reward_group_id: number
  master_tower_treasure_group_id: number
  master_tower_enemy_grade: number
  master_tower_enemy_grade_label: string
  icon_master_enemy_id: number
  master_quest_id: number
  master_tower_effect_label: string
  master_tower_warp_point_group_id: number
  limit_action_count: number
  affect_scope: number
  release_label: string
  quest: LoupLoupeQuest | null
  first_treasure_rewards: LoupLoupeReward[]
  treasures: LoupLoupeTreasure[]
  warp_points: LoupLoupeWarpPoint[]
  effects: LoupLoupeEffect[]
}

export type LoupLoupeTile = {
  master_tower_map_id: number
  master_tower_floor_id: number
  map_number: number
  master_tower_map_event_id: number
  map_scene_name: string
  release_label: string
  row: number
  col: number
  event: LoupLoupeEvent | null
}

export type LoupLoupeChallengeCondition = {
  master_tower_challenge_condition_id: number
  master_tower_challenge_condition_group_id: number
  master_tower_challenge_condition_detail_id: number
  release_label: string
  detail: {
    master_tower_challenge_condition_detail_id: number
    master_tower_challenge_type: number
    master_tower_challenge_type_label: string
    master_tower_challenge_variation_type: number
    master_tower_challenge_variation_type_label: string
    master_tower_challenge_condition_type: number
    master_tower_challenge_condition_type_label: string
    release_label: string
  } | null
}

export type LoupLoupeChallengeDropRate = {
  master_tower_challenge_drop_rate_id: number
  master_tower_challenge_drop_rate_group_id: number
  progress_num: number
  drop_rate: number
  release_label: string
}

export type LoupLoupeChallengeReward = {
  master_tower_challenge_reward_id: number
  master_tower_challenge_reward_group_id: number
  progress_num: number
  master_reward_group_id: number
  release_label: string
  rewards: LoupLoupeReward[]
}

export type LoupLoupeFloor = {
  master_tower_floor_id: number
  master_tower_id: number
  floor_number: number
  floor_name: string
  master_tower_effect_label: string
  map_size_type: number
  map_size_type_label: string
  map_variation: string
  map_scene_name: string
  background_path: string
  floor_strategy: string
  master_reward_group_id: number
  pre_floor_novel_script: string
  master_tower_challenge_condition_group_id: number
  master_tower_challenge_drop_rate_group_id: number
  master_tower_challenge_reward_group_id: number
  release_label: string
  map_side: number
  tile_count: number
  clear_rewards: LoupLoupeReward[]
  floor_effects: LoupLoupeEffect[]
  challenge_conditions: LoupLoupeChallengeCondition[]
  challenge_drop_rates: LoupLoupeChallengeDropRate[]
  challenge_rewards: LoupLoupeChallengeReward[]
  tiles: LoupLoupeTile[]
}

export type LoupLoupePayload = {
  meta: {
    generated_at: string
    feature: string
    source_base_dir: string
    table_counts: Record<string, number>
    sources: Record<string, string>
  }
  floors: LoupLoupeFloor[]
}

// Fetched from R2 at request time so the bundler never sees the ~13 MB blob
// (a static import inlines it into every bundle that reaches this module,
// including the deployed Worker script). React.cache memoizes per request;
// the module-scope `cached` holds the parse across requests in the same
// server instance. Mirrors lib/summon-data.ts's getSummonData.
let cached: LoupLoupePayload | null = null

const loadLoupLoupePayload = cache(async (): Promise<LoupLoupePayload> => {
  if (cached) return cached
  const cdn = process.env.NEXT_PUBLIC_MEDIA_CDN
  if (!cdn) throw new Error("NEXT_PUBLIC_MEDIA_CDN not set — loup_loupe.generated.json lives on R2")
  const res = await fetch(`${cdn.replace(/\/+$/, "")}/loup_loupe.generated.json`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Failed to fetch loup_loupe.generated.json from R2: ${res.status}`)
  cached = (await res.json()) as unknown as LoupLoupePayload
  return cached
})

export async function getLoupLoupeFloors(): Promise<LoupLoupeFloor[]> {
  const payload = await loadLoupLoupePayload()
  return payload.floors
}

export async function getLoupLoupeMeta(): Promise<LoupLoupePayload["meta"]> {
  const payload = await loadLoupLoupePayload()
  return payload.meta
}
