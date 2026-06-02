import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  try {
    const requestedLanguage = Number(request.nextUrl.searchParams.get("language") ?? 2)
    const language = [1, 2, 3, 4].includes(requestedLanguage) ? requestedLanguage : 2
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    }
    const detailUrls = [
      `https://api-us.ten-sura-m.wfs.games/web/announcement/${id}?language=${language}`,
      `https://api.ten-sura-m.wfs.games/web/announcement/${id}?region=1&language=${language}&phoneType=1&assetVersion=`,
    ]

    let response: Response | null = null
    for (const detailUrl of detailUrls) {
      response = await fetch(detailUrl, { headers })
      if (response.ok) break
    }

    if (!response?.ok) {
      throw new Error(`HTTP error! status: ${response?.status ?? "unknown"}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)
    const baseUrl = new URL(response.url)

    const title = $("h1.article-body").first().text().trim()
    const $detailMain = $(".detail-main")

    $detailMain.find("script, style").remove()
    $detailMain.find("[src]").each((_, element) => {
      const value = $(element).attr("src")
      if (value) $(element).attr("src", new URL(value, baseUrl).toString())
    })
    $detailMain.find("[href]").each((_, element) => {
      const value = $(element).attr("href")
      if (value) $(element).attr("href", new URL(value, baseUrl).toString())
    })

    const content = $detailMain.html() || "<p>Content not available</p>"

    return NextResponse.json({
      code: 200,
      message: "success",
      data: {
        id: Number(id),
        title,
        content, // raw HTML string
      },
    })
  } catch (error) {
    console.error("Error fetching event details:", error)

    return NextResponse.json(
      {
        code: 502,
        message: "failed to fetch official announcement detail",
        data: {
          id: Number(id),
          title: "",
          content: "",
        },
      },
      { status: 502 },
    )
  }
}
