import { NextResponse } from "next/server"
import { getAllEnemies } from "@/lib/enemies"

export const dynamic = "force-static"

export function GET() {
  return NextResponse.json(getAllEnemies(), {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  })
}
