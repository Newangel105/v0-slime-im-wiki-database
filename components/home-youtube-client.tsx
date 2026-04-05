"use client"

import React, { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Play, ExternalLink } from "lucide-react"

interface YouTubeVideo {
  id: string
  title: string
  url: string
  embedUrl: string
  thumbnail: string
  published: string | null
}

export default function HomeYouTubeClient() {
  const [youtubeVideo, setYoutubeVideo] = useState<YouTubeVideo | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(true)

  useEffect(() => {
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
              <a href={youtubeVideo.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-cyan-400 transition-colors flex-shrink-0">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
