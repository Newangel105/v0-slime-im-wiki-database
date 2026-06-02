import { getDesign } from "@/lib/design"
import { OceanTierMaker } from "@/components/ocean/tier-maker"
import { ClassicTierMaker } from "@/components/classic/tier-maker"

export default async function TierMakerPage() {
  const design = await getDesign()
  return design === "classic" ? <ClassicTierMaker /> : <OceanTierMaker />
}
