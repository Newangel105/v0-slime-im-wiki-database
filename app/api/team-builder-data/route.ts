import { NextResponse } from "next/server"
import { getAllHeartprints, getAllEquipment, getAllCharms } from "@/lib/pc-wiki"
import { getAllTeamBuilderCharacters } from "@/lib/team-builder-character-data"

export const dynamic = "force-static"

export function GET() {
  return NextResponse.json(
    {
      characters: getAllTeamBuilderCharacters(),
      heartprints: getAllHeartprints(),
      equipment: getAllEquipment(),
      charms: getAllCharms(),
    },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } }
  )
}
