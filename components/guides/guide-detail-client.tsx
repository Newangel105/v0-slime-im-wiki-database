"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, Edit, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GuideRenderer } from "@/components/guides/guide-renderer"
import { canEditGuide, canManageGuide, formatGuideDate, getCurrentGuideAuthor, guidesSupabase, guidesSupabaseConfigured, isGuideLocked, type GuideArticle, type GuideAuthorProfile } from "@/lib/guides"

export function GuideDetailClient({ slug }: { slug: string }) {
  const [article, setArticle] = useState<GuideArticle | null>(null)
  const [profile, setProfile] = useState<GuideAuthorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!guidesSupabaseConfigured) {
        setError("Guides are not configured yet.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const author = await getCurrentGuideAuthor()
      setProfile(author)

      const { data, error: articleError } = await guidesSupabase
        .from("guide_articles")
        .select("*")
        .eq("slug", slug)
        .maybeSingle()

      if (articleError) {
        setError(articleError.message)
        setArticle(null)
      } else {
        const found = data as GuideArticle | null
        if (!found || (found.status !== "published" && !canManageGuide(author, found))) {
          setError("Guide not found.")
          setArticle(null)
        } else {
          setArticle(found)
        }
      }

      setLoading(false)
    }

    load()
  }, [slug])

  if (loading) {
    return <main className="min-h-screen bg-[#0f172a] p-8 text-gray-300">Loading guide...</main>
  }

  if (error || !article) {
    return (
      <main className="min-h-screen bg-[#0f172a] text-white">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <Button asChild variant="outline" className="mb-6 border-white/15 bg-white/5 text-white hover:bg-white/10">
            <Link href="/guides"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Guides</Link>
          </Button>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-gray-300">{error || "Guide not found."}</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      <article>
        <header className="border-b border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <Button asChild variant="outline" className="mb-6 border-white/15 bg-white/5 text-white hover:bg-white/10">
              <Link href="/guides"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Guides</Link>
            </Button>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge className="border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/10">Guide</Badge>
              {article.status === "draft" ? <Badge className="border-yellow-400/40 bg-yellow-400/10 text-yellow-200 hover:bg-yellow-400/10">Draft preview</Badge> : null}
              {isGuideLocked(article) ? <Badge className="border-slate-400/40 bg-slate-400/10 text-slate-200 hover:bg-slate-400/10"><Lock className="mr-1 h-3 w-3" /> Locked</Badge> : null}
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{article.title}</h1>
            {article.summary ? <p className="mt-4 text-lg leading-8 text-gray-300">{article.summary}</p> : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-400">
              <div>
                Written by <span className="font-semibold text-white">{article.author_name}</span> · {formatGuideDate(article.published_at || article.created_at)}
              </div>
              {canEditGuide(profile, article) ? (
                <Button asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                  <Link href={`/guides/admin/${article.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <GuideRenderer content={article.content} />
        </div>
      </article>
    </main>
  )
}
