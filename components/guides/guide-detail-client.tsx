"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, Edit, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GuideRenderer } from "@/components/guides/guide-renderer"
import {
  canEditGuide,
  canManageGuide,
  formatGuideDate,
  getCurrentGuideAuthor,
  getGuideCover,
  guidesSupabase,
  guidesSupabaseConfigured,
  isGuideLocked,
  type GuideArticle,
  type GuideAuthorProfile,
} from "@/lib/guides"

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
    return (
      <main className="site-page slime-page-guides">
        <div className="site-container text-muted-foreground">Loading guide...</div>
      </main>
    )
  }

  if (error || !article) {
    return (
      <main className="site-page slime-page-guides">
        <div className="site-container">
          <Button asChild variant="outline" className="mb-6">
            <Link href="/guides">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Guides
            </Link>
          </Button>
          <div className="glass-panel p-8 text-muted-foreground">{error || "Guide not found."}</div>
        </div>
      </main>
    )
  }

  return (
    <main className="site-page slime-page-guides">
      <article className="site-container space-y-8">
        <section className="glass-panel-strong overflow-hidden">
          <div className="relative">
            {article.thumbnail_url ? (
              <div className="relative h-56 w-full overflow-hidden sm:h-72">
                <img src={getGuideCover(article)} alt={article.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
              </div>
            ) : null}

            <div className="relative p-6 sm:p-8">
              {!article.thumbnail_url ? <div className="section-kicker">Guide</div> : null}

              <Button asChild variant="outline" className="mb-6">
                <Link href="/guides">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Guides
                </Link>
              </Button>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
                  Guide
                </span>
                {article.status === "draft" ? (
                  <span className="inline-flex items-center rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-yellow-200">
                    Draft preview
                  </span>
                ) : null}
                {isGuideLocked(article) ? (
                  <span className="inline-flex items-center rounded-full border border-border/[0.22] bg-muted/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#cfe0ee]">
                    <Lock className="mr-1 h-3 w-3" /> Locked
                  </span>
                ) : null}
              </div>

              <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">{article.title}</h1>
              <div className="accent-rule my-5" />
              {article.summary ? <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{article.summary}</p> : null}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
                <div>
                  Written by <span className="font-semibold text-foreground">{article.author_name}</span> · {formatGuideDate(article.published_at || article.created_at)}
                </div>
                {canEditGuide(profile, article) ? (
                  <Button asChild>
                    <Link href={`/guides/admin/${article.id}/edit`}>
                      <Edit className="mr-2 h-4 w-4" /> Edit
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel p-6 sm:p-8">
          <GuideRenderer content={article.content} />
        </section>
      </article>
    </main>
  )
}
