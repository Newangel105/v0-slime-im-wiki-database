import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const region = searchParams.get('region') || '3'
  const language = searchParams.get('language') || '2'

  // Map region to the correct API domain
  const regionDomains: Record<string, string> = {
    '1': 'api-jp.ten-sura-m.wfs.games',
    '2': 'api-ap.ten-sura-m.wfs.games',
    '3': 'api-us.ten-sura-m.wfs.games',
    '4': 'api-eu.ten-sura-m.wfs.games',
  }

  const domain = regionDomains[region] || 'api-us.ten-sura-m.wfs.games'
  const apiUrl = `https://${domain}/web/announcement?region=${region}&language=${language}`

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://ten-sura-m.wfs.games',
        'Referer': 'https://ten-sura-m.wfs.games/',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) {
      console.error(`[v0] News API response not OK: ${response.status}`)
      return NextResponse.json({ data: { list: [] } }, { status: 200 })
    }

    const data = await response.json()
    const list = data?.data?.list || data?.list || data?.announcements || []

    return NextResponse.json({ data: { list } })
  } catch (error) {
    console.error('[v0] News API Error:', error)
    return NextResponse.json({ data: { list: [] } }, { status: 200 })
  }
}
