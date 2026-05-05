import type React from "react"
import { extractYouTubeVideoId, type GuideContent, type GuideContentBlock } from "@/lib/guides"

interface GuideRendererProps {
  content: GuideContent | null | undefined
}

function blockLayout(block: GuideContentBlock): "full" | "half" {
  return block.layout === "half" ? "half" : "full"
}

function isTextBlock(block: GuideContentBlock): boolean {
  return block.type === "paragraph" || block.type === "heading" || block.type === "quote" || block.type === "list"
}

function textAlignClass(block: GuideContentBlock): string {
  return block.textAlign === "center" ? "text-center" : "text-left"
}

function textBlockShellClass(block: GuideContentBlock): string {
  if (!isTextBlock(block)) return "min-w-0"

  if (block.verticalAlign === "center") {
    return "flex h-full min-h-[160px] min-w-0 flex-col justify-center"
  }

  return "min-w-0"
}

function renderBlock(block: GuideContentBlock, compact = false) {
  const alignClass = textAlignClass(block)

  if (block.type === "paragraph") {
    return (
      <p className={`${alignClass} whitespace-pre-wrap text-base leading-8 text-gray-200`}>
        {block.text}
      </p>
    )
  }

  if (block.type === "heading") {
    const Tag = block.level === 3 ? "h3" : "h2"
    return (
      <Tag className={`${alignClass} ${block.level === 3 ? "text-xl font-bold text-white" : "text-2xl font-extrabold text-white"}`}>
        {block.text}
      </Tag>
    )
  }

  if (block.type === "image") {
    if (!block.url) return null
    return (
      <figure className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <img
          src={block.url}
          alt={block.alt || block.caption || "Guide image"}
          className={`${compact ? "max-h-[460px]" : "max-h-[680px]"} w-full object-contain`}
        />
        {block.caption ? <figcaption className="border-t border-white/10 px-4 py-3 text-sm text-gray-300">{block.caption}</figcaption> : null}
      </figure>
    )
  }

  if (block.type === "youtube") {
    const videoId = block.videoId || extractYouTubeVideoId(block.url || "")
    if (!videoId) return null
    return (
      <figure className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <div className="aspect-video w-full">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            title={block.caption || "YouTube video"}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        {block.caption ? <figcaption className="border-t border-white/10 px-4 py-3 text-sm text-gray-300">{block.caption}</figcaption> : null}
      </figure>
    )
  }

  if (block.type === "quote") {
    return (
      <blockquote className={`${alignClass} rounded-2xl border-l-4 border-cyan-400 bg-cyan-400/10 px-5 py-4 text-gray-100`}>
        <p className="whitespace-pre-wrap text-lg italic leading-8">“{block.text}”</p>
        {block.cite ? <footer className="mt-3 text-sm font-semibold text-cyan-200">— {block.cite}</footer> : null}
      </blockquote>
    )
  }

  if (block.type === "list") {
    const items = block.items.filter((item) => item.trim())
    if (items.length === 0) return null
    return (
      <ul className={`${alignClass} ${block.textAlign === "center" ? "list-none pl-0" : "list-disc pl-6"} space-y-2 text-gray-200`}>
        {items.map((item, index) => (
          <li key={`${block.id}-${index}`} className="leading-7">
            {item}
          </li>
        ))}
      </ul>
    )
  }

  if (block.type === "divider") {
    return <hr className="border-white/10" />
  }

  return null
}

export function GuideRenderer({ content }: GuideRendererProps) {
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []

  if (blocks.length === 0) {
    return <p className="text-gray-400">This guide does not have content yet.</p>
  }

  const nodes: React.ReactNode[] = []
  let halfRow: GuideContentBlock[] = []

  function flushHalfRow() {
    if (halfRow.length === 0) return

    const row = halfRow
    halfRow = []

    nodes.push(
      <div key={`row-${row.map((block) => block.id).join("-")}`} className="grid items-stretch gap-6 md:grid-cols-2">
        {row.map((block) => (
          <div key={block.id} className={textBlockShellClass(block)}>
            {renderBlock(block, true)}
          </div>
        ))}
      </div>,
    )
  }

  for (const block of blocks) {
    if (blockLayout(block) === "half") {
      halfRow.push(block)
      if (halfRow.length === 2) flushHalfRow()
      continue
    }

    flushHalfRow()
    nodes.push(
      <div key={block.id} className={textBlockShellClass(block)}>
        {renderBlock(block)}
      </div>,
    )
  }

  flushHalfRow()

  return <div className="space-y-6 text-gray-100">{nodes}</div>
}
