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

  // Try multiple CORS proxies as fallbacks
  const corsProxies = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://proxy.cors.sh/${url}`,
  ]

  for (let i = 0; i < corsProxies.length; i++) {
    const proxyFn = corsProxies[i]
    try {
      const proxyUrl = proxyFn(apiUrl)
      console.log(`[v0] Trying proxy ${i + 1}: ${proxyUrl.substring(0, 50)}...`)
      
      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'application/json',
        },
      })

      console.log(`[v0] Proxy ${i + 1} response status: ${response.status}`)

      if (!response.ok) {
        console.log(`[v0] Proxy ${i + 1} failed with status ${response.status}`)
        continue
      }

      const text = await response.text()
      console.log(`[v0] Proxy ${i + 1} response length: ${text.length}, starts with: ${text.substring(0, 50)}`)
      
      // Check if response is JSON
      if (!text.startsWith('{') && !text.startsWith('[')) {
        console.log(`[v0] Proxy ${i + 1} returned non-JSON`)
        continue
      }

      const data = JSON.parse(text)
      const list = data?.data?.list || data?.list || data?.announcements || []
      console.log(`[v0] Successfully parsed news, found ${list.length} items`)

      return NextResponse.json({ data: { list } })
    } catch (err) {
      console.log(`[v0] Proxy ${i + 1} error:`, err)
      continue
    }
  }

  // If all proxies fail, return empty list
  return NextResponse.json({ data: { list: [] } }, { status: 200 })
}
