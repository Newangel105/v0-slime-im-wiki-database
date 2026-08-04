import { NextResponse } from "next/server"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"

export const revalidate = 3600

export async function GET() {
  const { browserCharacters } = await getAllCharacterBrowserData()
  return NextResponse.json(browserCharacters, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  })
}
