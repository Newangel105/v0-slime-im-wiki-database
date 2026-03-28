"use client"
import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Play, ExternalLink } from "lucide-react"

function getNextUtcTime(hour: number, minute = 0, second = 0) {
  const now = new Date()
  const next = new Date(now)
  next.setUTCHours(hour, minute, second, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next
}

function formatLocalTime(date: Date) {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
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

export default function HomePage() {
  // Hydration fix: only show timers after mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Timer region selection (NA, EU, Asia)
  const timerRegionOptions = [
    { key: "NA", label: "NA", reset: { hour: 11, minute: 0 }, update: { hour: 2, minute: 0 } },
    { key: "EU", label: "EU", reset: { hour: 4, minute: 0 }, update: { hour: 2, minute: 0 } },
    { key: "Asia", label: "Asia", reset: { hour: 19, minute: 0 }, update: { hour: 2, minute: 0 } },
  ]
  
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

  // News state and region/language selection
  const regionOptions = [
    { key: "NA", region: 3, language: 2, label: "NA" },
    { key: "EU", region: 4, language: 2, label: "EU" },
    { key: "Asia", region: 2, language: 2, label: "Asia" },
    { key: "Japan", region: 1, language: 1, label: "Japan" },
  ]
  const [selectedRegion, setSelectedRegion] = useState(regionOptions[0])
  const [loadingNews, setLoadingNews] = useState(true)

  // Generate the official news URL for embedding
  const getNewsUrl = () => {
    const regionDomains: Record<number, string> = {
      1: 'jp.ten-sura-m.wfs.games',
      2: 'ap.ten-sura-m.wfs.games',
      3: 'us.ten-sura-m.wfs.games',
      4: 'eu.ten-sura-m.wfs.games',
    }
    const domain = regionDomains[selectedRegion.region] || 'us.ten-sura-m.wfs.games'
    return `https://${domain}/announcement?region=${selectedRegion.region}&language=${selectedRegion.language}`
  }

  useEffect(() => {
    // News is loaded via iframe, so we just set loading to false
    setLoadingNews(false)
  }, [selectedRegion])

  // YouTube video state - automatically fetched from RSS feed
  const [youtubeVideo, setYoutubeVideo] = useState<YouTubeVideo | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(true)

  useEffect(() => {
    // Use a default video since YouTube RSS requires server-side fetch
    // The video ID can be updated manually or via a CMS in the future
    const defaultVideo: YouTubeVideo = {
      id: 'oqj9Ho6QS40',
      title: 'SLIME - ISEKAI Memories Official Stream',
      url: 'https://www.youtube.com/watch?v=oqj9Ho6QS40',
      embedUrl: 'https://www.youtube.com/embed/oqj9Ho6QS40',
      thumbnail: 'https://img.youtube.com/vi/oqj9Ho6QS40/hqdefault.jpg',
      published: null,
    }
    setYoutubeVideo(defaultVideo)
    setLoadingVideo(false)
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0a1a2f] via-[#0f1f35] to-[#1a2740]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* About Section */}
        <section className="mb-8">
          <Card className="bg-[#181f2a]/80 border border-gray-700/50 backdrop-blur-sm overflow-hidden">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="h-1 w-8 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"></span>
                ABOUT
              </h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                Welcome to <span className="text-cyan-400 font-semibold">SLIME.WIKI</span> - The comprehensive database for 
                <span className="text-blue-400 font-medium"> SLIME - Isekai Memories</span>, the official That Time I Got Reincarnated as a Slime 
                mobile game developed by WFS and published by Bandai Namco Entertainment.
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-4 border-t border-gray-700/50">
                <span>Database maintained by the community</span>
                <span className="text-gray-600">|</span>
                <span>All game assets and content are property of WFS and Bandai Namco Entertainment</span>
                <span className="text-gray-600">|</span>
                <span>This is an unofficial fan-made resource</span>
              </div>
            </div>
          </Card>
        </section>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Timers Section - Left Column */}
          <section className="lg:col-span-2">
            <Card className="bg-[#181f2a]/80 border border-gray-700/50 backdrop-blur-sm h-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="h-1 w-6 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"></span>
                    TIMERS
                  </h2>
                  <div className="flex gap-2">
                    {timerRegionOptions.map((opt) => (
                      <button
                        key={opt.key}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                          timerRegion.key === opt.key 
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25' 
                            : 'bg-[#232c3a] text-gray-400 hover:text-white hover:bg-[#2a3444]'
                        }`}
                        onClick={() => setTimerRegion(opt)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-[#232c3a] to-[#1a222d] rounded-xl p-5 border border-gray-700/30">
                    <span className="text-gray-400 text-sm font-medium mb-1 block">Daily Reset</span>
                    <span className="text-gray-500 text-xs mb-3 block">{mounted ? resetLocal : "--"}</span>
                    <span className="text-4xl font-mono font-bold text-white tracking-wider">{mounted ? resetCountdown : "--:--:--"}</span>
                  </div>
                  <div className="bg-gradient-to-br from-[#232c3a] to-[#1a222d] rounded-xl p-5 border border-gray-700/30">
                    <span className="text-gray-400 text-sm font-medium mb-1 block">Weekly Update</span>
                    <span className="text-gray-500 text-xs mb-3 block">{mounted ? updateLocal : "--"}</span>
                    <span className="text-4xl font-mono font-bold text-white tracking-wider">{mounted ? updateCountdown : "--:--:--"}</span>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* Latest Stream Section - Right Column */}
          <section className="lg:col-span-1">
            <Card className="bg-[#181f2a]/80 border border-gray-700/50 backdrop-blur-sm h-full">
              <div className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5 text-red-500" />
                  LATEST STREAM
                </h2>
                {loadingVideo ? (
                  <div className="aspect-video bg-[#232c3a] rounded-xl animate-pulse flex items-center justify-center">
                    <span className="text-gray-500">Loading...</span>
                  </div>
                ) : youtubeVideo ? (
                  <div className="space-y-3">
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-700/30">
                      <iframe
                        src={youtubeVideo.embedUrl}
                        title={youtubeVideo.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-300 line-clamp-2 flex-1">{youtubeVideo.title}</p>
                      <a 
                        href={youtubeVideo.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-cyan-400 transition-colors flex-shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          </section>
        </div>

        {/* News Section - Full Width */}
        <section>
          <Card className="bg-[#181f2a]/80 border border-gray-700/50 backdrop-blur-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="h-1 w-6 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"></span>
                  LATEST NEWS
                </h2>
                <div className="flex gap-2">
                  {regionOptions.map((opt) => (
                    <button
                      key={opt.key}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                        selectedRegion.key === opt.key 
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25' 
                          : 'bg-[#232c3a] text-gray-400 hover:text-white hover:bg-[#2a3444]'
                      }`}
                      onClick={() => setSelectedRegion(opt)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Embedded News via iframe */}
              <div className="relative rounded-xl overflow-hidden border border-gray-700/30 bg-white">
                {loadingNews ? (
                  <div className="h-96 bg-[#232c3a] animate-pulse flex items-center justify-center">
                    <span className="text-gray-500">Loading news...</span>
                  </div>
                ) : (
                  <>
                    <iframe
                      src={getNewsUrl()}
                      title="Game News"
                      className="w-full h-[500px] border-0"
                      sandbox="allow-scripts allow-same-origin"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#181f2a] via-[#181f2a]/90 to-transparent p-4 pt-8">
                      <a
                        href={getNewsUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-full text-sm font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Full News on Official Site
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-gray-700/30 text-center">
          <p className="text-gray-500 text-sm">
            SLIME.WIKI is a fan-made database. All rights reserved to WFS and Bandai Namco Entertainment.
          </p>
          <p className="text-gray-600 text-xs mt-2">
            That Time I Got Reincarnated as a Slime is a trademark of the respective owners.
          </p>
        </footer>
      </div>
    </main>
  )
}
