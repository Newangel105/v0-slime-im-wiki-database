import { GuideDetailClient } from "@/components/guides/guide-detail-client"

export const dynamic = "force-dynamic"

export default async function GuideArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <GuideDetailClient slug={slug} />
}
