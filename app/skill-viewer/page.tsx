import SkillViewerClient from "@/components/skill-viewer-client"
import { getAllWikiCharacters } from "@/lib/pc-wiki"

export const metadata = { title: "Skill Viewer | SLIME-WIKI" }

export default function SkillViewerPage() {
  const characters = getAllWikiCharacters()

  return (
    <main className="min-h-screen bg-[#111827] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Skill Viewer</h1>
          <p className="mt-1 text-sm text-gray-400">
            Browse every character skill through the same heuristic filter groups used on the characters page.
          </p>
        </div>
        <SkillViewerClient characters={characters} />
      </div>
    </main>
  )
}