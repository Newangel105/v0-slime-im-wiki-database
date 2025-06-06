"use client"
import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Gamepad2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"

interface ParsedAnnouncement {
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

interface EventDetail {
  id: number
  title: string
  content: string
}

interface ApiResponse {
  code: number
  message: string
  data: {
    list: ParsedAnnouncement[]
    tabs: { [key: string]: string }
  }
}

interface DetailResponse {
  code: number
  message: string
  data: EventDetail
}

const getCategoryConfig = (headerClass: string, articleType: string) => {
  let bgImage = ""

  if (headerClass.includes("is-yellow")) {
    bgImage = "/events/category-bg_yellow.png"
  } else if (headerClass.includes("is-red")) {
    bgImage = "/events/category-bg_red.png"
  } else if (headerClass.includes("is-green")) {
    bgImage = "/events/category-bg_green.png"
  } else if (headerClass.includes("is-pink") || headerClass.includes("is-magenta")) {
    bgImage = "/events/category-bg_magenta.png"
  } else if (headerClass.includes("is-purple")) {
    bgImage = "/events/category-bg_purple.png"
  } else if (headerClass.includes("is-gray")) {
    bgImage = "/events/category-bg_gray.png"
  } else if (headerClass.includes("is-blue")) {
    bgImage = "/events/category-bg_blue.png"
  }

  return { bgImage }
}

export default function EventsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("Notice")
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [events, setEvents] = useState<ParsedAnnouncement[]>([])
  const [tabs, setTabs] = useState<{ [key: string]: string }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [eventDetails, setEventDetails] = useState<Record<string, EventDetail>>({})
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/events")

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: ApiResponse = await response.json()

        if (data.code === 200 && data.data?.list) {
          setEvents(data.data.list)
          setTabs(data.data.tabs || {})
          // Set default category to first available tab
          const firstTab = Object.values(data.data.tabs || {})[0]
          if (firstTab) {
            setSelectedCategory(firstTab)
          }
        } else {
          throw new Error(data.message || "Failed to fetch events")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch events")
        console.error("Error fetching events:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const fetchEventDetails = async (eventId: string) => {
    if (eventDetails[eventId]) return

    setLoadingDetails((prev) => ({ ...prev, [eventId]: true }))

    try {
      const response = await fetch(`/api/events/${eventId}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: DetailResponse = await response.json()
      if (data.code === 200 && data.data) {
        setEventDetails((prev) => ({ ...prev, [eventId]: data.data }))
      }
    } catch (err) {
      console.error("Error fetching event details:", err)
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [eventId]: false }))
    }
  }

  const handleEventClick = async (eventId: string) => {
    if (expandedEvent === eventId) {
      setExpandedEvent(null)
    } else {
      setExpandedEvent(eventId)
      await fetchEventDetails(eventId)
    }
  }

  // Get available filter tabs based on current category
  const availableFilters = useMemo(() => {
    const categoryEvents = events.filter((event) => event.tabCategory === selectedCategory)
    const articleTypes = [...new Set(categoryEvents.map((event) => event.articleType))]

    const baseFilters = [{ key: "all", name: "All" }]
    const typeFilters = articleTypes.map((type) => ({
      key: type,
      name: type.charAt(0).toUpperCase() + type.slice(1),
    }))

    return [...baseFilters, ...typeFilters]
  }, [events, selectedCategory])

  const filteredEvents = useMemo(() => {
    let filtered = events

    // Apply tab category filter
    filtered = filtered.filter((event) => event.tabCategory === selectedCategory)

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.category.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Apply type filter
    if (selectedFilter !== "all") {
      filtered = filtered.filter((event) => event.articleType === selectedFilter)
    }

    return filtered
  }, [events, searchTerm, selectedCategory, selectedFilter])

  const { ongoingEvents, endedEvents } = useMemo(() => {
    const ongoing: ParsedAnnouncement[] = []
    const ended: ParsedAnnouncement[] = []

    filteredEvents.forEach((event) => {
      // If there's an end date, consider it ongoing, otherwise put in ended
      if (event.endDate && event.endDate.includes("Ends:")) {
        ongoing.push(event)
      } else {
        ended.push(event)
      }
    })

    return { ongoingEvents: ongoing, endedEvents: ended }
  }, [filteredEvents])

  const EventItem = ({ event }: { event: ParsedAnnouncement }) => {
    const config = getCategoryConfig(event.headerClass, event.articleType)
    const isExpanded = expandedEvent === event.id
    const details = eventDetails[event.id]
    const isLoadingDetails = loadingDetails[event.id]

    return (
      <div className="mb-4">
        {/* Event Header */}
        <div
            onClick={() => handleEventClick(event.id)}
            className="border-l-4 cursor-pointer hover:opacity-90 transition-opacity bg-cover bg-center"
            style={{
                backgroundImage: `url(${config.bgImage})`
            }}
        >
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3">
              {/* Icon placeholder */}
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded flex items-center justify-center">
                <img
                  src={`/events/icon_${event.articleType}.png`}
                  alt={event.category}
                  className="w-6 h-6"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-white font-bold text-lg">{event.category}</span>
                {event.isNew && (
                  <span className="px-2 py-1 bg-yellow-400 text-black text-sm font-bold rounded">NEW</span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {event.endDate && <span className="text-white text-sm">{event.endDate}</span>}
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-white" />
              ) : (
                <ChevronDown className="w-5 h-5 text-white" />
              )}
            </div>
          </div>
        </div>

        {/* Event Title */}
        <div className="bg-gray-700 p-4 border-l-4 border-gray-600">
          <h3 className="text-white font-medium text-lg">{event.title}</h3>
        </div>

        {/* Event Details (Expandable) */}
        {isExpanded && (
          <div className="bg-gray-900 border-l-4 border-gray-600">
            {isLoadingDetails ? (
              <div className="p-6 text-center">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
                <p className="text-gray-400">Loading event details...</p>
              </div>
            ) : details ? (
              <div className="p-6">
                <div
                  className="text-gray-300 prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: details.content }}
                />
                <div className="mt-4 pt-4 border-t border-gray-700 text-sm text-gray-400">
                  <p>
                    <strong>Tab:</strong> {event.tabCategory}
                  </p>
                  <p>
                    <strong>Type:</strong> {event.articleType}
                  </p>
                  <p>
                    <strong>Link:</strong>{" "}
                    <a
                      href={`https://api.ten-sura-m.wfs.games${event.href}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      View Original
                    </a>
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-gray-400">Failed to load event details</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <div className="flex items-center space-x-2">
                  <img
                    src="/icons/logo.png"
                    alt="Logo"
                    className="w-[77px] h-[67px] object-contain"
                 />
                  <span className="text-xl font-bold">SLIME.WIKI</span>
                </div>
                <nav className="hidden md:flex space-x-6">
                  <Link href="/characters" className="text-gray-300 hover:text-white transition-colors">
                    Characters
                  </Link>
                  <Link href="/forces" className="text-gray-300 hover:text-white transition-colors">
                    Forces
                  </Link>
                  <a href="#" className="text-white font-medium">
                    Events
                  </a>
                </nav>
              </div>
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-400">Loading events...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <span className="text-xl font-bold">SLIME.WIKI</span>
                </div>
                <nav className="hidden md:flex space-x-6">
                  <Link href="/characters" className="text-gray-300 hover:text-white transition-colors">
                    Characters
                  </Link>
                  <Link href="/forces" className="text-gray-300 hover:text-white transition-colors">
                    Forces
                  </Link>
                  <a href="#" className="text-white font-medium">
                    Events
                  </a>
                </nav>
              </div>
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <p className="text-red-400 mb-2">Failed to load events</p>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <span className="text-xl font-bold">SLIME.WIKI</span>
              </div>
              <nav className="hidden md:flex space-x-6">
                <Link href="/characters" className="text-gray-300 hover:text-white transition-colors">
                  Characters
                </Link>
                <Link href="/forces" className="text-gray-300 hover:text-white transition-colors">
                  Forces
                </Link>
                <a href="#" className="text-white font-medium">
                  Events
                </a>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-300 uppercase tracking-wider">EVENTS</h1>
        </div>

        {/* Category Tabs - Dynamic from scraped data */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-2">
            {Object.values(tabs).map((tabName) => (
              <button
                key={tabName}
                onClick={() => setSelectedCategory(tabName)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  selectedCategory === tabName
                    ? "bg-gray-700 text-white border-2 border-gray-500"
                    : "bg-gray-800 text-gray-300 border-2 border-gray-600 hover:bg-gray-700"
                }`}
                style={{
                  clipPath: "polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)",
                }}
              >
                {tabName}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-300 uppercase tracking-wider">FILTERS</h2>

            {/* Search */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            {/* Filter Tabs - Dynamic based on current category */}
            <div className="flex flex-wrap gap-2">
              {availableFilters.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedFilter(tab.key)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedFilter === tab.key
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  <span className="text-sm font-medium">{tab.name}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Ongoing Events */}
        {ongoingEvents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-300 uppercase tracking-wider mb-4">ONGOING</h2>
            {ongoingEvents.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
          </div>
        )}

        {/* Ended Events */}
        {endedEvents.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-300 uppercase tracking-wider mb-4">ENDED</h2>
            {endedEvents.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
          </div>
        )}

        {/* No Events Found */}
        {ongoingEvents.length === 0 && endedEvents.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p>No events found matching the current filters.</p>
          </div>
        )}
      </div>
    </div>
  )
}
