import PresetViewerClient from "@/components/preset-viewer-client"
import { ClassicPresetViewerClient } from "@/components/classic/preset-viewer-client"
import { getAllWikiCharacters } from "@/lib/pc-wiki"
import { META_PRESETS } from "@/lib/meta-presets"
import { getDesign } from "@/lib/design"

export const metadata = { title: "Preset Viewer | SLIME-WIKI" }

export default async function PresetViewerPage() {
  const allPresetNames = new Set(
    META_PRESETS.flatMap(p =>
      [p.protector, p.battle1, p.battle2, p.battle3, p.battle4, p.battle5,
       p.mini1, p.mini2, p.mini3, p.mini4].filter(Boolean) as string[]
    )
  )
  const characters = getAllWikiCharacters().filter(c => allPresetNames.has(c.affiliation_name))
  const design = await getDesign()
  return (
    <main className="site-page slime-page-preset-viewer px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {design === "classic" ? (
          <ClassicPresetViewerClient characters={characters} />
        ) : (
          <PresetViewerClient characters={characters} />
        )}
      </div>
    </main>
  )
}
