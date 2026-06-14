import { getDesign } from "@/lib/design"
import { NightInkCharacterDetail } from "@/components/nightink/character-detail"
import { OceanCharacterDetail } from "@/components/ocean/character-detail"
import { ClassicCharacterDetail } from "@/components/classic/character-detail"

// The character detail renders the design chosen by getDesign():
//   nightink -> the night-ink record page (default)
//   ocean    -> beach poster detail (rollback cookie only)
//   classic  -> original flat-dark detail (rollback cookie only)
export default async function CharacterDetailPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params
  const design = await getDesign()
  if (design === "classic") return <ClassicCharacterDetail characterId={characterId} />
  if (design === "ocean") return <OceanCharacterDetail characterId={characterId} />
  return <NightInkCharacterDetail characterId={characterId} />
}
