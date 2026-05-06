import ModelViewerClient from "@/components/model-viewer-client"
import modelsManifest from "@/public/models/index.json"

export const metadata = { title: "Model Viewer | SLIME-WIKI" }

export default function ModelViewerPage() {
  return (
    <main className="site-page px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <p className="section-kicker">3D Archive</p>
          <h1 className="section-title mt-2">Model Viewer</h1>
          <p className="mt-2 text-sm text-slate-400">
            Rotate, zoom, and inspect in-game character models. Drag to orbit, scroll to zoom.
          </p>
        </div>
        <ModelViewerClient models={modelsManifest.models} />
      </div>
    </main>
  )
}
