import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

// GET: return saved tier list if available. Supports ?gist=<id> to fetch a gist.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const gistIdParam = url.searchParams.get("gist")

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN
  const DEFAULT_GIST_ID = process.env.GIST_ID

  // If explicit gist id requested
  if (GITHUB_TOKEN && gistIdParam) {
    try {
      const res = await fetch(`https://api.github.com/gists/${gistIdParam}`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
      })
      if (!res.ok) return NextResponse.json({ tiers: null })
      const gist = await res.json()
      const file = gist.files?.["tier-list.json"]
      if (file && file.content) {
        try {
          const parsed = JSON.parse(file.content)
          return NextResponse.json(parsed)
        } catch (e) {
          return NextResponse.json({ tiers: null })
        }
      }
      return NextResponse.json({ tiers: null })
    } catch (e) {
      return NextResponse.json({ tiers: null })
    }
  }

  // If default GIST_ID provided in env, return that
  if (GITHUB_TOKEN && DEFAULT_GIST_ID) {
    try {
      const res = await fetch(`https://api.github.com/gists/${DEFAULT_GIST_ID}`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
      })
      if (!res.ok) return NextResponse.json({ tiers: null })
      const gist = await res.json()
      const file = gist.files?.["tier-list.json"]
      if (file && file.content) {
        try {
          const parsed = JSON.parse(file.content)
          return NextResponse.json(parsed)
        } catch (e) {
          return NextResponse.json({ tiers: null })
        }
      }
      return NextResponse.json({ tiers: null })
    } catch (e) {
      return NextResponse.json({ tiers: null })
    }
  }

  // Filesystem fallback (works for local dev). Note: serverless hosts may not persist disk writes.
  try {
    const savePath = path.join(process.cwd(), "tier-saves", "latest.json")
    const content = await fs.readFile(savePath, "utf8")
    const parsed = JSON.parse(content)
    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ tiers: null })
  }
}

// POST: save tiers. If GITHUB_TOKEN is set, create a new public gist and return its url/id.
export async function POST(request: Request) {
  const body = await request.json()
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN

  if (GITHUB_TOKEN) {
    try {
      // Create a new public gist
      const res = await fetch(`https://api.github.com/gists`, {
        method: "POST",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: "Slime IM - Tier list (public)",
          public: true,
          files: { "tier-list.json": { content: JSON.stringify(body, null, 2) } },
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({ error: text }, { status: 500 })
      }

      const gist = await res.json()
      const gistId = gist.id
      const htmlUrl = gist.html_url

      // Build a short site share link if origin is available in headers
      const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_BASE_URL || ""
      const siteUrl = origin ? `${origin}/tier-maker?gist=${gistId}` : null

      return NextResponse.json({ ok: true, gistId, htmlUrl, siteUrl })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }

  // Fallback write to disk (local dev)
  try {
    const saveDir = path.join(process.cwd(), "tier-saves")
    await fs.mkdir(saveDir, { recursive: true })
    const savePath = path.join(saveDir, "latest.json")
    await fs.writeFile(savePath, JSON.stringify(body, null, 2), "utf8")
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
