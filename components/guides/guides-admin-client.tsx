"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, Edit, Lock, Plus, RefreshCw, Trash2, Unlock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { canEditGuide, formatGuideDate, getCurrentGuideAuthor, getGuideCover, guidesSupabase, guidesSupabaseConfigured, isGuideLocked, type GuideArticle, type GuideAuthorProfile } from "@/lib/guides"

export function GuidesAdminClient() {
  const [profile, setProfile] = useState<GuideAuthorProfile | null>(null)
  const [articles, setArticles] = useState<GuideArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lockingId, setLockingId] = useState<string | null>(null)

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

  async function deleteArticle(article: GuideArticle) {
    if (!profile) return

    const confirmed = window.confirm(
      `Delete "${article.title}"?\n\nThis cannot be undone.`,
    )

    if (!confirmed) return

    setDeletingId(article.id)
    setError(null)

    const { error: deleteError } = await guidesSupabase
      .from("guide_articles")
      .delete()
      .eq("id", article.id)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      setArticles((current) => current.filter((item) => item.id !== article.id))
    }

    setDeletingId(null)
  }

  async function toggleArticleLock(article: GuideArticle) {
    if (!profile) return

    const currentlyLocked = isGuideLocked(article)
    const confirmed = window.confirm(
      currentlyLocked
        ? `Unlock "${article.title}"?

After unlocking, it can be edited again.`
        : `Lock "${article.title}"?

Locked articles cannot be edited until they are unlocked.`,
    )

    if (!confirmed) return

    setLockingId(article.id)
    setError(null)

    const payload = currentlyLocked
      ? { is_locked: false, locked_at: null, locked_by: null }
      : { is_locked: true, locked_at: new Date().toISOString(), locked_by: profile.id }

    const { data, error: lockError } = await guidesSupabase
      .from("guide_articles")
      .update(payload)
      .eq("id", article.id)
      .select("*")
      .single()

    if (lockError) {
      setError(lockError.message)
    } else if (data) {
      const updated = data as GuideArticle
      setArticles((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    }

    setLockingId(null)
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
                      {isGuideLocked(article) ? (
                        <Badge className="border-slate-400/40 bg-slate-400/10 text-slate-200 hover:bg-slate-400/10">
                          <Lock className="mr-1 h-3 w-3" /> Locked
                        </Badge>
                      ) : null}
                      <span className="text-xs uppercase tracking-wider text-gray-500">Updated {formatGuideDate(article.updated_at)}</span>
                    </div>
                    <h2 className="line-clamp-2 text-xl font-bold">{article.title}</h2>
                    <p className="mt-1 truncate text-sm text-gray-400">/{article.slug}</p>
                    {article.summary ? <p className="mt-2 line-clamp-2 text-sm leading-5 text-gray-400">{article.summary}</p> : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 md:justify-end md:pl-4">
                  <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                    <Link href={`/guides/${article.slug}`}>View</Link>
                  </Button>
                  {canEditGuide(profile, article) ? (
                    <Button asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                      <Link href={`/guides/admin/${article.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link>
                    </Button>
                  ) : (
                    <Button disabled className="bg-slate-700 text-slate-300 opacity-80">
                      <Lock className="mr-2 h-4 w-4" /> Locked
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={lockingId === article.id}
                    onClick={() => toggleArticleLock(article)}
                    className={isGuideLocked(article) ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 hover:text-cyan-100" : "border-white/15 bg-white/5 text-white hover:bg-white/10"}
                  >
                    {isGuideLocked(article) ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                    {lockingId === article.id ? "Updating..." : isGuideLocked(article) ? "Unlock" : "Lock"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deletingId === article.id}
                    onClick={() => deleteArticle(article)}
                    className="border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deletingId === article.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
