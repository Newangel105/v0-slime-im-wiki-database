"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, Edit, Plus, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatGuideDate, getCurrentGuideAuthor, getGuideCover, guidesSupabase, guidesSupabaseConfigured, type GuideArticle, type GuideAuthorProfile } from "@/lib/guides"

export function GuidesAdminClient() {
  const [profile, setProfile] = useState<GuideAuthorProfile | null>(null)
  const [articles, setArticles] = useState<GuideArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

    if (!author) {
      setError("You must be logged in as a guide author.")
      setLoading(false)
      return
    }

    let query = guidesSupabase
      .from("guide_articles")
      .select("*")
      .order("updated_at", { ascending: false })

    if (author.role !== "admin") {
      query = query.eq("author_id", author.id)
    }

    const { data, error: articlesError } = await query

    if (articlesError) {
      setError(articlesError.message)
      setArticles([])
    } else {
      setArticles((data || []) as GuideArticle[])
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button asChild variant="outline" className="mb-5 border-white/15 bg-white/5 text-white hover:bg-white/10">
              <Link href="/guides"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Guides</Link>
            </Button>
            <h1 className="text-3xl font-extrabold">My Articles</h1>
            {profile ? <p className="mt-2 text-gray-400">Signed in as {profile.display_name}</p> : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} className="border-white/15 bg-white/5 text-white hover:bg-white/10"><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
            <Button asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Link href="/guides/admin/new"><Plus className="mr-2 h-4 w-4" /> New Article</Link></Button>
          </div>
        </div>

        {loading ? <p className="text-gray-400">Loading articles...</p> : null}
        {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div> : null}

        {!loading && !error && articles.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-gray-300">No articles yet.</div>
        ) : null}

        <div className="space-y-4">
          {articles.map((article) => (
            <Card key={article.id} className="border-white/10 bg-slate-900/80 text-white">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-1 gap-4">
                  <Link
                    href={`/guides/${article.slug}`}
                    className="group h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950 sm:h-28 sm:w-44"
                    aria-label={`View ${article.title}`}
                  >
                    {article.thumbnail_url ? (
                      <img
                        src={getGuideCover(article)}
                        alt={article.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-500/20 via-slate-900 to-purple-500/20 px-3 text-center text-[10px] font-bold uppercase tracking-widest text-cyan-100">
                        SLIME.WIKI Guide
                      </div>
                    )}
                  </Link>

                  <div className="min-w-0 py-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge className={article.status === "published" ? "border-green-400/40 bg-green-400/10 text-green-200 hover:bg-green-400/10" : "border-yellow-400/40 bg-yellow-400/10 text-yellow-200 hover:bg-yellow-400/10"}>{article.status}</Badge>
                      <span className="text-xs uppercase tracking-wider text-gray-500">Updated {formatGuideDate(article.updated_at)}</span>
                    </div>
                    <h2 className="line-clamp-2 text-xl font-bold">{article.title}</h2>
                    <p className="mt-1 truncate text-sm text-gray-400">/{article.slug}</p>
                    {article.summary ? <p className="mt-2 line-clamp-2 text-sm leading-5 text-gray-400">{article.summary}</p> : null}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2 md:pl-4">
                  <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10"><Link href={`/guides/${article.slug}`}>View</Link></Button>
                  <Button asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Link href={`/guides/admin/${article.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
