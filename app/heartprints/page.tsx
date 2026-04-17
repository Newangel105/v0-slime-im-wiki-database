import { HeartprintsBrowser } from "@/components/heartprints-browser"
import { getAllHeartprints } from "@/lib/pc-wiki"

export default function HeartprintsPage() {
  const heartprints = getAllHeartprints()
  return <HeartprintsBrowser heartprints={heartprints} />
}
