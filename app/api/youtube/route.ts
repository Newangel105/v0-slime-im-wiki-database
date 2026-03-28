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

  // Try multiple CORS proxies
  const corsProxies = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ]

  for (let i = 0; i < corsProxies.length; i++) {
    const proxyFn = corsProxies[i]
    try {
      const proxyUrl = proxyFn(rssUrl)
      console.log(`[v0] YouTube: Trying proxy ${i + 1}`)
      const response = await fetch(proxyUrl)

      console.log(`[v0] YouTube: Proxy ${i + 1} status: ${response.status}`)

      if (!response.ok) {
        continue
      }

      const xmlText = await response.text()
      console.log(`[v0] YouTube: Response length: ${xmlText.length}, starts with: ${xmlText.substring(0, 50)}`)
      
      // Check if we got XML
      if (!xmlText.includes('<feed') && !xmlText.includes('<entry')) {
        console.log(`[v0] YouTube: Proxy ${i + 1} returned non-XML`)
        continue
      }

      // Parse the XML manually to extract the latest video
      const videoIdMatch = xmlText.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
      const titleMatch = xmlText.match(/<entry[^>]*>[\s\S]*?<title>([^<]+)<\/title>/)
      const publishedMatch = xmlText.match(/<entry[^>]*>[\s\S]*?<published>([^<]+)<\/published>/)

      if (videoIdMatch) {
        const videoId = videoIdMatch[1]
        const title = titleMatch ? titleMatch[1] : 'Latest Stream'
        const published = publishedMatch ? publishedMatch[1] : null

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
    } catch {
      continue
    }
  }

  // Return fallback video if all attempts fail
  return NextResponse.json({ video: fallbackVideo })
}
