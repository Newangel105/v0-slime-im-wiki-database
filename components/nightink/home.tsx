// Night-ink home — server side. Gathers the character dataset (same source as
// the /characters route: lib/pc-wiki via getAllWikiCharacters) and hands a
// small payload to the client component, which renders the approved prototype
// (reports/christmas-vision/my_vision/home-live.html + .css + .js) and runs
// the anime.js summon-circle ritual.
import { getAllWikiCharacters, toPublicAssetPath, type WikiCharacter } from "@/lib/pc-wiki"
import { NightInkHomeClient, type HomeLatestCharacter, type HomeStat } from "./home-client"

// The Archive Projector materializes the same GLBs the model viewer uses:
// models/index.json on R2 (see app/model-viewer/page.tsx). Soft-fail to []
// so the home never breaks when the CDN or env is unavailable — records
// without a model fall back to their full art in the beam.
type ModelManifestEntry = { id: string; name: string; glb: string; icon?: string }

async function getModelEntries(): Promise<ModelManifestEntry[]> {
  try {
    const cdn = process.env.NEXT_PUBLIC_MEDIA_CDN
    if (!cdn) return []
    const res = await fetch(`${cdn.replace(/\/+$/, "")}/models/index.json`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const manifest = (await res.json()) as { models?: ModelManifestEntry[] }
    return manifest.models ?? []
  } catch {
    return []
  }
}

/* the manifest is keyed by asset base name (e.g. "FreySwimsuit2026") — the
   same segment that appears in the character's image path:
   /Character/PC/FreySwimsuit2026/7/... -> FreySwimsuit2026 */
function modelFor(entries: ModelManifestEntry[], _pcId: number, thumb: string): string | null {
  const match = thumb.match(/\/Character\/(?:PC|Bless)\/([^/]+)\//i)
  if (!match) return null
  const key = match[1].toLowerCase()
  const hit = entries.find((e) => e.id.toLowerCase() === key)
  return hit ? hit.glb : null
}

// Same PartyL -> PartyM normalization the ocean home applies to images.icon
// (thumbs on the circle/strip are the small party portraits).
function toPartyThumb(icon: string): string {
  return icon
    .replace(/_CharaPartyL\.webp$/i, "_CharaPartyM.webp")
    .replace(/_BlessPartyL\.webp$/i, "_BlessPartyM.webp")
}

function uniqueCount(characters: WikiCharacter[], extract: (c: WikiCharacter) => (string | null | undefined)[]): number {
  return new Set(characters.flatMap(extract).filter(Boolean)).size
}

export async function NightInkHome() {
  const characters = await getAllWikiCharacters()
  const modelEntries = await getModelEntries()

  // newest first — release date desc, then id desc (prototype home-live.js §0)
  const ordered = [...characters].sort((a, b) => {
    const byRelease = String(b.release_date ?? "").localeCompare(String(a.release_date ?? ""))
    return byRelease !== 0 ? byRelease : b.master_pc_id - a.master_pc_id
  })

  const toHome = (c: WikiCharacter): HomeLatestCharacter => {
    const thumb = toPartyThumb(toPublicAssetPath(c.images.icon))
    return {
      id: c.master_pc_id,
      name: c.name,
      title: c.affiliation_name ?? "",
      release: (c.release_date ?? "").split(" ", 1)[0] ?? "",
      thumb,
      // full art fallback for records without a built 3D model
      info: thumb
        .replace(/_CharaPartyM\.webp$/i, "_CharaInfo.webp")
        .replace(/_BlessPartyM\.webp$/i, "_BlessCutin.webp"),
      modelGlb: modelFor(modelEntries, c.master_pc_id, toPublicAssetPath(c.images.icon)),
    }
  }

  // the Latest strip shows the newest records regardless of model
  const latest: HomeLatestCharacter[] = ordered.slice(0, 10).map(toHome)

  // the projector only summons records that actually have a 3D model — walk
  // the full ordered list (not just the top 10) so we always get a full dial
  const dialItems: HomeLatestCharacter[] = []
  const allModelItems: HomeLatestCharacter[] = []
  for (const c of ordered) {
    const item = toHome(c)
    if (!item.modelGlb) continue
    allModelItems.push(item)
    if (dialItems.length < 8) dialItems.push(item)
  }

  const stats: HomeStat[] = [
    { k: "Characters indexed", v: characters.length, hot: true },
    { k: "Skills catalogued", v: uniqueCount(characters, (c) => (c.skills ?? []).map((s) => s.name)) },
    { k: "Traits recorded", v: uniqueCount(characters, (c) => (c.traits ?? []).map((t) => t.name)) },
    { k: "Forces mapped", v: uniqueCount(characters, (c) => (c.forces ?? []).map((f) => f.name)) },
  ]

  return (
    <NightInkHomeClient
      latest={latest}
      dialItems={dialItems}
      allModelItems={allModelItems}
      stats={stats}
      recordCount={characters.length}
      lastSync={latest[0]?.release || "—"}
    />
  )
}
