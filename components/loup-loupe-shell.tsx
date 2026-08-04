"use client"

import dynamic from "next/dynamic"
import type { LoupLoupeFloor } from "@/lib/loup-loupe"
import type { WikiEnemy } from "@/lib/enemies"

const LoupLoupeBrowserDynamic = dynamic(
  () => import("@/components/loup-loupe-browser").then((m) => m.LoupLoupeBrowser),
  {
    ssr: false,
    loading: () => <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Loading labyrinth…</div>,
  },
)

const ClassicLoupLoupeBrowserDynamic = dynamic(
  () => import("@/components/classic/loup-loupe-browser").then((m) => m.ClassicLoupLoupeBrowser),
  {
    ssr: false,
    loading: () => <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Loading labyrinth…</div>,
  },
)

export function LoupLoupeShell({
  floors,
  enemies,
  classic,
}: {
  floors: LoupLoupeFloor[]
  enemies: WikiEnemy[]
  classic?: boolean
}) {
  if (classic) return <ClassicLoupLoupeBrowserDynamic floors={floors} enemies={enemies} />
  return <LoupLoupeBrowserDynamic floors={floors} enemies={enemies} />
}
