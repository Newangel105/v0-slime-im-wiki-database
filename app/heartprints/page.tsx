import { HeartprintsBrowser } from "@/components/heartprints-browser"
import { ClassicHeartprintsBrowser } from "@/components/classic/heartprints-browser"
import { getAllHeartprints } from "@/lib/pc-wiki"
import { getDesign } from "@/lib/design"

export default async function HeartprintsPage() {
  const heartprints = getAllHeartprints()
  const design = await getDesign()
  return design === "classic" ? (
    <ClassicHeartprintsBrowser heartprints={heartprints} />
  ) : (
    <HeartprintsBrowser heartprints={heartprints} />
  )
}
