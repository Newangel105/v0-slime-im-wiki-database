import { NextResponse } from "next/server"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"

export const dynamic = "force-static"

export function GET() {
  return NextResponse.json(getAllCharacterBrowserData(), {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  })
}
