import { GuidesClient } from "@/components/guides/guides-client"
import { ClassicGuidesClient } from "@/components/classic/guides-client"
import { getDesign } from "@/lib/design"

export const dynamic = "force-dynamic"

export default async function GuidesPage() {
  const design = await getDesign()
  return design === "classic" ? <ClassicGuidesClient /> : <GuidesClient />
}
