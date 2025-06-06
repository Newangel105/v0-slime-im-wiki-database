import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const response = await fetch(
      `https://api.ten-sura-m.wfs.games/web/announcement/${params.id}?region=1&language=2&phoneType=1&assetVersion=`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept: "text/html",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $("h1.article-body").first().text().trim();

    // Get the full HTML inside .detail-main exactly as it is
    const content = $(".detail-main").html() || "<p>Content not available</p>";

    return NextResponse.json({
      code: 200,
      message: "success",
      data: {
        id: Number(params.id),
        title,
        content, // raw HTML string
      },
    });
  } catch (error) {
    console.error("Error fetching event details:", error);

    // fallback mock data
    return NextResponse.json({
      code: 200,
      message: "success",
      data: {
        id: Number(params.id),
        title: "Event Details",
        content: `<div style="color: white;">
          <h2>Event Information</h2>
          <p>This is detailed information about the event. The content would normally come from the scraped HTML but is currently showing mock data due to scraping limitations.</p>
          <ul>
            <li>Event Duration: Limited Time</li>
            <li>Rewards: Special Items</li>
            <li>Requirements: Player Level 10+</li>
          </ul>
          <p>Please check the official game for the most up-to-date information.</p>
        </div>`,
      },
    });
  }
}
