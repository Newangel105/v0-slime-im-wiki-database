import TeamBuilderClient from "@/components/team-builder-client"
import { getAllWikiCharacters, getAllHeartprints, getAllEquipment, getAllCharms } from "@/lib/pc-wiki"

export default function TeamBuilderPage() {
  const characters = getAllWikiCharacters()
  const heartprints = getAllHeartprints()
  const equipment = getAllEquipment()
  const charms = getAllCharms()
  return (
    <main className="min-h-screen bg-[#111827] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full flex flex-col gap-8">
        <TeamBuilderClient characters={characters} heartprints={heartprints} equipment={equipment} charms={charms} />
      </div>
    </main>
  )
}
