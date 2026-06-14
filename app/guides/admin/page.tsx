import { GuidesAdminClient } from "@/components/guides/guides-admin-client"
import { getDesign } from "@/lib/design"
import { NkBoard, NkHeaderPod } from "@/components/nightink/pod-kit"

export const dynamic = "force-dynamic"

export default async function GuidesAdminPage() {
  const design = await getDesign()

  if (design === "nightink") {
    return (
      <NkBoard>
        <NkHeaderPod
          kicker="Guides"
          title="My "
          accent="Articles"
          sub="Manage your published guides and drafts — edit, publish or remove them."
        />
        <div className="nk-toolskin" style={{ marginTop: 28 }}>
          <GuidesAdminClient />
        </div>
      </NkBoard>
    )
  }

  return <GuidesAdminClient />
}
