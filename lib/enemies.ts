import { cache } from "react"

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

// Fetched from R2 at request time so the bundler never sees the ~5 MB blob
// (a static import inlines it into every bundle that reaches this module,
// including the deployed Worker script). React.cache memoizes per request;
// the module-scope `cached` holds the parse across requests in the same
// server instance. Mirrors lib/summon-data.ts's getSummonData.
let cached: WikiEnemy[] | null = null

export const getAllEnemies = cache(async (): Promise<WikiEnemy[]> => {
  if (cached) return cached
  const cdn = process.env.NEXT_PUBLIC_MEDIA_CDN
  if (!cdn) throw new Error("NEXT_PUBLIC_MEDIA_CDN not set — pc_wiki.enemies.json lives on R2")
  const res = await fetch(`${cdn.replace(/\/+$/, "")}/pc_wiki.enemies.json`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Failed to fetch pc_wiki.enemies.json from R2: ${res.status}`)
  const payload = (await res.json()) as EnemyPayload
  cached = payload.enemies
  return cached
})

/** Return one representative enemy per unique avatar_name (for display/selection grids). */
export async function getUniqueEnemyAvatars(): Promise<WikiEnemy[]> {
  const enemies = await getAllEnemies()
  const seen = new Set<string>()
  const result: WikiEnemy[] = []
  for (const e of enemies) {
    if (!e.avatar_name || seen.has(e.avatar_name)) continue
    seen.add(e.avatar_name)
    result.push(e)
  }
  return result
}
