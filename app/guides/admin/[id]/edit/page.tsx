import { GuideEditor } from "@/components/guides/guide-editor"

export const dynamic = "force-dynamic"

export default async function EditGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GuideEditor mode="edit" articleId={id} />
}
