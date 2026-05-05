import { extractYouTubeVideoId, type GuideContent } from "@/lib/guides"

interface GuideRendererProps {
  content: GuideContent | null | undefined
}

export function GuideRenderer({ content }: GuideRendererProps) {
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []

  if (blocks.length === 0) {
    return <p className="text-gray-400">This guide does not have content yet.</p>
  }

  return (
    <div className="space-y-6 text-gray-100">
      {blocks.map((block) => {
        if (block.type === "paragraph") {
          return (
            <p key={block.id} className="whitespace-pre-wrap text-base leading-8 text-gray-200">
              {block.text}
            </p>
          )
        }

        if (block.type === "heading") {
          const Tag = block.level === 3 ? "h3" : "h2"
          return (
            <Tag key={block.id} className={block.level === 3 ? "text-xl font-bold text-white" : "text-2xl font-extrabold text-white"}>
              {block.text}
            </Tag>
          )
        }

        if (block.type === "image") {
          if (!block.url) return null
          return (
            <figure key={block.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <img src={block.url} alt={block.alt || block.caption || "Guide image"} className="max-h-[680px] w-full object-contain" />
              {block.caption ? <figcaption className="border-t border-white/10 px-4 py-3 text-sm text-gray-300">{block.caption}</figcaption> : null}
            </figure>
          )
        }

        if (block.type === "youtube") {
          const videoId = block.videoId || extractYouTubeVideoId(block.url || "")
          if (!videoId) return null
          return (
            <figure key={block.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
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
            <blockquote key={block.id} className="rounded-2xl border-l-4 border-cyan-400 bg-cyan-400/10 px-5 py-4 text-gray-100">
              <p className="whitespace-pre-wrap text-lg italic leading-8">“{block.text}”</p>
              {block.cite ? <footer className="mt-3 text-sm font-semibold text-cyan-200">— {block.cite}</footer> : null}
            </blockquote>
          )
        }

        if (block.type === "list") {
          const items = block.items.filter((item) => item.trim())
          if (items.length === 0) return null
          return (
            <ul key={block.id} className="list-disc space-y-2 pl-6 text-gray-200">
              {items.map((item, index) => (
                <li key={`${block.id}-${index}`} className="leading-7">
                  {item}
                </li>
              ))}
            </ul>
          )
        }

        if (block.type === "divider") {
          return <hr key={block.id} className="border-white/10" />
        }

        return null
      })}
    </div>
  )
}
