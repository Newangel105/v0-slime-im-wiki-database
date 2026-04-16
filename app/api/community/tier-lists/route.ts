import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Simple in-memory rate limit: max 5 posts per IP per hour
const postCounts = new Map<string, { count: number; reset: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = postCounts.get(ip)
  if (!entry || now > entry.reset) {
    postCounts.set(ip, { count: 1, reset: now + 3600_000 })
    return false
  }
  if (entry.count >= 5) return true
  entry.count++
  return false
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "20")))
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from("tier_lists")
    .select("id, name, author, character_ids, created_at, upvotes", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count ?? 0, page, limit })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded. Max 5 submissions per hour." }, { status: 429 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const name = String(body.name ?? "").trim().slice(0, 100)
  const author = String(body.author ?? "Anonymous").trim().slice(0, 50) || "Anonymous"
  const data = body.data

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (!data || typeof data !== "object") return NextResponse.json({ error: "data must be an object" }, { status: 400 })

  // Validate payload size (~500KB max)
  if (JSON.stringify(data).length > 500_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  // Extract all character IDs from all tier lists for filtering
  let character_ids: number[] = []
  try {
    const lists: any[] = data.lists ?? (Array.isArray(data) ? data : [])
    for (const list of lists) {
      const tiers: any[] = list.tiers ?? (Array.isArray(list) ? list : [])
      for (const tier of tiers) {
        for (const item of tier.items ?? []) {
          const id = parseInt(String(item).split(":")[0])
          if (!isNaN(id)) character_ids.push(id)
        }
      }
    }
    character_ids = [...new Set(character_ids)]
  } catch {}

  const { data: row, error } = await supabase
    .from("tier_lists")
    .insert({ name, author, data, character_ids })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: row.id }, { status: 201 })
}
