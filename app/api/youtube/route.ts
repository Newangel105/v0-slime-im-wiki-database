import { NextResponse } from 'next/server'

export async function GET() {
  // SLIME ISEKAI Memories official channel ID
  const channelId = 'UCX1rRt5xZ5v8T2RUq7Y_lBQ'
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

  // Default fallback video
  const fallbackVideo = {
    id: 'oqj9Ho6QS40',
    title: 'SLIME - ISEKAI Memories',
    url: 'https://www.youtube.com/watch?v=oqj9Ho6QS40',
    embedUrl: 'https://www.youtube.com/embed/oqj9Ho6QS40',
    thumbnail: 'https://img.youtube.com/vi/oqj9Ho6QS40/hqdefault.jpg',
    published: null,
  }

  try {
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!response.ok) {
      console.error(`[v0] YouTube RSS fetch failed: ${response.status}`)
      return NextResponse.json({ video: fallbackVideo })
    }

    const xmlText = await response.text()

    // Parse video ID from XML using regex (more reliable than DOM parsing on server)
    const videoIdMatch = xmlText.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
    const titleMatch = xmlText.match(/<entry>[\s\S]*?<title>([^<]+)<\/title>/)
    const publishedMatch = xmlText.match(/<entry>[\s\S]*?<published>([^<]+)<\/published>/)

    if (videoIdMatch && videoIdMatch[1]) {
      const videoId = videoIdMatch[1]
      const title = titleMatch?.[1] || 'Latest Video'
      const published = publishedMatch?.[1] || null

      return NextResponse.json({
        video: {
          id: videoId,
          title,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          published,
        }
      })
    }

    return NextResponse.json({ video: fallbackVideo })
  } catch (error) {
    console.error('[v0] YouTube API Error:', error)
    return NextResponse.json({ video: fallbackVideo })
  }
}
