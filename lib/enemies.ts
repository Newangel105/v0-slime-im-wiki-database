import enemyData from "../pc_wiki.enemies.json"

export type WikiEnemy = {
  master_enemy_id: number
  avatar_name: string
  name: string
  affiliation_name: string | null
  element: string
  attack_type: string
  infinity_hp: boolean
  hp: number
  attack: number
  defense: number
  recovery_sp: number
  release_label: string | null
  thumb: string | null
  // Resist / weakness from MasterExtraParameter (10000-basis; negative = weak to that type)
  resist_attack_physics?: number
  resist_attack_magic?: number
  resist_element_earth?: number
  resist_element_air?: number   // Air = Space
  resist_element_wind?: number
  resist_element_water?: number
  resist_element_fire?: number
  resist_element_holy?: number  // Holy = Light
  resist_element_dark?: number
  damage_resist_element_earth?: number
  damage_resist_element_air?: number
  damage_resist_element_wind?: number
  damage_resist_element_water?: number
  damage_resist_element_fire?: number
  damage_resist_element_holy?: number
  damage_resist_element_dark?: number
}

type EnemyPayload = { enemies: WikiEnemy[] }

export function getAllEnemies(): WikiEnemy[] {
  return (enemyData as EnemyPayload).enemies
}

/** Return one representative enemy per unique avatar_name (for display/selection grids). */
export function getUniqueEnemyAvatars(): WikiEnemy[] {
  const seen = new Set<string>()
  const result: WikiEnemy[] = []
  for (const e of (enemyData as EnemyPayload).enemies) {
    if (!e.avatar_name || seen.has(e.avatar_name)) continue
    seen.add(e.avatar_name)
    result.push(e)
  }
  return result
}
