import { createClient } from "@supabase/supabase-js"

export type GuideStatus = "draft" | "published"
export type GuideAuthorRole = "author" | "admin"

export type GuideContentBlock =
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "heading"; level: 2 | 3; text: string }
  | { id: string; type: "image"; url: string; alt?: string; caption?: string }
  | { id: string; type: "youtube"; url?: string; videoId: string; caption?: string }
  | { id: string; type: "quote"; text: string; cite?: string }
  | { id: string; type: "list"; items: string[] }
  | { id: string; type: "divider" }

export interface GuideContent {
  blocks: GuideContentBlock[]
}

export interface GuideArticle {
  id: string
  slug: string
  title: string
  summary: string | null
  thumbnail_url: string | null
  content: GuideContent
  author_id: string
  author_name: string
  status: GuideStatus
  is_locked: boolean
  locked_at: string | null
  locked_by: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface GuideAuthorProfile {
  id: string
  display_name: string
  avatar_url: string | null
  role: GuideAuthorRole
  created_at: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_KEY ??
  ""

export const guidesSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const guidesSupabase = createClient(supabaseUrl || "https://example.supabase.co", supabaseAnonKey || "missing-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export function makeBlockId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function slugifyGuideTitle(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
}

export function formatGuideDate(value: string | null | undefined): string {
  if (!value) return "Unpublished"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unpublished"
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date)
}

export function extractYouTubeVideoId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  // Already a video id.
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
    return raw
  }

  try {
    const url = new URL(raw)
    const hostname = url.hostname.replace(/^www\./, "")

    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0]
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }

    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      const watchId = url.searchParams.get("v")
      if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId

      const parts = url.pathname.split("/").filter(Boolean)
      const embedIndex = parts.findIndex((part) => part === "embed" || part === "shorts")
      if (embedIndex >= 0) {
        const id = parts[embedIndex + 1]
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
      }
    }
  } catch {
    return null
  }

  return null
}

export function getGuideCover(article: Pick<GuideArticle, "thumbnail_url" | "title">): string {
  return article.thumbnail_url?.trim() || ""
}

export async function getCurrentGuideAuthor(): Promise<GuideAuthorProfile | null> {
  if (!guidesSupabaseConfigured) return null

  const {
    data: { user },
  } = await guidesSupabase.auth.getUser()

  if (!user) return null

  const { data, error } = await guidesSupabase
    .from("guide_author_profiles")
    .select("id, display_name, avatar_url, role, created_at")
    .eq("id", user.id)
    .maybeSingle()

  if (error || !data) return null
  return data as GuideAuthorProfile
}

export function isGuideLocked(article: Pick<GuideArticle, "is_locked"> | null | undefined): boolean {
  return Boolean(article?.is_locked)
}

export function canManageGuide(profile: GuideAuthorProfile | null, article: Pick<GuideArticle, "author_id"> | null): boolean {
  if (!profile || !article) return false
  return profile.role === "admin" || article.author_id === profile.id
}

export function canEditGuide(profile: GuideAuthorProfile | null, article: Pick<GuideArticle, "author_id" | "is_locked"> | null): boolean {
  if (!canManageGuide(profile, article)) return false
  return !isGuideLocked(article)
}
