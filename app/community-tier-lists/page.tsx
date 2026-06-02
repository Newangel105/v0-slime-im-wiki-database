"use client"
import { useEffect, useMemo, useState } from "react"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

type TierListMeta = {
  id: string
  name: string
  author: string
  character_ids: number[]
  created_at: string
  upvotes: number
}

function CharIcon({ id, chars }: { id: number; chars: ReturnType<typeof getAllCharacterBrowserData> }) {
  const c = chars.find((x) => x.master_pc_id === id)
  if (!c) return null
  return (
    <div className="relative w-8 h-8 rounded bg-muted overflow-hidden flex-shrink-0">
      <img src={c.images.icon} alt={c.name} title={c.name} className="w-full h-full object-cover object-top" />
    </div>
  )
}

function encodeUnicodeToBase64(str: string) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_m, p1) => String.fromCharCode(parseInt(p1, 16))),
  )
}

export default function CommunityTierListsPage() {
  const allChars = useMemo(() => getAllCharacterBrowserData(), [])
  const [lists, setLists] = useState<TierListMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const limit = 20

  useEffect(() => {
    setLoading(true)
    fetch(`/api/community/tier-lists?page=${page}&limit=${limit}`)
      .then((r) => r.json())
      .then((json) => {
        setLists(json.data ?? [])
        setTotal(json.total ?? 0)
      })
      .finally(() => setLoading(false))
  }, [page])

  const filtered = useMemo(() => {
    if (!search.trim()) return lists
    const q = search.toLowerCase()
    return lists.filter((l) => l.name.toLowerCase().includes(q) || l.author.toLowerCase().includes(q))
  }, [lists, search])

  function openInEditor(list: TierListMeta) {
    fetch(`/api/community/tier-lists/${list.id}`)
      .then((r) => r.json())
      .then((json) => {
        const data = json.data
        if (!data) return
        const encoded = encodeUnicodeToBase64(JSON.stringify(data))
        window.open(`/tier-maker?d=${encodeURIComponent(encoded)}`, "_blank")
      })
      .catch(() => alert("Failed to load tier list"))
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <main className="site-page px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        <div>
          <p className="section-kicker">Community</p>
          <h1 className="section-title mt-2">Tier Lists</h1>
          <p className="mt-2 text-sm text-muted-foreground">Browse tier lists shared by other players. Click to open in the Tier Maker.</p>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or author"
            className="h-10 rounded-full border-gray-600 bg-muted pl-11 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {loading ? (
          <div className="text-muted-foreground py-12 text-center">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center">No tier lists found yet. Be the first to share one!</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((list) => (
              <div key={list.id} className="glass-panel flex flex-col gap-3 p-4 transition-colors hover:border-cyan-300/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-foreground truncate">{list.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">by {list.author}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(list.created_at).toLocaleDateString()}</span>
                </div>

                {list.character_ids?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {list.character_ids.slice(0, 16).map((id) => (
                      <CharIcon key={id} id={id} chars={allChars} />
                    ))}
                    {list.character_ids.length > 16 && (
                      <span className="text-xs text-muted-foreground self-center">+{list.character_ids.length - 16}</span>
                    )}
                  </div>
                )}

                <button
                  onClick={() => openInEditor(list)}
                  className="neon-button mt-auto w-full py-2"
                >
                  Open in Tier Maker
                </button>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded bg-muted text-sm disabled:opacity-40 hover:bg-muted/80"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded bg-muted text-sm disabled:opacity-40 hover:bg-muted/80"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
