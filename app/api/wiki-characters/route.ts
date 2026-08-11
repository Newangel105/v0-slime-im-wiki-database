import { getAllWikiCharacters } from "@/lib/pc-wiki"

// The character DETAIL pages render a client-only shell (ssr:false) that needs the
// full WikiCharacter[] for prev/next navigation and cross-character force lookups.
// Fetching that ~7 MB blob inside the page's Server Component made the whole
// /characters/[characterId] route DYNAMIC — the fetch is >2 MB so Next can't put
// it in the data cache, which drops the route to 0% edge-cache-hit and re-pulls
// 7 MB from R2 on EVERY request (the Fast Origin Transfer blowout on Vercel).
//
// Instead the transformed list is exposed once here and edge-cached via
// Cache-Control, so the page itself stays fully static and R2 is hit ~once per
// revalidate window (not per request); browsers reuse the response across
// character navigations, so repeat views cost zero transfer.
export const dynamic = "force-static"
export const revalidate = 3600

export async function GET() {
  const characters = await getAllWikiCharacters()
  return Response.json(characters, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
