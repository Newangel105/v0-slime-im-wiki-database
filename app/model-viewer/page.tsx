import ModelViewerClient from "@/components/model-viewer-client"
import modelsManifest from "@/public/models/index.json"

export const metadata = { title: "Model Viewer | SLIME-WIKI" }

export default function ModelViewerPage() {
  return (
    <main className="min-h-screen bg-[#111827] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Model Viewer</h1>
          <p className="text-sm text-gray-400 mt-1">
            Rotate, zoom, and inspect in-game character models. Drag to orbit, scroll to zoom.
          </p>
        </div>
        <ModelViewerClient models={modelsManifest.models} />
      </div>
    </main>
  )
}
