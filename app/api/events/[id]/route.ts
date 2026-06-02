import { NextResponse } from "next/server"
import * as cheerio from "cheerio"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params

  try {
    const response = await fetch(
      `https://api.ten-sura-m.wfs.games/web/announcement/${id}?region=1&language=2&phoneType=1&assetVersion=`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept: "text/html",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const title = $("h1.article-body").first().text().trim()

    // Get the full HTML inside .detail-main exactly as it is
    const content = $(".detail-main").html() || "<p>Content not available</p>"

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
