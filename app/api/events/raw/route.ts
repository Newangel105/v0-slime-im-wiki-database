import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const requestedLanguage = Number(request.nextUrl.searchParams.get("language") ?? 2)
    const language = [1, 2, 3, 4].includes(requestedLanguage) ? requestedLanguage : 2
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    }
    const feedUrls = [
      `https://api-us.ten-sura-m.wfs.games/web/announcement?language=${language}`,
      `https://api.ten-sura-m.wfs.games/web/announcement?region=1&language=${language}&phoneType=1&assetVersion=`,
    ]

    let response: Response | null = null
    for (const feedUrl of feedUrls) {
      response = await fetch(feedUrl, { headers })
      if (response.ok) break
    }

    if (!response?.ok) {
      throw new Error(`HTTP error! status: ${response?.status ?? "unknown"}`)
    }

    const baseHref = new URL(".", response.url).toString()
    const frameStyle = `
      <base href="${baseHref}">
      <style>
        html, body { margin: 0; min-height: 100%; background: #171719; }
        body { overflow: auto; }
        img, video { max-width: 100%; }
      </style>
    `
    let html = await response.text()
    html = /<head[^>]*>/i.test(html)
      ? html.replace(/<head([^>]*)>/i, `<head$1>${frameStyle}`)
      : `${frameStyle}${html}`

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Error fetching raw event feed:", error)

    return new NextResponse(
      `<!doctype html><html><body style="margin:0;padding:24px;background:#171719;color:#fff;font-family:sans-serif">Official news could not be loaded.</body></html>`,
      {
        status: 502,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      },
    )
  }
}
