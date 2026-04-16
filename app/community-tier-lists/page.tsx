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
    <div className="relative w-8 h-8 rounded bg-gray-700 overflow-hidden flex-shrink-0">
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
    <main className="min-h-screen bg-[#111827] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Community Tier Lists</h1>
          <p className="mt-1 text-gray-400 text-sm">Browse tier lists shared by other players. Click to open in the Tier Maker.</p>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or author"
            className="h-10 rounded-full border-gray-600 bg-gray-700 pl-11 text-white placeholder:text-gray-400"
          />
        </div>

        {loading ? (
          <div className="text-gray-400 py-12 text-center">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-500 py-12 text-center">No tier lists found yet. Be the first to share one!</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((list) => (
              <div key={list.id} className="flex flex-col gap-3 rounded-2xl border border-gray-700 bg-gray-800 p-4 hover:border-gray-500 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-white truncate">{list.name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">by {list.author}</p>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{new Date(list.created_at).toLocaleDateString()}</span>
                </div>

                {list.character_ids?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {list.character_ids.slice(0, 16).map((id) => (
                      <CharIcon key={id} id={id} chars={allChars} />
                    ))}
                    {list.character_ids.length > 16 && (
                      <span className="text-xs text-gray-500 self-center">+{list.character_ids.length - 16}</span>
                    )}
                  </div>
                )}

                <button
                  onClick={() => openInEditor(list)}
                  className="mt-auto w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
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
              className="px-3 py-1.5 rounded bg-gray-700 text-sm disabled:opacity-40 hover:bg-gray-600"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded bg-gray-700 text-sm disabled:opacity-40 hover:bg-gray-600"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
