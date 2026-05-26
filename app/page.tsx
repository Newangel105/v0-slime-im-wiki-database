"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ChevronRight, Clock3, Database, ExternalLink, Newspaper, Play, Sparkles, Users, Video } from "lucide-react"

function getNextUtcTime(hour: number, minute = 0, second = 0) {
  const now = new Date()
  const next = new Date(now)
  next.setUTCHours(hour, minute, second, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next
}

function formatLocalTime(date: Date) {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(() => targetDate.getTime() - new Date().getTime())

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(targetDate.getTime() - new Date().getTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  const totalSeconds = Math.max(0, Math.floor(timeLeft / 1000))
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
  const seconds = String(totalSeconds % 60).padStart(2, "0")

  return `${hours}:${minutes}:${seconds}`
}

interface YouTubeVideo {
  id: string
  title: string
  url: string
  embedUrl: string
  thumbnail: string
  published: string | null
}

const timerRegionOptions = [
  { key: "NA", label: "NA", reset: { hour: 11, minute: 0 }, update: { hour: 2, minute: 0 } },
  { key: "EU", label: "EU", reset: { hour: 4, minute: 0 }, update: { hour: 2, minute: 0 } },
  { key: "Asia", label: "Asia", reset: { hour: 19, minute: 0 }, update: { hour: 2, minute: 0 } },
]

const languageOptions = [
  { key: "EN", language: 2, label: "English" },
  { key: "JP", language: 1, label: "Japanese" },
  { key: "CN", language: 3, label: "Chinese" },
  { key: "KR", language: 4, label: "Korean" },
]

const heroFeatures = [
  { label: "Character Database", icon: Database },
  { label: "Community Guides", icon: Users },
  { label: "Live Tools & Data", icon: Sparkles },
]

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [timerRegion, setTimerRegion] = useState(timerRegionOptions[0])
  const [resetTarget, setResetTarget] = useState(() => getNextUtcTime(timerRegionOptions[0].reset.hour, timerRegionOptions[0].reset.minute, 0))
  const [updateTarget, setUpdateTarget] = useState(() => getNextUtcTime(timerRegionOptions[0].update.hour, timerRegionOptions[0].update.minute, 0))

  useEffect(() => {
    setResetTarget(getNextUtcTime(timerRegion.reset.hour, timerRegion.reset.minute, 0))
    setUpdateTarget(getNextUtcTime(timerRegion.update.hour, timerRegion.update.minute, 0))
  }, [timerRegion])

  const resetCountdown = useCountdown(resetTarget)
  const updateCountdown = useCountdown(updateTarget)
  const resetLocal = formatLocalTime(resetTarget)
  const updateLocal = formatLocalTime(updateTarget)

  const [selectedLanguage, setSelectedLanguage] = useState(languageOptions[0])
  const [loadingNews, setLoadingNews] = useState(true)

  const getNewsUrl = () => {
    return `https://api-us.ten-sura-m.wfs.games/web/announcement?language=${selectedLanguage.language}`
  }

  useEffect(() => {
    setLoadingNews(false)
  }, [selectedLanguage])

  const [youtubeVideo, setYoutubeVideo] = useState<YouTubeVideo | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(true)
  const [showEmbed, setShowEmbed] = useState(false)
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null)
  const [thumbAttempt, setThumbAttempt] = useState(0)

  useEffect(() => {
    const defaultVideo: YouTubeVideo = {
      id: "lZ1robJuS8M",
      title: "SLIME - ISEKAI Memories Official Stream",
      url: "https://youtu.be/lZ1robJuS8M",
      embedUrl: "https://www.youtube.com/embed/lZ1robJuS8M",
      thumbnail: "https://img.youtube.com/vi/lZ1robJuS8M/maxresdefault.jpg",
      published: null,
    }
    setYoutubeVideo(defaultVideo)
    setLoadingVideo(false)
  }, [])

  const thumbFallbacks = (id: string) => [
    `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${id}/sddefault.jpg`,
    `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/default.jpg`,
  ]

  useEffect(() => {
    if (!youtubeVideo) return
    setThumbAttempt(0)
    setThumbnailSrc(thumbFallbacks(youtubeVideo.id)[0])
    setShowEmbed(false)
  }, [youtubeVideo])

  function onThumbError() {
    if (!youtubeVideo) return
    const next = thumbAttempt + 1
    const list = thumbFallbacks(youtubeVideo.id)
    if (next < list.length) {
      setThumbAttempt(next)
      setThumbnailSrc(list[next])
    }
  }

  const isUpcoming = !!(youtubeVideo && !youtubeVideo.published)

  return (
    <main className="site-page">
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 -z-30 bg-[#050811]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_22%_24%,rgba(255,45,91,0.26),transparent_24rem),radial-gradient(circle_at_78%_18%,rgba(45,216,255,0.2),transparent_24rem),radial-gradient(ellipse_at_72%_72%,rgba(180,80,200,0.22),transparent_30rem)]" />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,#050811_0%,rgba(5,8,17,0.95)_38%,rgba(5,8,17,0.35)_68%,rgba(5,8,17,0.08)_100%)]" />
        <div className="absolute bottom-0 right-[-4%] -z-20 h-[82%] max-h-[720px]">
          <img
            src="/Image/Character/PC/RimuruAnotherHA2026/7/RimuruAnotherHA2026_7_CharaCutin.webp"
            alt=""
            className="h-full object-contain opacity-70 [filter:brightness(1.15)_saturate(1.4)_contrast(1.08)_drop-shadow(0_0_12px_rgba(255,255,255,0.34))_drop-shadow(0_0_34px_rgba(255,255,255,0.24))_drop-shadow(0_0_58px_rgba(120,210,255,0.20))]"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-[#050811] via-[#050811]/40 to-transparent" />


        <div className="site-container flex min-h-[680px] flex-col justify-start pb-20 pt-20 sm:pt-24">
          <div className="max-w-3xl">
            <div className="mb-12 flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff3d68] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff3d68] shadow-[0_0_8px_rgba(255,61,104,0.8)]" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-200">Community Archive</span>
              </div>
            </div>
            <h1 className="flex max-w-2xl items-center text-6xl font-black uppercase leading-[0.9] tracking-[-0.02em] sm:text-[5.5rem]">
              <span className="bg-gradient-to-b from-white to-white/75 bg-clip-text text-transparent [text-shadow:0_2px_30px_rgba(255,255,255,0.08)]">SLIME</span>
              <span aria-hidden="true" className="relative mx-2.5 inline-flex h-3 w-3 items-center justify-center sm:mx-4 sm:h-4 sm:w-4">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#ff3d68] opacity-30" />
                <span className="relative h-full w-full rounded-full bg-[#ff3d68] shadow-[0_0_22px_rgba(255,61,104,0.85),0_0_44px_rgba(255,61,104,0.35)]" />
              </span>
              <span className="sr-only">.</span>
              <span className="bg-gradient-to-b from-white to-white/75 bg-clip-text text-transparent [text-shadow:0_2px_30px_rgba(255,255,255,0.08)]">WIKI</span>
            </h1>
            <div className="mt-6 flex max-w-xl items-start gap-4">
              <span className="mt-1.5 hidden h-14 w-[3px] rounded-full bg-gradient-to-b from-[#ff3d68] via-[#ff3d68]/70 to-transparent shadow-[0_0_14px_rgba(255,61,104,0.55)] sm:block" />
              <p className="text-base leading-7 text-slate-300/90 sm:text-lg">
                A clean, fast database for characters, forces, heartprints, team planning, skill lookup, and community builds.
              </p>
            </div>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/characters"
                className="group relative inline-flex min-w-[210px] items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-br from-[#ff5079] to-[#e02555] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-[0_8px_24px_-6px_rgba(255,61,104,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-inset ring-white/15 transition-all hover:from-[#ff6489] hover:to-[#ef3868] hover:shadow-[0_12px_32px_-6px_rgba(255,61,104,0.7),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5"
              >
                <span className="absolute inset-0 -z-10 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                Browse Characters
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/team-builder"
                className="group inline-flex min-w-[210px] items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-bold uppercase tracking-wide text-slate-200 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/[0.07] hover:text-white"
              >
                Team Builder
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          <div className="mt-14 max-w-3xl border-t border-white/[0.06] pt-8">
            <div className="flex flex-wrap items-center gap-y-5 divide-x divide-white/[0.07]">
              {heroFeatures.map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3 pl-6 pr-6 first:pl-0">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-white/[0.04] text-cyan-200/90 ring-1 ring-inset ring-white/[0.06]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-300">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="site-container space-y-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="rounded-2xl border border-white/10 bg-[#121318]/88 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34)] sm:p-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#ff3d68]/20 bg-[#ff3d68]/10 text-[#ff6f8f]">
                  <Clock3 className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-black tracking-tight text-white">Game Timers</h2>
              </div>
              <div className="flex rounded-lg border border-white/5 bg-[#0d0e13] p-1">
                {timerRegionOptions.map((opt) => (
                  <button
                    key={opt.key}
                    className={`rounded-md px-4 py-2 text-sm font-bold transition-all ${
                      timerRegion.key === opt.key
                        ? "bg-[#ff3d68] text-white shadow-lg shadow-[#ff3d68]/20"
                        : "text-slate-400 hover:bg-white/[0.055] hover:text-white"
                    }`}
                    onClick={() => setTimerRegion(opt)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TimerTile title="Daily Reset" localTime={mounted ? resetLocal : "--"} countdown={mounted ? resetCountdown : "--:--:--"} tone="red" />
              <TimerTile title="Weekly Update" localTime={mounted ? updateLocal : "--"} countdown={mounted ? updateCountdown : "--:--:--"} tone="cyan" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#121318]/88 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34)] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#ff3d68]/20 bg-[#ff3d68]/10 text-[#ff6f8f]">
                  <Video className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-black tracking-tight text-white">Upcoming Stream</h2>
              </div>
            </div>

            {loadingVideo ? (
              <div className="aspect-video animate-pulse rounded-xl border border-white/10 bg-white/[0.055]" />
            ) : youtubeVideo ? (
              <div className="space-y-3">
                <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-[#0a0b0f]">
                  {!showEmbed ? (
                    isUpcoming ? (
                      <a
                        href={youtubeVideo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block h-full w-full"
                        aria-label={`Open ${youtubeVideo.title} on YouTube`}
                      >
                        <img
                          src={thumbnailSrc || youtubeVideo.thumbnail}
                          alt={youtubeVideo.title}
                          onError={onThumbError}
                          className="h-full w-full object-cover opacity-90"
                        />
                        <StreamOverlay label="Upcoming" />
                      </a>
                    ) : (
                      <button onClick={() => setShowEmbed(true)} className="block h-full w-full">
                        <img
                          src={thumbnailSrc || youtubeVideo.thumbnail}
                          alt={youtubeVideo.title}
                          onError={onThumbError}
                          className="h-full w-full object-cover opacity-90"
                        />
                        <StreamOverlay label="Watch" />
                      </button>
                    )
                  ) : (
                    <iframe
                      src={youtubeVideo.embedUrl}
                      title={youtubeVideo.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full"
                    />
                  )}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 flex-1 text-sm font-medium text-slate-200">{youtubeVideo.title}</p>
                  <a href={youtubeVideo.url} target="_blank" rel="noopener noreferrer" className="quiet-button px-2 py-2" aria-label="Open stream on YouTube">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#121318]/88 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34)] sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#ff3d68]/20 bg-[#ff3d68]/10 text-[#ff6f8f]">
                <Newspaper className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-black tracking-tight text-white">Latest News</h2>
            </div>
            <div className="flex rounded-lg border border-white/5 bg-[#0d0e13] p-1">
              {languageOptions.map((opt) => (
                <button
                  key={opt.key}
                  className={`rounded-md px-4 py-2 text-sm font-bold transition-all ${
                    selectedLanguage.key === opt.key
                      ? "bg-[#ff3d68] text-white shadow-lg shadow-[#ff3d68]/20"
                      : "text-slate-400 hover:bg-white/[0.055] hover:text-white"
                  }`}
                  onClick={() => setSelectedLanguage(opt)}
                >
                  {opt.key}
                </button>
              ))}
            </div>
          </div>

          {loadingNews ? (
            <div className="flex h-96 items-center justify-center text-slate-500">Loading news...</div>
          ) : (
            <iframe
              src={getNewsUrl()}
              title="Game News"
              className="h-[560px] w-full rounded-xl border border-white/10 bg-[#0a0b0f]"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </section>

        <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-500">
          <p>SLIME.WIKI is an unofficial fan-made database. Game assets and content belong to WFS and Bandai Namco Entertainment.</p>
        </footer>
      </div>
    </main>
  )
}

function TimerTile({
  title,
  localTime,
  countdown,
  tone,
}: {
  title: string
  localTime: string
  countdown: string
  tone: "red" | "cyan"
}) {
  const accent = tone === "red" ? "from-red-400/80 to-red-500/5 text-red-200" : "from-cyan-300/80 to-cyan-500/5 text-cyan-100"

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0d12] p-5 shadow-inner shadow-white/[0.02]">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      <span className="block text-sm font-bold text-slate-400">{title}</span>
      <span className="mt-2 block min-h-5 text-xs text-slate-500">{localTime}</span>
      <span className="mt-4 block font-mono text-4xl font-black tracking-tight text-white sm:text-5xl">{countdown}</span>
    </div>
  )
}

function StreamOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/18">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-[#ff3d68] text-white shadow-xl shadow-[#ff3d68]/30">
        <Play className="h-6 w-6 fill-current" />
      </div>
      <span className="absolute left-3 top-3 rounded-md bg-yellow-400 px-2.5 py-1 text-xs font-black text-black">{label}</span>
    </div>
  )
}
