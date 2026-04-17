import PresetViewerClient from "@/components/preset-viewer-client"
import { getAllWikiCharacters } from "@/lib/pc-wiki"

export const metadata = { title: "Preset Viewer | SLIME-WIKI" }

export default function PresetViewerPage() {
  const characters = getAllWikiCharacters()
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
