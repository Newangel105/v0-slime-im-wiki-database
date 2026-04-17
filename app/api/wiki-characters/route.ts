import { NextResponse } from "next/server"
import { getAllWikiCharacters } from "@/lib/pc-wiki"

export const dynamic = "force-static"

export function GET() {
  // Strip fields unused by preset-viewer and battle-sim to reduce payload size
  const slim = getAllWikiCharacters().map(c => ({
    master_pc_id: c.master_pc_id,
    name: c.name,
    affiliation_name: c.affiliation_name,
    rarity: c.rarity,
    element: c.element,
    attack_type: c.attack_type,
    weapon_type: c.weapon_type,
    character_role: c.character_role,
    stats: c.stats,
    images: { icon: c.images.icon },
    release_date: c.release_date,
    // Strip: forces, traits, ex_abilities, facilities, images.full
    forces: [],
    traits: [],
    ex_abilities: [],
    facilities: [],
    skills: c.skills.map(s => ({
      slot: s.slot,
      label: s.label,
      kind: s.kind,
      name: s.name,
      description_max_level: s.description_max_level,
      icon_path: s.icon_path,
      cost: s.cost,
      special_skill_type: s.special_skill_type,
      is_skill_change: s.is_skill_change,
      replaces_label: s.replaces_label,
      replaces_slot: s.replaces_slot,
      skill_change_type: s.skill_change_type,
      // Strip: skill_filter_groups, skill_level_group_id
    })),
  }))

  return NextResponse.json(slim, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  })
}
