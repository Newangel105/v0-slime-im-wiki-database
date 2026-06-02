"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, ImagePlus, Lock, Plus, Save, Trash2, Upload, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
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

  const panelClass = "glass-panel"
  const strongPanelClass = "glass-panel-strong"
  const fieldLabelClass = "mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400"
  const fieldClass = "theme-input"
  const textareaClass = "min-h-[120px] border-white/10 bg-[#1b1c20]/90 text-white placeholder:text-slate-500"
  const selectClass = "h-10 rounded-md border border-white/10 bg-[#1b1c20]/90 px-3 text-sm text-white outline-none transition focus:border-[#da3e44]/40 focus:ring-2 focus:ring-[#da3e44]/30"
  const tinySelectClass = "h-9 rounded-md border border-white/10 bg-[#1b1c20]/90 px-2.5 text-xs text-white outline-none transition focus:border-[#da3e44]/40 focus:ring-2 focus:ring-[#da3e44]/30"
  const controlBoxClass = "rounded-xl border border-white/10 bg-[#1b1c20]/70 p-3"

  if (loading) {
    return (
      <main className="site-page">
        <div className="site-container text-slate-300">Loading editor...</div>
      </main>
    )
  }

  if (error && !profile) {
    return (
      <main className="site-page">
        <div className="site-container max-w-4xl">
          <Button asChild variant="outline" className="mb-6">
            <Link href="/guides">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Guides
            </Link>
          </Button>
          <div className="glass-panel border-red-500/30 bg-red-500/10 p-6 text-red-200">{error}</div>
        </div>
      </main>
    )
  }

  if (mode === "edit" && article && isGuideLocked(article)) {
    return (
      <main className="site-page">
        <div className="site-container max-w-4xl">
          <Button asChild variant="outline" className="mb-6">
            <Link href="/guides/admin">
              <ArrowLeft className="mr-2 h-4 w-4" /> My Articles
            </Link>
          </Button>
          <div className="glass-panel border-white/10 p-6 text-slate-100">
            <div className="mb-2 flex items-center gap-2 text-lg font-bold text-white">
              <Lock className="h-5 w-5 text-[#ff8a98]" /> This article is locked
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
    <main className="site-page">
      <div className="site-container space-y-6">
        <section className={`${strongPanelClass} overflow-hidden p-6 sm:p-8`}>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <Button asChild variant="outline" className="mb-6">
                <Link href="/guides/admin">
                  <ArrowLeft className="mr-2 h-4 w-4" /> My Articles
                </Link>
              </Button>
              <div className="section-kicker">Guide Studio</div>
              <h1 className="section-title mt-3 text-4xl sm:text-5xl">
                {mode === "edit" ? "Edit guide" : "Create guide"}
              </h1>
              <div className="accent-rule my-5 max-w-md" />
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span className="inline-flex items-center rounded-full border border-[#da3e44]/25 bg-[#da3e44]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff8a98]">
                  {status}
                </span>
                <span>Writing as <span className="font-semibold text-white">{profile?.display_name}</span></span>
                <span className="text-slate-500">•</span>
                <span>{content.blocks.length} section{content.blocks.length === 1 ? "" : "s"}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => save("draft")} disabled={saving} variant="outline">
                <Save className="mr-2 h-4 w-4" /> {saving && status === "draft" ? "Saving..." : "Save Draft"}
              </Button>
              <Button onClick={() => save("published")} disabled={saving}>
                <Upload className="mr-2 h-4 w-4" /> {saving && status === "published" ? "Publishing..." : "Publish"}
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-6">
            <section className={`${panelClass} p-5 sm:p-6`}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <div className="section-kicker">Guide details</div>
                  <h2 className="mt-2 text-2xl font-black text-white">Article metadata</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-[#222327] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  Live autoset slug
                </span>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <Label className={fieldLabelClass}>Title</Label>
                  <Input
                    value={title}
                    onChange={(event) => {
                      const value = event.target.value
                      setTitle(value)
                      if (!article && !slug) setSlug(slugifyGuideTitle(value))
                    }}
                    placeholder="Enter guide title"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <Label className={fieldLabelClass}>Slug</Label>
                  <Input
                    value={slug}
                    onChange={(event) => setSlug(slugifyGuideTitle(event.target.value))}
                    placeholder="guide-url-slug"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <Label className={fieldLabelClass}>Status</Label>
                  <div className="h-10 rounded-md border border-white/10 bg-[#1b1c20]/90 px-3 text-sm text-white flex items-center">
                    {status}
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <Label className={fieldLabelClass}>Summary</Label>
                  <Textarea
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    rows={4}
                    placeholder="Add a short summary for the guide card and hero section"
                    className={textareaClass}
                  />
                </div>

                <div className="lg:col-span-2">
                  <Label className={fieldLabelClass}>Thumbnail</Label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      value={thumbnailUrl}
                      onChange={(event) => setThumbnailUrl(event.target.value)}
                      placeholder="Paste image URL or upload"
                      className={`${fieldClass} flex-1`}
                    />
                    <label className="quiet-button cursor-pointer">
                      <ImagePlus className="h-4 w-4" /> Upload image
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
              </div>
            </section>

            <section className={`${panelClass} p-5 sm:p-6`}>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="section-kicker">Composer</div>
                  <h2 className="mt-2 text-2xl font-black text-white">Build content blocks</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                    Create modular content rows. Blocks can be mixed in flexible widths from 25% to 100%.
                  </p>
                </div>
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => addBlock("paragraph")}><Plus className="mr-1 h-4 w-4" /> Paragraph</Button>
                <Button size="sm" variant="outline" onClick={() => addBlock("heading")}><Plus className="mr-1 h-4 w-4" /> Heading</Button>
                <Button size="sm" variant="outline" onClick={() => addBlock("image")}><Plus className="mr-1 h-4 w-4" /> Image</Button>
                <Button size="sm" variant="outline" onClick={addSideBySidePair} className="border-[#da3e44]/30 bg-[#da3e44]/10 text-[#ff97a3] hover:bg-[#da3e44]/15 hover:text-white"><Plus className="mr-1 h-4 w-4" /> Side by Side</Button>
                <Button size="sm" variant="outline" onClick={() => addBlock("youtube")}><Video className="mr-1 h-4 w-4" /> YouTube</Button>
                <Button size="sm" variant="outline" onClick={() => addBlock("quote")}>Quote</Button>
                <Button size="sm" variant="outline" onClick={() => addBlock("list")}>List</Button>
                <Button size="sm" variant="outline" onClick={() => addBlock("divider")}>Divider</Button>
              </div>

              <div className="space-y-4">
                {content.blocks.map((block, index) => {
                  const blockHeight = getBlockHeightPercent(block)
                  const widthValue = getBlockWidthPercent(block)
                  return (
                    <div key={block.id} className="overflow-hidden rounded-[20px] border border-white/10 bg-[#18191d]/88 shadow-[0_14px_40px_rgba(0,0,0,0.16)]">
                      <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(218,62,68,0.08),transparent_44%,rgba(255,255,255,0.02)_100%)] px-4 py-3 sm:px-5">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#222327] text-slate-400">
                              <GripVertical className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/10 bg-[#222327] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                                  Section {index + 1}
                                </span>
                                <span className="rounded-full border border-[#da3e44]/25 bg-[#da3e44]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff8a98]">
                                  {block.type}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">
                                Adjust width, height, and alignment, then fill the block content below.
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 gap-2 self-start xl:self-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => moveBlockById(block.id, -1)}
                              disabled={index === 0}
                              className="h-9 w-9 p-0 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-30"
                              title="Move section up"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => moveBlockById(block.id, 1)}
                              disabled={index === content.blocks.length - 1}
                              className="h-9 w-9 p-0 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-30"
                              title="Move section down"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeBlock(block.id)}
                              className="h-9 w-9 p-0 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                              title="Delete section"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 p-4 sm:p-5">
                        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                          <div className={controlBoxClass}>
                            <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                              <span>Width</span>
                              <span>{widthValue}%</span>
                            </div>
                            <input
                              type="range"
                              min={25}
                              max={100}
                              step={1}
                              value={widthValue}
                              onChange={(event) => updateBlock(block.id, widthPatch(Number(event.target.value)))}
                              className="w-full accent-[#da3e44]"
                            />
                          </div>

                          <div className={controlBoxClass}>
                            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Height</div>
                            <select
                              value={blockHeight === "auto" ? "auto" : String(blockHeight)}
                              onChange={(event) => {
                                const value = event.target.value
                                updateBlock(block.id, heightPatch(value === "auto" ? "auto" : Number(value)))
                              }}
                              className={`${tinySelectClass} w-full`}
                            >
                              <option value="auto">Auto</option>
                              <option value="50">50%</option>
                              <option value="75">75%</option>
                              <option value="100">100%</option>
                              <option value="125">125%</option>
                              <option value="150">150%</option>
                              <option value="200">200%</option>
                            </select>
                          </div>

                          {isTextBlock(block) ? (
                            <>
                              <div className={controlBoxClass}>
                                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Content position</div>
                                <select
                                  value={getContentPosition(block)}
                                  onChange={(event) => updateBlock(block.id, { contentPosition: event.target.value as EditorContentPosition } as Partial<GuideContentBlock>)}
                                  className={`${tinySelectClass} w-full`}
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
                              </div>

                              <div className={controlBoxClass}>
                                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Text align</div>
                                <select
                                  value={block.textAlign ?? "left"}
                                  onChange={(event) => updateBlock(block.id, { textAlign: event.target.value as EditorTextAlign } as Partial<GuideContentBlock>)}
                                  className={`${tinySelectClass} w-full`}
                                >
                                  <option value="left">Left</option>
                                  <option value="center">Center</option>
                                  <option value="right">Right</option>
                                </select>
                              </div>
                            </>
                          ) : null}

                          {block.type === "image" ? (
                            <div className={controlBoxClass}>
                              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Image fit</div>
                              <select
                                value={(block.imageFit ?? "contain") as EditorImageFit}
                                onChange={(event) => updateBlock(block.id, { imageFit: event.target.value as EditorImageFit } as Partial<GuideContentBlock>)}
                                className={`${tinySelectClass} w-full`}
                                title="Fit keeps the image ratio. Stretch fit resizes the image to the selected width and height."
                              >
                                <option value="contain">Fit image</option>
                                <option value="cover">Stretch fit</option>
                              </select>
                            </div>
                          ) : null}
                        </div>

                        {block.type === "paragraph" ? (
                          <Textarea
                            value={block.text}
                            onChange={(event) => updateBlock(block.id, { text: event.target.value } as Partial<GuideContentBlock>)}
                            rows={6}
                            placeholder="Write paragraph text..."
                            className={textareaClass}
                          />
                        ) : null}

                        {block.type === "heading" ? (
                          <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                            <select
                              value={block.level}
                              onChange={(event) => updateBlock(block.id, { level: Number(event.target.value) as 2 | 3 } as Partial<GuideContentBlock>)}
                              className={selectClass}
                            >
                              <option value={2}>Heading 2</option>
                              <option value={3}>Heading 3</option>
                            </select>
                            <Input
                              value={block.text}
                              onChange={(event) => updateBlock(block.id, { text: event.target.value } as Partial<GuideContentBlock>)}
                              placeholder="Heading text"
                              className={fieldClass}
                            />
                          </div>
                        ) : null}

                        {block.type === "image" ? (
                          <div className="space-y-3">
                            <div className="flex flex-col gap-3 sm:flex-row">
                              <Input
                                value={block.url}
                                onChange={(event) => updateBlock(block.id, { url: event.target.value } as Partial<GuideContentBlock>)}
                                placeholder="Image URL"
                                className={`${fieldClass} flex-1`}
                              />
                              <label className="quiet-button cursor-pointer">
                                <ImagePlus className="h-4 w-4" /> Upload
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
                            <Input
                              value={block.caption || ""}
                              onChange={(event) => updateBlock(block.id, { caption: event.target.value } as Partial<GuideContentBlock>)}
                              placeholder="Caption"
                              className={fieldClass}
                            />
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
                              className={fieldClass}
                            />
                            <Input
                              value={block.caption || ""}
                              onChange={(event) => updateBlock(block.id, { caption: event.target.value } as Partial<GuideContentBlock>)}
                              placeholder="Caption"
                              className={fieldClass}
                            />
                          </div>
                        ) : null}

                        {block.type === "quote" ? (
                          <div className="space-y-3">
                            <Textarea
                              value={block.text}
                              onChange={(event) => updateBlock(block.id, { text: event.target.value } as Partial<GuideContentBlock>)}
                              rows={4}
                              placeholder="Quote text"
                              className={textareaClass}
                            />
                            <Input
                              value={block.cite || ""}
                              onChange={(event) => updateBlock(block.id, { cite: event.target.value } as Partial<GuideContentBlock>)}
                              placeholder="Citation / source"
                              className={fieldClass}
                            />
                          </div>
                        ) : null}

                        {block.type === "list" ? (
                          <Textarea
                            value={block.items.join("\n")}
                            onChange={(event) => updateBlock(block.id, { items: event.target.value.split("\n") } as Partial<GuideContentBlock>)}
                            rows={6}
                            placeholder="One item per line"
                            className={textareaClass}
                          />
                        ) : null}

                        {block.type === "divider" ? (
                          <div className="rounded-xl border border-dashed border-white/10 bg-[#111216] px-4 py-8 text-center text-slate-500">
                            Horizontal divider
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {error ? <div className="glass-panel border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div> : null}
            {message ? <div className="glass-panel border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">{message}</div> : null}
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <section className={`${strongPanelClass} overflow-hidden p-5`}>
              <div className="section-kicker">Live Preview</div>
              <h2 className="mt-2 text-2xl font-black text-white">Guide preview</h2>
              <div className="accent-rule my-4" />

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111216]">
                {previewArticle.thumbnail_url ? (
                  <img src={previewArticle.thumbnail_url} alt="Preview thumbnail" className="h-52 w-full object-cover" />
                ) : (
                  <div className="flex h-52 items-center justify-center bg-[radial-gradient(circle_at_18%_-8%,rgba(218,62,68,0.16),transparent_22rem),linear-gradient(135deg,#191a1e_0%,#1f2024_46%,#242529_100%)] text-sm font-semibold text-slate-500">
                    No thumbnail selected
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-[#18191d]/88 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-[#da3e44]/25 bg-[#da3e44]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff8a98]">
                    {previewArticle.status}
                  </span>
                  <span className="text-xs text-slate-400">/{previewArticle.slug}</span>
                </div>
                <h3 className="text-2xl font-black text-white">{previewArticle.title}</h3>
                {previewArticle.summary ? <p className="mt-3 text-sm leading-6 text-slate-300">{previewArticle.summary}</p> : null}
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <span>By {previewArticle.author_name}</span>
                  <span>•</span>
                  <span>{content.blocks.length} section{content.blocks.length === 1 ? "" : "s"}</span>
                </div>
              </div>

              <div className="mt-5 max-h-[720px] overflow-auto rounded-2xl border border-white/10 bg-[#121319]/70 p-4 image-scroll">
                <GuideRenderer content={previewArticle.content} />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
