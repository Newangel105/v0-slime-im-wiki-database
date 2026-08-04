import SkillViewerClient from "@/components/skill-viewer-client"
import { ClassicSkillViewerClient } from "@/components/classic/skill-viewer-client"
import { getAllWikiCharacters } from "@/lib/pc-wiki"
import { getDesign } from "@/lib/design"
import { NkBoard, NkHeaderPod } from "@/components/nightink/pod-kit"

export const metadata = { title: "Skill Viewer | SLIME-WIKI" }

export default async function SkillViewerPage() {
  const characters = await getAllWikiCharacters()
  const design = await getDesign()

  if (design === "nightink") {
    return (
      <NkBoard>
        <NkHeaderPod
          kicker="Skill Database"
          title="Skill "
          accent="Viewer"
          sub="Browse every character's skills, fusions and skill movies in one place."
        />
        <div className="nk-toolskin" style={{ marginTop: 28 }}>
          <SkillViewerClient characters={characters} />
        </div>
      </NkBoard>
    )
  }

  return (
    <main className="site-page slime-page-skill-viewer px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {design === "classic" ? (
          <ClassicSkillViewerClient characters={characters} />
        ) : (
          <SkillViewerClient characters={characters} />
        )}
      </div>
    </main>
  )
}
