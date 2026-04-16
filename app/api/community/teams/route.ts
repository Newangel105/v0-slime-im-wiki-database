import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const postCounts = new Map<string, { count: number; reset: number }>()
function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = postCounts.get(ip)
  if (!entry || now > entry.reset) { postCounts.set(ip, { count: 1, reset: now + 3600_000 }); return false }
  if (entry.count >= 5) return true
  entry.count++
  return false
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "20")))
  const offset = (page - 1) * limit
  const characterId = searchParams.get("character_id")

  let query = supabase
    .from("team_compositions")
    .select("id, name, author, description, slots, character_ids, created_at, upvotes", { count: "exact" })
    .order("created_at", { ascending: false })

  if (characterId) {
    const id = parseInt(characterId)
    if (!isNaN(id)) query = query.contains("character_ids", [id])
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count ?? 0, page, limit })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (isRateLimited(ip)) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const name = String(body.name ?? "").trim().slice(0, 100)
  const author = String(body.author ?? "Anonymous").trim().slice(0, 50) || "Anonymous"
  const description = String(body.description ?? "").trim().slice(0, 500)
  const slots = body.slots

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (!slots || typeof slots !== "object") return NextResponse.json({ error: "slots required" }, { status: 400 })

  // Extract character IDs for filtering
  const allIds = [
    ...(slots.mainSlots ?? []),
    ...(slots.subSlots ?? []),
    ...(slots.sideSlots ?? []),
    ...(slots.sideSubSlots ?? []),
  ].filter((id: any) => typeof id === "number" && !isNaN(id))

  const character_ids = [...new Set<number>(allIds)]

  const { data: row, error } = await supabase
    .from("team_compositions")
    .insert({ name, author, description, slots, character_ids })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: row.id }, { status: 201 })
}
