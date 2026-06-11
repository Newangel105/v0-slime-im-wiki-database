"use client"

import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react"
import { PrefabSpec, PrefabNode, SUMMON_UI_BASE } from "@/lib/summon-ui/specs"

type ColorLike = { r?: number; g?: number; b?: number; a?: number; rgba?: number } | number[] | null | undefined

function rgba(c: ColorLike, fallback = "rgba(255,255,255,1)") {
  if (!c) return fallback
  let r: number, g: number, b: number, a: number
  if (Array.isArray(c)) {
    ;[r, g, b, a] = c as number[]
  } else {
    if (typeof c.rgba === "number") {
      const packed = c.rgba >>> 0
      r = packed & 0xff
      g = (packed >>> 8) & 0xff
      b = (packed >>> 16) & 0xff
      a = (packed >>> 24) & 0xff
    } else {
      r = c.r ?? 255
      g = c.g ?? 255
      b = c.b ?? 255
      a = c.a ?? 1
    }
  }
  // float 0..1 if max <= 1, else byte 0..255
  const max = Math.max(r, g, b)
  const s = max <= 1.0001 ? 255 : 1
  return `rgba(${Math.round(r * s)},${Math.round(g * s)},${Math.round(b * s)},${a <= 1.0001 ? a : a / 255})`
}

function isWhite(t?: PrefabNode["tint"]) {
  if (!t) return true
  return t[0] > 0.92 && t[1] > 0.92 && t[2] > 0.92
}

function horizontalAlignment(align?: number | null) {
  const horizontal = (align ?? 2) & 0x7
  if (horizontal === 1) return { justifyContent: "flex-start", textAlign: "left" } as const
  if (horizontal === 4) return { justifyContent: "flex-end", textAlign: "right" } as const
  return { justifyContent: "center", textAlign: "center" } as const
}

function unitySliceParts(border: [number, number, number, number], iw: number, ih: number) {
  let [left, bottom, right, top] = border
  const horizontalDegenerate = left + right >= iw && left > 0 && right > 0
  const verticalDegenerate = bottom + top >= ih && bottom > 0 && top > 0

  // Unity's sliced Image can render sprites whose border consumes the whole
  // source width/height (common for long buttons and rule lines). CSS
  // border-image treats that as no fillable center, so give the browser a
  // 1-2px center strip while keeping the rendered border width from Unity.
  if (horizontalDegenerate) {
    left = Math.max(0, left - 1)
    right = Math.max(0, right - 1)
  }
  if (verticalDegenerate) {
    bottom = Math.max(0, bottom - 1)
    top = Math.max(0, top - 1)
  }

  return {
    slice: [left, bottom, right, top] as [number, number, number, number],
    width: border,
  }
}

/**
 * Renders a game UI prefab spec 1:1. Every rect/sprite is the prefab's own;
 * dynamic content is injected by node name via `text` / `slots`.
 */
export function PrefabLayer({
  spec,
  text,
  slots,
  hide,
  replace,
  onNodeClick,
  className,
  style,
  fill,
  nodeStyle,
  textStyle,
}: {
  spec: PrefabSpec
  text?: Record<string, ReactNode>
  slots?: Record<string, ReactNode>
  hide?: string[]
  replace?: string[]
  onNodeClick?: Record<string, () => void>
  className?: string
  style?: CSSProperties
  // fill: stretch to the parent box instead of locking the prefab's aspect
  // ratio. The game's modal windows stretch full-screen-width while keeping a
  // fixed canvas-height, so node %s still map correctly onto a wider box.
  fill?: boolean
  // Per-node box overrides (positioning / scaling only). Used to correct
  // fixed-pixel game elements that would otherwise scale with a wide modal
  // (e.g. the Bazaar Pts banner). The real sprite is unchanged.
  nodeStyle?: Record<string, CSSProperties>
  // Per-node text paint overrides. This keeps the prefab/TMP sizing logic
  // intact while letting runtime English labels use the game's decoded colors.
  textStyle?: Record<string, CSSProperties>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [layerW, setLayerW] = useState(0)
  const [cw, ch] = spec.canvas

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Unity's CanvasScaler is effectively height-matched in landscape, so
    // text / 9-slice scale follows the rendered height vs canvas height.
    const measure = () => {
      setScale(el.clientHeight / ch)
      setLayerW(el.clientWidth)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [ch])

  const hidden = new Set(hide || [])
  const replaced = new Set(replace || [])
  const classPositions = /\b(absolute|fixed|relative|sticky)\b/.test(className || "")
  const seen = new Map<string, number>()
  const nodes = spec.nodes.map((node) => {
    const count = (seen.get(node.name) ?? 0) + 1
    seen.set(node.name, count)
    return { node, keyName: `${node.name}#${count}` }
  })

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...(classPositions ? {} : { position: "relative" }),
        ...(fill ? {} : { aspectRatio: `${cw} / ${ch}` }),
        ...style,
      }}
    >
      {nodes.map(({ node: n, keyName }, i) => {
        if (hidden.has(n.name) || hidden.has(keyName)) return null
        // In-game these are anchored to the full-screen canvas with negative
        // insets, so the rect overflows our modal box. Full-bleed sprites
        // (w≥88: mask / frame / corners that mirror-tile) must keep overflowing
        // to compose; but a contained text block or a button (e.g. the
        // bottom-right "Recruit Details" button at x96 w34) should be clamped
        // inside so it isn't clipped/wrapped off-screen.
        const overflows = n.x < 0 || n.x + n.w > 100
        const fullBleed = n.w >= 88 && !n.text
        const clamp = overflows && !fullBleed && (!!n.text || !!n.img)
        let bx = n.x
        let bw = n.w
        if (clamp) {
          if (n.text) {
            // wide text rect: keep width, just bring on-screen, text is centred
            bx = Math.max(0, Math.min(n.x, 100 - n.w))
            bw = Math.min(n.w, 100)
            if (n.x < 0 && n.x + n.w > 100) {
              bx = 0
              bw = 100
            }
          } else {
            // button/sprite: shift fully inside, preserve size
            bw = Math.min(n.w, 100)
            bx = Math.max(0, Math.min(n.x, 100 - bw))
          }
        }
        const box: CSSProperties = {
          position: "absolute",
          left: `${bx}%`,
          top: `${n.y}%`,
          width: `${bw}%`,
          height: `${n.h}%`,
          ...(nodeStyle?.[keyName] ?? nodeStyle?.[n.name]),
        }
        const click = onNodeClick?.[keyName] ?? onNodeClick?.[n.name]
        if (click) {
          box.cursor = "pointer"
        }
        const slot = slots?.[keyName] ?? slots?.[n.name]
        const override = text?.[keyName] ?? text?.[n.name]
        const replaceInner = replaced.has(n.name) || replaced.has(keyName)

        let inner: ReactNode = null
        if (n.img && !replaceInner) {
          const url = `${SUMMON_UI_BASE}/${n.img.replace(/\.png$/, ".webp")}`
          const bd = n.border
          // Unity sliced sprites often have a zero-width/zero-height source
          // center (for example btnCommonGreen, btnCommonBlack, pointsBase,
          // lineH, btnDecisionNormal). Rendering those as raw stretched images
          // distorts borders and turns rule lines into red/green smears. CSS
          // border-image needs a tiny center strip, which unitySliceParts()
          // synthesizes by shaving one source pixel from the border slice.
          const hasCenter =
            !!bd && !!n.iw && !!n.ih &&
            bd[0] + bd[2] < n.iw - 0.5 &&
            bd[1] + bd[3] < n.ih - 0.5
          const borderOnly =
            !!bd &&
            !!n.iw &&
            !!n.ih &&
            !hasCenter &&
            (n.name === "frame" || n.name === "topLabel" || n.img === "aa6f554707741d55.png")
          const canSlice = !!(n.sliced && bd && bd.some((v) => v > 0) && n.iw && n.ih)
          if (canSlice && bd) {
            // Unity 9-slice. m_Border = [left, bottom, right, top].
            const parts = borderOnly ? { slice: bd, width: bd } : unitySliceParts(bd, n.iw as number, n.ih as number)
            const [sl, sb, sr, st] = parts.slice
            const [wl, wb, wr, wt] = parts.width
            inner = (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderStyle: "solid",
                  borderImageSource: `url(${url})`,
                  borderImageSlice: `${st} ${sr} ${sb} ${sl}${borderOnly ? "" : " fill"}`,
                  borderImageWidth: `${wt * scale}px ${wr * scale}px ${wb * scale}px ${wl * scale}px`,
                  borderImageRepeat: "stretch",
                  ...(isWhite(n.tint) ? {} : { filter: "none" }),
                }}
              />
            )
          } else if (!isWhite(n.tint)) {
            // tinted (Unity multiplies sprite by color) -> exact via CSS mask.
            // contain preserves the sprite aspect (no stretch).
            inner = (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: rgba(n.tint),
                  WebkitMaskImage: `url(${url})`,
                  maskImage: `url(${url})`,
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                }}
              />
            )
          } else {
            // Non-sliced sprite: preserve aspect (the game's design size is the
            // node rect; never distort the art — hard project rule).
            inner = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt=""
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            )
          }
        }

        return (
          <div key={`${keyName}-${i}`} style={box} onClick={click}>
            {inner}
            {slot ? <div style={{ position: "absolute", inset: 0 }}>{slot}</div> : null}
            {n.text && override !== undefined ? (() => {
              const baseSize = (n.text.size || 28) * scale
              // A label (the spec string has no newline) must stay on ONE line,
              // shrinking to fit the node width like Unity's TMP auto-size —
              // e.g. "Recruit Details/Drop Rates" in a button sized for the
              // shorter Japanese original. Multi-line blocks keep pre-line.
              const singleLine = !/\n/.test(n.text.v || "")
              const txt = typeof override === "string" ? override : n.text.v || ""
              const availW = (bw / 100) * layerW
              const fitSize =
                singleLine && availW > 0 && txt.length > 0
                  ? Math.max(7, Math.min(baseSize, (availW * 0.96) / (txt.length * 0.54)))
                  : baseSize
              return (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    ...horizontalAlignment(n.text.align),
                    color: rgba(n.text.color),
                    fontSize: `${fitSize}px`,
                    fontFamily: '"Times New Roman", Georgia, serif',
                    fontWeight: 700,
                    letterSpacing: 0,
                    lineHeight: 1.05,
                    whiteSpace: singleLine ? "nowrap" : "pre-line",
                    textShadow: "0 1px 2px rgba(0,0,0,0.95), 0 0 1px rgba(0,0,0,0.95)",
                    overflow: "visible",
                    ...(textStyle?.[keyName] ?? textStyle?.[n.name]),
                  }}
                >
                  {override}
                </div>
              )
            })() : null}
          </div>
        )
      })}
    </div>
  )
}
