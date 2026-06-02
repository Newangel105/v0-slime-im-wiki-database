import type React from "react"
import { extractYouTubeVideoId, type GuideContent, type GuideContentBlock } from "@/lib/guides"

interface GuideRendererProps {
  content: GuideContent | null | undefined
}

type TextAlign = "left" | "center" | "right"
type ContentPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"

const BASE_BLOCK_HEIGHT = 280
const MIN_BLOCK_WIDTH = 25
const MAX_BLOCK_WIDTH = 100
const MIN_BLOCK_HEIGHT = 50
const MAX_BLOCK_HEIGHT = 250

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, Math.round(numeric)))
}

function blockWidthPercent(block: GuideContentBlock): number {
  if (typeof block.widthPercent === "number") {
    return clampNumber(block.widthPercent, MIN_BLOCK_WIDTH, MAX_BLOCK_WIDTH, 100)
  }

  if (block.width === "25" || block.width === "quarter") return 25
  if (block.width === "33") return 33
  if (block.width === "50" || block.width === "half") return 50
  if (block.width === "66") return 66
  if (block.width === "75" || block.width === "three-quarter") return 75
  return block.layout === "half" ? 50 : 100
}

function blockHeightPercent(block: GuideContentBlock): number | null {
  if (typeof block.heightPercent === "number") {
    return clampNumber(block.heightPercent, MIN_BLOCK_HEIGHT, MAX_BLOCK_HEIGHT, 100)
  }

  if (block.height === "50") return 50
  if (block.height === "75") return 75
  if (block.height === "100" || block.height === "medium") return 100
  if (block.height === "125") return 125
  if (block.height === "150" || block.height === "tall") return 150
  if (block.height === "200" || block.height === "extra-tall") return 200
  if (block.height === "short") return 75

  return null
}

function blockHeightPx(block: GuideContentBlock): number | null {
  const percent = blockHeightPercent(block)
  if (!percent) return null
  return Math.round((BASE_BLOCK_HEIGHT * percent) / 100)
}

function isTextBlock(block: GuideContentBlock): boolean {
  return block.type === "paragraph" || block.type === "heading" || block.type === "quote" || block.type === "list"
}

function textAlignClass(block: GuideContentBlock): string {
  const align = (block.textAlign || "left") as TextAlign
  if (align === "center") return "text-center"
  if (align === "right") return "text-right"
  return "text-left"
}

function contentPosition(block: GuideContentBlock): ContentPosition {
  if (block.contentPosition) return block.contentPosition as ContentPosition
  if (block.verticalAlign === "center") return "center"
  return "top-left"
}

function contentPositionClass(block: GuideContentBlock): string {
  const pos = contentPosition(block)

  const vertical = pos.startsWith("bottom")
    ? "justify-end"
    : pos.startsWith("middle") || pos === "center"
      ? "justify-center"
      : "justify-start"

  const horizontal = pos.endsWith("right")
    ? "items-end"
    : pos.endsWith("center") || pos === "center"
      ? "items-center"
      : "items-start"

  return `${vertical} ${horizontal}`
}

function blockWrapperStyle(block: GuideContentBlock): React.CSSProperties | undefined {
  const px = blockHeightPx(block)
  if (!px) return undefined
  return { minHeight: `${px}px` }
}

function mediaBoxStyle(block: GuideContentBlock): React.CSSProperties | undefined {
  const px = blockHeightPx(block)
  if (!px) return undefined
  return { height: `${px}px` }
}

function wrapperClass(block: GuideContentBlock): string {
  if (!isTextBlock(block)) return "min-w-0"
  return `flex min-w-0 flex-col ${contentPositionClass(block)}`
}

function imageFitClass(block: GuideContentBlock): string {
  return block.imageFit === "cover" ? "object-fill" : "object-contain"
}

function renderBlock(block: GuideContentBlock) {
  const alignClass = textAlignClass(block)

  if (block.type === "paragraph") {
    if (!block.text || !block.text.trim()) return null
    return <p className={`${alignClass} max-w-full whitespace-pre-wrap text-base leading-8 text-foreground/90`}>{block.text}</p>
  }

  if (block.type === "heading") {
    if (!block.text || !block.text.trim()) return null
    const Tag = block.level === 3 ? "h3" : "h2"
    return (
      <Tag className={`${alignClass} max-w-full ${block.level === 3 ? "text-xl font-black text-foreground" : "text-3xl font-black text-foreground"}`}>
        {block.text}
      </Tag>
    )
  }

  if (block.type === "image") {
    if (!block.url) return null
    const fixedHeight = Boolean(blockHeightPx(block))

    return (
      <figure className="overflow-hidden" style={fixedHeight ? mediaBoxStyle(block) : undefined}>
        <img
          src={block.url}
          alt={block.alt || block.caption || "Guide image"}
          className={`${fixedHeight ? "h-full" : "h-auto"} w-full ${imageFitClass(block)}`}
        />
        {block.caption ? <figcaption className="mt-2 text-sm text-muted-foreground">{block.caption}</figcaption> : null}
      </figure>
    )
  }

  if (block.type === "youtube") {
    const videoId = block.videoId || extractYouTubeVideoId(block.url || "")
    if (!videoId) return null
    const fixedHeight = Boolean(blockHeightPx(block))
    return (
      <figure className="overflow-hidden rounded-2xl border border-border bg-black/30">
        <div className={`${fixedHeight ? "" : "aspect-video"} w-full`} style={fixedHeight ? mediaBoxStyle(block) : undefined}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            title={block.caption || "YouTube video"}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        {block.caption ? <figcaption className="border-t border-border px-4 py-3 text-sm text-muted-foreground">{block.caption}</figcaption> : null}
      </figure>
    )
  }

  if (block.type === "quote") {
    return (
      <blockquote className={`${alignClass} max-w-full rounded-2xl border border-accent/25 bg-accent/10 px-5 py-5 text-foreground shadow-[0_0_24px_rgba(52,208,221,0.08)]`}>
        <p className="whitespace-pre-wrap text-lg italic leading-8">“{block.text}”</p>
        {block.cite ? <footer className="mt-3 text-sm font-semibold text-accent">— {block.cite}</footer> : null}
      </blockquote>
    )
  }

  if (block.type === "list") {
    const items = block.items.filter((item) => item.trim())
    if (items.length === 0) return null
    return (
      <ul className={`${alignClass} ${block.textAlign === "center" || block.textAlign === "right" ? "list-none pl-0" : "list-disc pl-6"} max-w-full space-y-2 text-foreground/90`}>
        {items.map((item, index) => (
          <li key={`${block.id}-${index}`} className="leading-7">
            {item}
          </li>
        ))}
      </ul>
    )
  }

  if (block.type === "divider") {
    return <hr className="border-border" />
  }

  return null
}

function renderFlowRow(row: GuideContentBlock[]) {
  return (
    <div key={`row-${row.map((block) => block.id).join("-")}`} className="-m-3 flex flex-wrap items-stretch">
      {row.map((block) => {
        const width = blockWidthPercent(block)
        return (
          <div key={block.id} className="min-w-0 p-3" style={{ width: `${width}%` }}>
            <div className={wrapperClass(block)} style={blockWrapperStyle(block)}>
              {renderBlock(block)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function GuideRenderer({ content }: GuideRendererProps) {
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []

  if (blocks.length === 0) {
    return <p className="text-muted-foreground">This guide does not have content yet.</p>
  }

  const nodes: React.ReactNode[] = []
  let row: GuideContentBlock[] = []
  let usedWidth = 0

  function flushRow() {
    if (row.length === 0) return
    nodes.push(renderFlowRow(row))
    row = []
    usedWidth = 0
  }

  for (const block of blocks) {
    const width = blockWidthPercent(block)

    if (width >= 100) {
      flushRow()
      row.push(block)
      usedWidth = 100
      flushRow()
      continue
    }

    if (row.length >= 4 || usedWidth + width > 100) {
      flushRow()
    }

    row.push(block)
    usedWidth += width

    if (usedWidth >= 100) {
      flushRow()
    }
  }

  flushRow()

  return <div className="space-y-6 text-foreground">{nodes}</div>
}
