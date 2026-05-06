"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, ImagePlus, Lock, Plus, Save, Trash2, Upload, Video } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { extractYouTubeVideoId, guidesSupabase, guidesSupabaseConfigured, isGuideLocked, makeBlockId, slugifyGuideTitle, type GuideArticle, type GuideAuthorProfile, type GuideContent, type GuideContentBlock, type GuideStatus } from "@/lib/guides"
import { GuideRenderer } from "@/components/guides/guide-renderer"

type EditorMode = "new" | "edit"

interface GuideEditorProps {
  mode: EditorMode
  articleId?: string
}

function emptyContent(): GuideContent {
  return {
    blocks: [
      { id: makeBlockId(), type: "paragraph", text: "" },
    ],
  }
}

function safeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

type EditorBlockWidthPercent = number
type EditorBlockHeightPercent = "auto" | number
type EditorTextAlign = "left" | "center" | "right"
type EditorImageFit = "contain" | "cover"
type EditorContentPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"

type EditorBlockSizingPatch = {
  layout?: "full" | "half"
  width?: "full" | "three-quarter" | "half" | "quarter" | "100" | "75" | "66" | "50" | "33" | "25"
  widthPercent?: number
  height?: "auto" | "short" | "medium" | "tall" | "extra-tall" | "50" | "75" | "100" | "125" | "150" | "200"
  heightPercent?: number
  imageFit?: "contain" | "cover"
  textAlign?: "left" | "center" | "right"
  verticalAlign?: "top" | "center"
  contentPosition?: EditorContentPosition
}

function isTextBlock(block: GuideContentBlock): boolean {
  return (
    block.type === "paragraph" ||
    block.type === "heading" ||
    block.type === "quote" ||
    block.type === "list"
  )
}

function clampPercent(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, Math.round(numeric)))
}

function getBlockWidthPercent(block: GuideContentBlock): EditorBlockWidthPercent {
  if (typeof block.widthPercent === "number") {
    return clampPercent(block.widthPercent, 25, 100, 100)
  }

  if (block.width === "25" || block.width === "quarter") return 25
  if (block.width === "33") return 33
  if (block.width === "50" || block.width === "half") return 50
  if (block.width === "66") return 66
  if (block.width === "75" || block.width === "three-quarter") return 75

  // Backwards compatibility with older saved articles.
  return block.layout === "half" ? 50 : 100
}

function legacyWidthForPercent(width: EditorBlockWidthPercent): "full" | "three-quarter" | "half" | "quarter" {
  if (width === 25) return "quarter"
  if (width === 50) return "half"
  if (width === 75) return "three-quarter"
  return "full"
}

function getLegacyLayoutForWidth(width: EditorBlockWidthPercent): "full" | "half" {
  return width === 50 ? "half" : "full"
}

function widthPatch(width: EditorBlockWidthPercent): EditorBlockSizingPatch {
  const clamped = clampPercent(width, 25, 100, 100)
  return {
    widthPercent: clamped,
    width: legacyWidthForPercent(clamped),
    layout: getLegacyLayoutForWidth(clamped),
  }
}

function getBlockHeightPercent(block: GuideContentBlock): EditorBlockHeightPercent {
  if (typeof block.heightPercent === "number") {
    return clampPercent(block.heightPercent, 50, 250, 100)
  }

  if (block.height === "50") return 50
  if (block.height === "75" || block.height === "short") return 75
  if (block.height === "100" || block.height === "medium") return 100
  if (block.height === "125") return 125
  if (block.height === "150" || block.height === "tall") return 150
  if (block.height === "200" || block.height === "extra-tall") return 200
  return "auto"
}

function heightPatch(height: EditorBlockHeightPercent): EditorBlockSizingPatch {
  if (height === "auto") {
    return { height: "auto", heightPercent: undefined }
  }

  const clamped = clampPercent(height, 50, 250, 100)
  return {
    height: "100",
    heightPercent: clamped,
  }
}

function getContentPosition(block: GuideContentBlock): EditorContentPosition {
  if (block.contentPosition) return block.contentPosition as EditorContentPosition
  if (block.verticalAlign === "center") return "center"
  return "top-left"
}

export function GuideEditor({ mode, articleId }: GuideEditorProps) {
  const router = useRouter()
  const [profile, setProfile] = useState<GuideAuthorProfile | null>(null)
  const [article, setArticle] = useState<GuideArticle | null>(null)
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [summary, setSummary] = useState("")
  const [thumbnailUrl, setThumbnailUrl] = useState("")
  const [status, setStatus] = useState<GuideStatus>("draft")
  const [content, setContent] = useState<GuideContent>(emptyContent())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const previewArticle = useMemo<GuideArticle>(() => ({
    id: article?.id || "preview",
    title: title || "Untitled Guide",
    slug: slug || "untitled-guide",
    summary: summary || null,
    thumbnail_url: thumbnailUrl || null,
    content,
    author_id: profile?.id || "preview-author",
    author_name: profile?.display_name || "Author",
    status,
    is_locked: article?.is_locked || false,
    locked_at: article?.locked_at || null,
    locked_by: article?.locked_by || null,
    created_at: article?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    published_at: status === "published" ? article?.published_at || new Date().toISOString() : null,
  }), [article, content, profile, slug, status, summary, thumbnailUrl, title])

  useEffect(() => {
    async function load() {
      if (!guidesSupabaseConfigured) {
        setError("Guides are not configured yet. Add Supabase environment variables first.")
        setLoading(false)
        return
      }

      const {
        data: { user },
      } = await guidesSupabase.auth.getUser()

      if (!user) {
        setError("You must log in from the Guides page before creating or editing articles.")
        setLoading(false)
        return
      }

      const { data: profileData, error: profileError } = await guidesSupabase
        .from("guide_author_profiles")
        .select("id, display_name, avatar_url, role, created_at")
        .eq("id", user.id)
        .maybeSingle()

      if (profileError || !profileData) {
        setError("Your account is logged in, but it is not registered as a guide author.")
        setLoading(false)
        return
      }

      const authorProfile = profileData as GuideAuthorProfile
      setProfile(authorProfile)

      if (mode === "edit" && articleId) {
        const { data, error: articleError } = await guidesSupabase
          .from("guide_articles")
          .select("*")
          .eq("id", articleId)
          .maybeSingle()

        if (articleError || !data) {
          setError(articleError?.message || "Article not found.")
          setLoading(false)
          return
        }

        const loaded = data as GuideArticle
        if (authorProfile.role !== "admin" && loaded.author_id !== authorProfile.id) {
          setError("You can only edit your own articles.")
          setLoading(false)
          return
        }

        setArticle(loaded)
        setTitle(loaded.title || "")
        setSlug(loaded.slug || "")
        setSummary(loaded.summary || "")
        setThumbnailUrl(loaded.thumbnail_url || "")
        setStatus(loaded.status)
        setContent(loaded.content?.blocks ? loaded.content : emptyContent())
      }

      setLoading(false)
    }

    load()
  }, [mode, articleId])

  function updateBlock(id: string, patch: Partial<GuideContentBlock> | EditorBlockSizingPatch) {
    setContent((current) => ({
      blocks: current.blocks.map((block) => (block.id === id ? ({ ...block, ...patch } as GuideContentBlock) : block)),
    }))
  }

  function removeBlock(id: string) {
    setContent((current) => ({ blocks: current.blocks.filter((block) => block.id !== id) }))
  }

  function moveBlockByIndex(fromIndex: number, toIndex: number) {
    setContent((current) => {
      if (fromIndex === toIndex) return current
      if (fromIndex < 0 || fromIndex >= current.blocks.length) return current
      if (toIndex < 0 || toIndex >= current.blocks.length) return current

      const blocks = [...current.blocks]
      const [moved] = blocks.splice(fromIndex, 1)
      blocks.splice(toIndex, 0, moved)
      return { blocks }
    })
  }

  function moveBlockById(id: string, direction: -1 | 1) {
    const fromIndex = content.blocks.findIndex((block) => block.id === id)
    if (fromIndex < 0) return
    moveBlockByIndex(fromIndex, fromIndex + direction)
  }

  function addBlock(type: GuideContentBlock["type"], width: EditorBlockWidthPercent = 100) {
    const sizing = widthPatch(width)
    let block: GuideContentBlock

    switch (type) {
      case "paragraph":
        block = { id: makeBlockId(), type: "paragraph", text: "", ...sizing }
        break
      case "heading":
        block = { id: makeBlockId(), type: "heading", level: 2, text: "", ...sizing }
        break
      case "image":
        block = { id: makeBlockId(), type: "image", url: "", caption: "", alt: "", imageFit: "contain", ...sizing }
        break
      case "youtube":
        block = { id: makeBlockId(), type: "youtube", url: "", videoId: "", caption: "", ...sizing }
        break
      case "quote":
        block = { id: makeBlockId(), type: "quote", text: "", cite: "", ...sizing }
        break
      case "list":
        block = { id: makeBlockId(), type: "list", items: [""], ...sizing }
        break
      case "divider":
      default:
        block = { id: makeBlockId(), type: "divider", ...sizing }
        break
    }

    setContent((current) => ({ blocks: [...current.blocks, block] }))
  }

  function addSideBySidePair() {
    const left: GuideContentBlock = { id: makeBlockId(), type: "paragraph", text: "", ...widthPatch(50), ...heightPatch(100), contentPosition: "center" }
    const right: GuideContentBlock = { id: makeBlockId(), type: "image", url: "", caption: "", alt: "", imageFit: "contain", ...widthPatch(50), ...heightPatch(100) }
    setContent((current) => ({ blocks: [...current.blocks, left, right] }))
  }

  async function uploadImage(file: File, purpose: "thumbnail" | "inline"): Promise<string | null> {
    setMessage(null)
    setError(null)

    if (!profile) {
      setError("You must be logged in as an author to upload images.")
      return null
    }

    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.")
      return null
    }

    const path = `${profile.id}/${purpose}/${Date.now()}-${safeFileName(file.name)}`
    const { error: uploadError } = await guidesSupabase.storage.from("guide-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (uploadError) {
      setError(uploadError.message)
      return null
    }

    const { data } = guidesSupabase.storage.from("guide-images").getPublicUrl(path)
    return data.publicUrl
  }

  async function save(nextStatus?: GuideStatus) {
    if (!profile) return

    if (article && isGuideLocked(article)) {
      setError("This article is locked. Unlock it from My Articles before editing.")
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    const finalTitle = title.trim()
    const finalSlug = (slug.trim() || slugifyGuideTitle(finalTitle)).toLowerCase()
    const finalStatus = nextStatus ?? status

    if (!finalTitle) {
      setError("Title is required.")
      setSaving(false)
      return
    }

    if (!finalSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(finalSlug)) {
      setError("Slug must use lowercase letters, numbers, and hyphens only.")
      setSaving(false)
      return
    }

    const payload = {
      slug: finalSlug,
      title: finalTitle,
      summary: summary.trim() || null,
      thumbnail_url: thumbnailUrl.trim() || null,
      content,
      author_id: article?.author_id || profile.id,
      author_name: article?.author_name || profile.display_name,
      status: finalStatus,
      published_at: finalStatus === "published" ? article?.published_at || new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    if (article?.id) {
      const { error: updateError } = await guidesSupabase
        .from("guide_articles")
        .update(payload)
        .eq("id", article.id)

      if (updateError) {
        setError(updateError.message)
      } else {
        setStatus(finalStatus)
        setSlug(finalSlug)

        if (finalStatus === "published") {
          setSaving(false)
          router.push("/guides/admin")
          router.refresh()
          return
        }

        setMessage("Article saved.")
      }
    } else {
      const { data, error: insertError } = await guidesSupabase
        .from("guide_articles")
        .insert(payload)
        .select("*")
        .single()

      if (insertError) {
        setError(insertError.message)
      } else {
        const created = data as GuideArticle
        setArticle(created)
        setSlug(created.slug)
        setStatus(created.status)

        if (finalStatus === "published") {
          setSaving(false)
          router.push("/guides/admin")
          router.refresh()
          return
        }

        setMessage("Article created.")
        window.history.replaceState(null, "", `/guides/admin/${created.id}/edit`)
      }
    }

    setSaving(false)
  }

  if (loading) {
    return <main className="min-h-screen bg-[#0f172a] p-8 text-gray-300">Loading editor...</main>
  }

  if (error && !profile) {
    return (
      <main className="min-h-screen bg-[#0f172a] text-white">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <Button asChild variant="outline" className="mb-6 border-white/15 bg-white/5 text-white hover:bg-white/10">
            <Link href="/guides"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Guides</Link>
          </Button>
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{error}</div>
        </div>
      </main>
    )
  }

  if (mode === "edit" && article && isGuideLocked(article)) {
    return (
      <main className="min-h-screen bg-[#0f172a] text-white">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <Button asChild variant="outline" className="mb-6 border-white/15 bg-white/5 text-white hover:bg-white/10">
            <Link href="/guides/admin"><ArrowLeft className="mr-2 h-4 w-4" /> My Articles</Link>
          </Button>
          <div className="rounded-2xl border border-slate-400/30 bg-slate-500/10 p-6 text-slate-100">
            <div className="mb-2 flex items-center gap-2 text-lg font-bold">
              <Lock className="h-5 w-5" /> This article is locked
            </div>
            <p className="text-sm leading-6 text-slate-300">
              Unlock “{article.title}” from My Articles before editing it.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
            <Link href="/guides/admin"><ArrowLeft className="mr-2 h-4 w-4" /> My Articles</Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save("draft")} disabled={saving} variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              <Save className="mr-2 h-4 w-4" /> Save Draft
            </Button>
            <Button onClick={() => save("published")} disabled={saving} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
              <Upload className="mr-2 h-4 w-4" /> Publish
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <Card className="border-white/10 bg-slate-900/80 text-white">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2">
                  <Badge className="border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/10">{status}</Badge>
                  <span className="text-sm text-gray-400">Writing as {profile?.display_name}</span>
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={title}
                    onChange={(event) => {
                      const value = event.target.value
                      setTitle(value)
                      if (!article && !slug) setSlug(slugifyGuideTitle(value))
                    }}
                    className="mt-2 border-white/10 bg-slate-950/70 text-white"
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={slug} onChange={(event) => setSlug(slugifyGuideTitle(event.target.value))} className="mt-2 border-white/10 bg-slate-950/70 text-white" />
                </div>
                <div>
                  <Label>Summary</Label>
                  <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} className="mt-2 border-white/10 bg-slate-950/70 text-white" />
                </div>
                <div>
                  <Label>Thumbnail URL</Label>
                  <div className="mt-2 flex gap-2">
                    <Input value={thumbnailUrl} onChange={(event) => setThumbnailUrl(event.target.value)} className="border-white/10 bg-slate-950/70 text-white" />
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/15">
                      <ImagePlus className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (event) => {
                          const file = event.target.files?.[0]
                          if (!file) return
                          const url = await uploadImage(file, "thumbnail")
                          if (url) setThumbnailUrl(url)
                          event.target.value = ""
                        }}
                      />
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/80 text-white">
              <CardContent className="p-5">
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => addBlock("paragraph")} className="border-white/15 bg-white/5 text-white hover:bg-white/10"><Plus className="mr-1 h-4 w-4" /> Paragraph</Button>
                  <Button size="sm" variant="outline" onClick={() => addBlock("heading")} className="border-white/15 bg-white/5 text-white hover:bg-white/10"><Plus className="mr-1 h-4 w-4" /> Heading</Button>
                  <Button size="sm" variant="outline" onClick={() => addBlock("image")} className="border-white/15 bg-white/5 text-white hover:bg-white/10"><Plus className="mr-1 h-4 w-4" /> Image</Button>
                  <Button size="sm" variant="outline" onClick={addSideBySidePair} className="border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15"><Plus className="mr-1 h-4 w-4" /> Side by Side</Button>
                  <Button size="sm" variant="outline" onClick={() => addBlock("youtube")} className="border-white/15 bg-white/5 text-white hover:bg-white/10"><Video className="mr-1 h-4 w-4" /> YouTube</Button>
                  <Button size="sm" variant="outline" onClick={() => addBlock("quote")} className="border-white/15 bg-white/5 text-white hover:bg-white/10">Quote</Button>
                  <Button size="sm" variant="outline" onClick={() => addBlock("list")} className="border-white/15 bg-white/5 text-white hover:bg-white/10">List</Button>
                  <Button size="sm" variant="outline" onClick={() => addBlock("divider")} className="border-white/15 bg-white/5 text-white hover:bg-white/10">Divider</Button>
                </div>
                <p className="mb-4 text-xs text-gray-400">Use the up/down buttons to rearrange sections. Sections flow into rows automatically. A row can contain up to four elements, and their widths can be any value from 25% to 100% as long as the row total fits inside 100%.</p>

                <div className="space-y-4">
                  {content.blocks.map((block, index) => (
                    <div
                      key={block.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition"
                    >
                      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
                        <div className={`flex ${getBlockHeightPercent(block) === "auto" ? "w-[108px]" : "w-[48px]"} shrink-0 items-center gap-1.5`}>
                          <span
                            className="rounded-md p-1 text-gray-500"
                            title="Use the up/down arrows to move this section"
                            aria-label="Section reorder marker"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <span className="truncate whitespace-nowrap text-[10px] leading-none" title={`${index + 1}. ${block.type}`}>{index + 1}. {block.type}</span>
                        </div>
                        <div className="flex min-w-0 flex-1 items-center justify-start gap-1.5 overflow-hidden">
                          <div className="inline-flex h-8 min-w-[112px] max-w-[158px] flex-[1_1_150px] items-center gap-1.5 rounded-md border border-white/10 bg-slate-900 px-2 normal-case tracking-normal" title="Section width">
                            <span className="w-3 shrink-0 text-[11px] font-semibold text-cyan-200">W</span>
                            <input
                              type="range"
                              min={25}
                              max={100}
                              step={1}
                              value={getBlockWidthPercent(block)}
                              onChange={(event) => updateBlock(block.id, widthPatch(Number(event.target.value)))}
                              className="h-2 min-w-[24px] flex-1 cursor-pointer accent-cyan-400"
                              aria-label="Section width percentage"
                            />
                            <span className="w-9 shrink-0 whitespace-nowrap text-right text-[11px] font-semibold text-white">{getBlockWidthPercent(block)}%</span>
                          </div>
                          <div className={`inline-flex h-8 ${getBlockHeightPercent(block) === "auto" ? "min-w-[100px] flex-[0_1_112px]" : "min-w-[116px] max-w-[150px] flex-[1_1_145px]"} items-center gap-1.5 rounded-md border border-white/10 bg-slate-900 px-2 normal-case tracking-normal`} title="Section visual height">
                            <span className="w-3 shrink-0 text-[11px] font-semibold text-cyan-200">H</span>
                            {getBlockHeightPercent(block) === "auto" ? (
                              <>
                                <button
                                  type="button"
                                  className="inline-flex h-6 w-[34px] shrink-0 items-center justify-center rounded bg-cyan-400/20 px-1 text-[10px] font-semibold leading-none text-cyan-100 ring-1 ring-cyan-400/40"
                                  aria-label="Section height is automatic"
                                >
                                  Auto
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateBlock(block.id, heightPatch(100))}
                                  className="inline-flex h-6 w-[44px] shrink-0 items-center justify-center rounded bg-white/5 px-1 text-[10px] font-semibold leading-none text-gray-300 hover:bg-white/10"
                                  aria-label="Use custom section height"
                                >
                                  Custom
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => updateBlock(block.id, heightPatch("auto"))}
                                  className="inline-flex h-6 w-[34px] shrink-0 items-center justify-center rounded bg-white/5 px-1 text-[10px] font-semibold leading-none text-gray-300 hover:bg-white/10"
                                  aria-label="Set section height to auto"
                                >
                                  Auto
                                </button>
                                <input
                                  type="range"
                                  min={50}
                                  max={250}
                                  step={5}
                                  value={getBlockHeightPercent(block)}
                                  onChange={(event) => updateBlock(block.id, heightPatch(Number(event.target.value)))}
                                  className="h-2 min-w-[22px] flex-1 cursor-pointer accent-cyan-400"
                                  aria-label="Section height percentage"
                                />
                                <span className="w-9 shrink-0 whitespace-nowrap text-right text-[11px] font-semibold text-white">{getBlockHeightPercent(block)}%</span>
                              </>
                            )}
                          </div>
                          {isTextBlock(block) ? (
                            <>
                              <select
                                value={getContentPosition(block)}
                                onChange={(event) => {
                                  const contentPosition = event.target.value as EditorContentPosition
                                  updateBlock(block.id, {
                                    contentPosition,
                                    verticalAlign: contentPosition === "center" || contentPosition.startsWith("middle") ? "center" : "top",
                                  } as Partial<GuideContentBlock>)
                                }}
                                className="h-8 min-w-[70px] flex-[0_1_92px] rounded-md border border-white/10 bg-slate-900 px-1.5 text-[11px] normal-case tracking-normal text-white"
                                title="Text box position inside this section"
                              >
                                <option value="top-left">Top left</option>
                                <option value="top-center">Top center</option>
                                <option value="top-right">Top right</option>
                                <option value="middle-left">Middle left</option>
                                <option value="center">Center</option>
                                <option value="middle-right">Middle right</option>
                                <option value="bottom-left">Bottom left</option>
                                <option value="bottom-center">Bottom center</option>
                                <option value="bottom-right">Bottom right</option>
                              </select>
                              <select
                                value={block.textAlign ?? "left"}
                                onChange={(event) => updateBlock(block.id, { textAlign: event.target.value as EditorTextAlign } as Partial<GuideContentBlock>)}
                                className="h-8 min-w-[66px] flex-[0_1_84px] rounded-md border border-white/10 bg-slate-900 px-1.5 text-[11px] normal-case tracking-normal text-white"
                                title="Text alignment"
                              >
                                <option value="left">Text left</option>
                                <option value="center">Text center</option>
                                <option value="right">Text right</option>
                              </select>
                            </>
                          ) : null}
                          {block.type === "image" ? (
                            <select
                              value={(block.imageFit ?? "contain") as EditorImageFit}
                              onChange={(event) => updateBlock(block.id, { imageFit: event.target.value as EditorImageFit } as Partial<GuideContentBlock>)}
                              className="h-8 min-w-[58px] flex-[0_1_76px] rounded-md border border-white/10 bg-slate-900 px-1.5 text-[11px] normal-case tracking-normal text-white"
                              title="Fit keeps the image ratio. Stretch fit resizes the image to the selected width and height."
                            >
                              <option value="contain">Fit image</option>
                              <option value="cover">Stretch fit</option>
                            </select>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveBlockById(block.id, -1)}
                            disabled={index === 0}
                            className="h-8 w-6 shrink-0 p-0 text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-30"
                            title="Move section up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveBlockById(block.id, 1)}
                            disabled={index === content.blocks.length - 1}
                            className="h-8 w-6 shrink-0 p-0 text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-30"
                            title="Move section down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeBlock(block.id)} className="h-8 w-6 shrink-0 p-0 text-red-300 hover:bg-red-500/10 hover:text-red-200"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>

                      {block.type === "paragraph" ? (
                        <Textarea value={block.text} onChange={(event) => updateBlock(block.id, { text: event.target.value } as Partial<GuideContentBlock>)} rows={5} className="border-white/10 bg-slate-900 text-white" />
                      ) : null}

                      {block.type === "heading" ? (
                        <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                          <select value={block.level} onChange={(event) => updateBlock(block.id, { level: Number(event.target.value) as 2 | 3 } as Partial<GuideContentBlock>)} className="rounded-md border border-white/10 bg-slate-900 px-3 text-white">
                            <option value={2}>Heading 2</option>
                            <option value={3}>Heading 3</option>
                          </select>
                          <Input value={block.text} onChange={(event) => updateBlock(block.id, { text: event.target.value } as Partial<GuideContentBlock>)} className="border-white/10 bg-slate-900 text-white" />
                        </div>
                      ) : null}

                      {block.type === "image" ? (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Input value={block.url} onChange={(event) => updateBlock(block.id, { url: event.target.value } as Partial<GuideContentBlock>)} placeholder="Image URL" className="border-white/10 bg-slate-900 text-white" />
                            <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/15">
                              <ImagePlus className="h-4 w-4" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (event) => {
                                  const file = event.target.files?.[0]
                                  if (!file) return
                                  const url = await uploadImage(file, "inline")
                                  if (url) updateBlock(block.id, { url } as Partial<GuideContentBlock>)
                                  event.target.value = ""
                                }}
                              />
                            </label>
                          </div>
                          <Input value={block.caption || ""} onChange={(event) => updateBlock(block.id, { caption: event.target.value } as Partial<GuideContentBlock>)} placeholder="Caption" className="border-white/10 bg-slate-900 text-white" />
                        </div>
                      ) : null}

                      {block.type === "youtube" ? (
                        <div className="space-y-3">
                          <Input
                            value={block.url || block.videoId || ""}
                            onChange={(event) => {
                              const value = event.target.value
                              updateBlock(block.id, { url: value, videoId: extractYouTubeVideoId(value) || value } as Partial<GuideContentBlock>)
                            }}
                            placeholder="YouTube URL or video id"
                            className="border-white/10 bg-slate-900 text-white"
                          />
                          <Input value={block.caption || ""} onChange={(event) => updateBlock(block.id, { caption: event.target.value } as Partial<GuideContentBlock>)} placeholder="Caption" className="border-white/10 bg-slate-900 text-white" />
                        </div>
                      ) : null}

                      {block.type === "quote" ? (
                        <div className="space-y-3">
                          <Textarea value={block.text} onChange={(event) => updateBlock(block.id, { text: event.target.value } as Partial<GuideContentBlock>)} rows={3} className="border-white/10 bg-slate-900 text-white" />
                          <Input value={block.cite || ""} onChange={(event) => updateBlock(block.id, { cite: event.target.value } as Partial<GuideContentBlock>)} placeholder="Citation / source" className="border-white/10 bg-slate-900 text-white" />
                        </div>
                      ) : null}

                      {block.type === "list" ? (
                        <Textarea
                          value={block.items.join("\n")}
                          onChange={(event) => updateBlock(block.id, { items: event.target.value.split("\n") } as Partial<GuideContentBlock>)}
                          rows={5}
                          placeholder="One item per line"
                          className="border-white/10 bg-slate-900 text-white"
                        />
                      ) : null}

                      {block.type === "divider" ? <div className="py-4 text-center text-gray-500">Horizontal divider</div> : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div> : null}
            {message ? <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-green-200">{message}</div> : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="border-white/10 bg-slate-900/80 text-white">
              <CardContent className="p-5">
                <h2 className="mb-4 text-lg font-bold">Preview</h2>
                <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-slate-950">
                  {previewArticle.thumbnail_url ? <img src={previewArticle.thumbnail_url} alt="Preview thumbnail" className="h-48 w-full object-cover" /> : <div className="flex h-48 items-center justify-center text-gray-500">No thumbnail</div>}
                </div>
                <h3 className="text-2xl font-extrabold">{previewArticle.title}</h3>
                {previewArticle.summary ? <p className="mt-2 text-sm text-gray-300">{previewArticle.summary}</p> : null}
                <div className="mt-5 max-h-[680px] overflow-auto rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <GuideRenderer content={previewArticle.content} />
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}
