"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, Edit, Lock, Plus, RefreshCw, Trash2, Unlock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  canEditGuide,
  formatGuideDate,
  getCurrentGuideAuthor,
  getGuideCover,
  guidesSupabase,
  guidesSupabaseConfigured,
  isGuideLocked,
  type GuideArticle,
  type GuideAuthorProfile,
} from "@/lib/guides"

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

    let query = guidesSupabase.from("guide_articles").select("*").order("updated_at", { ascending: false })

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

    const confirmed = window.confirm(`Delete "${article.title}"?\n\nThis cannot be undone.`)
    if (!confirmed) return

    setDeletingId(article.id)
    setError(null)

    const { error: deleteError } = await guidesSupabase.from("guide_articles").delete().eq("id", article.id)

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
        ? `Unlock "${article.title}"?\n\nAfter unlocking, it can be edited again.`
        : `Lock "${article.title}"?\n\nLocked articles cannot be edited until they are unlocked.`,
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
    <main className="site-page slime-page-guides">
      <div className="site-container space-y-6">
        <section className="glass-panel-strong p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Button asChild variant="outline" className="mb-5">
                <Link href="/guides">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Guides
                </Link>
              </Button>
              <div className="section-kicker">Guide dashboard</div>
              <h1 className="section-title mt-3">My Articles</h1>
              <div className="accent-rule my-5 max-w-sm" />
              {profile ? <p className="text-muted-foreground">Signed in as {profile.display_name}</p> : null}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={load}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              <Button asChild>
                <Link href="/guides/admin/new">
                  <Plus className="mr-2 h-4 w-4" /> New Article
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {loading ? <p className="text-muted-foreground">Loading articles...</p> : null}
        {error ? <div className="glass-panel border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div> : null}

        {!loading && !error && articles.length === 0 ? (
          <div className="glass-panel p-8 text-muted-foreground">No articles yet.</div>
        ) : null}

        <section className="space-y-4">
          {articles.map((article) => (
            <article key={article.id} className="glass-panel overflow-hidden p-5 transition-all duration-200 hover:border-accent/30">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-1 gap-4">
                  <Link
                    href={`/guides/${article.slug}`}
                    className="group h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:h-28 sm:w-44"
                    aria-label={`View ${article.title}`}
                  >
                    {article.thumbnail_url ? (
                      <img
                        src={getGuideCover(article)}
                        alt={article.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_18%_-8%,rgba(52,208,221,0.16),transparent_22rem),linear-gradient(135deg,#143552_0%,#16395a_46%,#1A4466_100%)] px-3 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/70">
                        SLIME.WIKI Guide
                      </div>
                    )}
                  </Link>

                  <div className="min-w-0 py-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${article.status === "published" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-yellow-400/25 bg-yellow-400/10 text-yellow-200"}`}>
                        {article.status}
                      </span>
                      {isGuideLocked(article) ? (
                        <span className="inline-flex items-center rounded-full border border-border/[0.22] bg-muted/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#cfe0ee]">
                          <Lock className="mr-1 h-3 w-3" /> Locked
                        </span>
                      ) : null}
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Updated {formatGuideDate(article.updated_at)}
                      </span>
                    </div>
                    <h2 className="line-clamp-2 text-xl font-black text-foreground">{article.title}</h2>
                    <p className="mt-1 truncate text-sm text-muted-foreground">/{article.slug}</p>
                    {article.summary ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{article.summary}</p> : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 md:justify-end md:pl-4">
                  <Button asChild variant="outline">
                    <Link href={`/guides/${article.slug}`}>View</Link>
                  </Button>
                  {canEditGuide(profile, article) ? (
                    <Button asChild>
                      <Link href={`/guides/admin/${article.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled className="border border-accent/25 bg-accent/10 text-accent opacity-80">
                      <Lock className="mr-2 h-4 w-4" /> Locked
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={lockingId === article.id}
                    onClick={() => toggleArticleLock(article)}
                    className={isGuideLocked(article) ? "border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 hover:text-foreground" : undefined}
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
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
