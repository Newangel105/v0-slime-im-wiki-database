import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { region = '3', language = '2' } = req.query
  
  // Map region to the correct API domain
  const regionDomains: Record<string, string> = {
    '1': 'api-jp.ten-sura-m.wfs.games',   // Japan
    '2': 'api-ap.ten-sura-m.wfs.games',   // Asia
    '3': 'api-us.ten-sura-m.wfs.games',   // NA
    '4': 'api-eu.ten-sura-m.wfs.games',   // EU
  }
  
  const domain = regionDomains[region as string] || 'api-us.ten-sura-m.wfs.games'
  const apiUrl = `https://${domain}/web/announcement?region=${region}&language=${language}`
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`)
    }
    
    const data = await response.json()
    
    // Handle different response structures
    const list = data?.data?.list || data?.list || data?.announcements || []
    
    res.status(200).json({ data: { list } })
  } catch (error) {
    console.error('News API Error:', error)
    res.status(500).json({ error: 'Failed to fetch news', data: { list: [] } })
  }
}
