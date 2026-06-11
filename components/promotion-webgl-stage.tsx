"use client"

import { useEffect, useRef, type CSSProperties } from "react"
import { SUMMON_UI_BASE } from "@/lib/summon-ui/specs"
import type { PromotionViewRarity } from "@/lib/summon-ui/specs"
import { PREFAB_DESIGN, PREFAB_TREES } from "@/lib/summon-ui/prefab-trees"
import promotionBindingsRaw from "@/lib/summon-ui/lottery_runtime_data/UILotteryPromotion.bindings.json"
import tenslafontMaterialsRaw from "@/lib/summon-ui/lottery_runtime_data/Tenslafont_materials.json"
import fontDataRaw from "@/lib/summon-ui/tenslafont.json"
import type { TreeNode, TreeRectData, TreeColor } from "@/components/prefab-tree"

const FONT_ATLAS_URL = "/UI/summon/Tenslafont_atlas.png"
const MAX_DPR = 2.5

type ColorLike = { r?: number; g?: number; b?: number; a?: number; rgba?: number } | null | undefined
type Mat3 = [number, number, number, number, number, number]
type Rect = { left: number; top: number; w: number; h: number }
type FontGlyph = { x: number; y: number; w: number; h: number; bx: number; by: number; adv: number }
type FontData = {
  atlas_w: number
  atlas_h: number
  face_lineHeight: number | null
  face_ascentLine: number | null
  chars: Record<string, FontGlyph>
}
type Tween = { charDuration?: number; interval?: number }
type TmpPanel = {
  text?: string
  fontSize?: number
  fontColor?: ColorLike
  alignment?: number | null
  sharedMaterial?: { name?: string | null }
  colorGradientChildren?: string[]
  simpleTweenTMPSage?: Tween
}
type ClipKey = { time: number; value: number }
type ClipBinding = { path: string; property: string; first?: number; last?: number; keys?: ClipKey[] }
type Clip = { stopTime?: number; bindings?: ClipBinding[] }
type Bindings = {
  tmpTextPanels: Record<string, TmpPanel>
  colorGradientChildren: Record<string, { image?: { img?: string | null } }>
  animators: Record<string, { clipBindings?: Record<string, Clip> }>
}
type Material = {
  colors?: Record<string, ColorLike>
  floats?: Record<string, number>
}

type RenderNode = {
  node: TreeNode
  matrix: Mat3
  rect: Rect
  alpha: number
  clip?: Rect
}

type TextureEntry = {
  texture: WebGLTexture | null
  width: number
  height: number
  loaded: boolean
}

const fontData = fontDataRaw as FontData
const promotionBindings = promotionBindingsRaw as Bindings
const tenslafontMaterials = tenslafontMaterialsRaw as Record<string, Material>

const RERITY_FOR_VIEW_RARITY: Record<PromotionViewRarity, "rerity3" | "rerity4" | "rerity5" | "rerity5UltimatePlusPU"> = {
  R: "rerity3",
  SR: "rerity4",
  SSR: "rerity5",
  SSRUltimatePlusPU: "rerity5UltimatePlusPU",
}

const TEXT_GROUPS = [
  { group: "BackText", clip: "BackTextAnimationIn", loopClip: "BackTextLoop", leaves: ["Back00", "Back01"] },
  { group: "MiddleText", clip: "MiddleTextAnimationIn", loopClip: "MiddleTextLoop", leaves: ["Middle00", "Middle01"] },
  { group: "FrontText", clip: "FrontTextAnimationIn", loopClip: "FrontTextLoop", leaves: ["Front00", "Front01"] },
] as const

const DETECT_LABELS = [
  "UILotteryPromotion/container/detectRog/label00",
  "UILotteryPromotion/container/detectRog/label01",
  "UILotteryPromotion/container/detectRog/label02",
]

function rgbaParts(c: ColorLike, fallback: [number, number, number, number] = [1, 1, 1, 1]): [number, number, number, number] {
  if (!c) return fallback
  if (typeof c.rgba === "number") {
    const p = c.rgba >>> 0
    return [(p & 255) / 255, ((p >>> 8) & 255) / 255, ((p >>> 16) & 255) / 255, ((p >>> 24) & 255) / 255]
  }
  const r = c.r ?? 1
  const g = c.g ?? 1
  const b = c.b ?? 1
  const a = c.a ?? 1
  const s = Math.max(r, g, b) <= 1.0001 ? 1 : 1 / 255
  return [r * s, g * s, b * s, a <= 1.0001 ? a : a / 255]
}

function colorAlpha(c: TreeColor | ColorLike): number {
  return rgbaParts(c as ColorLike)[3]
}

function multiply(a: ColorLike, b: ColorLike): [number, number, number, number] {
  const aa = rgbaParts(a)
  const bb = rgbaParts(b)
  return [aa[0] * bb[0], aa[1] * bb[1], aa[2] * bb[2], aa[3] * bb[3]]
}

function childRect(r: TreeRectData, pw: number, ph: number): Rect {
  const w = (r.anchorMax[0] - r.anchorMin[0]) * pw + r.sizeDelta[0]
  const h = (r.anchorMax[1] - r.anchorMin[1]) * ph + r.sizeDelta[1]
  const anchorCx = ((r.anchorMin[0] + r.anchorMax[0]) / 2) * pw
  const anchorCy = ((r.anchorMin[1] + r.anchorMax[1]) / 2) * ph
  const pivotX = anchorCx + r.anchoredPosition[0]
  const pivotY = anchorCy + r.anchoredPosition[1]
  const blX = pivotX - r.pivot[0] * w
  const blY = pivotY - r.pivot[1] * h
  return { left: blX, top: ph - (blY + h), w, h }
}

function matMul(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

function nodeMatrix(rect: Rect, r: TreeRectData): Mat3 {
  const sx = r.localScale[0] || 1
  const sy = r.localScale[1] || 1
  const ox = r.pivot[0] * rect.w
  const oy = (1 - r.pivot[1]) * rect.h
  // T(rect.left, rect.top) * T(origin) * S * T(-origin)
  return [sx, 0, 0, sy, rect.left + ox - sx * ox, rect.top + oy - sy * oy]
}

function transformPoint(m: Mat3, x: number, y: number) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }
}

function transformRect(m: Mat3, x: number, y: number, w: number, h: number): Rect {
  const p0 = transformPoint(m, x, y)
  const p1 = transformPoint(m, x + w, y + h)
  const left = Math.min(p0.x, p1.x)
  const top = Math.min(p0.y, p1.y)
  return { left, top, w: Math.abs(p1.x - p0.x), h: Math.abs(p1.y - p0.y) }
}

function intersect(a: Rect | undefined, b: Rect): Rect | undefined {
  if (!a) return { ...b }
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const right = Math.min(a.left + a.w, b.left + b.w)
  const bottom = Math.min(a.top + a.h, b.top + b.h)
  if (right <= left || bottom <= top) return undefined
  return { left, top, w: right - left, h: bottom - top }
}

function finiteKeys(binding: ClipBinding | undefined): ClipKey[] {
  if (!binding) return []
  if (Array.isArray(binding.keys) && binding.keys.length) return binding.keys.filter((k) => Number.isFinite(k.time) && Number.isFinite(k.value))
  const keys: ClipKey[] = []
  if (typeof binding.first === "number") keys.push({ time: 0, value: binding.first })
  if (typeof binding.last === "number" && binding.last !== binding.first) keys.push({ time: 1, value: binding.last })
  return keys
}

function sampleKeys(binding: ClipBinding | undefined, time: number, fallback: number): number {
  const keys = finiteKeys(binding).sort((a, b) => a.time - b.time)
  if (!keys.length) return fallback
  if (time <= keys[0].time) return keys[0].value
  for (let i = 1; i < keys.length; i += 1) {
    const prev = keys[i - 1]
    const next = keys[i]
    if (time <= next.time) {
      const span = Math.max(0.0001, next.time - prev.time)
      const t = (time - prev.time) / span
      return prev.value + (next.value - prev.value) * t
    }
  }
  return keys[keys.length - 1].value
}

function binding(animatorPath: string, clipName: string, targetPath: string, property: string): ClipBinding | undefined {
  return promotionBindings.animators[animatorPath]?.clipBindings?.[clipName]?.bindings?.find((b) => b.path === targetPath && b.property === property)
}

function rootClipName(start: PromotionViewRarity, fix: PromotionViewRarity): "SSRPromotion" | "SSRUltimatePlusPUPromotion" | null {
  if (start !== "SR") return null
  if (fix === "SSR") return "SSRPromotion"
  if (fix === "SSRUltimatePlusPU") return "SSRUltimatePlusPUPromotion"
  return null
}

function activeRarityAt(start: PromotionViewRarity, fix: PromotionViewRarity, elapsed: number): PromotionViewRarity {
  const clipName = rootClipName(start, fix)
  if (!clipName || start === fix) return start
  const startPath = `UILotteryPromotion/container/${RERITY_FOR_VIEW_RARITY[start]}`
  const activeBinding = promotionBindings.animators.UILotteryPromotion?.clipBindings?.[clipName]?.bindings?.find(
    (b) => b.path === startPath && b.property === "m_IsActive",
  )
  const off = finiteKeys(activeBinding).find((k) => k.time > 0 && k.value <= 0.001)?.time ?? 1.25
  return elapsed >= off ? fix : start
}

function animatedY(path: string, activeRerity: string, elapsed: number, defaultY: number): number {
  for (const groupDef of TEXT_GROUPS) {
    const animatorPath = `UILotteryPromotion/container/${activeRerity}/${groupDef.group}`
    if (!path.startsWith(`${animatorPath}/`)) continue
    const inClip = promotionBindings.animators[animatorPath]?.clipBindings?.[groupDef.clip]
    const inStop = inClip?.stopTime ?? 1.166667
    const inBinding = binding(animatorPath, groupDef.clip, path, "m_AnchoredPosition.y")
    if (elapsed <= inStop) return sampleKeys(inBinding, elapsed, defaultY)
    const loop = promotionBindings.animators[animatorPath]?.clipBindings?.[groupDef.loopClip]
    const loopStop = loop?.stopTime ?? 1
    const loopBinding = binding(animatorPath, groupDef.loopClip, path, "m_AnchoredPosition.y")
    return sampleKeys(loopBinding, ((elapsed - inStop) % loopStop), sampleKeys(inBinding, inStop, defaultY))
  }
  return defaultY
}

function groupAlpha(path: string, activeRerity: string, elapsed: number, base: number): number {
  for (const groupDef of TEXT_GROUPS) {
    const animatorPath = `UILotteryPromotion/container/${activeRerity}/${groupDef.group}`
    if (path !== animatorPath) continue
    const stop = promotionBindings.animators[animatorPath]?.clipBindings?.[groupDef.clip]?.stopTime ?? 1.166667
    return base * Math.max(0, Math.min(1, elapsed / Math.max(0.001, stop * 0.142857)))
  }
  return base
}

function rootAlpha(path: string, start: PromotionViewRarity, fix: PromotionViewRarity, elapsed: number, base: number): number {
  const clipName = rootClipName(start, fix)
  if (!clipName) return base
  const clip = promotionBindings.animators.UILotteryPromotion?.clipBindings?.[clipName]
  if (DETECT_LABELS.includes(path)) {
    const b = clip?.bindings?.find((candidate) => candidate.path === path && candidate.property === "m_Alpha")
    return base * sampleKeys(b, elapsed, base)
  }
  return base
}

function spriteUrl(img?: string | null) {
  return img ? `${SUMMON_UI_BASE}/${img.replace(/\.png$/, ".webp")}` : null
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error("Unable to create WebGL shader")
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "WebGL shader compile failed")
  return shader
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()
  if (!p) throw new Error("Unable to create WebGL program")
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "WebGL program link failed")
  return p
}

const SPRITE_VS = `#version 300 es
precision highp float;
in vec2 a_pos;
in vec2 a_uv;
in vec4 a_color;
uniform vec2 u_resolution;
out vec2 v_uv;
out vec4 v_color;
void main() {
  vec2 z = a_pos / u_resolution;
  vec2 clip = z * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = a_uv;
  v_color = a_color;
}`
const SPRITE_FS = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec2 v_uv;
in vec4 v_color;
out vec4 outColor;
void main() {
  outColor = texture(u_tex, v_uv) * v_color;
}`

const TEXT_VS = `#version 300 es
precision highp float;
in vec2 a_pos;
in vec2 a_uv;
in vec2 a_grad_uv;
in vec4 a_color;
uniform vec2 u_resolution;
out vec2 v_uv;
out vec2 v_grad_uv;
out vec4 v_color;
void main() {
  vec2 z = a_pos / u_resolution;
  vec2 clip = z * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = a_uv;
  v_grad_uv = a_grad_uv;
  v_color = a_color;
}`
const TEXT_FS = `#version 300 es
precision highp float;
uniform sampler2D u_font;
uniform sampler2D u_gradient;
uniform bool u_use_gradient;
uniform vec4 u_effect_color;
uniform float u_edge;
uniform float u_softness;
uniform float u_alpha_mult;
in vec2 v_uv;
in vec2 v_grad_uv;
in vec4 v_color;
out vec4 outColor;
void main() {
  vec4 s = texture(u_font, v_uv);
  float d = max(max(s.r, s.g), max(s.b, s.a));
  float aa = max(fwidth(d) * 0.75 + u_softness, 0.0035);
  float alpha = smoothstep(u_edge - aa, u_edge + aa, d) * v_color.a * u_alpha_mult;
  vec4 base = u_use_gradient ? texture(u_gradient, v_grad_uv) * v_color : v_color;
  base.rgb *= u_effect_color.rgb;
  base.a *= u_effect_color.a * alpha;
  outColor = base;
}`

class PromotionWebGLRenderer {
  private gl: WebGL2RenderingContext
  private spriteProgram: WebGLProgram
  private textProgram: WebGLProgram
  private buffer: WebGLBuffer
  private textures = new Map<string, TextureEntry>()
  private startTime = performance.now()
  private raf = 0
  private resizeObserver?: ResizeObserver
  private canvas: HTMLCanvasElement
  private props: PromotionWebGLStageProps

  constructor(canvas: HTMLCanvasElement, props: PromotionWebGLStageProps) {
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true })
    if (!gl) throw new Error("WebGL2 is required for PromotionWebGLStage")
    this.gl = gl
    this.canvas = canvas
    this.props = props
    this.spriteProgram = program(gl, SPRITE_VS, SPRITE_FS)
    this.textProgram = program(gl, TEXT_VS, TEXT_FS)
    const buffer = gl.createBuffer()
    if (!buffer) throw new Error("Unable to allocate WebGL buffer")
    this.buffer = buffer
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    this.ensureTexture(FONT_ATLAS_URL, true)
    this.preloadTreeImages(PREFAB_TREES.promotion.root as unknown as TreeNode)
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()
    this.loop = this.loop.bind(this)
    this.loop()
  }

  updateProps(props: PromotionWebGLStageProps) {
    const keyChanged = this.props.animationKey !== props.animationKey || this.props.startRarity !== props.startRarity || this.props.fixRarity !== props.fixRarity
    this.props = props
    if (keyChanged) this.startTime = performance.now()
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.resizeObserver?.disconnect()
  }

  private preloadTreeImages(node: TreeNode) {
    const img = node.comp.image?.img || node.comp.rawImage?.img
    const url = spriteUrl(img)
    if (url) this.ensureTexture(url, false)
    for (const child of node.children) this.preloadTreeImages(child)
  }

  private ensureTexture(url: string, isFont: boolean): TextureEntry {
    const existing = this.textures.get(url)
    if (existing) return existing
    const gl = this.gl
    const texture = gl.createTexture()
    const entry: TextureEntry = { texture, width: 1, height: 1, loaded: false }
    this.textures.set(url, entry)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 0]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const img = new Image()
    img.decoding = "async"
    img.onload = () => {
      entry.width = img.naturalWidth || 1
      entry.height = img.naturalHeight || 1
      entry.loaded = true
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, isFont ? gl.LINEAR : gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, isFont ? gl.LINEAR : gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }
    img.src = url
    return entry
  }

  private resize() {
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr))
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  private loop() {
    this.draw((performance.now() - this.startTime) / 1000)
    this.raf = requestAnimationFrame(this.loop)
  }

  private designToScreen(x: number, y: number, dw: number, dh: number) {
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
    const cw = this.canvas.clientWidth
    const ch = this.canvas.clientHeight
    const fit = PREFAB_DESIGN.promotion.fit ?? "contain"
    let sx = cw / dw
    let sy = ch / dh
    let ox = 0
    let oy = 0
    if (fit === "contain") {
      const s = Math.min(sx, sy)
      ox = (cw - dw * s) / 2
      oy = (ch - dh * s) / 2
      sx = s
      sy = s
    }
    return { x: (ox + x * sx) * dpr, y: (oy + y * sy) * dpr, sx: sx * dpr, sy: sy * dpr }
  }

  private rectToScreen(r: Rect, dw: number, dh: number): Rect {
    const p = this.designToScreen(r.left, r.top, dw, dh)
    return { left: p.x, top: p.y, w: r.w * p.sx, h: r.h * p.sy }
  }

  private draw(elapsed: number) {
    const gl = this.gl
    const canvas = this.canvas
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.disable(gl.SCISSOR_TEST)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const [dw, dh] = PREFAB_DESIGN.promotion.size as [number, number]
    const activeRarity = activeRarityAt(this.props.startRarity, this.props.fixRarity, elapsed)
    const activeRerity = RERITY_FOR_VIEW_RARITY[activeRarity]
    const root = PREFAB_TREES.promotion.root as unknown as TreeNode
    const colorGradientPaths = new Set(Object.keys(promotionBindings.colorGradientChildren))

    const renderList: RenderNode[] = []
    this.collect(root, dw, dh, [1, 0, 0, 1, 0, 0], 1, undefined, renderList, activeRerity, elapsed, colorGradientPaths)

    for (const item of renderList) {
      const n = item.node
      if (n.path === "UILotteryPromotion") continue
      const panel = promotionBindings.tmpTextPanels[n.path]
      if (panel) {
        this.drawPanelText(item, panel, elapsed, dw, dh)
      } else if (n.comp.image?.img) {
        const a = colorAlpha(n.comp.image.color)
        if (a > 0.001) this.drawSprite(item, spriteUrl(n.comp.image.img), rgbaParts(n.comp.image.color as ColorLike), dw, dh)
      } else if (n.comp.rawImage?.img) {
        const a = colorAlpha(n.comp.rawImage.color)
        if (a > 0.001) this.drawSprite(item, spriteUrl(n.comp.rawImage.img), rgbaParts(n.comp.rawImage.color as ColorLike), dw, dh)
      }
    }
  }

  private collect(
    node: TreeNode,
    pw: number,
    ph: number,
    parentMatrix: Mat3,
    parentAlpha: number,
    parentClip: Rect | undefined,
    out: RenderNode[],
    activeRerity: string,
    elapsed: number,
    gradientPaths: Set<string>,
  ) {
    if (!node.active && !this.forceShow(node.path, activeRerity)) return
    if (this.hidden(node.path, activeRerity)) return

    const rectData: TreeRectData = { ...node.rect, anchoredPosition: [...node.rect.anchoredPosition] as [number, number] }
    rectData.anchoredPosition[1] = animatedY(node.path, activeRerity, elapsed, rectData.anchoredPosition[1])
    const localRect = childRect(rectData, pw, ph)
    const localMatrix = nodeMatrix(localRect, rectData)
    const matrix = matMul(parentMatrix, localMatrix)
    const worldRect = transformRect(matrix, 0, 0, localRect.w, localRect.h)
    let alpha = parentAlpha * (node.comp.canvasGroupAlpha ?? 1)
    alpha = groupAlpha(node.path, activeRerity, elapsed, alpha)
    alpha = rootAlpha(node.path, this.props.startRarity, this.props.fixRarity, elapsed, alpha)
    // Mask types: new explicit names (isSpriteMask/isRectMask) take precedence;
    // legacy names (isMask/isRectMask2D) kept for backwards compat with older
    // tree JSON. Both forms of mask are approximated here as a rect intersect
    // — the WebGL stage doesn't yet do sprite-alpha stencil clipping, so a
    // Unity Mask is conservatively narrowed to its host rect.
    const hasMask =
      (node.comp.isSpriteMask ?? node.comp.isMask) ||
      (node.comp.isRectMask ?? node.comp.isRectMask2D)
    const clip = hasMask ? intersect(parentClip, worldRect) : parentClip

    if (!gradientPaths.has(node.path)) out.push({ node, matrix, rect: worldRect, alpha, clip })
    for (const child of node.children) this.collect(child, localRect.w, localRect.h, matrix, alpha, clip, out, activeRerity, elapsed, gradientPaths)
  }

  private forceShow(path: string, activeRerity: string) {
    if (path === `UILotteryPromotion/container/${activeRerity}`) return true
    if (activeRerity === "rerity4" && path === "UILotteryPromotion/container/uiparticle_SR") return true
    if (activeRerity === "rerity5" && (path === "UILotteryPromotion/container/uiparticle_SSR" || path === "UILotteryPromotion/container/uiparticle_SSR_ad")) return true
    if (activeRerity === "rerity5UltimatePlusPU" && (path === "UILotteryPromotion/container/uiparticle_SSRUltimatePlusPU" || path === "UILotteryPromotion/container/uiparticle_SSRUltimatePlusPU_ad")) return true
    return false
  }

  private hidden(path: string, activeRerity: string) {
    const rarityRoot = path.match(/^UILotteryPromotion\/container\/(rerity3|rerity4|rerity5|rerity5UltimatePlusPU)(\/|$)/)?.[1]
    return Boolean(rarityRoot && rarityRoot !== activeRerity)
  }

  private applyClip(clip: Rect | undefined, dw: number, dh: number) {
    const gl = this.gl
    if (!clip) {
      gl.disable(gl.SCISSOR_TEST)
      return
    }
    const s = this.rectToScreen(clip, dw, dh)
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(Math.round(s.left), Math.round(this.canvas.height - (s.top + s.h)), Math.max(0, Math.round(s.w)), Math.max(0, Math.round(s.h)))
  }

  private drawSprite(item: RenderNode, url: string | null, tint: [number, number, number, number], dw: number, dh: number) {
    if (!url) return
    const tex = this.ensureTexture(url, false)
    if (!tex.texture || !tex.loaded) return
    const gl = this.gl
    this.applyClip(item.clip, dw, dh)
    gl.useProgram(this.spriteProgram)
    gl.uniform2f(gl.getUniformLocation(this.spriteProgram, "u_resolution"), this.canvas.width, this.canvas.height)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex.texture)
    gl.uniform1i(gl.getUniformLocation(this.spriteProgram, "u_tex"), 0)
    const r = this.rectToScreen(item.rect, dw, dh)
    const color: [number, number, number, number] = [tint[0], tint[1], tint[2], tint[3] * item.alpha]
    const data = quadData(r.left, r.top, r.w, r.h, 0, 0, 1, 1, color)
    this.uploadAndDraw(this.spriteProgram, data, ["a_pos", "a_uv", "a_color"], [2, 2, 4])
  }

  private drawPanelText(item: RenderNode, panel: TmpPanel, elapsed: number, dw: number, dh: number) {
    const text = panel.text ?? ""
    if (!text) return
    const atlas = this.ensureTexture(FONT_ATLAS_URL, true)
    if (!atlas.texture || !atlas.loaded) return
    const material = panel.sharedMaterial?.name ? tenslafontMaterials[panel.sharedMaterial.name] : undefined
    const face = multiply(panel.fontColor, material?.colors?._FaceColor ?? null)
    const glow = rgbaParts(material?.colors?._GlowColor, [1, 1, 1, 0])
    const underlay = rgbaParts(material?.colors?._UnderlayColor, [0, 0, 0, 0])
    const outline = rgbaParts(material?.colors?._OutlineColor, [0, 0, 0, 0])
    const gradientUrl = this.gradientUrl(panel)
    const gradient = gradientUrl ? this.ensureTexture(gradientUrl, false) : null

    const verts = this.textVertices(item, panel, elapsed, dw, dh)
    if (!verts.length) return

    // Underlay and glow are still derived from TMP material values, but drawn
    // as SDF passes instead of DOM filter passes. This is the core renderer
    // swap that removes per-glyph CSS mask repaint cost.
    if (underlay[3] > 0.001) this.drawTextPass(verts, atlas.texture, gradient?.texture ?? null, gradient?.loaded ?? false, underlay, 0.42, 0.018, item.clip, dw, dh, 0.72)
    if (glow[3] > 0.001 && (material?.floats?._GlowOuter ?? 0) > 0) this.drawTextPass(verts, atlas.texture, gradient?.texture ?? null, gradient?.loaded ?? false, glow, 0.38, 0.04, item.clip, dw, dh, 0.55)
    if (outline[3] > 0.001) this.drawTextPass(verts, atlas.texture, gradient?.texture ?? null, gradient?.loaded ?? false, outline, 0.43, 0.018, item.clip, dw, dh, 0.45)
    this.drawTextPass(verts, atlas.texture, gradient?.texture ?? null, gradient?.loaded ?? false, face, 0.50, 0.0045, item.clip, dw, dh, 1)
  }

  private gradientUrl(panel: TmpPanel) {
    const first = panel.colorGradientChildren?.[0]
    const img = first ? promotionBindings.colorGradientChildren[first]?.image?.img : null
    return spriteUrl(img)
  }

  private textVertices(item: RenderNode, panel: TmpPanel, elapsed: number, dw: number, dh: number): Float32Array {
    const fontSize = panel.fontSize ?? 64
    const ascent = fontData.face_ascentLine ?? 19.2
    const lineHeight = (fontData.face_lineHeight ?? 26.16) * (fontSize / ascent) * 1.15
    const scale = fontSize / ascent
    const lines = (panel.text ?? "").split(/\r?\n/)
    const chars = fontData.chars
    const space = chars["32"]?.adv ?? 3.84375
    const tween = panel.simpleTweenTMPSage
    const interval = tween?.interval ?? 0.0075
    const charDuration = tween?.charDuration ?? 0.02
    const isCenter = item.node.path.includes("detectRog")
    const rows: number[] = []
    for (const line of lines) {
      let w = 0
      for (const ch of [...line]) {
        const code = String(ch.codePointAt(0) ?? 32)
        w += (chars[code]?.adv ?? space) * scale
      }
      rows.push(w)
    }
    const totalHeight = lines.length * lineHeight
    let global = 0
    const out: number[] = []
    const gradRect = this.gradientRect(item.node, item.matrix, item.rect.w, item.rect.h)
    for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
      const line = lines[lineNo]
      let x = isCenter ? Math.max(0, (item.rect.w - rows[lineNo]) / 2) : 0
      const y = isCenter ? Math.max(0, (item.rect.h - totalHeight) / 2) + lineNo * lineHeight : lineNo * lineHeight
      for (const ch of [...line]) {
        const code = String(ch.codePointAt(0) ?? 32)
        const glyph = chars[code]
        const alpha = Math.max(0, Math.min(1, (elapsed - global * interval) / Math.max(0.001, charDuration))) * item.alpha
        global += 1
        if (!glyph || glyph.w <= 0 || glyph.h <= 0 || alpha <= 0.001) {
          x += (glyph?.adv ?? space) * scale
          continue
        }
        const gx = x + glyph.bx * scale
        const gy = y + ((fontData.face_ascentLine ?? 19.2) * scale - glyph.by * scale)
        const gw = glyph.w * scale
        const gh = glyph.h * scale
        const p = this.quadFromLocal(item.matrix, gx, gy, gw, gh, dw, dh)
        const u0 = glyph.x / fontData.atlas_w
        const v0 = (fontData.atlas_h - glyph.y - glyph.h) / fontData.atlas_h
        const u1 = (glyph.x + glyph.w) / fontData.atlas_w
        const v1 = (fontData.atlas_h - glyph.y) / fontData.atlas_h
        appendTextQuad(out, p, u0, v0, u1, v1, alpha, gradRect)
        x += glyph.adv * scale
      }
    }
    return new Float32Array(out)
  }

  private gradientRect(node: TreeNode, panelMatrix: Mat3, panelW: number, panelH: number): Rect {
    const child = node.children.find((c) => c.path.includes("/ColorGradient_"))
    if (!child) return transformRect(panelMatrix, 0, 0, panelW, panelH)
    const local = childRect(child.rect, panelW, panelH)
    return transformRect(matMul(panelMatrix, nodeMatrix(local, child.rect)), 0, 0, local.w, local.h)
  }

  private quadFromLocal(matrix: Mat3, x: number, y: number, w: number, h: number, dw: number, dh: number) {
    const p0 = transformPoint(matrix, x, y)
    const p1 = transformPoint(matrix, x + w, y + h)
    const r = this.rectToScreen({ left: Math.min(p0.x, p1.x), top: Math.min(p0.y, p1.y), w: Math.abs(p1.x - p0.x), h: Math.abs(p1.y - p0.y) }, dw, dh)
    return r
  }

  private drawTextPass(verts: Float32Array, atlas: WebGLTexture, gradient: WebGLTexture | null, useGradient: boolean, color: [number, number, number, number], edge: number, softness: number, clip: Rect | undefined, dw: number, dh: number, alphaMult: number) {
    const gl = this.gl
    this.applyClip(clip, dw, dh)
    gl.useProgram(this.textProgram)
    gl.uniform2f(gl.getUniformLocation(this.textProgram, "u_resolution"), this.canvas.width, this.canvas.height)
    gl.uniform4f(gl.getUniformLocation(this.textProgram, "u_effect_color"), color[0], color[1], color[2], color[3])
    gl.uniform1f(gl.getUniformLocation(this.textProgram, "u_edge"), edge)
    gl.uniform1f(gl.getUniformLocation(this.textProgram, "u_softness"), softness)
    gl.uniform1f(gl.getUniformLocation(this.textProgram, "u_alpha_mult"), alphaMult)
    gl.uniform1i(gl.getUniformLocation(this.textProgram, "u_use_gradient"), useGradient && Boolean(gradient) ? 1 : 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, atlas)
    gl.uniform1i(gl.getUniformLocation(this.textProgram, "u_font"), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, gradient || atlas)
    gl.uniform1i(gl.getUniformLocation(this.textProgram, "u_gradient"), 1)
    this.uploadAndDraw(this.textProgram, verts, ["a_pos", "a_uv", "a_grad_uv", "a_color"], [2, 2, 2, 4])
  }

  private uploadAndDraw(prog: WebGLProgram, data: Float32Array, attrs: string[], sizes: number[]) {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW)
    const strideFloats = sizes.reduce((a, b) => a + b, 0)
    const stride = strideFloats * 4
    let offset = 0
    for (let i = 0; i < attrs.length; i += 1) {
      const loc = gl.getAttribLocation(prog, attrs[i])
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, sizes[i], gl.FLOAT, false, stride, offset * 4)
      }
      offset += sizes[i]
    }
    gl.drawArrays(gl.TRIANGLES, 0, data.length / strideFloats)
  }
}

function quadData(x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number, color: [number, number, number, number]) {
  return new Float32Array([
    x, y, u0, v0, ...color,
    x + w, y, u1, v0, ...color,
    x + w, y + h, u1, v1, ...color,
    x, y, u0, v0, ...color,
    x + w, y + h, u1, v1, ...color,
    x, y + h, u0, v1, ...color,
  ])
}

function appendTextQuad(out: number[], r: Rect, u0: number, v0: number, u1: number, v1: number, alpha: number, gradRect: Rect) {
  const g = (x: number, y: number): [number, number] => {
    const gu = gradRect.w ? (x - gradRect.left) / gradRect.w : 0
    const gv = gradRect.h ? (y - gradRect.top) / gradRect.h : 0
    return [gu, gv]
  }
  const c: [number, number, number, number] = [1, 1, 1, alpha]
  const p = [
    [r.left, r.top, u0, v0],
    [r.left + r.w, r.top, u1, v0],
    [r.left + r.w, r.top + r.h, u1, v1],
    [r.left, r.top, u0, v0],
    [r.left + r.w, r.top + r.h, u1, v1],
    [r.left, r.top + r.h, u0, v1],
  ]
  for (const [x, y, u, v] of p) {
    const [gu, gv] = g(x, y)
    out.push(x, y, u, v, gu, gv, ...c)
  }
}

export type PromotionWebGLStageProps = {
  startRarity: PromotionViewRarity
  fixRarity: PromotionViewRarity
  animationKey?: string | number
  onAdvance?: () => void
  className?: string
  style?: CSSProperties
}

export function PromotionWebGLStage(props: PromotionWebGLStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<PromotionWebGLRenderer | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new PromotionWebGLRenderer(canvas, propsRef.current)
    rendererRef.current = renderer
    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    rendererRef.current?.updateProps(props)
  }, [props])

  return (
    <div className={props.className} style={{ position: "absolute", inset: 0, overflow: "hidden", background: "black", ...props.style }} onClick={props.onAdvance}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ display: "block", width: "100%", height: "100%" }} />
      <button
        type="button"
        aria-label="Skip reveal"
        onClick={(e) => {
          e.stopPropagation()
          props.onAdvance?.()
        }}
        className="absolute right-[8.5%] top-[6.5%] z-10 h-[8%] w-[18%] cursor-pointer bg-transparent"
      >
        <span className="pointer-events-none absolute right-0 top-0 font-serif text-[clamp(12px,1.5vw,28px)] font-bold italic tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
          SKIP ▶▶
        </span>
      </button>
    </div>
  )
}
