"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import type { SummonPayload } from "@/lib/summon-data"

const SummonSimulatorClient = dynamic(
  () => import("@/components/summon-simulator").then((m) => m.SummonSimulator),
  {
    ssr: false,
    loading: () => <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Loading summon simulator…</div>,
  },
)

const LOADING = (
  <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Loading summon simulator…</div>
)

// Fetched client-side rather than passed as a server prop: a Server ->
// Client Component prop crossing the RSC boundary gets serialized into the
// page payload regardless of the ssr:false dynamic import above, and at
// ~55 MB that blew Vercel's 19 MB ISR snapshot limit. Fetching it here keeps
// the payload out of both the server render and the page's cached output.
export function SummonSimulatorShell() {
  const [data, setData] = useState<SummonPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const cdn = process.env.NEXT_PUBLIC_MEDIA_CDN
    if (!cdn) {
      setError("NEXT_PUBLIC_MEDIA_CDN not set")
      return
    }
    fetch(`${cdn.replace(/\/+$/, "")}/summon.generated.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch summon.generated.json: ${res.status}`)
        return res.json()
      })
      .then((payload: SummonPayload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-red-400">Failed to load summon data: {error}</div>
  }
  if (!data) {
    return LOADING
  }
  return <SummonSimulatorClient data={data} />
}
