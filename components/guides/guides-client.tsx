"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Edit, LogIn, LogOut, Plus, RefreshCw, Search } from "lucide-react"
import {
  guidesSupabase,
  guidesSupabaseConfigured,
  type GuideArticle,
  type GuideAuthorProfile,
  formatGuideDate,
  getGuideCover,
  getCurrentGuideAuthor,
} from "@/lib/guides"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function LoginPanel({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit() {
    setMessage(null)
    setLoading(true)
    const { error } = await guidesSupabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setEmail("")
    setPassword("")
    onLoggedIn()
  }

  return (
    <div className="glass-panel p-5">
      <div className="section-kicker mb-3">Author login</div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="theme-input"
        />
        <Input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          className="theme-input"
          onKeyDown={(event) => {
            if (event.key === "Enter") submit()
          }}
        />
        <Button onClick={submit} disabled={loading || !email.trim() || !password}>
          {loading ? "Signing in..." : "Log in"}
        </Button>
      </div>
      {message ? <p className="mt-3 text-sm text-red-300">{message}</p> : null}
    </div>
  )
}

function AuthorAvatar({
  profile,
  name,
  size = "sm",
}: {
  profile?: Pick<GuideAuthorProfile, "avatar_url" | "display_name"> | null
  name: string
  size?: "sm" | "lg"
}) {
  const displayName = profile?.display_name?.trim() || name.trim() || "Author"
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"

  const sizeClasses = size === "lg" ? "h-12 w-12 text-base" : "h-7 w-7 text-[10px]"

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={displayName}
        className={`${sizeClasses} rounded-full border border-white/15 object-cover shadow-lg ring-2 ring-[#da3e44]/20`}
        loading="lazy"
      />
    )
  }

  return (
    <span
      className={`${sizeClasses} inline-flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#222327] font-extrabold text-white shadow-lg ring-2 ring-[#da3e44]/20`}
    >
      {initials}
    </span>
  )
}

function GuideCard({ article, authorProfile }: { article: GuideArticle; authorProfile?: GuideAuthorProfile | null }) {
  const authorName = authorProfile?.display_name || article.author_name

  return (
    <article className="glass-panel group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-[#da3e44]/35 hover:shadow-[0_24px_80px_rgba(0,0,0,0.32),0_0_34px_rgba(218,62,68,0.12)]">
      <Link href={`/guides/${article.slug}`} className="block">
        <div className="relative aspect-[16/9] overflow-hidden bg-[#16171b]">
          {article.thumbnail_url ? (
            <img
              src={getGuideCover(article)}
              alt={article.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_18%_-8%,rgba(218,62,68,0.16),transparent_22rem),linear-gradient(135deg,#191a1e_0%,#1f2024_46%,#242529_100%)] px-6 text-center text-sm font-bold uppercase tracking-[0.26em] text-white/60">
              SLIME.WIKI Guide
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#121319] via-[#121319]/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="inline-flex items-center rounded-full border border-[#da3e44]/30 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff8a98] backdrop-blur-sm">
              Guide
            </div>
          </div>
        </div>
      </Link>

      <div className="relative -mt-6 px-5">
        <div className="glass-panel-strong flex items-end gap-3 px-4 py-3">
          <AuthorAvatar profile={authorProfile} name={authorName} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{authorName}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Contributor</p>
          </div>
          <span className="ml-auto shrink-0 text-xs text-slate-400">
            {formatGuideDate(article.published_at || article.created_at)}
          </span>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        <Link href={`/guides/${article.slug}`} className="block">
          <h3 className="line-clamp-2 text-xl font-black leading-snug text-white transition-colors duration-200 group-hover:text-[#ff8a98]">
            {article.title}
          </h3>
        </Link>
        {article.summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{article.summary}</p> : null}
      </div>
    </article>
  )
}

export function GuidesClient() {
  const [articles, setArticles] = useState<GuideArticle[]>([])
  const [profile, setProfile] = useState<GuideAuthorProfile | null>(null)
  const [authorProfiles, setAuthorProfiles] = useState<Record<string, GuideAuthorProfile>>({})
  const [query, setQuery] = useState("")
  const [showLogin, setShowLogin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!guidesSupabaseConfigured) {
      setLoading(false)
      setError(
        "Guides are not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment.",
      )
      return
    }

    setLoading(true)
    setError(null)

    const [{ data, error: guidesError }, author] = await Promise.all([
      guidesSupabase
        .from("guide_articles")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      getCurrentGuideAuthor(),
    ])

    if (guidesError) {
      setError(guidesError.message)
      setArticles([])
      setAuthorProfiles({})
    } else {
      const loadedArticles = (data || []) as GuideArticle[]
      setArticles(loadedArticles)

      const authorIds = Array.from(new Set(loadedArticles.map((article) => article.author_id).filter(Boolean)))
      if (authorIds.length > 0) {
        const { data: profileRows } = await guidesSupabase
          .from("guide_author_profiles")
          .select("id, display_name, avatar_url, role, created_at")
          .in("id", authorIds)

        const byId: Record<string, GuideAuthorProfile> = {}
        for (const row of profileRows || []) {
          const authorProfile = row as GuideAuthorProfile
          byId[authorProfile.id] = authorProfile
        }
        setAuthorProfiles(byId)
      } else {
        setAuthorProfiles({})
      }
    }

    setProfile(author)
    setLoading(false)
  }

  useEffect(() => {
    load()

    const { data } = guidesSupabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return articles
    return articles.filter((article) => {
      const authorName = authorProfiles[article.author_id]?.display_name || article.author_name
      return [article.title, article.summary, authorName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    })
  }, [articles, authorProfiles, query])

  async function signOut() {
    await guidesSupabase.auth.signOut()
    setProfile(null)
    setShowLogin(false)
  }

  return (
    <main className="site-page">
      <div className="site-container space-y-8">
        <section className="glass-panel-strong p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="section-kicker">Community Guides</div>
              <h1 className="section-title mt-3 text-4xl sm:text-5xl">Guides</h1>
              <div className="accent-rule my-5" />
              <p className="max-w-2xl text-base leading-7 text-slate-300">
                Articles, team notes, event tips, and strategy write-ups from trusted contributors.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {profile ? (
                <>
                  <Button asChild>
                    <Link href="/guides/admin/new">
                      <Plus className="mr-2 h-4 w-4" /> Create Article
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/guides/admin">
                      <Edit className="mr-2 h-4 w-4" /> My Articles
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setShowLogin((value) => !value)}>
                  <LogIn className="mr-2 h-4 w-4" /> Author login
                </Button>
              )}
            </div>
          </div>

          {!profile && showLogin ? <div className="mt-6"><LoginPanel onLoggedIn={load} /></div> : null}
        </section>

        <section className="glass-panel p-5 sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search guides..."
                className="theme-input pl-10"
              />
            </div>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </section>

        {loading ? <p className="text-slate-400">Loading guides...</p> : null}
        {error ? <p className="glass-panel border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</p> : null}

        {!loading && !error && filteredArticles.length === 0 ? (
          <div className="glass-panel p-10 text-center text-slate-300">No published guides yet.</div>
        ) : null}

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredArticles.map((article) => (
            <GuideCard key={article.id} article={article} authorProfile={authorProfiles[article.author_id]} />
          ))}
        </section>
      </div>
    </main>
  )
}
