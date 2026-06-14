import { GuideDetailClient } from "@/components/guides/guide-detail-client"
import { getDesign } from "@/lib/design"
import { NkBoard } from "@/components/nightink/pod-kit"

export const dynamic = "force-dynamic"

export default async function GuideArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const design = await getDesign()

  if (design === "nightink") {
    return (
      <NkBoard>
        <div className="nk-toolskin">
          <GuideDetailClient slug={slug} />
        </div>
      </NkBoard>
    )
  }

  return <GuideDetailClient slug={slug} />
}
