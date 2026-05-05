"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Edit, LogIn, LogOut, Plus, RefreshCw, Search } from "lucide-react"
import { guidesSupabase, guidesSupabaseConfigured, type GuideArticle, type GuideAuthorProfile, formatGuideDate, getGuideCover, getCurrentGuideAuthor } from "@/lib/guides"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cyan-200">
        <LogIn className="h-4 w-4" /> Author login
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="border-white/10 bg-slate-950/70 text-white placeholder:text-gray-500"
        />
        <Input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          className="border-white/10 bg-slate-950/70 text-white placeholder:text-gray-500"
          onKeyDown={(event) => {
            if (event.key === "Enter") submit()
          }}
        />
        <Button onClick={submit} disabled={loading || !email.trim() || !password} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
          {loading ? "Signing in..." : "Log in"}
        </Button>
      </div>
      {message ? <p className="mt-3 text-sm text-red-300">{message}</p> : null}
    </div>
  )
}


function AuthorAvatar({ profile, name }: { profile?: Pick<GuideAuthorProfile, "avatar_url" | "display_name"> | null; name: string }) {
  const displayName = profile?.display_name?.trim() || name.trim() || "Author"
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?"

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={displayName}
        className="h-6 w-6 rounded-full border border-white/15 object-cover"
        loading="lazy"
      />
    )
  }

  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/15 text-[10px] font-extrabold text-cyan-100">
      {initials}
    </span>
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
      setError("Guides are not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment.")
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
    <main className="min-h-screen bg-[#0f172a] text-white">
      <section className="border-b border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge className="mb-4 border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/10">Community guides</Badge>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Guides</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-gray-300">
                Articles, team notes, event tips, and strategy write-ups from trusted contributors.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {profile ? (
                <>
                  <Button asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                    <Link href="/guides/admin/new">
                      <Plus className="mr-2 h-4 w-4" /> Create Article
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                    <Link href="/guides/admin">
                      <Edit className="mr-2 h-4 w-4" /> My Articles
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={signOut} className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setShowLogin((value) => !value)} className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                  <LogIn className="mr-2 h-4 w-4" /> Author login
                </Button>
              )}
            </div>
          </div>

          {!profile && showLogin ? <div className="mt-6"><LoginPanel onLoggedIn={load} /></div> : null}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search guides..."
              className="border-white/10 bg-slate-950/70 pl-10 text-white placeholder:text-gray-500"
            />
          </div>
          <Button variant="outline" onClick={load} className="border-white/15 bg-white/5 text-white hover:bg-white/10">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {loading ? <p className="text-gray-400">Loading guides...</p> : null}
        {error ? <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</p> : null}

        {!loading && !error && filteredArticles.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-gray-300">
            No published guides yet.
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredArticles.map((article) => {
            const authorProfile = authorProfiles[article.author_id]
            const authorName = authorProfile?.display_name || article.author_name

            return (
            <Card key={article.id} className="overflow-hidden border-white/10 bg-slate-900/80 text-white shadow-xl shadow-black/20">
              <Link href={`/guides/${article.slug}`} className="block">
                <div className="aspect-video overflow-hidden bg-slate-950">
                  {article.thumbnail_url ? (
                    <img src={getGuideCover(article)} alt={article.title} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-500/20 via-slate-900 to-purple-500/20 px-6 text-center text-sm font-bold uppercase tracking-widest text-cyan-100">
                      SLIME.WIKI Guide
                    </div>
                  )}
                </div>
              </Link>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between gap-3 text-xs uppercase tracking-wider text-gray-400">
                  <span className="flex min-w-0 items-center gap-2">
                    <AuthorAvatar profile={authorProfile} name={authorName} />
                    <span className="truncate">{authorName}</span>
                  </span>
                  <span className="shrink-0">{formatGuideDate(article.published_at || article.created_at)}</span>
                </div>
                <Link href={`/guides/${article.slug}`} className="text-xl font-extrabold text-white hover:text-cyan-200">
                  {article.title}
                </Link>
                {article.summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-300">{article.summary}</p> : null}
              </CardContent>
            </Card>
            )
          })}
        </div>
      </section>
    </main>
  )
}
