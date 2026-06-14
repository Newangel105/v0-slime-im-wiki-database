"use client"

// Night-ink home, client side — a faithful port of the approved prototype
// reports/christmas-vision/my_vision/home-live.html + home-live.js
// (styles: SECTION 4 of app/night-ink.css = home-live.css verbatim).
//
// Deviations from the prototype (all deliberate, see phase report):
// - The brand/nav mastrow is NOT rendered here: the app has a global
//   night-ink masthead (components/nightink/site-nav.tsx, layout.tsx).
// - News loads through the site's own /api/events proxy (the pattern the
//   ocean home uses) instead of hitting the official announcement API
//   cross-origin; the payload shape (data.list) is identical.
// - Internal links use next/link.
import anime from "animejs"
import Link from "next/link"
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { ArchiveBackground } from "./archive-background"
import { ArchiveDial } from "./archive-dial"

export type HomeLatestCharacter = {
  id: number
  name: string
  title: string
  release: string
  thumb: string
  /** full-body art (CharaInfo / BlessCutin) — beam fallback when no model */
  info: string
  /** GLB path in the model-viewer manifest, resolved via mediaUrl() */
  modelGlb: string | null
}

export type HomeStat = {
  k: string
  v: number
  hot?: boolean
}

type Props = {
  latest: HomeLatestCharacter[]
  dialItems: HomeLatestCharacter[]
  allModelItems: HomeLatestCharacter[]
  stats: HomeStat[]
  recordCount: number
  lastSync: string
}

type NewsRow = {
  id: string
  title: string
  category: string
  date: string
  isNew: boolean
  description: string
  articleType: string
}

type Announcement = {
  id: string
  title: string
  category?: string
  tabCategory?: string
  isNew?: boolean
  endDate?: string
  href?: string
  articleType?: string
}

type AnnouncementDetail = {
  id: number
  title: string
  content: string
}

/* ----------------------------------------------------------------
   gates (prototype §4, hrefs mapped to the real routes)
   ---------------------------------------------------------------- */
const gates = [
  { num: "01", nm: "Characters", ds: "Stats, skills, traits and forces for every playable record.", href: "/characters", art: "/nightink/chars/rimuru.webp" },
  { num: "02", nm: "Team Builder", ds: "Compose squads and share builds with live numbers.", href: "/team-builder", art: "/nightink/chars/shion.webp" },
  { num: "03", nm: "Banners", ds: "Every summon banner with rates, history and reruns.", href: "/summon", art: "/nightink/chars/milim-shore.webp" },
  { num: "04", nm: "Skills", ds: "The full skill encyclopedia with movie previews.", href: "/skill-viewer", art: "/nightink/chars/ramiris.webp" },
  { num: "05", nm: "Model Viewer", ds: "Spin and inspect every character's actual 3D battle model.", href: "/model-viewer", art: "/nightink/chars/veldora.webp" },
]

/* ----------------------------------------------------------------
   timers (prototype §5c — same regions/UTC times as the live home)
   ---------------------------------------------------------------- */
const timerRegions = [
  { key: "NA", label: "NA", reset: { hour: 11, minute: 0 }, update: { hour: 2, minute: 0 } },
  { key: "EU", label: "EU", reset: { hour: 4, minute: 0 }, update: { hour: 2, minute: 0 } },
  { key: "Asia", label: "Asia", reset: { hour: 19, minute: 0 }, update: { hour: 2, minute: 0 } },
]

function getOfficialAnnouncementFeedUrl(language = 2) {
  return `https://api-us.ten-sura-m.wfs.games/web/announcement?language=${language}`
}

function getNextUtcTime(hour: number, minute: number) {
  const now = new Date()
  const next = new Date(now)
  next.setUTCHours(hour, minute, 0, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next
}

function formatCountdown(target: Date) {
  const total = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000))
  const h = String(Math.floor(total / 3600)).padStart(2, "0")
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0")
  const s = String(total % 60).padStart(2, "0")
  return `${h}:${m}:${s}`
}

function formatSchedule(target: Date) {
  return target.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })
}

function NewsRowButton({ item, onOpen }: { item: NewsRow; onOpen: (item: NewsRow) => void }) {
  const className = `home-news-row${item.isNew ? " is-new" : ""}`
  return (
    <button type="button" className={className} onClick={() => onOpen(item)}>
      <span className="tag">{item.category || "News"}</span>
      <span className="tt">{item.title}</span>
      <span className="dt">{item.date}</span>
    </button>
  )
}

function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null
  return createPortal(children, document.body)
}

function NewsModal({
  news,
  detail,
  loading,
  onClose,
}: {
  news: NewsRow | null
  detail: AnnouncementDetail | null
  loading: boolean
  onClose: () => void
}) {
  if (!news) return null

  return (
    <ModalPortal>
      <div className="home-news-modal" role="dialog" aria-modal="true" aria-label="Official announcement" onClick={onClose}>
        <article className="home-news-modal-panel" onClick={(event) => event.stopPropagation()}>
          <header className="home-news-modal-header">
            <span>
              <small>{news.category}</small>
              <strong>{detail?.title || news.title}</strong>
            </span>
            <button type="button" onClick={onClose} aria-label="Close announcement">
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="home-news-modal-body">
            {loading ? (
              <div className="home-news-loading">Loading official announcement...</div>
            ) : (
              <div
                className="home-news-detail"
                dangerouslySetInnerHTML={{ __html: detail?.content || "<p>Announcement content is unavailable.</p>" }}
              />
            )}
          </div>
        </article>
      </div>
    </ModalPortal>
  )
}

function NewsListModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  const officialFeedUrl = getOfficialAnnouncementFeedUrl()

  return (
    <ModalPortal>
      <div className="home-news-modal" role="dialog" aria-modal="true" aria-label="All official news" onClick={onClose}>
        <article className="home-news-modal-panel home-news-list-panel" onClick={(event) => event.stopPropagation()}>
          <header className="home-news-modal-header">
            <span>
              <small>Official Feed</small>
              <strong>All Latest News</strong>
            </span>
            <button type="button" onClick={onClose} aria-label="Close all news">
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="home-news-modal-body home-official-news-body">
            <iframe
              className="home-official-news-frame"
              src={`/api/recruit-article?src=${encodeURIComponent(officialFeedUrl)}`}
              title="Official latest news"
            />
          </div>
        </article>
      </div>
    </ModalPortal>
  )
}

export function NightInkHomeClient({ latest, dialItems, allModelItems, stats, recordCount, lastSync }: Props) {
  const boardRef = useRef<HTMLElement>(null)

  const newest = latest[0]
  const fallbackNews: NewsRow[] = [
    newest && {
      id: "fb-0",
      title: `New record summoned: ${newest.name}`,
      category: "Record",
      date: newest.release,
      isNew: true,
      description: `Open the archive record for ${newest.name}.`,
      articleType: "record",
    },
    {
      id: "fb-1",
      title: "Official announcements - open the event board for the latest notices.",
      category: "News",
      date: "Latest",
      isNew: false,
      description: "The official announcement feed could not be loaded, so this fallback item is shown.",
      articleType: "info",
    },
    {
      id: "fb-2",
      title: "Character database updated - browse current unit stats, skills, and filters.",
      category: "Update",
      date: "Wiki",
      isNew: false,
      description: "Browse current unit stats, skills, traits, forces, and release metadata.",
      articleType: "update",
    },
    {
      id: "fb-3",
      title: "Team tools available - use the builder and viewers to plan your account.",
      category: "Tools",
      date: "Wiki",
      isNew: false,
      description: "Use the team builder, viewers, and data tools to plan your account.",
      articleType: "tools",
    },
  ].filter(Boolean) as NewsRow[]

  const [news, setNews] = useState<NewsRow[]>(fallbackNews)
  const [selectedNews, setSelectedNews] = useState<NewsRow | null>(null)
  const [newsListOpen, setNewsListOpen] = useState(false)
  const [newsDetail, setNewsDetail] = useState<AnnouncementDetail | null>(null)
  const [loadingNewsDetail, setLoadingNewsDetail] = useState(false)
  const [regionKey, setRegionKey] = useState(timerRegions[0].key)
  // null until mounted — countdowns/schedules are client-local, so SSR renders
  // placeholders to avoid hydration mismatches (same pattern as ocean home)
  const [nowTick, setNowTick] = useState<number | null>(null)

  /* §5b NEWS — official announcements via the site's /api/events proxy */
  useEffect(() => {
    let cancelled = false
    fetch("/api/events?language=2", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("bad response"))))
      .then((payload) => {
        const list = (payload?.data?.list ?? []) as Announcement[]
        if (cancelled || list.length === 0) return
        setNews(
          list.map((item) => ({
            id: String(item.id),
            title: item.title,
            category: item.tabCategory || item.category || "News",
            date: item.endDate ? String(item.endDate).slice(0, 10) : "",
            isNew: !!item.isNew,
            description: item.tabCategory ? `${item.tabCategory} announcement` : "Official announcement",
            articleType: item.articleType || "info",
          })),
        )
      })
      .catch(() => {
        // keep the bundled fallback rows when the official feed is unavailable
      })
    return () => {
      cancelled = true
    }
  }, [])

  /* §5c TIMERS — tick every second once mounted */
  useEffect(() => {
    setNowTick(Date.now())
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!selectedNews) {
      setNewsDetail(null)
      setLoadingNewsDetail(false)
      return
    }

    if (selectedNews.id.startsWith("fb-")) {
      setNewsDetail({
        id: 0,
        title: selectedNews.title,
        content: `<p>${selectedNews.description}</p>`,
      })
      setLoadingNewsDetail(false)
      return
    }

    const newsToLoad = selectedNews
    let cancelled = false

    async function loadNewsDetail() {
      setLoadingNewsDetail(true)
      setNewsDetail(null)
      try {
        const response = await fetch(`/api/events/${newsToLoad.id}?language=2`, { cache: "no-store" })
        if (!response.ok) throw new Error("Announcement detail request failed")
        const payload = await response.json()
        const detail = payload?.data as AnnouncementDetail | undefined
        if (!cancelled && detail) setNewsDetail(detail)
      } catch {
        if (!cancelled) {
          setNewsDetail({
            id: Number(newsToLoad.id) || 0,
            title: newsToLoad.title,
            content: "<p>The official announcement could not be loaded right now.</p>",
          })
        }
      } finally {
        if (!cancelled) setLoadingNewsDetail(false)
      }
    }

    loadNewsDetail()

    return () => {
      cancelled = true
    }
  }, [selectedNews])

  const region = timerRegions.find((r) => r.key === regionKey) ?? timerRegions[0]
  const timerRows = [
    { label: "Daily reset", time: region.reset, hot: true },
    { label: "Weekly update", time: region.update, hot: false },
  ].map((row) => {
    const target = nowTick === null ? null : getNextUtcTime(row.time.hour, row.time.minute)
    return {
      ...row,
      schedule: target ? formatSchedule(target) : "",
      countdown: target ? formatCountdown(target) : "--:--:--",
    }
  })

  /* §6 MOTION — intro reveal + perpetual canvas life. The summon circle
     is gone: the 3D Archive Projector (archive-dial.tsx) owns the stage. */
  useEffect(() => {
    const board = boardRef.current
    if (!board) return

    const q = (selector: string) => Array.from(board.querySelectorAll<HTMLElement>(selector))
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const renderStatsFinal = () => {
      q(".home-stat").forEach((el) => {
        const value = el.querySelector(".v")
        if (value) value.textContent = Number(el.dataset.value).toLocaleString("en-US")
      })
    }

    if (reduced) {
      // finished static state (the inline pre-hydration script never added
      // .motion under reduced motion, but make sure)
      document.body.classList.remove("motion")
      renderStatsFinal()
      return
    }

    document.body.classList.add("motion")

    let scrollFrame = 0
    const hero = board.querySelector<HTMLElement>(".home-hero")
    const syncHeroDepth = () => {
      scrollFrame = 0
      if (!hero) return
      const rect = hero.getBoundingClientRect()
      const start = window.innerHeight * 0.78
      const end = -rect.height * 0.22
      const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)))
      hero.style.setProperty("--hero-depth", progress.toFixed(3))
      hero.style.setProperty("--scope-scale", (1 + progress * 0.22).toFixed(3))
      hero.style.setProperty("--scope-rotate", `${(-8 * progress).toFixed(2)}deg`)
      hero.style.setProperty("--scope-y", `${(-18 * progress).toFixed(2)}px`)
      hero.style.setProperty("--scope-opacity", (0.28 + progress * 0.44).toFixed(3))
      hero.style.setProperty("--field-y", `${(-34 * progress).toFixed(2)}px`)
    }
    const requestHeroDepth = () => {
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame)
      scrollFrame = window.requestAnimationFrame(syncHeroDepth)
    }

    requestHeroDepth()
    window.addEventListener("scroll", requestHeroDepth, { passive: true })
    window.addEventListener("resize", requestHeroDepth, { passive: true })

    const intro = anime.timeline({
      easing: "easeInOutSine",
      complete: () => document.body.classList.remove("motion"),
    })

    intro.add({
      targets: q(".od-dial"),
      opacity: [0, 1],
      scale: [0.84, 1],
      duration: 900,
      easing: "easeOutElastic(1, 0.62)",
    })

    anime({
      targets: q(".home-field-mark"),
      translateX: () => anime.random(-34, 34),
      translateY: () => anime.random(-22, 22),
      scaleX: () => anime.random(80, 128) / 100,
      opacity: [0.12, 0.72],
      duration: () => anime.random(3600, 7600),
      delay: anime.stagger(95),
      direction: "alternate",
      easing: "easeInOutSine",
      loop: true,
    })

    return () => {
      // stop everything this effect started (dev StrictMode re-runs included)
      window.removeEventListener("scroll", requestHeroDepth)
      window.removeEventListener("resize", requestHeroDepth)
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame)
      ;[
        ".od-dial",
        ".home-stat",
        ".home-news-row",
        ".home-timer-row",
        ".home-gate",
        ".hl-item",
        ".home-field-mark",
        ".home-kicker",
        ".home-h1 span",
        ".home-sub",
        ".home-cta",
      ].forEach((selector) => anime.remove(q(selector)))
      document.body.classList.remove("motion")
      renderStatsFinal()
    }
  }, [])

  return (
    <main className="board v2 grain home-board" ref={boardRef}>
      <ArchiveBackground />
      {/* prototype-equivalent pre-hydration hide: home-live.js adds
          body.motion synchronously before first paint so the ritual's
          targets start invisible; run the same check inline. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.body.classList.add('motion')}}catch(e){}",
        }}
      />
      <div className="v2-inner">
        <section className="home-hero" aria-label="Tempest Archive">
          <span className="nf-ring nf-ring-hero" aria-hidden="true" />
          <div className="home-hero-field" aria-hidden="true">
            {Array.from({ length: 28 }, (_, index) => (
              <span
                key={index}
                className="home-field-mark"
                style={
                  {
                    "--x": `${(index * 37) % 100}%`,
                    "--y": `${(index * 23 + 11) % 100}%`,
                    "--r": `${-32 + ((index * 17) % 64)}deg`,
                    "--s": `${0.55 + ((index * 7) % 12) / 20}`,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          <div className="home-copy">
            <span className="cap home-kicker">
              Unofficial database &middot; That Time I Got Reincarnated as a Slime: Isekai Memories
            </span>
            <h1 className="home-h1">
              <span>Tempest</span>
              <span>
                Arch<em>ive</em>
              </span>
            </h1>
            <p className="home-sub">
              Every character, skill, force, banner and battle number &mdash; extracted from the game files and
              pressed in night ink. Turn the dial, press the core, and the newest records answer the summons.
            </p>
            <div className="home-ctas">
              <Link className="home-cta" href="/characters">
                Browse characters &rarr;
              </Link>
              <Link className="home-cta ghost" href="/summon">
                Summon records
              </Link>
            </div>
          </div>

          <div className="sc-stage" aria-label="Archive projector — the newest records">
            <ArchiveDial items={dialItems} allItems={allModelItems} />
          </div>
        </section>

        <section className="v2-pod home-statrow" aria-label="Archive numbers">
          <span className="v2-tab">Archive</span>
          <div className="home-stats">
            {stats.map((stat) => (
              <div key={stat.k} className={`home-stat${stat.hot ? " is-hot" : ""}`} data-value={stat.v}>
                <span className="v">{stat.v.toLocaleString("en-US")}</span>
                <span className="k">{stat.k}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="home-row2" aria-label="News and timers">
          <div className="v2-pod home-news">
            <div className="v2-bridge v" style={{ top: -27, height: 28, left: 110, width: 84 }} aria-hidden="true">
              <i className="tl" />
              <i className="tr" />
              <i className="bl" />
              <i className="br" />
            </div>
            <span className="v2-tab">News</span>
            <button type="button" className="home-news-view-all" onClick={() => setNewsListOpen(true)}>
              View all
            </button>
            <div className="home-news-list">
              {news.slice(0, 7).map((item) => (
                <NewsRowButton key={item.id} item={item} onOpen={setSelectedNews} />
              ))}
            </div>
          </div>

          <aside className="v2-pod home-timers">
            <div className="v2-bridge h" style={{ left: -27, width: 28, top: 44, height: 44 }} aria-hidden="true">
              <i className="tl" />
              <i className="tr" />
              <i className="bl" />
              <i className="br" />
            </div>
            <span className="v2-tab alt">Timers</span>
            <div className="home-region-tabs" role="tablist" aria-label="Timer region">
              {timerRegions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={option.key === region.key}
                  className={option.key === region.key ? "is-active" : undefined}
                  onClick={() => setRegionKey(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="home-timer-list">
              {timerRows.map((row) => (
                <div key={row.label} className={`home-timer-row${row.hot ? " is-hot" : ""}`}>
                  <span className="k">
                    <span>{row.label}</span>
                    <span>{row.schedule}</span>
                  </span>
                  <span className="cd">{row.countdown}</span>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="home-gates" aria-label="Wiki sections">
          <div className="v2-bridge v" style={{ top: -27, height: 28, right: 112, width: 84 }} aria-hidden="true">
            <i className="tl" />
            <i className="tr" />
            <i className="bl" />
            <i className="br" />
          </div>
          {gates.map((gate, i) => (
            <Link key={gate.href} className={`home-gate${i % 2 ? " alt" : ""}`} href={gate.href}>
              <span className="num">{gate.num}</span>
              <span className="nm">{gate.nm}</span>
              <span className="ds">{gate.ds}</span>
              <span className="arrow">&rarr;</span>
              <img className="gate-art" src={gate.art} alt="" loading="lazy" />
            </Link>
          ))}
        </section>

        <section className="v2-pod home-latest" aria-label="Latest records">
          <div className="v2-bridge v" style={{ top: -27, height: 28, right: 150, width: 84 }} aria-hidden="true">
            <i className="tl" />
            <i className="tr" />
            <i className="bl" />
            <i className="br" />
          </div>
          <span className="v2-tab alt">Latest</span>
          <div className="home-latest-head">
            <span className="count">Fresh from the gate</span>
            <Link className="cap home-latest-link" href="/characters">
              Open the full archive &rarr;
            </Link>
          </div>
          <div className="hl-strip">
            {latest.slice(0, 10).map((character) => (
              <Link key={character.id} className="hl-item" href={`/characters/${character.id}`}>
                <img
                  src={character.thumb}
                  alt=""
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.visibility = "hidden"
                  }}
                />
                <span className="nm">{character.name}</span>
                <span className="dt">{character.release}</span>
              </Link>
            ))}
          </div>
        </section>

        <div className="v2-dockbar home-dock">
          <span className="upp">Slime Wiki &middot; Night ink edition</span>
          <span className="upp">
            {recordCount} records &middot; last sync {lastSync}
          </span>
        </div>
      </div>
      <NewsModal
        news={selectedNews}
        detail={newsDetail}
        loading={loadingNewsDetail}
        onClose={() => setSelectedNews(null)}
      />
      <NewsListModal open={newsListOpen} onClose={() => setNewsListOpen(false)} />
    </main>
  )
}
