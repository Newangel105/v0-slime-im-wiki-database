import { GuidesClient } from "@/components/guides/guides-client"
import { ClassicGuidesClient } from "@/components/classic/guides-client"
import { NightInkGuidesClient } from "@/components/nightink/guides-client"
import { getDesign } from "@/lib/design"

export const dynamic = "force-dynamic"

export default async function GuidesPage() {
  const design = await getDesign()
  if (design === "nightink") return <NightInkGuidesClient />
  return design === "classic" ? <ClassicGuidesClient /> : <GuidesClient />
}
