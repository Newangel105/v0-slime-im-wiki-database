import TeamBuilderClient from "@/components/team-builder-client"
import { getAllWikiCharacters } from "@/lib/pc-wiki"

export default function TeamBuilderPage() {
  const characters = getAllWikiCharacters()
  return (
    <main className="min-h-screen bg-[#111827] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full flex flex-col gap-8">
        <TeamBuilderClient characters={characters} />
      </div>
    </main>
  )
}
