"use client"

import dynamic from "next/dynamic"
import type { SummonPayload } from "@/lib/summon-data"

const SummonSimulatorClient = dynamic(
  () => import("@/components/summon-simulator").then((m) => m.SummonSimulator),
  {
    ssr: false,
    loading: () => <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Loading summon simulator…</div>,
  },
)

export function SummonSimulatorShell({ data }: { data: SummonPayload }) {
  return <SummonSimulatorClient data={data} />
}
