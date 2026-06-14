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
import { NkBoard, NkHeaderPod, NkPod } from "./pod-kit"

// Night-ink port of the Guides index: identical Supabase load/auth/search
// logic, re-housed in the pod organism.

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
    <NkPod className="tight" style={{ marginTop: 18 }} label="Author login">
      <p className="nk-pod-title">Author login</p>
      <div className="nk-row" style={{ gap: 10 }}>
        <input className="nk-input" style={{ flex: 1, minWidth: 180 }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" />
        <input
          className="nk-input"
          style={{ flex: 1, minWidth: 180 }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="nk-btn red" onClick={submit} disabled={loading || !email.trim() || !password}>
          {loading ? "Signing in…" : "Log in"}
        </button>
      </div>
      {message && <p style={{ marginTop: 12, fontSize: 13, color: "#f08a82" }}>{message}</p>}
    </NkPod>
  )
}

function AuthorAvatar({ profile, name, size = "sm" }: { profile?: Pick<GuideAuthorProfile, "avatar_url" | "display_name"> | null; name: string; size?: "sm" | "lg" }) {
  const displayName = profile?.display_name?.trim() || name.trim() || "Author"
  const initials =
    displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?"
  const dim = size === "lg" ? 46 : 28
  const style: React.CSSProperties = { width: dim, height: dim, borderRadius: "50%", flex: "none", border: "1px solid var(--line)" }
  if (profile?.avatar_url) return <img src={profile.avatar_url} alt={displayName} style={{ ...style, objectFit: "cover" }} loading="lazy" />
  return (
    <span style={{ ...style, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--night3)", fontWeight: 800, fontSize: size === "lg" ? 15 : 10, color: "var(--cream)" }}>
      {initials}
    </span>
  )
}

function GuideCard({ article, authorProfile }: { article: GuideArticle; authorProfile?: GuideAuthorProfile | null }) {
  const authorName = authorProfile?.display_name || article.author_name
  return (
    <article className="nk-guide-card">
      <Link href={`/guides/${article.slug}`} className="nk-guide-cover">
        {article.thumbnail_url ? (
          <img src={getGuideCover(article)} alt={article.title} />
        ) : (
          <div className="nk-guide-cover-fallback">SLIME.WIKI Guide</div>
        )}
        <span className="nk-guide-badge">Guide</span>
      </Link>
      <div className="nk-guide-author">
        <AuthorAvatar profile={authorProfile} name={authorName} size="lg" />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{authorName}</p>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--cream-faint)" }}>Contributor</p>
        </div>
        <span style={{ marginLeft: "auto", flex: "none", fontSize: 12, color: "var(--cream-faint)" }}>{formatGuideDate(article.published_at || article.created_at)}</span>
      </div>
      <div style={{ padding: "14px 18px 18px" }}>
        <Link href={`/guides/${article.slug}`}>
          <h3 className="nk-guide-title">{article.title}</h3>
        </Link>
        {article.summary && <p className="nk-guide-summary">{article.summary}</p>}
      </div>
    </article>
  )
}

export function NightInkGuidesClient() {
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
      guidesSupabase.from("guide_articles").select("*").eq("status", "published").order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
      getCurrentGuideAuthor(),
    ])
    if (guidesError) {
      setError(guidesError.message)
      setArticles([])
      setAuthorProfiles({})
    } else {
      const loadedArticles = (data || []) as GuideArticle[]
      setArticles(loadedArticles)
      const authorIds = Array.from(new Set(loadedArticles.map((a) => a.author_id).filter(Boolean)))
      if (authorIds.length > 0) {
        const { data: profileRows } = await guidesSupabase.from("guide_author_profiles").select("id, display_name, avatar_url, role, created_at").in("id", authorIds)
        const byId: Record<string, GuideAuthorProfile> = {}
        for (const row of profileRows || []) {
          const ap = row as GuideAuthorProfile
          byId[ap.id] = ap
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
    const { data } = guidesSupabase.auth.onAuthStateChange(() => load())
    return () => data.subscription.unsubscribe()
  }, [])

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return articles
    return articles.filter((article) => {
      const authorName = authorProfiles[article.author_id]?.display_name || article.author_name
      return [article.title, article.summary, authorName].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    })
  }, [articles, authorProfiles, query])

  async function signOut() {
    await guidesSupabase.auth.signOut()
    setProfile(null)
    setShowLogin(false)
  }

  const actions = profile ? (
    <>
      <Link className="nk-btn red" href="/guides/admin/new"><Plus className="h-4 w-4" /> Create</Link>
      <Link className="nk-btn" href="/guides/admin"><Edit className="h-4 w-4" /> My Articles</Link>
      <button className="nk-btn" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</button>
    </>
  ) : (
    <button className="nk-btn" onClick={() => setShowLogin((v) => !v)}><LogIn className="h-4 w-4" /> Author login</button>
  )

  return (
    <NkBoard>
      <NkHeaderPod
        kicker="Community Guides"
        title="Gui"
        accent="des"
        sub="Articles, team notes, event tips and strategy write-ups from trusted contributors."
        actions={actions}
      />

      {!profile && showLogin && <LoginPanel onLoggedIn={load} />}

      <NkPod className="tight" style={{ marginTop: 26 }} label="Search guides">
        <div className="nk-row" style={{ gap: 12 }}>
          <div className="nk-searchbar" style={{ flex: 1, minWidth: 220 }}>
            <Search />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guides…" />
          </div>
          <button className="nk-btn" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>
      </NkPod>

      {loading && <p className="nk-muted" style={{ marginTop: 24 }}>Loading guides…</p>}
      {error && (
        <NkPod className="tight" style={{ marginTop: 24, borderColor: "rgba(210,69,58,.4)" }}>
          <p style={{ margin: 0, color: "#f08a82", fontSize: 13 }}>{error}</p>
        </NkPod>
      )}
      {!loading && !error && filteredArticles.length === 0 && (
        <NkPod style={{ marginTop: 24 }}>
          <p className="nk-muted" style={{ textAlign: "center", padding: "24px 0" }}>No published guides yet.</p>
        </NkPod>
      )}

      <div className="nk-guide-grid" style={{ marginTop: 26 }}>
        {filteredArticles.map((article) => (
          <GuideCard key={article.id} article={article} authorProfile={authorProfiles[article.author_id]} />
        ))}
      </div>
    </NkBoard>
  )
}
