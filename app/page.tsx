import { getDesign } from "@/lib/design"
import { NightInkHome } from "@/components/nightink/home"
import "./home-dial.css"
import { OceanHome } from "@/components/ocean/home"
import { ClassicHome } from "@/components/classic/home"

// Home renders the design chosen by getDesign():
//   nightink -> the night-ink home (default; placeholder until the Home phase)
//   ocean    -> beach poster home   (rollback cookie only)
//   classic  -> original flat-dark home (rollback cookie only)
export default async function HomePage() {
  const design = await getDesign()
  if (design === "classic") return <ClassicHome />
  if (design === "ocean") return <OceanHome />
  return <NightInkHome />
}
