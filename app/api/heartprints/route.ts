import { getAllHeartprints } from "@/lib/pc-wiki"
import { NextResponse } from "next/server"

export const revalidate = 3600

export function GET() {
  return NextResponse.json(getAllHeartprints(), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
