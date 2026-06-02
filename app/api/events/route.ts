import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

interface ParsedAnnouncement {
  id: string
  title: string
  category: string
  isNew: boolean
  endDate: string
  href: string
  headerClass: string
  tabCategory: string
  articleType: string
}

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

    const html = await response.text()
    const $ = cheerio.load(html)
    const announcements: ParsedAnnouncement[] = []
    const tabNames: Record<string, string> = {}

    $(".article-tab-item").each((index, element) => {
      const $element = $(element)
      const tabTrigger = $element.attr("data-switchtab-trigger")
      const tabName = $element.find("span").text().trim()
      if (tabTrigger) tabNames[tabTrigger] = tabName
    })

    $(".article-group[data-switchtab-content]").each((groupIndex, groupElement) => {
      const $group = $(groupElement)
      const tabId = $group.attr("data-switchtab-content")
      const tabCategory = tabNames[tabId || ""] || "Unknown"

      $group.find(".article-item").each((index, element) => {
        const $element = $(element)
        const $container = $element.find(".article-container")
        const href = $container.attr("href") || ""
        const id = href.split("/").pop()?.split("?")[0] || ""

        const $header = $container.find(".article-header")
        const $category = $container.find(".article-category")
        const $date = $container.find(".article-date")
        const $body = $container.find(".article-body")

        const category = $category.text().trim()
        const isNew = $category.hasClass("is-new")
        const endDate = $date.text().trim()
        const title = $body.text().trim()
        const headerClass = $header.attr("class") || ""
        const categoryClasses = $category.attr("class") || ""

        let articleType = "unknown"
        if (categoryClasses.includes("is-maintenance")) articleType = "maintenance"
        else if (categoryClasses.includes("is-info")) articleType = "info"
        else if (categoryClasses.includes("is-event")) articleType = "event"
        else if (categoryClasses.includes("is-recruit")) articleType = "recruit"
        else if (categoryClasses.includes("is-scout")) articleType = "scout"
        else if (categoryClasses.includes("is-campaign")) articleType = "campaign"
        else if (categoryClasses.includes("is-issues")) articleType = "issues"

        if (id && title) {
          announcements.push({
            id,
            title,
            category,
            isNew,
            endDate,
            href,
            headerClass,
            tabCategory,
            articleType,
          })
        }
      })
    })

    return NextResponse.json({
      code: 200,
      message: "success",
      data: {
        list: announcements,
        tabs: tabNames,
      },
    })
  } catch (error) {
    console.error("Error fetching events:", error)

    return NextResponse.json(
      {
        code: 502,
        message: "failed to fetch official announcement list",
        data: {
          list: [],
          tabs: {},
        },
      },
      { status: 502 },
    )
  }
}
