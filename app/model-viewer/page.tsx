import { getDesign } from "@/lib/design"
import { NkBoard, NkHeaderPod } from "@/components/nightink/pod-kit"
import { ModelViewerShell } from "@/components/model-viewer-shell"
import type { ModelEntry } from "@/components/model-viewer-client"

export const metadata = { title: "Model Viewer | SLIME-WIKI" }

// models/index.json lives on R2 (uploaded alongside public/models/). Fetching it
// at request time keeps webpack out of the manifest and avoids re-bundling it on
// every build. Cached server-side for 1h via Next's Data Cache.
export const revalidate = 3600

type ModelsManifest = { models: ModelEntry[] }

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
  const { models } = await getModelsManifest()
  const design = await getDesign()

  if (design === "nightink") {
    return (
      <NkBoard>
        <NkHeaderPod
          kicker="3D Models"
          title="Model "
          accent="Viewer"
          sub="Spin, zoom and inspect every character's actual 3D battle model, with idle animation."
        />
        <div className="nk-toolskin" style={{ marginTop: 28 }}>
          <ModelViewerShell models={models} />
        </div>
      </NkBoard>
    )
  }

  return (
    <main className="site-page slime-page-model-viewer px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <ModelViewerShell models={models} classic={design === "classic"} />
      </div>
    </main>
  )
}
