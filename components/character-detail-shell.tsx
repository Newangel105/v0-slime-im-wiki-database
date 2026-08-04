"use client"

import dynamic from "next/dynamic"
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

export function CharacterDetailShell({
  characterId,
  design,
  characters,
}: {
  characterId: string
  design: string
  characters: WikiCharacter[]
}) {
  if (design === "classic") return <ClassicCharacterDetailClient characterId={characterId} characters={characters} />
  if (design === "ocean") return <OceanCharacterDetailClient characterId={characterId} characters={characters} />
  return <NightInkCharacterDetailClient characterId={characterId} characters={characters} />
}
