import ModelViewerClient from "@/components/model-viewer-client"

export const metadata = { title: "Model Viewer | SLIME-WIKI" }

// models/index.json lives on R2 (uploaded alongside public/models/). Fetching
// at request time keeps webpack out of the manifest and avoids re-bundling
// it on every build. Cached server-side for 1h via Next's Data Cache.
export const dynamic = "force-dynamic"

type ModelsManifest = { models: unknown[] }

async function getModelsManifest(): Promise<ModelsManifest> {
  const cdn = process.env.NEXT_PUBLIC_MEDIA_CDN
  if (!cdn) throw new Error("NEXT_PUBLIC_MEDIA_CDN not set — models/index.json lives on R2")
  const res = await fetch(`${cdn.replace(/\/+$/, "")}/models/index.json`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Failed to fetch models/index.json from R2: ${res.status}`)
  return res.json()
}

export default async function ModelViewerPage() {
  const modelsManifest = await getModelsManifest()
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
