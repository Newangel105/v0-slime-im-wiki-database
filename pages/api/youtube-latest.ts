import type { NextApiRequest, NextApiResponse } from 'next'

// Slime Isekai Memories official channel ID
const CHANNEL_ID = 'UCvZ_bLKvnNLY8n4vUgJhTHA' // Official SLIME ISEKAI Memories channel

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set cache headers - cache for 1 hour
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  
  try {
    // Use YouTube RSS feed as a simple way to get latest videos without API key
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch YouTube feed')
    }
    
    const xmlText = await response.text()
    
    // Parse the XML to extract the latest video
    const videoIdMatch = xmlText.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
    const titleMatch = xmlText.match(/<media:title>([^<]+)<\/media:title>/)
    const publishedMatch = xmlText.match(/<published>([^<]+)<\/published>/)
    
    if (videoIdMatch && videoIdMatch[1]) {
      const videoId = videoIdMatch[1]
      const title = titleMatch ? titleMatch[1] : 'Latest Stream'
      const published = publishedMatch ? publishedMatch[1] : null
      
      res.status(200).json({
        success: true,
        video: {
          id: videoId,
          title: title,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          published: published,
        }
      })
    } else {
      // Fallback to a default video if RSS parsing fails
      res.status(200).json({
        success: false,
        video: {
          id: 'oqj9Ho6QS40',
          title: 'Recent Stream',
          url: 'https://www.youtube.com/watch?v=oqj9Ho6QS40',
          embedUrl: 'https://www.youtube.com/embed/oqj9Ho6QS40',
          thumbnail: 'https://img.youtube.com/vi/oqj9Ho6QS40/hqdefault.jpg',
          published: null,
        }
      })
    }
  } catch (error) {
    console.error('YouTube API Error:', error)
    // Return fallback video on error
    res.status(200).json({
      success: false,
      video: {
        id: 'oqj9Ho6QS40',
        title: 'Recent Stream',
        url: 'https://www.youtube.com/watch?v=oqj9Ho6QS40',
        embedUrl: 'https://www.youtube.com/embed/oqj9Ho6QS40',
        thumbnail: 'https://img.youtube.com/vi/oqj9Ho6QS40/hqdefault.jpg',
        published: null,
      }
    })
  }
}
