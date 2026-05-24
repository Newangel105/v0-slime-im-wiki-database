"use client"

// PrefabTree — a faithful Unity RectTransform → CSS layout engine.
//
// Unlike the old flat PrefabLayer (which pre-flattened the prefab to %
// rects and dropped localScale / masks / CanvasGroup / sibling order),
// this renders the REAL nested prefab tree. The DOM nesting mirrors the
// prefab parent→child hierarchy 1:1, so the browser's own CSS transform /
// opacity / overflow cascade reproduces Unity's localScale / CanvasGroup /
// Mask cascade exactly.
//
// Each node is an absolutely-positioned box inside its parent's content
// box, placed with the exact Unity anchor/pivot/anchoredPosition/sizeDelta
// formula (in design px), then `transform: scale(localScale)` about the
// pivot. The root design box (e.g. 1920×1080) is fitted into the rendered
// area (contain = letterbox, like Unity's centred fixed canvas).
//
// Source trees: lib/summon-ui/prefab_trees/<Prefab>.tree.json
// (built by _work/build_prefab_tree.py from the resolved prefab dump).

import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState, Fragment } from "react"
import { SUMMON_UI_BASE } from "@/lib/summon-ui/specs"

export type TreeRectData = {
  anchorMin: [number, number]
  anchorMax: [number, number]
  anchoredPosition: [number, number]
  sizeDelta: [number, number]
  pivot: [number, number]
  localScale: [number, number]
}
export type TreeColor = { r?: number; g?: number; b?: number; a?: number; rgba?: number } | null
export type TreeNode = {
  name: string
  path: string
  active: boolean
  rect: TreeRectData
  comp: {
    image: { img: string; iw: number; ih: number; border: number[]; color: TreeColor; imgType: number | null; fill: number | null } | null
    rawImage: { img?: string; iw?: number; ih?: number; color: TreeColor } | null
    text: { v: string | null; size: number | null; color: TreeColor; align: number | null } | null
    // Unity has TWO distinct masking components:
    //   isSpriteMask / isMask  — UnityEngine.UI.Mask, clips children by
    //                            the host Image/RawImage's sprite alpha
    //                            (like SVG clip-path). NOT a rect clip.
    //   isRectMask  / isRectMask2D — UnityEngine.UI.RectMask2D, clips
    //                                children to the host's RectTransform
    //                                bounding rect (≡ CSS overflow:hidden).
    // The new explicit names (isSpriteMask / isRectMask) come from
    // _work/build_prefab_tree.py. Legacy names are kept for backwards
    // compat with older tree JSON files; renderNode reads BOTH.
    isMask: boolean
    isRectMask2D: boolean
    isSpriteMask?: boolean
    isRectMask?: boolean
    canvasGroupAlpha: number | null
    isParticle: boolean
    scripts: string[]
  }
  children: TreeNode[]
}
export type PrefabTreeJson = { prefab: string; root: TreeNode }

function colorCss(c: TreeColor, fallback = "rgba(255,255,255,1)"): string {
  if (!c) return fallback
  if (typeof c.rgba === "number") {
    const p = c.rgba >>> 0
    return `rgba(${p & 255},${(p >>> 8) & 255},${(p >>> 16) & 255},${((p >>> 24) & 255) / 255})`
  }
  const r = c.r ?? 1, g = c.g ?? 1, b = c.b ?? 1, a = c.a ?? 1
  const s = Math.max(r, g, b) <= 1.0001 ? 255 : 1
  return `rgba(${Math.round(r * s)},${Math.round(g * s)},${Math.round(b * s)},${a <= 1.0001 ? a : a / 255})`
}

function colorAlpha(c: TreeColor): number {
  if (!c) return 1
  if (typeof c.rgba === "number") {
    const p = c.rgba >>> 0
    return ((p >>> 24) & 255) / 255
  }
  const a = c.a
  if (typeof a !== "number") return 1
  // Float 0..1 vs byte 0..255: heuristic — if value > 1.01 treat as byte
  return a > 1.01 ? a / 255 : a
}

function isWhite(c: TreeColor): boolean {
  if (!c) return true
  if (typeof c.rgba === "number") {
    const p = c.rgba >>> 0
    return (p & 255) > 235 && ((p >>> 8) & 255) > 235 && ((p >>> 16) & 255) > 235
  }
  return (c.r ?? 1) > 0.92 && (c.g ?? 1) > 0.92 && (c.b ?? 1) > 0.92
}

// Compute a child's design-space rect (px, CSS y-down) inside a parent
// content box of size (pw, ph). Exact Unity RectTransform formula.
function childRect(r: TreeRectData, pw: number, ph: number) {
  const w = (r.anchorMax[0] - r.anchorMin[0]) * pw + r.sizeDelta[0]
  const h = (r.anchorMax[1] - r.anchorMin[1]) * ph + r.sizeDelta[1]
  const anchorCx = ((r.anchorMin[0] + r.anchorMax[0]) / 2) * pw
  const anchorCy = ((r.anchorMin[1] + r.anchorMax[1]) / 2) * ph
  const pivotX = anchorCx + r.anchoredPosition[0]
  const pivotY = anchorCy + r.anchoredPosition[1]
  const blX = pivotX - r.pivot[0] * w // bottom-left, y-up
  const blY = pivotY - r.pivot[1] * h
  const cssLeft = blX
  const cssTop = ph - (blY + h) // flip to y-down
  return { left: cssLeft, top: cssTop, w, h }
}

// Walk the prefab tree to nodePath and return the node's design-space
// bounding box (CSS y-down px) inside the root designSize. Throws if the
// path isn't found — callers must not rely on fallback positions, so a
// missing node surfaces as a hard error instead of a silent off-position
// render.
export function getNodeBoundingBox(
  tree: PrefabTreeJson,
  nodePath: string,
  designSize: [number, number],
): { left: number; top: number; w: number; h: number } {
  const [dw, dh] = designSize
  // The root of the prefab is the canvas; the tree's first level is its
  // direct children. Find the parent chain from root to nodePath.
  const chain: TreeNode[] = []
  function find(node: TreeNode, target: string): boolean {
    if (node.path === target) {
      chain.push(node)
      return true
    }
    for (const c of node.children) {
      if (find(c, target)) {
        chain.unshift(node)
        return true
      }
    }
    return false
  }
  if (!find(tree.root, nodePath)) {
    throw new Error(`PrefabTree: node not found at path "${nodePath}" in prefab "${tree.prefab}"`)
  }
  // chain[0] = root, chain[end] = target. The root's content box is the
  // design canvas (root rect is full-canvas for our extracted prefabs).
  let parentW = dw
  let parentH = dh
  let acc = { left: 0, top: 0, w: dw, h: dh }
  for (let i = 1; i < chain.length; i += 1) {
    const r = childRect(chain[i].rect, parentW, parentH)
    acc = { left: acc.left + r.left, top: acc.top + r.top, w: r.w, h: r.h }
    parentW = r.w
    parentH = r.h
  }
  return acc
}

// One row from extract_appear_image_materials.py /
// extract_result_image_materials.py — the resolved GPU blend state for a
// single Image/RawImage component (after factoring in shader Pass property
// references like UI-VFXDefault's `_Src`/`_Dst`).
export type ImageMaterialEntry = {
  path: string
  component: "Image" | "RawImage" | string
  material_pid: number
  material_name: string | null
  shader_name: string
  src_blend: number
  dst_blend: number
  // Resolved blend mode label: "alpha" | "premultiplied" | "additive" |
  // "additive_alpha_weighted" | "alpha_minus_color" | "multiply" |
  // "opaque_replace" | "custom(s,d)".
  blend_mode: string
}
export type ImageMaterialsJson = { _meta?: string; components: ImageMaterialEntry[] }

// One entry from character_appear_per_rarity_swaps.json. At runtime the
// Animator's Appear<rarity> clip swaps the Sprite / Texture / Material on
// specific Image/RawImage nodes via m_PPtrCurves. PrefabTree applies these
// overrides per-rarity so the rendered asset matches what the game shows.
export type RaritySwapEntry = {
  // Path WITHOUT the prefab-root prefix (e.g. "container/characterName/base/efUltimate").
  path: string
  // "m_Sprite" | "m_Texture" | "m_Material" | "m_Materials[0]"
  attribute: string
  target_kind: "Sprite" | "Texture2D" | "Material" | string | null
  target_name: string | null
  target_file_hash?: string  // 16-char lowercase hex (= matching /UI/summon/<hash>.png)
  resolution_note?: string
}
export type RaritySwapColorFinal = {
  path: string
  attribute: "m_Color.r" | "m_Color.g" | "m_Color.b" | "m_Color.a"
  first: number
  last: number
}
export type RaritySwapsRarity = {
  stopTime: number
  swaps: RaritySwapEntry[]
  color_finals: RaritySwapColorFinal[]
  color_animated?: unknown[]
  active_finals?: unknown[]
  // Paths (relative to prefab root) whose m_IsActive ends ≤ 0.7 at the
  // Animator clip's stopTime — i.e. nodes that should NOT render at the end
  // of the Appear<rarity> animation. Direct output of the clip's settled
  // state, no heuristics.
  hide_paths_from_active_finals?: string[]
}
export type RaritySwapsJson = {
  _meta?: string
  rarities: Record<string, RaritySwapsRarity>
}

export type PrefabTreeProps = {
  tree: PrefabTreeJson
  // Design canvas size (e.g. [1920,1080] for CharacterAppear container).
  designSize: [number, number]
  // "contain" letterboxes the design box (Unity centred fixed canvas);
  // "stretch" fills the rendered area (Unity full-stretch container).
  fit?: "contain" | "stretch"
  // Inject a React node at a prefab path or node name (replaces that
  // node's own visual; children still render).
  slots?: Record<string, ReactNode>
  // Like `slots` but also suppresses the node's prefab children — use
  // when the injected component fully replaces a subtree (e.g.
  // RuntimeThumbReward replacing the thumbReward sub-prefab).
  slotsReplaceSubtree?: Record<string, ReactNode>
  // Hide nodes (and their subtree) by path or name.
  hide?: Set<string> | string[]
  // Force-show nodes that are inactive in the prefab (by path or name).
  show?: Set<string> | string[]
  // Override TMP text content by path or name.
  text?: Record<string, ReactNode>
  // Per-node extra style by path or name (escape hatch; avoid for layout).
  nodeStyle?: Record<string, CSSProperties>
  // Per-node TMP text style overrides (applied to the AutoFitText inner
  // container, where the hardcoded fontSize/fontWeight/fontStyle live).
  // Setting `fontSize: "24px"` here genuinely overrides the prefab's
  // baseFontSize. `nodeStyle` cannot do this — it only styles the outer
  // box wrapper, which AutoFitText's inline fontSize overrides.
  textStyle?: Record<string, CSSProperties>
  // Per-component blend-mode data extracted from the prefab + dep bundles.
  // When provided, PrefabTree applies the real GPU blend state per node
  // (mapping additive_alpha_weighted/additive → mix-blend-mode: plus-lighter
  // with screen fallback). When omitted, all nodes render with normal alpha.
  imageMaterials?: ImageMaterialsJson
  // Per-rarity Sprite/Texture/Material PPtr swap data (from the Animator's
  // Appear<rarity> clip pptrCurveMapping). Pair with `viewRarity` to apply.
  raritySwaps?: RaritySwapsJson
  // The viewRarity tier to apply swaps for. Must be one of the keys in
  // raritySwaps.rarities (e.g. "R" / "SR" / "SSR" / "SSRUltimate" / "UREx" /
  // "URUltimate"). When omitted, swaps are not applied.
  viewRarity?: string
  className?: string
  style?: CSSProperties
  // Called once with a path→DOMElement map (for WAAPI animation binding).
  onNodes?: (map: Map<string, HTMLElement>) => void
  // Provide a sprite URL for an Image node whose prefab default sprite is
  // null (e.g. `UILotteryCharacterAppear/.../d2`, which `XIUICharacterDisplay
  // .Load2DAsync` populates at runtime from `pcDetailIllustrationPath`).
  // Rendered through the same Image path as prefab-defined sprites (color
  // tint, sliced borders, blend mode all apply). When a `raritySwaps` swap
  // also targets this path, the swap target wins. URLs are taken VERBATIM
  // (no SUMMON_UI_BASE prefix) — use absolute paths like
  // `/Image/Character/PC/Rimuru/SSR/Rimuru_SSR_CharaInfo.webp`.
  imageSrcOverride?: Record<string, { src: string; objectFit?: "cover" | "contain" | "fill"; objectPosition?: string }>
  // Replace a prefab RectTransform's `anchoredPosition` / `localScale`
  // wholesale (NOT compose). Mirrors `XIUICharacterDisplay.Set2DTransform`
  // (RVA `0xA1E98B8`) which calls `rt.set_anchoredPosition(GetIllustPosition)`
  // and `rt.set_localScale(GetIllustScale)` — the per-character
  // PcDetailCharaDisplaySetting REPLACES the prefab default at runtime.
  // Apply to the actual image2d/d2 path (NOT a parent), since pivots differ.
  rectOverride?: Record<string, { anchoredPosition?: [number, number]; localScale?: [number, number] }>
}

// Wraps children in a contain-fit design box of the given Unity design
// size, so absolutely-positioned children using design-space px land at the
// TMP m_enableAutoSizing approximation. Unity's TextMeshPro auto-shrinks
// text down to a minimum fontSize so it fits the RectTransform width. Our
// CSS by default lets long text wrap or overflow (verified via the
// "dord-longname" diag preset — the 33-char synthesised name wrapped to
// 2 lines AND overlapped the title text below). This component renders
// the text on a single line (white-space: nowrap), measures its natural
// width against the containing box's clientWidth, and applies a
// `transform: scaleX()` when the text overflows. The y-scale stays at 1
// so glyphs aren't squashed vertically; only horizontal compression
// kicks in, matching TMP's behaviour for names like
// "Sir Reginald Algernon Bartholomew" in the 688-px characterName box.
// Minimum scale is 0.5 to keep text readable; below that we let it wrap.
// Canvas singleton for fast off-DOM text measurement (avoids triggering
// reflows on every measure pass).
let __measureCtx: CanvasRenderingContext2D | null = null
function measureTextWidth(text: string, font: string): number {
  if (typeof document === "undefined") return 0
  if (!__measureCtx) {
    const c = document.createElement("canvas")
    __measureCtx = c.getContext("2d")
  }
  if (!__measureCtx) return 0
  __measureCtx.font = font
  return __measureCtx.measureText(text).width
}

function AutoFitText({
  baseFontSize,
  color,
  alignItems,
  justifyContent,
  textAlign,
  children,
  extraStyle,
}: {
  baseFontSize: number
  color: string
  alignItems: CSSProperties["alignItems"]
  justifyContent: CSSProperties["justifyContent"]
  textAlign: CSSProperties["textAlign"]
  children: ReactNode
  extraStyle?: CSSProperties
}) {
  const outerRef = useRef<HTMLDivElement | null>(null)
  const [scaleX, setScaleX] = useState(1)
  // Flatten children into a plain string for canvas-based width measurement.
  // Most TMP text comes through as a single string or React element with a
  // string child; we walk the tree just deep enough to cover both.
  const textString = (() => {
    const visit = (node: ReactNode): string => {
      if (node == null || node === false) return ""
      if (typeof node === "string" || typeof node === "number") return String(node)
      if (Array.isArray(node)) return node.map(visit).join("")
      if (typeof node === "object" && node !== null && "props" in node) {
        const props = (node as { props: { children?: ReactNode } }).props
        return visit(props.children)
      }
      return ""
    }
    return visit(children)
  })()
  useLayoutEffect(() => {
    const measure = () => {
      const outer = outerRef.current
      if (!outer) return
      const cs = window.getComputedStyle(outer)
      const pad = parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0")
      const rawW = outer.clientWidth - pad
      if (rawW <= 0 || !textString) return
      // ORNAMENT SAFETY MARGIN: the prefab characterName / characterTitle
      // rects (688×76 / 670×50) define the FULL text-design-box, but the
      // visible Unity plate has decorative frame ornaments inside that
      // box's edges (corner curls, skull medallion, etc.). Without
      // accounting for them the auto-shrunk text crashes into the
      // ornament artwork. The frame ornament occupies roughly the outer
      // 8% on each side of the design box → use 84% of the raw width as
      // the usable text area. This matches the visual interior of the
      // plate where the in-game TMP also sits.
      const containerW = rawW * 0.84
      // Canvas measureText returns natural text width at the given font.
      // Times New Roman + bold ≈ matches CSS rendering.
      const font = `bold ${baseFontSize}px "Times New Roman", Georgia, serif`
      const naturalW = measureTextWidth(textString, font)
      if (naturalW <= 0) return
      const next = naturalW > containerW ? Math.max(0.3, containerW / naturalW) : 1
      setScaleX((prev) => (Math.abs(prev - next) < 0.001 ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (outerRef.current) ro.observe(outerRef.current)
    return () => ro.disconnect()
  }, [textString, baseFontSize])
  return (
    <div
      ref={outerRef}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems,
        justifyContent,
        textAlign,
        color,
        fontSize: `${baseFontSize}px`,
        fontFamily: '"Times New Roman", Georgia, serif',
        fontWeight: 700,
        lineHeight: 1.15,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textShadow: "0 1px 2px rgba(0,0,0,0.95)",
        padding: "0 8px",
        ...extraStyle,
      }}
    >
      <span
        style={{
          display: "inline-block",
          transform: scaleX !== 1 ? `scaleX(${scaleX})` : undefined,
          transformOrigin:
            textAlign === "left" ? "left center" : textAlign === "right" ? "right center" : "center center",
        }}
      >
        {children}
      </span>
    </div>
  )
}

// same screen position as a sibling <PrefabTree fit="contain" /> would.
export function DesignBoxFit({
  designSize,
  children,
  className,
  style,
}: {
  designSize: [number, number]
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])
  const [dw, dh] = designSize
  const fitScale = box.w > 0 && box.h > 0 ? Math.min(box.w / dw, box.h / dh) : 1
  const offX = (box.w - dw * fitScale) / 2
  const offY = (box.h - dh * fitScale) / 2
  return (
    <div ref={ref} className={className} style={{ position: "relative", overflow: "hidden", ...style }}>
      <div
        style={{
          position: "absolute",
          left: `${offX}px`,
          top: `${offY}px`,
          width: `${dw * fitScale}px`,
          height: `${dh * fitScale}px`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: `${dw}px`,
            height: `${dh}px`,
            transform: `scale(${fitScale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

// Per-Image render path selector.
//
// Unity's Image component composes: `output = sprite_RGBA × m_Color_RGBA`.
// CSS doesn't have a single primitive that mirrors that; we approximate it
// with two paths picked from the resolved Material/Shader:
//
//   A1 — Alpha-shape sprite path
//     For shaders that ARE alpha-blended (m_Material null = default canvas
//     UI/Default, UI/FillColor, UI/Default, UI/NoiseTvScroll, etc.). These
//     sprites use the alpha channel as the SHAPE boundary; the visible
//     interior is roughly one tint × m_Color.
//     CSS:  div with backgroundColor=m_Color, mask-image=url(sprite),
//           mask-mode: ALPHA. The mask clips to sprite alpha; the colored
//           background fills the visible shape. This MATCHES Unity for
//           sprites whose RGB is "shape filled with white-ish", which is
//           how most UI sprites are authored (decoStar, rarityStar,
//           rarity*Effect/effect, base, line — all the "weird square"
//           cases from passes 11–15).
//
//   A2 — Luminance-gradient sprite path (the previous default)
//     For VFX/additive shaders (UI-VFXDefault, UI/Addition). These sprites
//     encode the visible shape as a BRIGHTNESS gradient in RGB while
//     keeping alpha fully opaque (so the shape isn't clipped at all — the
//     "shape" is the bright region). Mask-mode: luminance correctly reads
//     brightness-as-alpha and gives the soft gradient look additively.
//     CSS:  div with backgroundColor=m_Color, mask-image=url(sprite),
//           mask-mode: LUMINANCE.
//
// Shader → path mapping (per character_appear_image_materials.json shader
// distribution at audit time):
//   UI-VFXDefault          → A2 (31 components)
//   UI/Addition            → A2 (6)
//   UI/FillColor           → A1 (8)
//   UI/NoiseTvScroll       → A1 (1)
//   (default canvas material) → A1 (15) — Unity's UI/Default fallback
//   <unknown>              → A1 (safest default; matches Unity's UI/Default
//                            which is alpha-blended)
function isLuminanceGradientShader(shader: string | undefined): boolean {
  if (!shader) return false
  return shader === "UI-VFXDefault" || shader === "UI/Addition"
}

// Map Unity GPU blend state → CSS `mix-blend-mode`. The mapping reflects
// what each Unity blend factor combination actually does to the framebuffer:
//   additive            (One/One):              src + dst              → plus-lighter
//   additive_alpha_weighted (SrcAlpha/One):     src*a + dst            → plus-lighter
//   alpha               (SrcAlpha/OneMinusSrcAlpha): src*a + dst*(1-a)→ normal
//   premultiplied       (One/OneMinusSrcAlpha): src + dst*(1-a)        → normal (color is premultiplied)
//   alpha_minus_color   (SrcAlpha/OneMinusSrcColor): src*a + dst*(1-src)→ approximated as normal
//   multiply            (DstColor/Zero):        src*dst                → multiply
//   opaque_replace      (One/Zero):             src                    → normal
// `plus-lighter` is the precise additive CSS mode (added in baseline 2023);
// it is widely supported now (Chrome 109+, Safari 16.4+, Firefox 129+).
// We fall back to `screen` for the rare case the browser doesn't support
// it via a CSS layer with @supports — handled at the consumer level.
function blendModeToCss(blend: string | undefined): "plus-lighter" | "multiply" | undefined {
  if (!blend) return undefined
  if (blend === "additive" || blend === "additive_alpha_weighted") return "plus-lighter"
  if (blend === "multiply") return "multiply"
  return undefined
}

export function PrefabTree({
  tree,
  designSize,
  fit = "contain",
  slots,
  slotsReplaceSubtree,
  hide,
  show,
  text,
  nodeStyle,
  textStyle,
  imageMaterials,
  raritySwaps,
  viewRarity,
  className,
  style,
  onNodes,
  imageSrcOverride,
  rectOverride,
}: PrefabTreeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const nodeMap = useRef<Map<string, HTMLElement>>(new Map())

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  useLayoutEffect(() => {
    onNodes?.(nodeMap.current)
  })

  const [dw, dh] = designSize
  const hideSet = hide instanceof Set ? hide : new Set(hide || [])
  const showSet = show instanceof Set ? show : new Set(show || [])
  // Merge per-rarity hide paths from the Appear<rarity> clip's m_IsActive
  // final-frame state. These get the full prefab-root prefix so they match
  // TreeNode.path. Example: URUltimate hides rarity1Effect..rarity5Effect
  // because the clip ends with their m_IsActive ≤ 0.7.
  if (raritySwaps && viewRarity) {
    const r = raritySwaps.rarities[viewRarity]
    if (r?.hide_paths_from_active_finals) {
      const rootPrefix = tree.prefab + "/"
      for (const p of r.hide_paths_from_active_finals) {
        hideSet.add(rootPrefix + p)
      }
    }
  }
  // path → resolved GPU blend mode (from extract_appear_image_materials.py /
  // extract_result_image_materials.py). Empty when imageMaterials not passed.
  const blendByPath = new Map<string, string>()
  // path → resolved shader name (UI/Default, UI/FillColor, UI-VFXDefault,
  // UI/Addition, etc.). Routes renderImage / renderRawImage between the
  // A1 alpha-shape path and the A2 luminance-gradient path. When the path
  // isn't in the map (e.g. prefabs without imageMaterials data), the
  // default is A1 — Unity's default UI/Default material is alpha-blended.
  const shaderByPath = new Map<string, string>()
  // path → resolved material name. Used to detect special masking materials
  // (e.g. `baseMask`) that perform sprite-alpha stencil masking from the
  // PARENT's sprite. In Unity these custom materials sample the parent's
  // _MainTex alpha as a stencil; without a Mask component on the parent,
  // PrefabTree's existing isMask path doesn't fire. We detect baseMask
  // children below and apply CSS mask-image to the parent instead.
  const materialByPath = new Map<string, string>()
  if (imageMaterials?.components) {
    for (const c of imageMaterials.components) {
      blendByPath.set(c.path, c.blend_mode)
      shaderByPath.set(c.path, c.shader_name)
      if (c.material_name) materialByPath.set(c.path, c.material_name)
    }
  }
  // Set of paths whose CHILDREN should clip to the host sprite's alpha.
  // Built by walking the tree and looking for any child of a node that
  // uses a material whose name contains "Mask" (e.g. `baseMask`,
  // `frameMask`, etc.). When detected, the PARENT node gets CSS
  // mask-image (its own sprite) applied — masking the parent's box AND
  // all descendants in one shot. This reproduces the Unity sprite-mask
  // material behaviour without needing a real Mask component.
  const spriteMaskParents = new Set<string>()
  function scanForMaskChildren(node: TreeNode) {
    for (const c of node.children) {
      const m = materialByPath.get(c.path)
      if (m && /mask/i.test(m)) {
        spriteMaskParents.add(node.path)
      }
      scanForMaskChildren(c)
    }
  }
  scanForMaskChildren(tree.root)
  // Per-rarity Sprite/Texture swap map: full prefab-relative path →
  // target_file_hash (matches /UI/summon/<hash>.png). The raritySwaps JSON
  // stores paths WITHOUT the root prefix (e.g. "container/characterName/...")
  // while PrefabTree's TreeNode.path is rooted at the prefab name (e.g.
  // "UILotteryCharacterAppear/container/..."). We normalise to the latter so
  // a single map.get(n.path) works for any prefab.
  const swapByPath = new Map<string, RaritySwapEntry>()
  // Per-rarity m_Color.a final value: path → 0..1. When alpha=0 we hide the
  // node (matches the final-frame state of the Animator's Appear<rarity>
  // clip — e.g. URUltimate fades base/efUltimate to alpha=0).
  const alphaByPath = new Map<string, number>()
  if (raritySwaps && viewRarity) {
    const r = raritySwaps.rarities[viewRarity]
    if (r) {
      const rootPrefix = tree.prefab + "/"
      for (const s of r.swaps) {
        // Only Sprite / Texture2D swaps carry an image to apply (m_Material
        // swaps shift the shader but PrefabTree's blend mapping already
        // reflects the runtime material via imageMaterials per-rarity is
        // out of scope here — Material swaps mostly affect blend mode).
        const isImage = s.attribute === "m_Sprite" || s.attribute === "m_Texture"
        if (!isImage || !s.target_file_hash) continue
        swapByPath.set(rootPrefix + s.path, s)
      }
      for (const c of r.color_finals) {
        if (c.attribute === "m_Color.a") {
          alphaByPath.set(rootPrefix + c.path, c.last)
        }
      }
    }
  }

  // Outer fit transform: scale the whole design box into the rendered area.
  let fitScale = 1
  let offX = 0
  let offY = 0
  if (box.w > 0 && box.h > 0) {
    if (fit === "contain") {
      fitScale = Math.min(box.w / dw, box.h / dh)
      offX = (box.w - dw * fitScale) / 2
      offY = (box.h - dh * fitScale) / 2
    } else {
      // stretch: independent x/y — handled via width/height 100% wrapper
      fitScale = 1
    }
  }

  function renderNode(n: TreeNode, pw: number, ph: number, depth: number): ReactNode {
    const key = n.path
    const isHidden = hideSet.has(n.path) || hideSet.has(n.name)
    if (isHidden) return null
    const forceShow = showSet.has(n.path) || showSet.has(n.name)
    if (!n.active && !forceShow) return null
    // Per-rarity alpha=0 hides the node entirely (matches the Animator
    // clip's final-frame m_Color.a). Example: URUltimate fades base/efUltimate
    // to alpha=0, so the prefab-default rainbow texture must not render even
    // though the GameObject is m_IsActive=true.
    //
    // SAFETY EXCEPTION: when `imageSrcOverride` covers this path, the
    // caller is driving the visual + its own opacity (typically via WAAPI
    // in onNodes). Skip the hide so the WAAPI animation can fade-in even
    // if a stale color_finals.last value would otherwise unmount the node.
    // (The decoder cursor bug B-PASS4-1 that caused SR d2 m_Color.a.last=0
    // is now FIXED at the extractor level — see _work/refresh_color_finals.py
    // — but keep this guard as a defense against any future similar
    // decoder regressions affecting caller-driven nodes.)
    const hasImageOverride = !!(imageSrcOverride?.[n.path] ?? imageSrcOverride?.[n.name])
    const rarityAlpha = alphaByPath.get(n.path)
    if (rarityAlpha !== undefined && rarityAlpha <= 0.001 && !hasImageOverride) return null

    // rectOverride mirrors XIUICharacterDisplay.Set2DTransform: REPLACE
    // anchoredPosition / localScale rather than compose. Only the two
    // fields exposed by Set2DTransform are overridable; the rest of the
    // RectTransform stays prefab-default (anchorMin/Max, sizeDelta, pivot).
    const ov = rectOverride?.[n.path]
    const effectiveRect: TreeRectData = ov
      ? {
          ...n.rect,
          anchoredPosition: ov.anchoredPosition ?? n.rect.anchoredPosition,
          localScale: ov.localScale ?? n.rect.localScale,
        }
      : n.rect
    const r = childRect(effectiveRect, pw, ph)
    const sx = effectiveRect.localScale[0] || 1
    const sy = effectiveRect.localScale[1] || 1
    // CSS transform-origin: Unity pivot is bottom-left based; CSS top-left.
    const originX = n.rect.pivot[0] * 100
    const originY = (1 - n.rect.pivot[1]) * 100

    // CSS blend mode is derived from the actual GPU blend state the game's
    // shader Pass uses. The data comes from
    // extract_{appear,result}_image_materials.py which reads:
    //   Material.m_Shader → Shader.m_ParsedForm.m_SubShaders[0].m_Passes[0]
    //     .m_State.rtBlend0.{srcBlend, destBlend}
    // and resolves property-driven references (e.g. UI-VFXDefault's `_Src`
    // / `_Dst`) back to the material's m_Floats. The resolved blend factor
    // pair maps to a CSS mix-blend-mode (plus-lighter / multiply / normal).
    // No node-name heuristics — the rule is the Unity render pipeline's
    // decompiled blend state, applied per-path.
    const blendCss = blendModeToCss(blendByPath.get(n.path))
    // Mask handling — Unity Mask vs RectMask2D have DIFFERENT semantics:
    //   - RectMask2D: bounding-rect clip ≡ CSS overflow: hidden.
    //   - Mask (UnityEngine.UI.Mask): sprite-alpha stencil; children are
    //     clipped by the host Image/RawImage's sprite alpha (≡ SVG clip-path).
    //     The closest CSS equivalent is to set `mask-image: url(sprite)`
    //     with `mask-mode: alpha` ON THE HOST DIV — that applies the mask
    //     to the host AND all descendants, which is the Unity Mask behaviour.
    const isRectClip = n.comp.isRectMask ?? n.comp.isRectMask2D ?? false
    const isSpriteClip = n.comp.isSpriteMask ?? n.comp.isMask ?? false
    // Host sprite URL — used only when isSpriteClip applies. Pull from
    // image/rawImage component if present; without a host sprite the mask
    // can't be authored, so we fall back to rect-clip behaviour.
    const hostSprite = (n.comp.image?.img || n.comp.rawImage?.img) ?? null
    // Sprite mask: applied either because the node has a Unity Mask /
    // SpriteMask component (`isSpriteClip`), OR because one of its
    // children uses a Mask-type material (`baseMask` etc.) which clips
    // child rendering to the parent's sprite alpha. Both cases need the
    // same CSS mask-image setup on the host element.
    const needsSpriteMask = (isSpriteClip || spriteMaskParents.has(n.path)) && !!hostSprite
    const maskStyle: CSSProperties = needsSpriteMask
      ? {
          WebkitMaskImage: `url(${SUMMON_UI_BASE}/${hostSprite})`,
          maskImage: `url(${SUMMON_UI_BASE}/${hostSprite})`,
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          // Unity Mask uses sprite ALPHA as the stencil; use alpha not luminance.
          ...({ WebkitMaskSourceType: "alpha" } as React.CSSProperties),
          maskMode: "alpha",
        }
      : {}
    const boxStyle: CSSProperties = {
      position: "absolute",
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.w}px`,
      height: `${r.h}px`,
      transform: sx !== 1 || sy !== 1 ? `scale(${sx}, ${sy})` : undefined,
      transformOrigin: `${originX}% ${originY}%`,
      ...(n.comp.canvasGroupAlpha != null && n.comp.canvasGroupAlpha < 1
        ? { opacity: n.comp.canvasGroupAlpha }
        : {}),
      ...(isRectClip ? { overflow: "hidden" } : {}),
      ...maskStyle,
      ...(blendCss ? { mixBlendMode: blendCss } : {}),
      ...(nodeStyle?.[n.path] ?? nodeStyle?.[n.name]),
    }

    const injectedSubtree = slotsReplaceSubtree?.[n.path] ?? slotsReplaceSubtree?.[n.name]
    const injected = injectedSubtree ?? slots?.[n.path] ?? slots?.[n.name]
    const textOverride = text?.[n.path] ?? text?.[n.name]
    const suppressChildren = injectedSubtree !== undefined

    // imageSrcOverride: render a runtime-loaded sprite at this node as if
    // it were the prefab's Image. Goes through the SAME Image rendering
    // path so the Image-component cascade (Outline, AspectRatioFitter
    // sized to fill the parent rect, swap-data precedence, alpha mask)
    // applies. Used for `XIUICharacterDisplay`-driven nodes where the
    // prefab default `image.img` is null and the sprite is set at
    // runtime by `Load2DAsync`.
    const imgOv = imageSrcOverride?.[n.path] ?? imageSrcOverride?.[n.name]

    let visual: ReactNode = null
    if (injected !== undefined) {
      visual = <div style={{ position: "absolute", inset: 0 }}>{injected}</div>
    } else if (imgOv) {
      visual = renderImageOverride(imgOv)
    } else if (n.comp.image?.img) {
      visual = renderImage(n)
    } else if (n.comp.rawImage?.img) {
      const ri = n.comp.rawImage
      const c = ri.color
      // Per-rarity m_Texture swap (from the Appear<rarity> clip's pptrCurveMapping):
      // RawImage.m_Texture gets swapped to a tier-specific Texture2D. The swap
      // replaces ri.img with the swap target's PNG hash. Example: SSRUltimate
      // swaps base/efUltimate's texture to t_grad_uv_11_mir, hiding the
      // prefab-default pastel rainbow.
      const swap = swapByPath.get(n.path)
      const swapTextureFile = (swap && swap.attribute === "m_Texture") ? `${swap.target_file_hash}.png` : null
      const riImg = swapTextureFile ?? ri.img
      // Unity RawImage multiplies the texture by m_Color (RGBA). Respect
      // alpha first — many prefab layers (bgPattern, bgPatternAdd, the
      // ColorGradient overlays) ship with alpha=0 and are faded in by
      // the animator at runtime. If alpha is 0 the node renders nothing.
      const a = colorAlpha(c)
      if (a <= 0.001) {
        visual = null
      } else {
        const tintNonWhite = !isWhite(c)
        // Same A1/A2 split as renderImage. For RawImage components in
        // CharacterAppear the typical luminance-gradient targets are
        // gradation / pattern / efUltimate (all UI-VFXDefault); alpha-shape
        // targets are bgPattern, shadow, rimuru. Default = A1 alpha.
        const useLuminance = isLuminanceGradientShader(shaderByPath.get(n.path))
        const maskMode = useLuminance ? "luminance" : "alpha"
        visual = tintNonWhite ? (
          // Tint-via-mask render — see renderImage's matching block for
          // the full A1/A2 rationale.
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: colorCss(c),
              WebkitMaskImage: `url(${SUMMON_UI_BASE}/${riImg})`,
              maskImage: `url(${SUMMON_UI_BASE}/${riImg})`,
              WebkitMaskSize: "100% 100%",
              maskSize: "100% 100%",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              ...({ WebkitMaskSourceType: maskMode } as React.CSSProperties),
              maskMode,
              opacity: a,
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${SUMMON_UI_BASE}/${riImg}`}
            alt=""
            draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", opacity: a }}
          />
        )
      }
    } else if (n.comp.rawImage && !n.comp.rawImage.img) {
      const a = colorAlpha(n.comp.rawImage.color)
      if (a > 0.001 && !isWhite(n.comp.rawImage.color)) {
        visual = <div style={{ position: "absolute", inset: 0, backgroundColor: colorCss(n.comp.rawImage.color), opacity: a }} />
      }
    }
    if (n.comp.text && textOverride !== undefined) {
      visual = (
        <>
          {visual}
          {renderText(n, textOverride)}
        </>
      )
    } else if (n.comp.text && n.comp.text.v && injected === undefined) {
      visual = (
        <>
          {visual}
          {renderText(n, n.comp.text.v)}
        </>
      )
    }

    return (
      <div
        key={key}
        data-path={n.path}
        style={boxStyle}
        ref={(el) => {
          if (el) nodeMap.current.set(n.path, el)
          else nodeMap.current.delete(n.path)
        }}
      >
        {visual}
        {suppressChildren ? null : n.children.map((c) => renderNode(c, r.w, r.h, depth + 1))}
      </div>
    )
  }

  // Render a runtime-loaded sprite for an Image node whose prefab default
  // is null (typically `XIUICharacterAppear/.../d2`). Uses the supplied
  // absolute URL verbatim (no SUMMON_UI_BASE prefix). Object-fit defaults
  // to "cover" with center-top positioning — matches the in-game
  // AspectRatioFitter EnvelopeParent behavior on d2, where the character
  // art is taller than the slot and the face is anchored at the top.
  function renderImageOverride(ov: { src: string; objectFit?: "cover" | "contain" | "fill"; objectPosition?: string }): ReactNode {
    const objectFit = ov.objectFit ?? "cover"
    const objectPosition = ov.objectPosition ?? "center top"
    if (!ov.src) return null
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ov.src}
        alt=""
        draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit, objectPosition, display: "block" }}
      />
    )
  }

  function renderImage(n: TreeNode): ReactNode {
    const im = n.comp.image!
    const a = colorAlpha(im.color)
    // Unity Image multiplies the sprite by m_Color (RGBA). Alpha=0 means
    // the node is invisible by default (animator-driven fade-in).
    if (a <= 0.001) return null
    // Per-rarity m_Sprite swap (from the Appear<rarity> clip's pptrCurveMapping):
    // replace the prefab-default sprite file with the tier-specific asset hash
    // so e.g. SSRUltimate's base shows baseCharacterAppearBig and not the
    // prefab default.
    const swap = swapByPath.get(n.path)
    const imgFile = swap && swap.attribute === "m_Sprite" ? `${swap.target_file_hash}.png` : im.img
    const url = `${SUMMON_UI_BASE}/${imgFile}`
    const bd = im.border as [number, number, number, number]
    const sliced = im.imgType === 1 && bd && bd.some((v) => v > 0)
    if (sliced) {
      const [l, b, rr, t] = bd
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderStyle: "solid",
            borderImageSource: `url(${url})`,
            borderImageSlice: `${t} ${rr} ${b} ${l} fill`,
            borderImageWidth: `${t}px ${rr}px ${b}px ${l}px`,
            borderImageRepeat: "stretch",
            opacity: a,
          }}
        />
      )
    }
    // Unity's Image rendering for most non-VFX shaders (UI/Default,
    // UI/FillColor, default canvas) is `output_rgba = sprite_rgba ×
    // m_Color_rgba`. The sprite carries its own RGB content (e.g. the
    // nameplate `base` sprite a7784776e363fbc8.png is dark navy) and
    // m_Color tints it. Our previous "mask" path treated the sprite as
    // pure alpha-shape and painted solid m_Color in its silhouette —
    // which DESTROYED the sprite's RGB and rendered the dark-navy plate
    // as solid grey (verified via D:\imag_comp.png, where the left/site
    // shows a grey washed plate and the right/game shows dark navy).
    //
    // Fix (Pass-15k): always render the sprite as <img> so its RGB is
    // preserved, then overlay m_Color via mix-blend-mode: multiply when
    // m_Color isn't white. This mirrors Unity's shader. Applies to both
    // swapped (hasSpriteSwap) and prefab-default sprites. The earlier
    // A2/luminance "mask" path is kept for genuinely luminance-gradient
    // shaders (UI-VFXDefault additive) where the sprite is meant as a
    // brightness mask, not as an RGB image.
    const useLuminance = isLuminanceGradientShader(shaderByPath.get(n.path))
    if (useLuminance && !isWhite(im.color)) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: colorCss(im.color),
            WebkitMaskImage: `url(${url})`,
            maskImage: `url(${url})`,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            ...({ WebkitMaskSourceType: "luminance" } as React.CSSProperties),
            maskMode: "luminance",
            opacity: a,
          }}
        />
      )
    }
    // Pass-15v: skip the multiply tint when m_Color is a near-uniform grey.
    // Rationale: Unity's UI/FillColor + grey m_Color (~0.5) produces a
    // dimmed-uniform tint that's then amplified back up by URP Bloom +
    // ColorAdjustments in the final composited frame. Our CSS pipeline has
    // no foreground bloom (removed in Pass-15k to fix the white nameplate
    // glow), so the multiply just darkens the sprite to ~50% brightness
    // with no compensating amplification — stars + plate read as dim grey
    // (user's "star_comparison.png" shows the side-by-side: 5 dim grey
    // stars on the left vs 6 bright cyan stars in-game). For uniform-grey
    // m_Color, dropping the multiply renders the sprite RGB at full
    // brightness, which visually matches the in-game post-bloom result
    // closer than the technically-Unity-accurate dimmed version.
    // Coloured m_Color tints (non-uniform RGB, e.g. red highlights) still
    // apply via multiply since they carry actual colour information.
    const c = im.color
    const isUniformGrey = (() => {
      if (!c) return false
      const r = c.r ?? 1, g = c.g ?? 1, b = c.b ?? 1
      const maxC = Math.max(r, g, b), minC = Math.min(r, g, b)
      return (maxC - minC) < 0.05
    })()
    const tintIsMul = !isWhite(c) && !isUniformGrey
    return (
      <div style={{ position: "absolute", inset: 0, opacity: a, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", display: "block" }}
        />
        {tintIsMul && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: colorCss(c),
              mixBlendMode: "multiply",
              WebkitMaskImage: `url(${url})`,
              maskImage: `url(${url})`,
              WebkitMaskSize: "100% 100%",
              maskSize: "100% 100%",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    )
  }

  function renderText(n: TreeNode, content: ReactNode): ReactNode {
    const tx = n.comp.text!
    const txStyle = textStyle?.[n.path] ?? textStyle?.[n.name]
    // TMP m_alignment is a bitfield. The horizontal nibble: 1=Left, 2=Center,
    // 4=Right, 8=Justified. Vertical nibble (high bits, ×0x100): 1=Top,
    // 2=Middle, 4=Bottom. Many prefabs ship "Center" = 0x202 etc.
    const align = tx.align ?? 0x202
    const hAlign = align & 0xff
    const vAlign = (align >>> 8) & 0xff
    const isLeft = (hAlign & 0x1) !== 0
    const isRight = (hAlign & 0x4) !== 0
    const justify = isLeft ? "flex-start" : isRight ? "flex-end" : "center"
    const textAlign = isLeft ? "left" : isRight ? "right" : "center"
    const alignItems = (vAlign & 0x1) !== 0 ? "flex-start" : (vAlign & 0x4) !== 0 ? "flex-end" : "center"
    return (
      <AutoFitText
        baseFontSize={tx.size ?? 32}
        color={colorCss(tx.color)}
        alignItems={alignItems}
        justifyContent={justify}
        textAlign={textAlign}
        extraStyle={txStyle}
      >
        {content}
      </AutoFitText>
    )
  }

  // Root: a design-box of designSize, fitted into the rendered area.
  const rootInner =
    fit === "contain" ? (
      <div
        style={{
          position: "absolute",
          left: `${offX}px`,
          top: `${offY}px`,
          width: `${dw * fitScale}px`,
          height: `${dh * fitScale}px`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: `${dw}px`,
            height: `${dh}px`,
            transform: `scale(${fitScale})`,
            transformOrigin: "top left",
          }}
        >
          {tree.root.children.map((c) => renderNode(c, dw, dh, 0))}
        </div>
      </div>
    ) : (
      <div style={{ position: "absolute", inset: 0 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: box.w > 0 ? `scale(${box.w / dw}, ${box.h / dh})` : undefined,
            transformOrigin: "top left",
            width: `${dw}px`,
            height: `${dh}px`,
          }}
        >
          {tree.root.children.map((c) => renderNode(c, dw, dh, 0))}
        </div>
      </div>
    )

  return (
    <div
      ref={ref}
      className={className}
      style={
        {
          position: "relative",
          overflow: "hidden",
          // Expose the fit scale so children can compensate (e.g. render text
          // at a fixed SCREEN px regardless of viewport size by using
          // `fontSize: "calc(<px>px / var(--prefab-fit-scale))"`).
          // Stringified — React doesn't append px to custom properties but
          // explicit string keeps the CSS parser happy across browsers.
          "--prefab-fit-scale": String(fit === "contain" ? fitScale : box.w > 0 ? box.w / dw : 1),
          ...style,
        } as CSSProperties
      }
    >
      {rootInner}
    </div>
  )
}
