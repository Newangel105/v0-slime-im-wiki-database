"use client"

import dynamic from "next/dynamic"
import type { ModelEntry } from "@/components/model-viewer-client"

const ModelViewerClientDynamic = dynamic(() => import("@/components/model-viewer-client").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Loading model viewer…</div>,
})

const ClassicModelViewerClientDynamic = dynamic(
  () => import("@/components/classic/model-viewer-client").then((m) => m.ClassicModelViewerClient),
  {
    ssr: false,
    loading: () => <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Loading model viewer…</div>,
  },
)

export function ModelViewerShell({ models, classic }: { models: ModelEntry[]; classic?: boolean }) {
  if (classic) return <ClassicModelViewerClientDynamic models={models} />
  return <ModelViewerClientDynamic models={models} />
}
