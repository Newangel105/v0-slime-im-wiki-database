"use client"
import { redirect } from "next/navigation"
import { Bell, Calendar, Gift, Settings, Trophy, Users, Wrench, AlertTriangle, Info } from "lucide-react"

interface NewsItem {
  id: string
  type: "notice" | "event" | "recruit" | "campaign" | "issues" | "update" | "maintenance" | "packs"
  title: string
  date: string
  isNew?: boolean
  priority?: "high" | "medium" | "low"
  tags?: string[]
}

const newsItems: NewsItem[] = [
  {
    id: "1",
    type: "issues",
    title: "Issue Affecting Charm Equipment",
    date: "10/17/2024",
    isNew: true,
    priority: "high",
  },
  {
    id: "2",
    type: "campaign",
    title: "3rd Anniversary Campaign",
    date: "10/17/2024",
    isNew: true,
    priority: "medium",
  },
  {
    id: "3",
    type: "update",
    title: "Ver. 2.1.0 Update",
    date: "10/17/2024",
    isNew: true,
    priority: "medium",
  },
  {
    id: "4",
    type: "notice",
    title: "Discord Member Milestone Campaign!",
    date: "10/17/2024",
    isNew: true,
    priority: "low",
  },
  {
    id: "5",
    type: "issues",
    title: "Issue Causing an Error in Quests",
    date: "10/17/2024",
    isNew: true,
    priority: "high",
    tags: ["1.6.0", "UTC", "10/17", "Update"],
  },
  {
    id: "6",
    type: "update",
    title: "Update Notice",
    date: "10/17/2024",
    isNew: true,
    priority: "medium",
    tags: ["5:00", "UTC", "10/17", "Update", "Important", "10/16"],
  },
]

const filterTypes = [
  { key: "all", label: "All", icon: null },
  { key: "notice", label: "Notice", icon: Bell },
  { key: "event", label: "Event", icon: Calendar },
  { key: "recruit", label: "Recruit", icon: Users },
  { key: "campaign", label: "Campaign", icon: Trophy },
  { key: "issues", label: "Issues", icon: AlertTriangle },
  { key: "update", label: "Update", icon: Settings },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
  { key: "packs", label: "Packs", icon: Gift },
]

const getTypeIcon = (type: string) => {
  switch (type) {
    case "notice":
      return Bell
    case "event":
      return Calendar
    case "recruit":
      return Users
    case "campaign":
      return Trophy
    case "issues":
      return AlertTriangle
    case "update":
      return Settings
    case "maintenance":
      return Wrench
    case "packs":
      return Gift
    default:
      return Info
  }
}

const getTypeColor = (type: string) => {
  switch (type) {
    case "issues":
      return "bg-red-600"
    case "campaign":
      return "bg-yellow-600"
    case "update":
      return "bg-blue-600"
    case "notice":
      return "bg-green-600"
    case "event":
      return "bg-purple-600"
    case "recruit":
      return "bg-orange-600"
    case "maintenance":
      return "bg-gray-600"
    case "packs":
      return "bg-pink-600"
    default:
      return "bg-gray-600"
  }
}

export default function HomePage() {
  redirect("/characters")
}

// export default function GameDatabase() {
//   const [selectedFilter, setSelectedFilter] = useState("all")
//   const [selectedRegion, setSelectedRegion] = useState("NA")
//   const [resetTime, setResetTime] = useState({ hours: 18, minutes: 15, seconds: 22 })
//   const [updateTime, setUpdateTime] = useState({ hours: 9, minutes: 15, seconds: 22 })
//
//   useEffect(() => {
//     const timer = setInterval(() => {
//       setResetTime((prev) => {
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
