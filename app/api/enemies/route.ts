import { NextResponse } from "next/server"
import { getAllEnemies } from "@/lib/enemies"

export const revalidate = 3600

export async function GET() {
  return NextResponse.json(await getAllEnemies(), {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  })
}
