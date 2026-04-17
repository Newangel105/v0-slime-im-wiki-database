import { getAllHeartprints } from "@/lib/pc-wiki"
import { NextResponse } from "next/server"

export const dynamic = "force-static"

export function GET() {
  return NextResponse.json(getAllHeartprints(), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
