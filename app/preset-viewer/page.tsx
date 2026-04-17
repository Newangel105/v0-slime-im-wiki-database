import PresetViewerClient from "@/components/preset-viewer-client"
import { getAllWikiCharacters } from "@/lib/pc-wiki"
import { META_PRESETS } from "@/lib/meta-presets"

export const metadata = { title: "Preset Viewer | SLIME-WIKI" }

export default function PresetViewerPage() {
  const allPresetNames = new Set(
    META_PRESETS.flatMap(p =>
      [p.protector, p.battle1, p.battle2, p.battle3, p.battle4, p.battle5,
       p.mini1, p.mini2, p.mini3, p.mini4].filter(Boolean) as string[]
    )
  )
  const characters = getAllWikiCharacters().filter(c => allPresetNames.has(c.affiliation_name))
  return (
    <main className="min-h-screen bg-[#111827] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Preset Viewer</h1>
          <p className="text-sm text-gray-400 mt-1">Select a meta preset to view the full team skill breakdown.</p>
        </div>
        <PresetViewerClient characters={characters} />
      </div>
    </main>
  )
}
