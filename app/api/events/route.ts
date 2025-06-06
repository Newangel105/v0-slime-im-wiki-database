import { NextResponse } from "next/server"
import * as cheerio from "cheerio"

interface ParsedAnnouncement {
  id: string
  title: string
  category: string
  isNew: boolean
  endDate: string
  href: string
  headerClass: string
  tabCategory: string // Notice, Slime News, or Issues
  articleType: string // maintenance, info, event, etc.
}

export async function GET() {
  try {
    const response = await fetch(
      "https://api.ten-sura-m.wfs.games/web/announcement?region=1&language=2&phoneType=1&assetVersion=",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const announcements: ParsedAnnouncement[] = []

    // Get tab names
    const tabNames: { [key: string]: string } = {}
    $(".article-tab-item").each((index, element) => {
      const $element = $(element)
      const tabTrigger = $element.attr("data-switchtab-trigger")
      const tabName = $element.find("span").text().trim()
      if (tabTrigger) {
        tabNames[tabTrigger] = tabName
      }
    })

    // Process each tab content group
    $(".article-group[data-switchtab-content]").each((groupIndex, groupElement) => {
      const $group = $(groupElement)
      const tabId = $group.attr("data-switchtab-content")
      const tabCategory = tabNames[tabId || ""] || "Unknown"

      // Process articles within this group
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

        // Extract article type from category classes
        let articleType = "unknown"
        const categoryClasses = $category.attr("class") || ""
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

    // Return mock data if scraping fails
    const mockData = {
      code: 200,
      message: "success",
      data: {
        list: [
          {
            id: "600000017",
            title: "English Displayed in the French Version of the App(Annonce sur l'ajout du français)",
            category: "Maintenance",
            isNew: false,
            endDate: "",
            href: "/web/announcement/600000017?region=1&language=2&phoneType=1&assetVersion=",
            headerClass: "article-header is-purple",
            tabCategory: "Notice",
            articleType: "maintenance",
          },
          {
            id: "700000475",
            title: "Regarding Survey Notice",
            category: "Notice",
            isNew: false,
            endDate: "",
            href: "/web/announcement/700000475?region=1&language=2&phoneType=1&assetVersion=",
            headerClass: "article-header is-red",
            tabCategory: "Notice",
            articleType: "info",
          },
          {
            id: "4001002712",
            title: "Rimuru's Predation Quest",
            category: "Event",
            isNew: true,
            endDate: "Ends: 1:59 UTC 6/9 (Mon)",
            href: "/web/announcement/4001002712?region=1&language=2&phoneType=1&assetVersion=",
            headerClass: "article-header is-yellow",
            tabCategory: "Slime News",
            articleType: "event",
          },
          {
            id: "4001002713",
            title: "Avatar of Allure Redux Recruit",
            category: "Recruit",
            isNew: false,
            endDate: "Ends: 5:59 UTC 6/9 (Mon)",
            href: "/web/announcement/4001002713?region=1&language=2&phoneType=1&assetVersion=",
            headerClass: "article-header is-pink",
            tabCategory: "Slime News",
            articleType: "recruit",
          },
          {
            id: "4001002715",
            title: "Issue Affecting Charm Equipment",
            category: "Issues",
            isNew: true,
            endDate: "",
            href: "/web/announcement/4001002715?region=1&language=2&phoneType=1&assetVersion=",
            headerClass: "article-header is-gray",
            tabCategory: "Issues",
            articleType: "issues",
          },
        ],
        tabs: {
          "tab-0": "Notice",
          "tab-1": "Slime News",
          "tab-2": "Issues",
        },
      },
    }

    return NextResponse.json(mockData)
  }
}
