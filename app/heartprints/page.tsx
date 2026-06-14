import { HeartprintsBrowser } from "@/components/heartprints-browser"
import { ClassicHeartprintsBrowser } from "@/components/classic/heartprints-browser"
import { NightInkHeartprintsBrowser } from "@/components/nightink/heartprints-browser"
import { getAllHeartprints } from "@/lib/pc-wiki"
import { getDesign } from "@/lib/design"

export default async function HeartprintsPage() {
  const heartprints = getAllHeartprints()
  const design = await getDesign()

  if (design === "nightink") return <NightInkHeartprintsBrowser heartprints={heartprints} />

  return design === "classic" ? (
    <ClassicHeartprintsBrowser heartprints={heartprints} />
  ) : (
    <HeartprintsBrowser heartprints={heartprints} />
  )
}
