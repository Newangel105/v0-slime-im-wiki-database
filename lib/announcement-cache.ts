// Shared announcement cache. The official events feed is fetched at most once
// per browser per TTL window (default 6h), with the result mirrored to
// localStorage so subsequent page loads (and banner switches in the same
// session) skip the network entirely.
//
// Consumers: BannerEndDate, OfficialAnnouncement, TradePanel days-left in
// components/summon-simulator.tsx.

export type AnnouncementArticle = {
  id: string
  title: string
  category: string
  isNew: boolean
  endDate: string
  href: string
  headerClass: string
  tabCategory: string
  articleType: string
}

const STORAGE_KEY = "summon-announcements-v1"
const TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

type CacheEnvelope = { ts: number; articles: AnnouncementArticle[] }

let memCache: AnnouncementArticle[] | null = null
let inFlight: Promise<AnnouncementArticle[]> | null = null

function readPersistedCache(): AnnouncementArticle[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope
    if (typeof parsed?.ts !== "number" || !Array.isArray(parsed?.articles)) return null
    if (Date.now() - parsed.ts > TTL_MS) return null
    return parsed.articles
  } catch {
    return null
  }
}

function writePersistedCache(articles: AnnouncementArticle[]) {
  if (typeof window === "undefined") return
  try {
    const envelope: CacheEnvelope = { ts: Date.now(), articles }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
  } catch {
    /* quota exceeded etc. — silently skip persistence */
  }
}

// Synchronous read. Returns the cached array if any (in-memory first, then
// localStorage), or null if there's no fresh cache. Useful for first-render
// to skip the loading spinner when we already have data.
export function readAnnouncementsSync(): AnnouncementArticle[] | null {
  if (memCache) return memCache
  const persisted = readPersistedCache()
  if (persisted) {
    memCache = persisted
    return persisted
  }
  return null
}

// Async fetch with single-flight + caching. If a fetch is already in flight,
// returns that promise. Otherwise, fetches and updates both layers of cache.
export async function fetchAnnouncements(): Promise<AnnouncementArticle[]> {
  const cached = readAnnouncementsSync()
  if (cached) return cached
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const res = await fetch("/api/announcements/list", { cache: "default" })
      if (!res.ok) return []
      const payload = await res.json()
      const articles = ((payload?.data?.list ?? []) as AnnouncementArticle[]) || []
      memCache = articles
      writePersistedCache(articles)
      return articles
    } catch {
      return []
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}
