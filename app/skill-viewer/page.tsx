import SkillViewerClient from "@/components/skill-viewer-client"
import { getAllWikiCharacters } from "@/lib/pc-wiki"

export const metadata = { title: "Skill Viewer | SLIME-WIKI" }

export default function SkillViewerPage() {
  const characters = getAllWikiCharacters()

  return (
    <main className="site-page px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div>
          <p className="section-kicker">Tool Archive</p>
          <h1 className="section-title mt-2">Skill Viewer</h1>
          <p className="mt-2 text-sm text-slate-400">
            Browse every character skill through skill filters
          </p>
        </div>
        <SkillViewerClient characters={characters} />
      </div>
    </main>
  )
}
