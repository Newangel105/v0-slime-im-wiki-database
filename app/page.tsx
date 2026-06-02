import { getDesign } from "@/lib/design"
import { OceanHome } from "@/components/ocean/home"
import { ClassicHome } from "@/components/classic/home"

// Home renders the design chosen by the slime-design cookie:
//   ocean   -> beach poster home
//   classic -> original flat-dark home (no background image)
export default async function HomePage() {
  const design = await getDesign()
  return design === "classic" ? <ClassicHome /> : <OceanHome />
}
