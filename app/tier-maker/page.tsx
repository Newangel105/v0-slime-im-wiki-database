import { getDesign } from "@/lib/design"
import { OceanTierMaker } from "@/components/ocean/tier-maker"
import { ClassicTierMaker } from "@/components/classic/tier-maker"
import { NkBoard, NkHeaderPod, NkPod } from "@/components/nightink/pod-kit"

export default async function TierMakerPage() {
  const design = await getDesign()

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
            <OceanTierMaker />
          </div>
        </NkPod>
      </NkBoard>
    )
  }

  return design === "classic" ? <ClassicTierMaker /> : <OceanTierMaker />
}
