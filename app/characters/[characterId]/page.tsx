import { getDesign } from "@/lib/design"
import { CharacterDetailShell } from "@/components/character-detail-shell"
import { getAllWikiCharacters } from "@/lib/pc-wiki"

// Pre-render every character route as a STATIC shell. The heavy ~7 MB character
// dataset is NO LONGER fetched here — doing so made the route dynamic (the fetch
// is >2 MB, so Next can't cache it), which dropped it to 0% edge-cache-hit and
// re-pulled 7 MB from R2 on EVERY request (the Fast Origin Transfer blowout).
// The client shell (CharacterDetailShell) now fetches the list once from the
// CDN-cached /api/wiki-characters route. generateStaticParams only needs the id
// list, and loadWikiData() memoizes, so the build does ~1 R2 fetch per worker —
// and each page render is a tiny data-free shell, so no build-worker memory blow-up.
export const dynamic = "force-static"
export const revalidate = 3600

export async function generateStaticParams() {
  const characters = await getAllWikiCharacters()
  return characters.map((character) => ({ characterId: String(character.master_pc_id) }))
}

// The character detail renders the design chosen by getDesign() (always "nightink"
// now; ocean/classic are dead rollback paths).
export default async function CharacterDetailPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params
  const design = await getDesign()
  return <CharacterDetailShell characterId={characterId} design={design} />
}
