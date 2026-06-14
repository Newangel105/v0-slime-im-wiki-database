import { GuideEditor } from "@/components/guides/guide-editor"
import { getDesign } from "@/lib/design"
import { NkBoard, NkHeaderPod } from "@/components/nightink/pod-kit"

export const dynamic = "force-dynamic"

export default async function NewGuidePage() {
  const design = await getDesign()

  if (design === "nightink") {
    return (
      <NkBoard>
        <NkHeaderPod kicker="Guides" title="New " accent="Article" sub="Write and publish a new community guide." />
        <div className="nk-toolskin" style={{ marginTop: 28 }}>
          <GuideEditor mode="new" />
        </div>
      </NkBoard>
    )
  }

  return <GuideEditor mode="new" />
}
