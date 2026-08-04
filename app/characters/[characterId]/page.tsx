import { getDesign } from "@/lib/design"
import { CharacterDetailShell } from "@/components/character-detail-shell"
import { getAllWikiCharacters } from "@/lib/pc-wiki"

// No generateStaticParams: pc_wiki.generated.json is fetched from R2 (kept out
// of the bundle — see lib/pc-wiki.ts), and Next's fetch data cache refuses to
// cache anything over 2MB. Pre-rendering all ~460 character pages at build time
// would mean ~460 separate 7MB R2 fetches during the build, which crashes the
// build worker. Render on demand instead — same fix already applied to /summon
// for the same reason (see lib/summon-data.ts). Each page still gets normal
// ISR caching after its first request via `revalidate` below.
export const revalidate = 3600

// The character detail renders the design chosen by getDesign():
//   nightink -> the night-ink record page (default)
//   ocean    -> beach poster detail (rollback cookie only)
//   classic  -> original flat-dark detail (rollback cookie only)
export default async function CharacterDetailPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params
  const design = await getDesign()
  const characters = await getAllWikiCharacters()
  return <CharacterDetailShell characterId={characterId} design={design} characters={characters} />
}
