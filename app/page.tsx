"use client"
import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { AlertTriangle, Info, Calendar } from "lucide-react"


function getNextUtcTime(hour, minute = 0, second = 0) {
  const now = new Date()
  const next = new Date(now)
  next.setUTCHours(hour, minute, second, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next
}

function formatLocalTime(date) {
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

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState(() => targetDate - new Date())
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(targetDate - new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate])
  const totalSeconds = Math.max(0, Math.floor(timeLeft / 1000))
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
  const seconds = String(totalSeconds % 60).padStart(2, "0")
  return `${hours}:${minutes}:${seconds}`
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
  // Default to NA
  const [timerRegion, setTimerRegion] = useState(timerRegionOptions[0])
  // When timerRegion changes, update targets
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
  const [news, setNews] = useState([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [newsError, setNewsError] = useState(null)

  useEffect(() => {
    setLoadingNews(true)
    setNewsError(null)
    fetch(`/api/news?region=${selectedRegion.region}&language=${selectedRegion.language}`)
      .then((res) => res.json())
      .then((data) => {
        setNews(data?.data?.list || [])
        setLoadingNews(false)
      })
      .catch((err) => {
        setNewsError("Failed to load news")
        setLoadingNews(false)
      })
  }, [selectedRegion])

  // Livestream link (static for now)
  const livestreamUrl = "https://www.youtube.com/watch?v=oqj9Ho6QS40"

  return (
    <main className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-[#0a1a2f] to-[#1a2740] p-4">
      <section className="w-full max-w-4xl bg-[#181f2a] rounded-lg border border-gray-700 p-4 mb-6">
        <h2 className="text-2xl font-bold text-center text-white mb-2">ABOUT</h2>
        <p className="text-center text-gray-300 text-sm">This is a Database for SLIME - Isekai Memories, the That Time I Got Reincarnated as a Slime mobile game developed by WFS and published by Bandai Namco Entertainment.</p>
      </section>
      <section className="w-full max-w-4xl mb-6">
        <div className="flex flex-row gap-2 mb-2 justify-center">
          {timerRegionOptions.map((opt) => (
            <button
              key={opt.key}
              className={`px-3 py-1 rounded text-white text-xs ${timerRegion.key === opt.key ? 'bg-blue-600' : 'bg-[#232c3a]'}`}
              onClick={() => setTimerRegion(opt)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-[#181f2a] border border-gray-700 p-4 flex flex-col items-center">
            <span className="text-gray-400 text-xs mb-1">Reset</span>
            <span className="text-white text-xs mb-1">{mounted ? resetLocal : "--"}</span>
            <span className="text-3xl font-mono text-white">{mounted ? resetCountdown : "--:--:--"}</span>
          </Card>
          <Card className="bg-[#181f2a] border border-gray-700 p-4 flex flex-col items-center">
            <span className="text-gray-400 text-xs mb-1">Update</span>
            <span className="text-white text-xs mb-1">{mounted ? updateLocal : "--"}</span>
            <span className="text-3xl font-mono text-white">{mounted ? updateCountdown : "--:--:--"}</span>
          </Card>
        </div>
      </section>
      <section className="w-full max-w-4xl bg-[#181f2a] rounded-lg border border-gray-700 p-4 mb-6">
        <div className="flex flex-row gap-2 mb-2">
          {regionOptions.map((opt) => (
            <button
              key={opt.key}
              className={`px-3 py-1 rounded text-white text-xs ${selectedRegion.key === opt.key ? 'bg-blue-600' : 'bg-[#232c3a]'}`}
              onClick={() => setSelectedRegion(opt)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {loadingNews ? (
            <Card className="bg-[#232c3a] border border-gray-700 p-3 text-center text-gray-400">Loading news...</Card>
          ) : newsError ? (
            <Card className="bg-[#232c3a] border border-gray-700 p-3 text-center text-red-400">{newsError}</Card>
          ) : news.length === 0 ? (
            <Card className="bg-[#232c3a] border border-gray-700 p-3 text-center text-gray-400">No news found.</Card>
          ) : (
            news.slice(0, 3).map((item) => (
              <Card key={item.id} className="bg-[#232c3a] border border-gray-700 p-3">
                <div className="flex flex-row items-center gap-2 mb-1">
                  {item.category === "Maintenance" ? (
                    <AlertTriangle className="text-yellow-400 w-4 h-4" />
                  ) : item.category === "Recruit" ? (
                    <Info className="text-cyan-400 w-4 h-4" />
                  ) : item.category === "Campaign" ? (
                    <Calendar className="text-green-400 w-4 h-4" />
                  ) : (
                    <Info className="text-gray-400 w-4 h-4" />
                  )}
                  <span className="text-white font-semibold text-sm">{item.category}{item.isNew && <span className="text-green-400 ml-1">NEW</span>}</span>
                </div>
                <div className="text-gray-300 text-xs">{item.title}<br />{item.endDate && <span>Ends: {item.endDate}</span>}</div>
              </Card>
            ))
          )}
        </div>
      </section>
      <section className="w-full max-w-4xl bg-[#181f2a] rounded-lg border border-gray-700 p-4 flex justify-center">
        <iframe
          width="360"
          height="202"
          src="https://www.youtube.com/embed/oqj9Ho6QS40"
          title="Recent Livestream"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="rounded-lg border border-gray-700 w-full max-w-xs object-cover"
        />
      </section>
    </main>
  )
}
//         let newHours = prev.hours
//
//         if (newSeconds < 0) {
//           newSeconds = 59
//           newMinutes -= 1
//         }
//         if (newMinutes < 0) {
//           newMinutes = 59
//           newHours -= 1
//         }
//         if (newHours < 0) {
//           newHours = 23
//         }
//
//         return { hours: newHours, minutes: newMinutes, seconds: newSeconds }
//       })
//
//       setUpdateTime((prev) => {
//         let newSeconds = prev.seconds - 1
//         let newMinutes = prev.minutes
//         let newHours = prev.hours
//
//         if (newSeconds < 0) {
//           newSeconds = 59
//           newMinutes -= 1
//         }
//         if (newMinutes < 0) {
//           newMinutes = 59
//           newHours -= 1
//         }
//         if (newHours < 0) {
//           newHours = 23
//         }
//
//         return { hours: newHours, minutes: newMinutes, seconds: newSeconds }
//       })
//     }, 1000)
//
//     return () => clearInterval(timer)
//   }, [])
//
//   const filteredNews = selectedFilter === "all" ? newsItems : newsItems.filter((item) => item.type === selectedFilter)
//
//   const formatTime = (time: { hours: number; minutes: number; seconds: number }) => {
//     return `${time.hours.toString().padStart(2, "0")}:${time.minutes.toString().padStart(2, "0")}:${time.seconds.toString().padStart(2, "0")}`
//   }
//
//   return (
//     <div className="min-h-screen bg-gray-900 text-white">
//       {/* Header */}
//       <header className="bg-gray-800 border-b border-gray-700">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="flex items-center justify-between h-16">
//             <div className="flex items-center space-x-8">
//               <div className="flex items-center space-x-2">
//                 <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
//                   <Gamepad2 className="w-5 h-5" />
//                 </div>
//                 <span className="text-xl font-bold">GAME.WIKI</span>
//               </div>
//               <nav className="hidden md:flex space-x-6">
//                 <a href="#" className="text-gray-300 hover:text-white transition-colors">
//                   Characters
//                 </a>
//                 <a href="#" className="text-gray-300 hover:text-white transition-colors">
//                   Forces
//                 </a>
//                 <a href="#" className="text-gray-300 hover:text-white transition-colors">
//                   Events
//                 </a>
//               </nav>
//             </div>
//           </div>
//         </div>
//       </header>
//
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         {/* About Section */}
//         <Card className="bg-gray-800 border-gray-700 mb-8">
//           <CardContent className="p-6">
//             <h2 className="text-lg font-semibold mb-4 text-gray-300">ABOUT</h2>
//             <p className="text-gray-400 mb-4">
//               GAME.WIKI is a Database for GAME - Isekai Memories, the That Time I Got Reincarnated as a Slime mobile
//               game developed by WFS and published by Bandai Namco Entertainment.
//             </p>
//             <div className="bg-red-600 text-white p-3 rounded">
//               This website is only getting automatic updates until I get the slimeim.wiki domain back, if ever.
//             </div>
//           </CardContent>
//         </Card>
//
//         {/* Timers Section */}
//         <Card className="bg-gray-800 border-gray-700 mb-8">
//           <CardContent className="p-6">
//             <h2 className="text-lg font-semibold mb-4 text-gray-300">TIMERS</h2>
//             <div className="flex space-x-2 mb-6">
//               {["NA", "EU", "Asia"].map((region) => (
//                 <Button
//                   key={region}
//                   variant={selectedRegion === region ? "default" : "outline"}
//                   size="sm"
//                   onClick={() => setSelectedRegion(region)}
//                   className={selectedRegion === region ? "bg-gray-600" : "border-gray-600 text-gray-300"}
//                 >
//                   {region}
//                 </Button>
//               ))}
//             </div>
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
//               <div className="text-center">
//                 <h3 className="text-gray-400 mb-2">Reset</h3>
//                 <p className="text-xs text-gray-500 mb-2">Sun Jun 01 2025 1:00:00</p>
//                 <div className="text-4xl font-mono font-bold">{formatTime(resetTime)}</div>
//               </div>
//               <div className="text-center">
//                 <h3 className="text-gray-400 mb-2">Update</h3>
//                 <p className="text-xs text-gray-500 mb-2">Sun Jun 01 2025 02:00:00</p>
//                 <div className="text-4xl font-mono font-bold">{formatTime(updateTime)}</div>
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//
//         {/* Latest Section */}
//         <Card className="bg-gray-800 border-gray-700">
//           <CardContent className="p-6">
//             <h2 className="text-lg font-semibold mb-6 text-gray-300">LATEST</h2>
//             <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
//               {/* Filter Sidebar */}
//               <div className="lg:col-span-1">
//                 <div className="space-y-2">
//                   {filterTypes.map((filter) => {
//                     const Icon = filter.icon
//                     return (
//                       <button
//                         key={filter.key}
//                         onClick={() => setSelectedFilter(filter.key)}
//                         className={`w-full flex items-center space-x-3 px-3 py-2 rounded text-left transition-colors ${
//                           selectedFilter === filter.key
//                             ? "bg-gray-700 text-white"
//                             : "text-gray-400 hover:text-white hover:bg-gray-700"
//                         }`}
//                       >
//                         {Icon && <Icon className="w-4 h-4" />}
//                         <span>{filter.label}</span>
//                       </button>
//                     )
//                   })}
//                 </div>
//               </div>
//
//               {/* News Items */}
//               <div className="lg:col-span-3">
//                 <div className="space-y-4">
//                   {filteredNews.map((item) => {
//                     const TypeIcon = getTypeIcon(item.type)
//                     return (
//                       <div key={item.id} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors">
//                         <div className="flex items-start justify-between">
//                           <div className="flex-1">
//                             <div className="flex items-center space-x-2 mb-2">
//                               {item.isNew && <Badge className="bg-yellow-600 text-black text-xs px-2 py-1">NEW</Badge>}
//                               <div
//                                 className={`w-6 h-6 rounded flex items-center justify-center ${getTypeColor(item.type)}`}
//                               >
//                                 <TypeIcon className="w-3 h-3" />
//                               </div>
//                               <span className="text-xs text-gray-400 capitalize">{item.type}</span>
//                             </div>
//                             <h3 className="text-white font-medium mb-2">{item.title}</h3>
//                             {item.tags && (
//                               <div className="flex flex-wrap gap-1 mb-2">
//                                 {item.tags.map((tag, index) => (
//                                   <Badge
//                                     key={index}
//                                     variant="outline"
//                                     className="text-xs border-gray-600 text-gray-300"
//                                   >
//                                     {tag}
//                                   </Badge>
//                                 ))}
//                               </div>
//                             )}
//                           </div>
//                           <div className="text-xs text-gray-400 ml-4">{item.date}</div>
//                         </div>
//                       </div>
//                     )
//                   })}
//                 </div>
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//
//         {/* Recent Livestream Section */}
//         <Card className="bg-gray-800 border-gray-700 mt-8">
//           <CardContent className="p-6">
//             <h2 className="text-lg font-semibold mb-4 text-gray-300">RECENT LIVESTREAM</h2>
//             <div className="text-gray-400 text-center py-8">No recent livestream data available</div>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   )
// }
