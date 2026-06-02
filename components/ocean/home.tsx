"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from "react"
import { createPortal } from "react-dom"
import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Compass,
  Newspaper,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Sun,
  Users,
  X,
} from "lucide-react"

type TimerTarget = {
  label: string
  detail: string
  getTarget: () => Date
  icon: LucideIcon
}

type TimerRegionOption = {
  key: "NA" | "EU" | "Asia"
  label: string
  reset: {
    hour: number
    minute: number
  }
  update: {
    hour: number
    minute: number
  }
}

type LanguageOption = {
  key: "EN" | "JP" | "CN" | "KR"
  language: number
  label: string
}

type NewsItem = {
  id: string
  title: string
  category: string
  date: string
  description: string
  articleType: string
}

type AnnouncementDetail = {
  id: number
  title: string
  content: string
}

type Announcement = {
  id: string
  title: string
  category: string
  isNew: boolean
  endDate: string
  href: string
  headerClass?: string
  tabCategory: string
  articleType: string
}

type HomeCharacter = {
  id: number
  name: string
  affiliation: string
  image: string
  thumb: string
  href: string
  releaseDate?: string | null
}

type CharacterImageFit = "banner" | "wide" | "portrait" | "tall"
type CharacterArtKind = "CharaCutin" | "CharaInfo" | "CharaCard" | "BlessCutin"

const HOME_CHARACTER_STORAGE_KEY = "slime-home-character-id"
const HOME_FAVORITES_STORAGE_KEY = "slime-home-favorite-character-ids"

type ApiCharacter = {
  master_pc_id: number
  name: string
  affiliation_name: string
  rarity: number
  element: string
  character_role: string
  release_date: string | null
  images: {
    icon: string
  }
}

type YouTubeVideo = {
  id: string
  title: string
  url: string
  embedUrl: string
  thumbnail: string
  published: string | null
}

const defaultCharacters: HomeCharacter[] = [
  {
    id: 150001,
    name: "Rimuru Tempest",
    affiliation: "Great Sage Demon Slime",
    image: "/Image/Character/PC/Rimuru1kuji2024/5/Rimuru1kuji2024_5_CharaCutin.webp",
    thumb: "/Image/Character/PC/Rimuru1kuji2024/5/Rimuru1kuji2024_5_CharaPartyM.webp",
    href: "/characters/150001",
  },
  {
    id: 150002,
    name: "Milim Nava",
    affiliation: "Dragonoid",
    image: "/Image/Character/PC/MilimHA2026/7/MilimHA2026_7_CharaCutin.webp",
    thumb: "/Image/Character/PC/MilimHA2026/7/MilimHA2026_7_CharaPartyM.webp",
    href: "/characters/150002",
  },
  {
    id: 150003,
    name: "Shuna",
    affiliation: "Tempest Priestess",
    image: "/Image/Character/PC/ShunaSwimsuitHibiscus/5/ShunaSwimsuitHibiscus_5_CharaCutin.webp",
    thumb: "/Image/Character/PC/ShunaSwimsuitHibiscus/5/ShunaSwimsuitHibiscus_5_CharaPartyM.webp",
    href: "/characters/150003",
  },
  {
    id: 150004,
    name: "Benimaru",
    affiliation: "Samurai General",
    image: "/Image/Character/PC/BenimaruDefault/5/BenimaruDefault_5_CharaCutin.webp",
    thumb: "/Image/Character/PC/BenimaruDefault/5/BenimaruDefault_5_CharaPartyM.webp",
    href: "/characters/150004",
  },
  {
    id: 150005,
    name: "Diablo",
    affiliation: "Black Progenitor",
    image: "/Image/Character/PC/DiabloDefault/5/DiabloDefault_5_CharaCutin.webp",
    thumb: "/Image/Character/PC/DiabloDefault/5/DiabloDefault_5_CharaPartyM.webp",
    href: "/characters/150005",
  },
]

const fallbackNews: NewsItem[] = [
  {
    id: "fallback-official",
    title: "Official announcements",
    category: "News",
    date: "Latest",
    description: "Open the event board for the latest notices.",
    articleType: "info",
  },
  {
    id: "fallback-characters",
    title: "Character database updated",
    category: "Update",
    date: "Wiki",
    description: "Browse current unit stats, skills, and filters.",
    articleType: "info",
  },
  {
    id: "fallback-tools",
    title: "Team tools available",
    category: "Tools",
    date: "Wiki",
    description: "Use the builder and viewers to plan your account.",
    articleType: "info",
  },
]

const timerRegionOptions: TimerRegionOption[] = [
  { key: "NA", label: "NA", reset: { hour: 11, minute: 0 }, update: { hour: 2, minute: 0 } },
  { key: "EU", label: "EU", reset: { hour: 4, minute: 0 }, update: { hour: 2, minute: 0 } },
  { key: "Asia", label: "Asia", reset: { hour: 19, minute: 0 }, update: { hour: 2, minute: 0 } },
]

const languageOptions: LanguageOption[] = [
  { key: "EN", language: 2, label: "English" },
  { key: "JP", language: 1, label: "Japanese" },
  { key: "CN", language: 3, label: "Chinese" },
  { key: "KR", language: 4, label: "Korean" },
]

function getOfficialAnnouncementFeedUrl(language: number) {
  return `https://api-us.ten-sura-m.wfs.games/web/announcement?language=${language}`
}

const defaultYouTubeVideo: YouTubeVideo = {
  id: "lZ1robJuS8M",
  title: "SLIME - ISEKAI Memories Official Stream",
  url: "https://youtu.be/lZ1robJuS8M",
  embedUrl: "https://www.youtube.com/embed/lZ1robJuS8M",
  thumbnail: "https://img.youtube.com/vi/lZ1robJuS8M/maxresdefault.jpg",
  published: null,
}

const quickLinks = [
  { href: "/characters", label: "Characters", detail: "Browse all units", icon: Users },
  { href: "/summon", label: "Banners", detail: "Current & upcoming", icon: Sparkles },
  { href: "/guides", label: "Guides", detail: "Build & strategy", icon: BookOpen },
  { href: "/tier-maker", label: "Tier Maker", detail: "Rank characters", icon: Star },
  { href: "/team-builder", label: "Team Builder", detail: "Create your team", icon: Users },
]

function getNextUtcTime(hour: number, minute = 0, second = 0) {
  const now = new Date()
  const next = new Date(now)
  next.setUTCHours(hour, minute, second, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next
}

function formatLocalTime(date: Date) {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function useCountdown(getTarget: () => Date) {
  const [countdown, setCountdown] = useState("--:--:--")

  useEffect(() => {
    let targetDate = getTarget()

    function updateCountdown() {
      const nextLeft = targetDate.getTime() - Date.now()

      if (nextLeft <= 0) {
        targetDate = getTarget()
      }

      const totalSeconds = Math.max(0, Math.floor((targetDate.getTime() - Date.now()) / 1000))
      const days = Math.floor(totalSeconds / 86400)
      const hours = Math.floor((totalSeconds % 86400) / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60

      if (days > 0) {
        setCountdown(`${String(days).padStart(2, "0")}d ${String(hours).padStart(2, "0")}h`)
        return
      }

      setCountdown(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      )
    }

    updateCountdown()
    const interval = window.setInterval(() => {
      updateCountdown()
    }, 1000)

    return () => window.clearInterval(interval)
  }, [getTarget])

  return countdown
}

function getTimerTargets(region: TimerRegionOption): TimerTarget[] {
  const resetTarget = getNextUtcTime(region.reset.hour, region.reset.minute)
  const updateTarget = getNextUtcTime(region.update.hour, region.update.minute)

  return [
    {
      label: "Daily Reset",
      detail: `${region.label} reset - ${formatLocalTime(resetTarget)}`,
      getTarget: () => getNextUtcTime(region.reset.hour, region.reset.minute),
      icon: Sun,
    },
    {
      label: "Weekly Update",
      detail: `${region.label} update - ${formatLocalTime(updateTarget)}`,
      getTarget: () => getNextUtcTime(region.update.hour, region.update.minute),
      icon: RefreshCw,
    },
  ]
}

function getYouTubeThumbFallbacks(id: string) {
  return [
    `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${id}/sddefault.jpg`,
    `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/default.jpg`,
  ]
}

function toCharacterArt(icon: string, kind: CharacterArtKind) {
  return icon
    .replace(/_CharaPartyM\.webp$/i, `_${kind}.webp`)
    .replace(/_CharaPartyL\.webp$/i, `_${kind}.webp`)
    .replace(/_CharaCard\.webp$/i, `_${kind}.webp`)
    .replace(/_CharaInfo\.webp$/i, `_${kind}.webp`)
    .replace(/_CharaCutin\.webp$/i, `_${kind}.webp`)
    .replace(/_BlessPartyM\.webp$/i, `_${kind}.webp`)
    .replace(/_BlessPartyL\.webp$/i, `_${kind}.webp`)
    .replace(/_BlessCard\.webp$/i, `_${kind}.webp`)
    .replace(/_BlessCutin\.webp$/i, `_${kind}.webp`)
}

function isBlessCharacterArt(icon: string) {
  return icon.includes("/Character/Bless/") || /_Bless(?:PartyM|PartyL|Card|Cutin)\.webp$/i.test(icon)
}

function toHeroCutinArt(icon: string) {
  return isBlessCharacterArt(icon) ? toCharacterArt(icon, "BlessCutin") : toCharacterArt(icon, "CharaCutin")
}

function toPartyThumbArt(icon: string) {
  return icon.replace(/_CharaPartyL\.webp$/i, "_CharaPartyM.webp").replace(/_BlessPartyL\.webp$/i, "_BlessPartyM.webp")
}

function toHomeCharacter(character: ApiCharacter): HomeCharacter {
  return {
    id: character.master_pc_id,
    name: character.name,
    affiliation: character.affiliation_name,
    image: toHeroCutinArt(character.images.icon),
    thumb: toPartyThumbArt(character.images.icon),
    href: `/characters/${character.master_pc_id}`,
    releaseDate: character.release_date,
  }
}

function toNewsItem(item: Announcement): NewsItem {
  return {
    id: item.id,
    title: item.title,
    category: item.category || item.tabCategory || "News",
    date: item.endDate || (item.isNew ? "New" : "Latest"),
    description: item.tabCategory ? `${item.tabCategory} announcement` : "Official announcement",
    articleType: item.articleType || "info",
  }
}

function splitCharacterName(name: string) {
  const cleanName = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim()
  const [first = cleanName, ...rest] = cleanName.split(" ")
  return {
    first,
    rest: rest.join(" ") || "Unit",
  }
}

function readSavedCharacterId() {
  try {
    return Number(window.localStorage.getItem(HOME_CHARACTER_STORAGE_KEY))
  } catch {
    return Number.NaN
  }
}

function readSavedFavoriteIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HOME_FAVORITES_STORAGE_KEY) || "[]")
    return Array.isArray(parsed) ? parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id)) : []
  } catch {
    return []
  }
}

function saveHeroCharacterState(characterId: number, favoriteIds?: number[]) {
  try {
    window.localStorage.setItem(HOME_CHARACTER_STORAGE_KEY, String(characterId))
    if (favoriteIds) {
      window.localStorage.setItem(HOME_FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds))
    }
  } catch {
    // Local storage can be unavailable in strict privacy modes; the UI still works for the session.
  }
}

function resolveCharacterImageFit(image: HTMLImageElement): CharacterImageFit {
  const aspect = image.naturalWidth / image.naturalHeight
  if (!Number.isFinite(aspect) || aspect <= 0) return "wide"

  if (aspect >= 1.65) {
    return "banner"
  }
  if (aspect >= 1.12) {
    return "wide"
  }
  if (aspect <= 0.72) {
    return "tall"
  }
  return "portrait"
}

export function OceanHome() {
  const [carouselCharacters, setCarouselCharacters] = useState<HomeCharacter[]>(defaultCharacters)
  const [availableCharacters, setAvailableCharacters] = useState<HomeCharacter[]>(defaultCharacters)
  const [activeCharacterId, setActiveCharacterId] = useState(defaultCharacters[0].id)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState("")
  const [news, setNews] = useState<NewsItem[]>(fallbackNews)
  const [loadingNews, setLoadingNews] = useState(true)
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [newsListOpen, setNewsListOpen] = useState(false)
  const [newsDetail, setNewsDetail] = useState<AnnouncementDetail | null>(null)
  const [loadingNewsDetail, setLoadingNewsDetail] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(languageOptions[0])
  const [timerRegion, setTimerRegion] = useState<TimerRegionOption>(timerRegionOptions[0])
  const [youtubeVideo, setYoutubeVideo] = useState<YouTubeVideo | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(true)
  const [showEmbed, setShowEmbed] = useState(false)
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null)
  const [thumbAttempt, setThumbAttempt] = useState(0)

  const activeCharacter = carouselCharacters.find((character) => character.id === activeCharacterId) ?? carouselCharacters[0]
  const activeIndex = Math.max(0, carouselCharacters.findIndex((character) => character.id === activeCharacter.id))
  const titleParts = splitCharacterName(activeCharacter.name)
  const timerTargets = useMemo(() => getTimerTargets(timerRegion), [timerRegion])
  const isUpcomingStream = !!(youtubeVideo && !youtubeVideo.published)

  useEffect(() => {
    function openPicker() {
      setPickerOpen(true)
    }

    window.addEventListener("slime:openCharacterPicker", openPicker)

    if (new URLSearchParams(window.location.search).get("customize") === "character") {
      setPickerOpen(true)
    }

    return () => window.removeEventListener("slime:openCharacterPicker", openPicker)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCharacters() {
      try {
        const response = await fetch("/api/characters-data", { cache: "force-cache" })
        if (!response.ok) return
        const data = (await response.json()) as ApiCharacter[]
        const mapped = data.map(toHomeCharacter)
        if (cancelled || mapped.length === 0) return

        setAvailableCharacters(mapped)

        const savedId = readSavedCharacterId()
        const savedFavoriteIds = readSavedFavoriteIds()
        const savedFavorites = savedFavoriteIds
          .map((id) => mapped.find((character) => character.id === id))
          .filter((character): character is HomeCharacter => Boolean(character))
          .slice(0, 5)
        if (savedFavorites.length > 0) {
          setCarouselCharacters(savedFavorites)
        }

        const savedCharacter = mapped.find((character) => character.id === savedId)
        if (savedCharacter) {
          applyCharacter(savedCharacter, false)
        }
      } catch {
        // Keep bundled defaults if the static API cannot load.
      }
    }

    loadCharacters()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadAnnouncements() {
      setLoadingNews(true)
      try {
        const response = await fetch(`/api/events?language=${selectedLanguage.language}`, { cache: "no-store" })
        if (!response.ok) return
        const payload = await response.json()
        const list = (payload?.data?.list ?? []) as Announcement[]
        if (cancelled || list.length === 0) return

        setNews(list.map(toNewsItem))
      } catch {
        // Keep bundled fallbacks when the official feed is unavailable.
      } finally {
        if (!cancelled) setLoadingNews(false)
      }
    }

    loadAnnouncements()

    return () => {
      cancelled = true
    }
  }, [selectedLanguage])

  useEffect(() => {
    setYoutubeVideo(defaultYouTubeVideo)
    setLoadingVideo(false)
  }, [])

  useEffect(() => {
    if (!selectedNews) {
      setNewsDetail(null)
      return
    }

    if (selectedNews.id.startsWith("fallback-")) {
      setNewsDetail({
        id: 0,
        title: selectedNews.title,
        content: `<p>${selectedNews.description}</p>`,
      })
      return
    }

    const newsToLoad = selectedNews
    let cancelled = false

    async function loadNewsDetail() {
      setLoadingNewsDetail(true)
      setNewsDetail(null)
      try {
        const response = await fetch(`/api/events/${newsToLoad.id}?language=${selectedLanguage.language}`, {
          cache: "no-store",
        })
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
  }, [selectedLanguage.language, selectedNews])

  useEffect(() => {
    if (!youtubeVideo) return
    setThumbAttempt(0)
    setThumbnailSrc(getYouTubeThumbFallbacks(youtubeVideo.id)[0])
    setShowEmbed(false)
  }, [youtubeVideo])

  function applyCharacter(character: HomeCharacter, persist = true) {
    setCarouselCharacters((current) => {
      const next = [character, ...current.filter((item) => item.id !== character.id)].slice(0, 5)
      if (persist) saveHeroCharacterState(character.id, next.map((item) => item.id))
      return next
    })
    setActiveCharacterId(character.id)
    if (persist) saveHeroCharacterState(character.id)
  }

  function toggleFavoriteCharacter(character: HomeCharacter) {
    setCarouselCharacters((current) => {
      const exists = current.some((item) => item.id === character.id)
      const next = exists
        ? current.filter((item) => item.id !== character.id)
        : [character, ...current.filter((item) => item.id !== character.id)].slice(0, 5)
      const safeNext = next.length > 0 ? next : [character]
      const nextActiveId = safeNext.some((item) => item.id === activeCharacterId) ? activeCharacterId : safeNext[0].id

      saveHeroCharacterState(nextActiveId, safeNext.map((item) => item.id))
      if (nextActiveId !== activeCharacterId) {
        setActiveCharacterId(nextActiveId)
      }

      return safeNext
    })
  }

  function selectCharacter(index: number) {
    const next = carouselCharacters[(index + carouselCharacters.length) % carouselCharacters.length]
    if (!next) return
    setActiveCharacterId(next.id)
    saveHeroCharacterState(next.id)
  }

  function chooseCharacter(character: HomeCharacter) {
    applyCharacter(character)
    setPickerOpen(false)
  }

  function handleThumbError() {
    if (!youtubeVideo) return

    const next = thumbAttempt + 1
    const fallbacks = getYouTubeThumbFallbacks(youtubeVideo.id)
    if (next < fallbacks.length) {
      setThumbAttempt(next)
      setThumbnailSrc(fallbacks[next])
      return
    }

    setThumbnailSrc("/assets/home/frame-wave-bg.png")
  }

  return (
    <main className="poster-home">
      <DecorativeBackground />

      <div className="poster-shell">
        <section className="poster-hero" aria-label="Featured character">
          <div className="poster-copy">
            <p className="poster-eyebrow">Featured Character</p>
            <h1
              className={
                titleParts.first.length > 8 || titleParts.rest.length > 8 || activeCharacter.name.length > 14
                  ? "is-long-name"
                  : undefined
              }
            >
              {titleParts.first}
              <span>{titleParts.rest}</span>
            </h1>
            <p className="poster-description">
              {activeCharacter.affiliation}. Browse stats, skills, traits, and team options for this unit.
            </p>
            <div className="poster-actions">
              <Link href={activeCharacter.href} className="poster-action-dark">
                View Profile
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link href="/characters" className="poster-action-blue">
                Browse Wiki
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <CharacterThumbs characters={carouselCharacters} activeIndex={activeIndex} onSelect={selectCharacter} />
          </div>

          <HeroFrame character={activeCharacter} carouselCharacters={carouselCharacters} />
        </section>

        <section className="poster-midbar poster-shortcuts-row" aria-label="Homepage shortcuts">
          <QuickLinks />
        </section>

        <section className="poster-cards" aria-label="Homepage dashboard">
          <LatestNewsCard
            news={news}
            loading={loadingNews}
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
            onOpenNews={setSelectedNews}
            onOpenAllNews={() => setNewsListOpen(true)}
          />
          <GameTimersCard timerTargets={timerTargets} timerRegion={timerRegion} onTimerRegionChange={setTimerRegion} />
          <UpcomingStreamCard
            video={youtubeVideo}
            loading={loadingVideo}
            showEmbed={showEmbed}
            thumbnailSrc={thumbnailSrc}
            isUpcoming={isUpcomingStream}
            onShowEmbed={() => setShowEmbed(true)}
            onThumbError={handleThumbError}
          />
        </section>
      </div>

      <CharacterPicker
        open={pickerOpen}
        query={pickerQuery}
        characters={availableCharacters}
        favoriteIds={new Set(carouselCharacters.map((character) => character.id))}
        onQueryChange={setPickerQuery}
        onSelect={chooseCharacter}
        onToggleFavorite={toggleFavoriteCharacter}
        onClose={() => setPickerOpen(false)}
      />
      <NewsModal
        news={selectedNews}
        detail={newsDetail}
        loading={loadingNewsDetail}
        onClose={() => setSelectedNews(null)}
      />
      <NewsListModal
        open={newsListOpen}
        selectedLanguage={selectedLanguage}
        onClose={() => setNewsListOpen(false)}
      />
    </main>
  )
}

function DecorativeBackground() {
  return (
    <div className="poster-bg" aria-hidden="true">
      <span className="poster-bg-dots poster-bg-dots-left" />
      <span className="poster-bg-dots poster-bg-dots-right" />
      <span className="poster-bg-tape poster-bg-tape-left">Slime Wiki</span>
      <span className="poster-bg-tape poster-bg-tape-right">Slime Wiki</span>
    </div>
  )
}

function HeroFrame({
  character,
  carouselCharacters,
}: {
  character: HomeCharacter
  carouselCharacters: HomeCharacter[]
}) {
  const frameLabel = character.affiliation || "Featured Unit"
  const [imageFit, setImageFit] = useState<CharacterImageFit>("wide")

  useEffect(() => {
    setImageFit("wide")
  }, [character.image])

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    setImageFit(resolveCharacterImageFit(event.currentTarget))
  }

  function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget
    if (!isBlessCharacterArt(character.thumb) && image.dataset.fallback !== "info") {
      image.dataset.fallback = "info"
      image.src = toCharacterArt(character.thumb, "CharaInfo")
      return
    }

    image.src = character.thumb
  }

  return (
    <div className="poster-frame">
      <div className="poster-frame-stage">
        <span className="poster-frame-label">
          <Compass className="h-5 w-5" />
          {frameLabel}
        </span>
        <span className="poster-frame-jp">{character.name}</span>
        <img
          className="poster-frame-character"
          src={character.image}
          data-fit={imageFit}
          alt=""
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        <span className="poster-frame-bubble poster-frame-bubble-a" />
        <span className="poster-frame-bubble poster-frame-bubble-b" />
        <span className="poster-frame-bubble poster-frame-bubble-c" />
        <div className="poster-frame-dots" aria-hidden="true">
          {carouselCharacters.map((item) => (
            <span key={item.id} className={item.id === character.id ? "is-active" : ""} />
          ))}
        </div>
      </div>
      <div className="poster-frame-border" aria-hidden="true">
        <i className="poster-frame-slice poster-frame-slice-tl" />
        <i className="poster-frame-slice poster-frame-slice-t" />
        <i className="poster-frame-slice poster-frame-slice-tr" />
        <i className="poster-frame-slice poster-frame-slice-l" />
        <i className="poster-frame-slice poster-frame-slice-c" />
        <i className="poster-frame-slice poster-frame-slice-r" />
        <i className="poster-frame-slice poster-frame-slice-bl" />
        <i className="poster-frame-slice poster-frame-slice-b" />
        <i className="poster-frame-slice poster-frame-slice-br" />
      </div>
    </div>
  )
}

function CharacterThumbs({
  characters,
  activeIndex,
  onSelect,
}: {
  characters: HomeCharacter[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <div className="poster-thumb-rail" aria-label="Featured character selector">
      <button type="button" onClick={() => onSelect(activeIndex - 1)} aria-label="Previous character">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="poster-thumbs">
        {characters.map((character, index) => (
          <button
            key={character.id}
            type="button"
            className={activeIndex === index ? "is-active" : ""}
            onClick={() => onSelect(index)}
            aria-label={`Show ${character.name}`}
          >
            <img src={character.thumb} alt="" />
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onSelect(activeIndex + 1)} aria-label="Next character">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}

function QuickLinks() {
  return (
    <nav className="poster-quick-links" aria-label="Quick links">
      {quickLinks.map(({ href, label, detail, icon: Icon }) => (
        <Link href={href} key={label}>
          <Icon className="h-7 w-7" />
          <span>
            <strong>{label}</strong>
            <small>{detail}</small>
          </span>
        </Link>
      ))}
    </nav>
  )
}

function LatestNewsCard({
  news,
  loading,
  selectedLanguage,
  onLanguageChange,
  onOpenNews,
  onOpenAllNews,
}: {
  news: NewsItem[]
  loading: boolean
  selectedLanguage: LanguageOption
  onLanguageChange: (language: LanguageOption) => void
  onOpenNews: (news: NewsItem) => void
  onOpenAllNews: () => void
}) {
  return (
    <section className="poster-card poster-news-card" aria-labelledby="latest-news-heading">
      <div className="poster-card-title">
        <h2 id="latest-news-heading">
          <Newspaper className="h-5 w-5" />
          Latest News
        </h2>
        <div className="poster-card-actions">
          <button type="button" className="poster-card-action-link" onClick={onOpenAllNews}>
            View all
          </button>
          <div className="poster-language-tabs" aria-label="News language">
            {languageOptions.map((language) => (
              <button
                key={language.key}
                type="button"
                className={selectedLanguage.key === language.key ? "is-active" : ""}
                onClick={() => onLanguageChange(language)}
                title={language.label}
              >
                {language.key}
              </button>
            ))}
          </div>
        </div>
      </div>
      {loading ? (
        <div className="poster-card-loading">Loading official news...</div>
      ) : (
        <div className="poster-news-list">
          {news.map((item) => (
            <button
              type="button"
              className="poster-news-item"
              key={`${item.id}-${item.title}`}
              onClick={() => onOpenNews(item)}
            >
              <span className="poster-news-icon" data-type={item.articleType}>
                <Newspaper className="h-5 w-5" />
              </span>
              <span>
                <span className="poster-news-meta">
                  <strong>{item.category}</strong>
                  <b>{item.title}</b>
                </span>
                <small>{item.description}</small>
                <time>{item.date}</time>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function NewsListModal({
  open,
  selectedLanguage,
  onClose,
}: {
  open: boolean
  selectedLanguage: LanguageOption
  onClose: () => void
}) {
  if (!open) return null

  const officialFeedUrl = getOfficialAnnouncementFeedUrl(selectedLanguage.language)

  return (
    <ModalPortal>
      <div className="poster-news-modal" role="dialog" aria-modal="true" aria-label="All official news" onClick={onClose}>
        <article className="poster-news-modal-panel poster-news-list-panel" onClick={(event) => event.stopPropagation()}>
          <header className="poster-news-modal-header">
            <span>
              <small>Official Feed</small>
              <strong>All Latest News</strong>
            </span>
            <button type="button" onClick={onClose} aria-label="Close all news">
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="poster-news-modal-body poster-official-news-body">
            <iframe
              className="poster-official-news-frame"
              src={`/api/recruit-article?src=${encodeURIComponent(officialFeedUrl)}`}
              title="Official latest news"
            />
          </div>
        </article>
      </div>
    </ModalPortal>
  )
}

function GameTimersCard({
  timerTargets,
  timerRegion,
  onTimerRegionChange,
}: {
  timerTargets: TimerTarget[]
  timerRegion: TimerRegionOption
  onTimerRegionChange: (region: TimerRegionOption) => void
}) {
  return (
    <section className="poster-card poster-timers-card" aria-labelledby="game-timers-heading">
      <div className="poster-card-title">
        <h2 id="game-timers-heading">
          <CalendarDays className="h-5 w-5" />
          Game Timers
        </h2>
        <div className="poster-region-tabs" aria-label="Timer region">
          {timerRegionOptions.map((region) => (
            <button
              key={region.key}
              type="button"
              className={timerRegion.key === region.key ? "is-active" : ""}
              onClick={() => onTimerRegionChange(region)}
            >
              {region.label}
            </button>
          ))}
        </div>
      </div>
      <div className="poster-timer-list">
        {timerTargets.map((timer) => (
          <TimerRow key={timer.label} timer={timer} />
        ))}
      </div>
    </section>
  )
}

function TimerRow({ timer }: { timer: TimerTarget }) {
  const countdown = useCountdown(timer.getTarget)
  const Icon = timer.icon

  return (
    <div className="poster-timer-row">
      <Icon className="h-7 w-7" />
      <span>
        <strong>{timer.label}</strong>
        <small>{timer.detail}</small>
      </span>
      <time>{countdown}</time>
    </div>
  )
}

function UpcomingStreamCard({
  video,
  loading,
  showEmbed,
  thumbnailSrc,
  isUpcoming,
  onShowEmbed,
  onThumbError,
}: {
  video: YouTubeVideo | null
  loading: boolean
  showEmbed: boolean
  thumbnailSrc: string | null
  isUpcoming: boolean
  onShowEmbed: () => void
  onThumbError: () => void
}) {
  const thumbnail = thumbnailSrc || video?.thumbnail

  return (
    <section className="poster-card poster-stream-card" aria-labelledby="upcoming-stream-heading">
      <div className="poster-card-title">
        <h2 id="upcoming-stream-heading">
          <Play className="h-5 w-5" />
          Official Stream
        </h2>
        {video && (
          <a href={video.url} target="_blank" rel="noopener noreferrer">
            YouTube
          </a>
        )}
      </div>
      {loading ? (
        <div className="poster-stream-preview poster-stream-loading" />
      ) : video && showEmbed ? (
        <div className="poster-stream-preview poster-stream-embed">
          <iframe
            src={video.embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : video && isUpcoming ? (
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="poster-stream-preview poster-stream-youtube"
          aria-label={`Open ${video.title} on YouTube`}
        >
          <StreamPreviewContent video={video} thumbnail={thumbnail} isUpcoming={isUpcoming} onThumbError={onThumbError} />
        </a>
      ) : video ? (
        <button
          type="button"
          className="poster-stream-preview poster-stream-youtube"
          onClick={onShowEmbed}
          aria-label={`Play ${video.title}`}
        >
          <StreamPreviewContent video={video} thumbnail={thumbnail} isUpcoming={isUpcoming} onThumbError={onThumbError} />
        </button>
      ) : (
        <div className="poster-stream-preview poster-stream-youtube">
          <span className="poster-stream-copy">
            <b>Announcements</b>
            <strong>No Stream Scheduled</strong>
            <small>Watch official notices for the next broadcast.</small>
          </span>
        </div>
      )}
      <div className="poster-stream-dots" aria-hidden="true">
        <span className="is-active" />
        <span />
        <span />
      </div>
    </section>
  )
}

function StreamPreviewContent({
  video,
  thumbnail,
  isUpcoming,
  onThumbError,
}: {
  video: YouTubeVideo
  thumbnail?: string | null
  isUpcoming: boolean
  onThumbError: () => void
}) {
  return (
    <>
      <span className="poster-stream-art" aria-hidden="true">
        {thumbnail && <img src={thumbnail} alt="" onError={onThumbError} />}
      </span>
      <span className="poster-stream-badge">{isUpcoming ? "Upcoming" : "Latest"}</span>
      <span className="poster-stream-play" aria-hidden="true">
        <Play className="h-7 w-7 fill-current" />
      </span>
      <span className="sr-only">{video.title}</span>
    </>
  )
}

function CharacterPicker({
  open,
  query,
  characters,
  favoriteIds,
  onQueryChange,
  onSelect,
  onToggleFavorite,
  onClose,
}: {
  open: boolean
  query: string
  characters: HomeCharacter[]
  favoriteIds: Set<number>
  onQueryChange: (value: string) => void
  onSelect: (character: HomeCharacter) => void
  onToggleFavorite: (character: HomeCharacter) => void
  onClose: () => void
}) {
  const filteredCharacters = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const pool = normalized
      ? characters.filter((character) =>
          `${character.name} ${character.affiliation}`.toLowerCase().includes(normalized),
        )
      : characters

    return pool
  }, [characters, query])

  if (!open) return null

  return (
    <ModalPortal>
      <div className="poster-picker" role="dialog" aria-modal="true" aria-label="Choose homepage character" onClick={onClose}>
        <div className="poster-picker-panel" onClick={(event) => event.stopPropagation()}>
          <div className="poster-picker-header">
            <span>
              <strong>Choose Character</strong>
              <small>Updates the character inside the hero frame.</small>
            </span>
            <button type="button" onClick={onClose} aria-label="Close character picker">
              <X className="h-5 w-5" />
            </button>
          </div>
          <label className="poster-picker-search">
            <Search className="h-4 w-4" />
            <input
              autoFocus
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search name or affiliation..."
            />
          </label>
          <div className="poster-picker-grid">
            {filteredCharacters.map((character) => (
              <div
                key={character.id}
                className={favoriteIds.has(character.id) ? "poster-picker-item is-favorite" : "poster-picker-item"}
              >
                <button type="button" className="poster-picker-select" onClick={() => onSelect(character)}>
                  <img src={character.thumb} alt="" />
                  <span>
                    <strong>{character.name}</strong>
                    <small>{character.affiliation}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="poster-picker-favorite"
                  aria-label={favoriteIds.has(character.id) ? `Remove ${character.name} from carousel` : `Add ${character.name} to carousel`}
                  aria-pressed={favoriteIds.has(character.id)}
                  onClick={() => onToggleFavorite(character)}
                >
                  <Star className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

function NewsModal({
  news,
  detail,
  loading,
  onClose,
}: {
  news: NewsItem | null
  detail: AnnouncementDetail | null
  loading: boolean
  onClose: () => void
}) {
  if (!news) return null

  return (
    <ModalPortal>
      <div className="poster-news-modal" role="dialog" aria-modal="true" aria-label="Official announcement" onClick={onClose}>
        <article className="poster-news-modal-panel" onClick={(event) => event.stopPropagation()}>
          <header className="poster-news-modal-header">
            <span>
              <small>{news.category}</small>
              <strong>{detail?.title || news.title}</strong>
            </span>
            <button type="button" onClick={onClose} aria-label="Close announcement">
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="poster-news-modal-body">
            {loading ? (
              <div className="poster-card-loading">Loading official announcement...</div>
            ) : (
              <div
                className="poster-news-detail"
                dangerouslySetInnerHTML={{ __html: detail?.content || "<p>Announcement content is unavailable.</p>" }}
              />
            )}
          </div>
        </article>
      </div>
    </ModalPortal>
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
