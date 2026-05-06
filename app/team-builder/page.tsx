import { Suspense } from "react"
import TeamBuilderClient from "@/components/team-builder-client"
import { getAllTeamBuilderCharacters } from "@/lib/team-builder-character-data"
import { getAllHeartprints, getAllEquipment, getAllCharms } from "@/lib/pc-wiki"

export default function TeamBuilderPage() {
  const characters = getAllTeamBuilderCharacters()
  const heartprints = getAllHeartprints()
  const equipment = getAllEquipment()
  const charms = getAllCharms()
  return (
    <main className="site-page px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full flex flex-col gap-8">
        <Suspense>
          <TeamBuilderClient characters={characters} heartprints={heartprints} equipment={equipment} charms={charms} />
        </Suspense>
      </div>
    </main>
  )
}
