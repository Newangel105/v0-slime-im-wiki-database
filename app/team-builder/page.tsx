import { Suspense } from "react"
import TeamBuilderClient from "@/components/team-builder-client"
import { ClassicTeamBuilderClient } from "@/components/classic/team-builder-client"
import { getAllTeamBuilderCharacters } from "@/lib/team-builder-character-data"
import { getAllHeartprints, getAllEquipment, getAllCharms } from "@/lib/pc-wiki"
import { getDesign } from "@/lib/design"

export default async function TeamBuilderPage() {
  const characters = getAllTeamBuilderCharacters()
  const heartprints = getAllHeartprints()
  const equipment = getAllEquipment()
  const charms = getAllCharms()
  const design = await getDesign()
  return (
    <main className="site-page slime-page-team-builder px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto w-full flex flex-col gap-8">
        <Suspense>
          {design === "classic" ? (
            <ClassicTeamBuilderClient characters={characters} heartprints={heartprints} equipment={equipment} charms={charms} />
          ) : (
            <TeamBuilderClient characters={characters} heartprints={heartprints} equipment={equipment} charms={charms} />
          )}
        </Suspense>
      </div>
    </main>
  )
}
