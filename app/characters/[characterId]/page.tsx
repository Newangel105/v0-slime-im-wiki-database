import { getDesign } from "@/lib/design"
import { OceanCharacterDetail } from "@/components/ocean/character-detail"
import { ClassicCharacterDetail } from "@/components/classic/character-detail"

export default async function CharacterDetailPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params
  const design = await getDesign()
  return design === "classic" ? (
    <ClassicCharacterDetail characterId={characterId} />
  ) : (
    <OceanCharacterDetail characterId={characterId} />
  )
}
