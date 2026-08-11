"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import type { WikiCharacter } from "@/lib/pc-wiki"

const NightInkCharacterDetailClient = dynamic(
  () => import("@/components/nightink/character-detail").then((m) => m.NightInkCharacterDetail),
  {
    ssr: false,
    loading: () => <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Loading character details…</div>,
  },
)

const OceanCharacterDetailClient = dynamic(
  () => import("@/components/ocean/character-detail").then((m) => m.OceanCharacterDetail),
  {
    ssr: false,
    loading: () => <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Loading character details…</div>,
  },
)

const ClassicCharacterDetailClient = dynamic(
  () => import("@/components/classic/character-detail").then((m) => m.ClassicCharacterDetail),
  {
    ssr: false,
    loading: () => <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Loading character details…</div>,
  },
)

export function CharacterDetailShell({ characterId, design }: { characterId: string; design: string }) {
  // The ~7 MB character list is fetched HERE on the client (from the CDN-cached
  // /api/wiki-characters route) rather than in the Server Component, so the page
  // route stays static/edge-cached instead of re-pulling 7 MB from R2 per request.
  // Browsers reuse the cached response across character navigations.
  const [characters, setCharacters] = useState<WikiCharacter[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch("/api/wiki-characters")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<WikiCharacter[]>
      })
      .then((data) => {
        if (alive) setCharacters(data)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [])

  if (failed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Couldn’t load character data — please refresh.
      </div>
    )
  }
  if (!characters) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Loading character details…
      </div>
    )
  }

  if (design === "classic") return <ClassicCharacterDetailClient characterId={characterId} characters={characters} />
  if (design === "ocean") return <OceanCharacterDetailClient characterId={characterId} characters={characters} />
  return <NightInkCharacterDetailClient characterId={characterId} characters={characters} />
}
