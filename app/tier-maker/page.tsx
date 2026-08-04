import { getDesign } from "@/lib/design"
import { OceanTierMaker } from "@/components/ocean/tier-maker"
import { ClassicTierMaker } from "@/components/classic/tier-maker"
import { NkBoard, NkHeaderPod, NkPod } from "@/components/nightink/pod-kit"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"

export default async function TierMakerPage() {
  const design = await getDesign()
  const { browserCharacters, wikiCharacters } = await getAllCharacterBrowserData()

  if (design === "nightink") {
    return (
      <NkBoard>
        <NkHeaderPod
          kicker="Ranking Tool"
          title="Tier "
          accent="Maker"
          sub="Drag characters into tiers to build, label and share your own ranked list."
        />
        <NkPod style={{ marginTop: 28 }}>
          <div className="nk-toolskin">
            <OceanTierMaker characters={browserCharacters} wikiCharacters={wikiCharacters} />
          </div>
        </NkPod>
      </NkBoard>
    )
  }

  return design === "classic" ? (
    <ClassicTierMaker characters={browserCharacters} wikiCharacters={wikiCharacters} />
  ) : (
    <OceanTierMaker characters={browserCharacters} wikiCharacters={wikiCharacters} />
  )
}
