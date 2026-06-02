"use client"
import { useEffect, useMemo, useState } from "react"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"
import { getAllWikiCharacters, getCharacterVisualTier } from "@/lib/pc-wiki"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

type TeamMeta = {
  id: string
  name: string
  author: string
  description: string
  slots: {
    mainSlots: (number | null)[]
    subSlots: (number | null)[]
    sideSlots: (number | null)[]
    sideSubSlots: (number | null)[]
  }
  character_ids: number[]
  created_at: string
  upvotes: number
}

const RARITY_ASSETS: Record<number, string> = {
  3: "/UI/Texture/CommonRarityAtlas/starCharaL3.webp",
  4: "/UI/Texture/CommonRarityAtlas/starCharaL4.webp",
  5: "/UI/Texture/CommonRarityAtlas/starCharaL5.webp",
  6: "/UI/Texture/CommonRarityAtlas/starCharaL6.webp",
  7: "/UI/Texture/CommonRarityAtlas/starCharaL6_SpecialPlus.webp",
  8: "/UI/Texture/CommonRarityAtlas/starCharaL7_Epic.webp",
}

function getMiniFramePath(tier: number, pfx: string) {
  if (tier === 8) return `UI/Texture/CommonRarityAtlas/frame${pfx}M7_Epic.webp`
  const t = Math.min(Math.max(tier, 3), 7)
  return `UI/Texture/CommonRarityAtlas/frame${pfx}M${t}.webp`
}

function isProtectorChar(wc: any) {
  if (!wc) return false
  if (wc.character_role !== "Supporter") return false
  return !wc.skills?.some((s: any) => s.slot === "special_skill" && s.kind === "special")
}

function CharSlotIcon({
  charId,
  chars,
  wikiChars,
  size = 56,
}: {
  charId: number | null
  chars: ReturnType<typeof getAllCharacterBrowserData>
  wikiChars: any[]
  size?: number
}) {
  if (!charId) {
    return <div className="rounded bg-muted/40 border border-border" style={{ width: size, height: size }} />
  }
  const c = chars.find((x) => x.master_pc_id === charId)
  if (!c) return null
  const wc = wikiChars.find((w: any) => w.master_pc_id === charId)
  const visualTier = wc ? getCharacterVisualTier(wc) : 5
  const pfx = wc && isProtectorChar(wc) ? "Bless" : "Member"
  const miniFrame = getMiniFramePath(visualTier, pfx)
  const starAsset = RARITY_ASSETS[visualTier]

  return (
    <div className="relative rounded bg-background" style={{ width: size, height: size }}>
      <img src={c.images.icon} alt={c.name} title={c.name} className="w-full h-full object-cover object-top rounded" />
      {miniFrame && <img src={miniFrame} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-fill z-10" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />}
      {starAsset && <img src={starAsset} alt="" className="pointer-events-none absolute bottom-0 left-0 right-0 h-[14%] object-contain z-20" />}
    </div>
  )
}

function TeamCard({ team, chars, wikiChars, onLoad }: { team: TeamMeta; chars: ReturnType<typeof getAllCharacterBrowserData>; wikiChars: any[]; onLoad: (team: TeamMeta) => void }) {
  const { mainSlots, subSlots, sideSlots, sideSubSlots } = team.slots ?? { mainSlots: [], subSlots: [], sideSlots: [], sideSubSlots: [] }
  return (
    <div className="glass-panel flex flex-col gap-3 p-4 transition-colors hover:border-cyan-300/40">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground">{team.name}</h2>
          <p className="text-xs text-muted-foreground">by {team.author}</p>
          {team.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{team.description}</p>}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{new Date(team.created_at).toLocaleDateString()}</span>
      </div>

      {/* Main row: 4 main slots with their sub slots below */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1 items-center">
            <CharSlotIcon charId={mainSlots?.[i] ?? null} chars={chars} wikiChars={wikiChars} size={52} />
            <CharSlotIcon charId={subSlots?.[i] ?? null} chars={chars} wikiChars={wikiChars} size={36} />
          </div>
        ))}
      </div>

      {/* Side row */}
      {((sideSlots?.some(Boolean)) || (sideSubSlots?.some(Boolean))) && (
        <div className="flex gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1 items-center">
              <CharSlotIcon charId={sideSlots?.[i] ?? null} chars={chars} wikiChars={wikiChars} size={52} />
              <CharSlotIcon charId={sideSubSlots?.[i] ?? null} chars={chars} wikiChars={wikiChars} size={36} />
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => onLoad(team)}
        className="neon-button mt-auto w-full py-2"
      >
        Open in Team Builder
      </button>
    </div>
  )
}

export default function CommunityTeamsPage() {
  const allChars = useMemo(() => getAllCharacterBrowserData(), [])
  const wikiChars = useMemo(() => getAllWikiCharacters(), [])
  const [teams, setTeams] = useState<TeamMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [filterCharId, setFilterCharId] = useState<number | null>(null)
  const [charSearch, setCharSearch] = useState("")
  const limit = 20

  const sortedChars = useMemo(() => {
    return [...allChars].sort((a, b) => {
      const wcA = wikiChars.find((w: any) => w.master_pc_id === a.master_pc_id)
      const wcB = wikiChars.find((w: any) => w.master_pc_id === b.master_pc_id)
      const tA = wcA ? getCharacterVisualTier(wcA) : 5
      const tB = wcB ? getCharacterVisualTier(wcB) : 5
      return tB - tA || a.name.localeCompare(b.name)
    })
  }, [allChars, wikiChars])

  const visibleChars = useMemo(() => {
    if (!charSearch.trim()) return sortedChars
    const q = charSearch.toLowerCase()
    return sortedChars.filter((c) => c.name.toLowerCase().includes(q))
  }, [sortedChars, charSearch])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (filterCharId) params.set("character_id", String(filterCharId))
    fetch(`/api/community/teams?${params}`)
      .then((r) => r.json())
      .then((json) => {
        setTeams(json.data ?? [])
        setTotal(json.total ?? 0)
      })
      .finally(() => setLoading(false))
  }, [page, filterCharId])

  const filtered = useMemo(() => {
    if (!search.trim()) return teams
    const q = search.toLowerCase()
    return teams.filter((t) => t.name.toLowerCase().includes(q) || t.author.toLowerCase().includes(q))
  }, [teams, search])

  function handleLoadTeam(team: TeamMeta) {
    try {
      sessionStorage.setItem("communityTeamLoad", JSON.stringify(team.slots))
      window.open("/team-builder", "_blank")
    } catch {
      alert("Failed to open team builder")
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <main className="site-page px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        <div>
          <p className="section-kicker">Community</p>
          <h1 className="section-title mt-2">Teams</h1>
          <p className="mt-2 text-sm text-muted-foreground">Browse team compositions shared by other players. Filter by character to find teams featuring them.</p>
        </div>

        {/* Character filter */}
        <div className="glass-panel flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Filter by character</span>
            {filterCharId && (
              <button onClick={() => { setFilterCharId(null); setPage(1) }} className="text-xs text-blue-400 hover:text-blue-300">
                Clear filter
              </button>
            )}
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={charSearch} onChange={(e) => setCharSearch(e.target.value)} placeholder="Search characters" className="h-8 rounded-full border-gray-600 bg-muted pl-9 text-sm text-foreground placeholder:text-muted-foreground" />
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {visibleChars.slice(0, 120).map((c) => {
              const active = filterCharId === c.master_pc_id
              return (
                <button
                  key={c.master_pc_id}
                  onClick={() => { setFilterCharId(active ? null : c.master_pc_id); setPage(1) }}
                  title={c.name}
                  className={`relative w-10 h-10 rounded overflow-hidden transition-all ${active ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-800" : "opacity-70 hover:opacity-100"}`}
                >
                  <img src={c.images.icon} alt={c.name} className="w-full h-full object-cover object-top" />
                </button>
              )
            })}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or author" className="h-10 rounded-full border-gray-600 bg-muted pl-11 text-foreground placeholder:text-muted-foreground" />
        </div>

        {loading ? (
          <div className="text-muted-foreground py-12 text-center">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center">No teams found. Be the first to share one from the Team Builder!</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((team) => (
              <TeamCard key={team.id} team={team} chars={allChars} wikiChars={wikiChars} onLoad={handleLoadTeam} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded bg-muted text-sm disabled:opacity-40 hover:bg-muted/80">Previous</button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded bg-muted text-sm disabled:opacity-40 hover:bg-muted/80">Next</button>
          </div>
        )}
      </div>
    </main>
  )
}
