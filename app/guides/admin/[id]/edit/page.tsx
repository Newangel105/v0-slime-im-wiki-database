import { GuideEditor } from "@/components/guides/guide-editor"
import { getDesign } from "@/lib/design"
import { NkBoard, NkHeaderPod } from "@/components/nightink/pod-kit"

export const dynamic = "force-dynamic"

export default async function EditGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const design = await getDesign()

  if (design === "nightink") {
    return (
      <NkBoard>
        <NkHeaderPod kicker="Guides" title="Edit " accent="Article" sub="Update and re-publish your guide." />
        <div className="nk-toolskin" style={{ marginTop: 28 }}>
          <GuideEditor mode="edit" articleId={id} />
        </div>
      </NkBoard>
    )
  }

  return <GuideEditor mode="edit" articleId={id} />
}
