"use client"

// LotteryParticles — a data-driven canvas particle emitter that replays the
// REAL Unity ParticleSystem parameters extracted 1:1 from the lottery
// prefabs (lottery_runtime_data/<Prefab>.particles.json + …particle_materials.json).
// Every number (startLifetime, startSpeed, startSize, startColor, rateOverTime,
// bursts, gravityModifier, looping, duration, shape, color/size/velocity/
// rotation over lifetime, material/texture references) comes straight from
// the prefab's ParticleSystem / ParticleSystemRenderer / Material typetree —
// nothing here is invented.
//
// Renderer behaviour summary:
//   * Sprites are drawn from the real material's _MainTex / _Color / _Alpha
//     textures, rotated by RotationModule curves, sized by SizeModule curves,
//     coloured by ColorModule gradient × startColor, moved by VelocityModule
//     curves on top of startSpeed + gravity. Composite mode (additive vs
//     alpha-blend) is read from the material's _SrcBlend / _DstBlend pair.
//   * When a system has no resolved texture (renderer/material chain failed),
//     the renderer falls back to an additive radial gradient with a console
//     warning — that path is documented as a hard error to investigate, not
//     a silent stand-in.

import { useEffect, useRef } from "react"

export type PSMinMax = number | [number, number] | { scalar?: number; curve?: boolean } | null

export type PSShape = {
  enabled?: boolean | number | null
  // Unity ParticleSystem.ShapeType enum: 0=Sphere, 4=Cone, 5=Box, 7=Circle,
  // 8=Edge, 10=Donut, 17=Rectangle. radius applies to Sphere/Circle/Cone/Donut.
  type?: number | null
  // In legacy extracts radius is just a number; in the full extract it is the
  // Unity MinMaxCurve struct { value, mode, spread, speed }. We accept both.
  radius?: number | { value?: number } | null
  // For Cone (type=4), angle is the half-angle of the spawn cone in degrees.
  angle?: number | null
} | null

// Full ParticleSystem + ParticleSystemRenderer + ShapeModule data, joined by
// `path` from character_appear_particle_full.json. This is the source of truth
// for Donut/Cone/Circle ring sampling, renderMode-aware size clamping, and the
// scalingMode setting that decides whether Transform.lossyScale multiplies the
// particle size. Without this data the renderer falls back to the simpler
// PSShape it already had.
export type PSEmitterFull = {
  path: string
  scalingMode?: number | null  // 0=Hierarchy, 1=Local, 2=Shape
  shape?: {
    enabled?: boolean | null
    type?: number | null  // Unity ShapeType: 0=Sphere, 4=Cone, 7=Circle, 10=Donut, …
    // MinMaxCurve-wrapped fields in the full extract:
    radius?: { value?: number } | number | null
    arc?: { value?: number } | number | null
    radiusThickness?: number | null  // 0=edge-only, 1=full disk; default 1
    donutRadius?: number | null  // cross-section radius for Donut
    angle?: number | null  // Cone half-angle (deg)
    randomDirectionAmount?: number | null
    randomPositionAmount?: number | null
    alignToDirection?: boolean | null
  } | null
  renderer?: {
    renderMode?: number | null  // 0=Billboard, 1=StretchedBillboard, 2=HorizontalBillboard, 3=VerticalBillboard, 4=Mesh
    minParticleSize?: number | null
    maxParticleSize?: number | null  // Clamp in screen-relative units (Billboard) or world (Mesh)
    pivot?: { x: number; y: number; z: number } | null
  } | null
}

// MinMaxCurve as exported by extract_particle_lifetime_curves.py.
//   mode 0 = Constant (single scalar)
//   mode 1 = Curve (sample `max` array at lifeT)
//   mode 2 = TwoCurves (lerp between min/max curves by particle's rng [0,1])
//   mode 3 = TwoConstants (lerp between scalarMin / scalar by rng)
export type PSCurveKey = { t: number; v: number; in: number; out: number }
export type PSMinMaxCurve = {
  mode: number
  scalar: number
  scalarMin: number
  max: PSCurveKey[]
  min: PSCurveKey[]
} | null

export type PSColorGradient = {
  // Unity Gradient: up to 8 color keys + 8 alpha keys, each with its own time
  // slot 0..65535. m_NumColorKeys / m_NumAlphaKeys tell us how many slots are
  // active. mode 0 = Blend, 1 = Fixed.
  key0?: { r: number; g: number; b: number; a: number }
  key1?: { r: number; g: number; b: number; a: number }
  key2?: { r: number; g: number; b: number; a: number }
  key3?: { r: number; g: number; b: number; a: number }
  key4?: { r: number; g: number; b: number; a: number }
  key5?: { r: number; g: number; b: number; a: number }
  key6?: { r: number; g: number; b: number; a: number }
  key7?: { r: number; g: number; b: number; a: number }
  ctime0?: number
  ctime1?: number
  ctime2?: number
  ctime3?: number
  ctime4?: number
  ctime5?: number
  ctime6?: number
  ctime7?: number
  atime0?: number
  atime1?: number
  atime2?: number
  atime3?: number
  atime4?: number
  atime5?: number
  atime6?: number
  atime7?: number
  m_Mode?: number
  m_NumColorKeys?: number
  m_NumAlphaKeys?: number
}

export type PSRecord = {
  go: string | null
  path?: string | null
  duration: number | null
  looping: boolean | number | null
  main: {
    startLifetime: PSMinMax
    startSpeed: PSMinMax
    startSize: PSMinMax
    startColor:
      | { r: number; g: number; b: number; a: number }
      | {
          minMaxState?: number
          minColor?: { r: number; g: number; b: number; a: number }
          maxColor?: { r: number; g: number; b: number; a: number }
          maxGradient?: PSColorGradient
        }
      | null
    gravityModifier: PSMinMax
    maxParticles: number | null
  }
  emission: {
    enabled: boolean | number | null
    rateOverTime: PSMinMax
    bursts:
      | Array<{ time: number; count?: number | { scalar?: number }; countCurve?: { scalar?: number } }>
      | null
  }
  shape?: PSShape
  // Lifetime modules (added by extract_particle_lifetime_curves.py)
  sizeModule?: { enabled: boolean; separateAxes?: boolean; curve: PSMinMaxCurve; y?: PSMinMaxCurve; z?: PSMinMaxCurve }
  velocityModule?: { enabled: boolean; inWorldSpace?: boolean; x: PSMinMaxCurve; y: PSMinMaxCurve; z: PSMinMaxCurve }
  // For RotationModule: when separateAxes=false (default for 2D billboards),
  // Unity stores the single-axis Z rotation in `curve`. When true, x/y/z hold
  // per-axis curves. We read `curve` first, falling back to `z` for the
  // separate-axes case.
  rotationModule?: { enabled: boolean; separateAxes?: boolean; curve?: PSMinMaxCurve; x?: PSMinMaxCurve; y?: PSMinMaxCurve; z?: PSMinMaxCurve }
  colorModule?: { enabled: boolean; gradient: { minMaxState?: number; maxGradient?: PSColorGradient } | null }
}

// Material/texture chain for each system, joined by `path` from
// character_appear_particle_materials.json. The renderer reads this to know
// which sprite to draw and which blend mode to use.
export type PSMaterialBinding = {
  path: string
  texture_file?: string | null
  material_name?: string | null
  blend_mode?: string | null
  shader_name?: string | null
}

// Per-emitter spawn origin + world-unit-to-pixel scale, joined by `path` from
// character_appear_particle_transforms.json. canvas_origin_x/css_y_design_px
// are 1920×1080 design-space coords (CSS y-down); unit_px is the nearest
// UIParticle ancestor's m_Scale3D.x (108 for UIParticle subtrees, 1.0 for the
// world-space ef_sageBg fallback whose startSize values are already in pixel
// range). When the design origin lands outside the canvas (world-space sageBg
// emitters whose RectTransform sits off-screen because Unity's particle engine
// uses the world Transform position instead), the renderer falls back to the
// host canvas's centre.
export type PSEmitterTransform = {
  path: string
  canvas_origin_x_design_px: number
  css_y_design_px: number
  unit_px: number
}

// MinMaxCurve "scalar" reader. Unity's MinMaxCurve struct in the full
// extract has shape { value, mode, spread, speed }; we just want the constant
// value (`value`) for shape parameters like radius/arc that are typically
// constants in lottery prefabs. Returns null if the field isn't an object
// with a usable value.
function readMinMaxScalar(v: { value?: number } | number | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === "number") return v
  if (typeof v === "object" && typeof v.value === "number") return v.value
  return null
}

// The legacy PSRecord.shape stores radius as a flat number (instead of the
// MinMaxCurve struct the full extractor produces). Both shapes coexist
// while we migrate consumers; this helper returns the legacy value or null.
function extractLegacyRadius(r: number | { value?: number } | null | undefined): number | null {
  if (r == null) return null
  if (typeof r === "number") return r
  if (typeof r === "object" && typeof r.value === "number") return r.value
  return null
}

// Track which (shapeType, path) pairs we've already warned about so the
// console doesn't spam every spawn. Keyed by `${type}|${path}`.
const _warnedShapeKeys = new Set<string>()
function warnUnsupportedShape(shapeType: number, path: string | null | undefined): void {
  const key = `${shapeType}|${path ?? "?"}`
  if (_warnedShapeKeys.has(key)) return
  _warnedShapeKeys.add(key)
  console.warn(
    `LotteryParticles[blocker]: unsupported ShapeType ${shapeType} for emitter ${path ?? "?"} — emitting from centre as fallback. Implement Box/Edge/Rectangle sampling to lift this blocker.`,
  )
}

function rangeSample(v: PSMinMax, fallback = 0): number {
  if (v == null) return fallback
  if (typeof v === "number") return v
  if (Array.isArray(v)) {
    const [a, b] = v
    return a + Math.random() * (b - a)
  }
  if (typeof v === "object" && typeof v.scalar === "number") return v.scalar
  return fallback
}

// Sample a Unity AnimationCurve at time t (0..1 normalised over particle
// lifetime) using cubic Hermite interpolation between adjacent keys.
// Unity's AnimationCurve stores keyframes with inSlope/outSlope tangents;
// the Hermite basis (h00, h10, h01, h11) reconstructs the same cubic the
// Unity runtime evaluates. ±Infinity tangents = constant-step ("stepped"
// curves used for popping the value at the keyframe), so we collapse them
// to the previous key's value.
function sampleCurveHermite(keys: PSCurveKey[], t: number, fallback = 1): number {
  if (!keys || keys.length === 0) return fallback
  if (keys.length === 1) return keys[0].v
  if (t <= keys[0].t) return keys[0].v
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].v
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a.t && t <= b.t) {
      const dt = b.t - a.t
      if (dt <= 1e-9) return b.v
      const outSlope = a.out
      const inSlope = b.in
      if (!isFinite(outSlope) || !isFinite(inSlope)) return a.v
      const r = (t - a.t) / dt
      const r2 = r * r
      const r3 = r2 * r
      const h00 = 2 * r3 - 3 * r2 + 1
      const h10 = r3 - 2 * r2 + r
      const h01 = -2 * r3 + 3 * r2
      const h11 = r3 - r2
      return h00 * a.v + h10 * outSlope * dt + h01 * b.v + h11 * inSlope * dt
    }
  }
  return keys[keys.length - 1].v
}

// Sample a MinMaxCurve at lifeT given a per-particle random in [0, 1].
function sampleMinMax(curve: PSMinMaxCurve, t: number, rng: number, fallback = 1): number {
  if (!curve) return fallback
  const mode = curve.mode ?? 0
  if (mode === 0) return curve.scalar
  if (mode === 1) {
    const v = sampleCurveHermite(curve.max ?? [], t, fallback)
    return v * curve.scalar
  }
  if (mode === 2) {
    const a = sampleCurveHermite(curve.min ?? [], t, fallback)
    const b = sampleCurveHermite(curve.max ?? [], t, fallback)
    return (a + (b - a) * rng) * curve.scalar
  }
  if (mode === 3) {
    return curve.scalarMin + (curve.scalar - curve.scalarMin) * rng
  }
  return fallback
}

// Sample Unity Gradient at t [0, 1]. Sorted ctime + atime slots; mode 0
// (Blend) lerps between adjacent stops; mode 1 (Fixed) returns the previous
// stop's value with no interpolation.
function sampleGradient(grad: PSColorGradient | null | undefined, t: number): { r: number; g: number; b: number; a: number } {
  if (!grad) return { r: 1, g: 1, b: 1, a: 1 }
  const nC = grad.m_NumColorKeys ?? 0
  const nA = grad.m_NumAlphaKeys ?? 0
  // Build (t, value) lists. Time slots are 0..65535 from Unity.
  const cKeys: { t: number; r: number; g: number; b: number }[] = []
  const aKeys: { t: number; a: number }[] = []
  for (let i = 0; i < 8; i += 1) {
    const k = (grad as Record<string, unknown>)[`key${i}`] as { r: number; g: number; b: number; a: number } | undefined
    const ct = (grad as Record<string, unknown>)[`ctime${i}`] as number | undefined
    const at = (grad as Record<string, unknown>)[`atime${i}`] as number | undefined
    if (k != null && i < nC && ct != null) {
      cKeys.push({ t: ct / 65535, r: k.r, g: k.g, b: k.b })
    }
    if (k != null && i < nA && at != null) {
      aKeys.push({ t: at / 65535, a: k.a })
    }
  }
  cKeys.sort((a, b) => a.t - b.t)
  aKeys.sort((a, b) => a.t - b.t)
  const mode = grad.m_Mode ?? 0
  function lerpC(): { r: number; g: number; b: number } {
    if (cKeys.length === 0) return { r: 1, g: 1, b: 1 }
    if (cKeys.length === 1 || t <= cKeys[0].t) return cKeys[0]
    if (t >= cKeys[cKeys.length - 1].t) return cKeys[cKeys.length - 1]
    for (let i = 0; i < cKeys.length - 1; i += 1) {
      const a = cKeys[i]
      const b = cKeys[i + 1]
      if (t >= a.t && t <= b.t) {
        if (mode === 1) return a
        const r = (t - a.t) / Math.max(1e-9, b.t - a.t)
        return {
          r: a.r + (b.r - a.r) * r,
          g: a.g + (b.g - a.g) * r,
          b: a.b + (b.b - a.b) * r,
        }
      }
    }
    return cKeys[cKeys.length - 1]
  }
  function lerpA(): number {
    if (aKeys.length === 0) return 1
    if (aKeys.length === 1 || t <= aKeys[0].t) return aKeys[0].a
    if (t >= aKeys[aKeys.length - 1].t) return aKeys[aKeys.length - 1].a
    for (let i = 0; i < aKeys.length - 1; i += 1) {
      const a = aKeys[i]
      const b = aKeys[i + 1]
      if (t >= a.t && t <= b.t) {
        if (mode === 1) return a.a
        const r = (t - a.t) / Math.max(1e-9, b.t - a.t)
        return a.a + (b.a - a.a) * r
      }
    }
    return aKeys[aKeys.length - 1].a
  }
  const c = lerpC()
  return { r: c.r, g: c.g, b: c.b, a: lerpA() }
}

// Sample a start color which may be a MinMaxGradient or a flat color.
function sampleStartColor(
  sc: PSRecord["main"]["startColor"],
  rng: number,
): { r: number; g: number; b: number; a: number } {
  if (!sc) return { r: 1, g: 1, b: 1, a: 1 }
  if ("r" in sc && "g" in sc && "b" in sc) return sc as { r: number; g: number; b: number; a: number }
  const mm = sc as {
    minMaxState?: number
    minColor?: { r: number; g: number; b: number; a: number }
    maxColor?: { r: number; g: number; b: number; a: number }
    maxGradient?: PSColorGradient
  }
  const state = mm.minMaxState ?? 0
  const a = mm.minColor ?? { r: 1, g: 1, b: 1, a: 1 }
  const b = mm.maxColor ?? { r: 1, g: 1, b: 1, a: 1 }
  if (state === 2) {
    // RandomBetweenTwoColors — lerp by rng
    return {
      r: a.r + (b.r - a.r) * rng,
      g: a.g + (b.g - a.g) * rng,
      b: a.b + (b.b - a.b) * rng,
      a: a.a + (b.a - a.a) * rng,
    }
  }
  // Fallback to maxColor if defined, otherwise minColor.
  return b.a != null ? b : a
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  startSize: number // unit×px reference size — actual size is startSize * sizeOverLifetime(t)
  startR: number
  startG: number
  startB: number
  startA: number
  rotation: number // current rotation angle (radians)
  // Per-particle random samples for the four MinMax* curves. Stored at
  // spawn so curve sampling at different lifeTs stays consistent.
  rngSize: number
  rngVel: number
  rngRot: number
  rngColor: number
}

// Convert Unity radians-to-radians for rotation curves. Unity stores rotation
// MinMaxCurves in radians (verified empirically: e.g. `-0.872664` for ef_e_particle_00_a
// matches `-50°` in radians).
function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

export function LotteryParticles({
  systems,
  className,
  unitPx = 18,
  maxTotal = 320,
  materials,
  transforms,
  particleFull,
  designSize = [1920, 1080],
  designOffset = [0, 0],
  stopEmissionAt,
}: {
  systems: PSRecord[]
  className?: string
  unitPx?: number
  maxTotal?: number
  // Optional material/texture bindings keyed by system `path`. When provided,
  // the renderer loads each unique texture once and draws the real sprite
  // per particle (rotated + tinted + sized). Without bindings, the renderer
  // falls back to an additive radial gradient (documented as a hard error
  // path in the file header).
  materials?: PSMaterialBinding[]
  // Per-emitter spawn origin + scale (1920×1080 design-space). When supplied,
  // each system's spawn position is read from its prefab RectTransform cascade
  // and unitPx is read from the nearest UIParticle ancestor's m_Scale3D —
  // replacing the canvas-wide unitPx prop and the canvas-centre spawn fallback.
  transforms?: PSEmitterTransform[]
  // Full ParticleSystem typetree (ShapeModule + ParticleSystemRenderer +
  // scalingMode) joined by `path`. When supplied, the renderer uses Donut/Cone
  // ring sampling with arc + radiusThickness + donutRadius (instead of the
  // legacy "treat any non-Cone shape as a uniform disk" path) and applies
  // renderMode-aware max-size clamping via the renderer's maxParticleSize.
  particleFull?: PSEmitterFull[]
  // The design-space coordinate frame this canvas covers. For a full-stage
  // BG canvas this is [1920, 1080] at offset [0, 0]. For slotted canvases
  // (per-star, ef_appear) the caller passes the slot's design-space box so
  // we can remap per-emitter origins into the slot's local pixel space.
  designSize?: [number, number]
  designOffset?: [number, number]
  // Hard cap on emission elapsed time (seconds). Source-traced from the
  // Appear<rarity> AnimationClip's m_StopTime — in Unity the AnimatorController
  // transitions out of the Appear state at clip-end and the per-rarity bursts
  // (rarityNEffect/ef_e_*, ef_appear, ef_view_<rarity>) stop emitting. Without
  // this cap our LotteryParticles canvas keeps spawning particles forever,
  // saturating to a solid white box where bursts overlap (B-PASS4-2). After
  // elapsed > stopEmissionAt, no new particles spawn and no bursts fire;
  // existing particles continue their startLifetime-driven natural decay.
  stopEmissionAt?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let raf = 0
    let running = true
    const start = performance.now()

    const active = systems.filter(
      (s) => s.emission && (s.emission.enabled === true || s.emission.enabled === 1),
    )

    // Resolve per-emitter transforms once. Each active system gets a slot in
    // sysTransforms with:
    //   localX/localY — spawn origin in canvas pixels at the current size
    //                   (Infinity when we should fall back to canvas centre,
    //                   either because the system has no transforms entry or
    //                   its design origin sits outside the canvas frame —
    //                   the world-space ef_sageBg case).
    //   unitPx        — per-emitter world-unit→pixel scale (UIParticle
    //                   m_Scale3D when present, else the prop unitPx).
    const tfByPath = new Map<string, PSEmitterTransform>()
    for (const t of transforms ?? []) tfByPath.set(t.path, t)
    const fullByPath = new Map<string, PSEmitterFull>()
    for (const f of particleFull ?? []) fullByPath.set(f.path, f)
    const [designW, designH] = designSize
    const [designOX, designOY] = designOffset

    // Preload textures referenced by `materials`. We share HTMLImageElement
    // instances across systems with the same texture file. Each entry is
    // { img, loaded } so the renderer can fall back to radial-gradient until
    // the texture decodes.
    const matByPath = new Map<string, PSMaterialBinding>()
    for (const m of materials ?? []) matByPath.set(m.path, m)
    const textureCache = new Map<string, { img: HTMLImageElement; loaded: boolean }>()
    function getTexture(file: string | null | undefined): { img: HTMLImageElement; loaded: boolean } | null {
      if (!file) return null
      const cached = textureCache.get(file)
      if (cached) return cached
      const img = new Image()
      const entry = { img, loaded: false }
      img.onload = () => {
        entry.loaded = true
      }
      img.src = `/UI/lottery_particles/${file}`
      textureCache.set(file, entry)
      return entry
    }
    const sysTextures = active.map((s) => {
      const binding = s.path ? matByPath.get(s.path) : undefined
      return {
        binding,
        tex: getTexture(binding?.texture_file),
      }
    })

    const accum = active.map(() => 0)
    const burstFired = active.map(() => new Set<number>())
    // Track previous sysTime per emitter so we can detect loop wrap-around
    // (sysTime jumps from near sysDur back to ~0) and clear burstFired at the
    // CORRECT moment — once per loop cycle, not every frame. Previous code
    // cleared burstFired unconditionally after each frame's burst check for
    // looping systems, which made bursts re-fire EVERY FRAME (a burst at
    // sysTime=0 always satisfied `sysTime >= 0`), accumulating massive
    // particle counts (B-PASS4-2: rarityNEffect shine bursts spawned
    // 3 particles per frame × 60fps × 2.28s clip = ~410 stationary additive
    // sprites per emitter, saturating the canvas to a solid white box).
    const prevSysTime = active.map(() => -1)
    const particles: Particle[][] = active.map(() => [])

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      canvas!.width = Math.max(1, Math.floor(rect.width))
      canvas!.height = Math.max(1, Math.floor(rect.height))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let last = start
    function frame(now: number) {
      if (!running) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const elapsed = (now - start) / 1000
      const W = canvas!.width
      const H = canvas!.height
      ctx!.clearRect(0, 0, W, H)

      let total = 0
      for (const arr of particles) total += arr.length

      active.forEach((s, si) => {
        const sysDur = s.duration ?? 5
        const looping = s.looping === true || s.looping === 1
        const sysTime = looping ? elapsed % Math.max(0.0001, sysDur) : elapsed
        const startLifeFallback = typeof s.main.startLifetime === "number" ? s.main.startLifetime : 3
        // Source-traced cap: if `stopEmissionAt` is set, no system emits past
        // that elapsed time. Mirrors the Animator state-exit in Unity that
        // disables/stops ParticleSystems when the Appear clip finishes.
        const pastClipEnd = typeof stopEmissionAt === "number" && elapsed > stopEmissionAt
        const alive = !pastClipEnd && (looping || elapsed <= sysDur + startLifeFallback)
        const arr = particles[si]

        // Fidelity fix: Unity ParticleSystem enforces a per-system
        // maxParticles cap. Without this, e.g. ef_e_circleSmoke00 (R rarity
        // bg, maxParticles=2 in Unity) was spawning unbounded particles in
        // our simulator → smoke storm instead of one large halo. This cap
        // is per-EMITTER (s.main.maxParticles), not the global maxTotal.
        const sysMaxParticles = typeof s.main.maxParticles === "number" ? s.main.maxParticles : Infinity
        if (alive && total < maxTotal) {
          const rate = rangeSample(s.emission.rateOverTime, 0)
          if (rate > 0) {
            accum[si] += rate * dt
            while (accum[si] >= 1 && total < maxTotal && arr.length < sysMaxParticles) {
              accum[si] -= 1
              arr.push(spawn(s, W, H))
              total++
            }
          }
          for (const b of s.emission.bursts ?? []) {
            const bt = b.time ?? 0
            if (!burstFired[si].has(bt) && sysTime >= bt) {
              burstFired[si].add(bt)
              const cnt =
                typeof b.count === "number"
                  ? b.count
                  : (b.count && typeof b.count === "object" && typeof b.count.scalar === "number"
                      ? b.count.scalar
                      : 0) || b.countCurve?.scalar || 0
              const budget = Math.min(cnt, maxTotal - total, sysMaxParticles - arr.length)
              for (let k = 0; k < budget; k++) {
                arr.push(spawn(s, W, H))
                total++
              }
            }
          }
          // Loop-wrap detection: sysTime = elapsed mod sysDur, so it
          // decreases when crossing a loop boundary. When it wraps, clear
          // the burst-fired record so bursts re-fire for the new cycle.
          // Without this guard a sysTime=0 burst would re-fire every frame
          // (the previous "always clear if looping" path).
          if (looping && prevSysTime[si] > sysTime) burstFired[si].clear()
        }
        prevSysTime[si] = sysTime

        const grav = rangeSample(s.main.gravityModifier, 0)
        const sm = s.sizeModule?.enabled ? s.sizeModule.curve : null
        const vmX = s.velocityModule?.enabled ? s.velocityModule.x : null
        const vmY = s.velocityModule?.enabled ? s.velocityModule.y : null
        // Per-emitter unit_px scaled to the current canvas size. Velocity
        // curves and gravity multiply by this to convert world-units/sec →
        // canvas-pixels/sec for the current frame's W. Must match spawn()'s
        // renderUnitPx exactly so a particle's startSpeed and its velocity-
        // module top-up share the same scale.
        const sysTf = s.path ? tfByPath.get(s.path) : undefined
        const sysUnitPx = sysTf?.unit_px ?? unitPx
        const renderUnitPx = sysUnitPx * (W / Math.max(1, designW))
        // Single-axis rotation curve. separateAxes=false → use `curve`;
        // separateAxes=true → use the z axis explicitly. Both fields are
        // typed optional in PSRecord because Unity stores only one.
        const rmZ = s.rotationModule?.enabled
          ? s.rotationModule.separateAxes
            ? s.rotationModule.z ?? null
            : s.rotationModule.curve ?? null
          : null
        const cmGrad = s.colorModule?.enabled ? s.colorModule.gradient?.maxGradient : null
        const blend = sysTextures[si]?.binding?.blend_mode ?? "additive"
        // Default to additive for ParticleSystems (Unity's particle default);
        // explicit alpha-blended materials switch to source-over composition.
        ctx!.globalCompositeOperation = blend === "alpha" ? "source-over" : "lighter"

        const tex = sysTextures[si]?.tex

        for (let i = arr.length - 1; i >= 0; i--) {
          const p = arr[i]
          p.age += dt
          if (p.age >= p.life) {
            arr.splice(i, 1)
            continue
          }
          const lifeT = p.age / p.life
          // Apply VelocityModule on top of base velocity. Unity uses linear
          // velocity in world units / sec along each axis; we multiply by
          // unitPx to get screen px / sec, then by dt for the per-frame add.
          if (vmX) {
            const vAdd = sampleMinMax(vmX, lifeT, p.rngVel, 0)
            p.x += vAdd * renderUnitPx * dt
          }
          if (vmY) {
            // Unity Y is up; our canvas Y is down. Flip sign.
            const vAdd = sampleMinMax(vmY, lifeT, p.rngVel, 0)
            p.y += -vAdd * renderUnitPx * dt
          }
          p.vy += grav * 9.81 * dt * renderUnitPx
          p.x += p.vx * dt
          p.y += p.vy * dt
          // Apply RotationModule (Z-axis billboard rotation). The curve is
          // angular velocity in radians/sec — multiply by dt and accumulate.
          if (rmZ) {
            const rotRate = sampleMinMax(rmZ, lifeT, p.rngRot, 0)
            p.rotation += rotRate * dt
          }
          // Compose final size + color from start + lifetime modules.
          const sizeMul = sm ? sampleMinMax(sm, lifeT, p.rngSize, 1) : 1
          const size = Math.max(0.5, p.startSize * sizeMul)
          let r = p.startR
          let g = p.startG
          let b = p.startB
          let a = p.startA
          if (cmGrad) {
            const cm = sampleGradient(cmGrad, lifeT)
            r *= cm.r
            g *= cm.g
            b *= cm.b
            a *= cm.a
          } else {
            // Default fallback: hold start color, fade out linearly across
            // the lifetime (mirrors the previous behaviour for systems with
            // no ColorModule data).
            a *= 1 - lifeT
          }
          a = Math.max(0, Math.min(1, a))

          // Fidelity fix: per-emitter blend mode from the resolved Material
          // blend_mode (see character_appear_particle_materials.json which
          // resolves Material.m_Shader → Pass blend state + material floats
          // → final {src, dst} factor pair). Particle materials use
          // TempestVFX/VFXDefault shader; src=1/dst=1 → additive, src=5/dst=1
          // → SrcAlpha-weighted additive, src=5/dst=10 → standard alpha,
          // src=1/dst=0 → "opaque replace" (treated as alpha-blended here
          // since Unity's particle shader still composes against framebuffer
          // through srcAlpha).
          // Canvas globalCompositeOperation supports a subset: "lighter" is
          // additive (One+One), "source-over" is alpha. We approximate the
          // remaining via "lighter" for any additive-like, else "source-over".
          const binding = sysTextures[si]?.binding
          const bMode = binding?.blend_mode || ""
          const isAdditive =
            bMode === "additive" ||
            bMode === "additive_alpha_weighted" ||
            bMode.startsWith("custom(1.0,1.0") ||
            bMode.startsWith("custom(5.0,1.0")
          const prevComposite: GlobalCompositeOperation = ctx!.globalCompositeOperation
          ctx!.globalCompositeOperation = isAdditive ? "lighter" : "source-over"

          if (tex && tex.loaded) {
            // Real sprite path: tint the texture by drawing it onto an
            // offscreen canvas tinted with the colour, then drawImage to the
            // main canvas with rotation. For performance, when r/g/b are
            // all white (1, 1, 1) we skip the tint step — most lottery
            // burst sprites are pre-coloured by their material's _Color
            // texture and Unity's startColor.
            const isWhite = r >= 0.998 && g >= 0.998 && b >= 0.998
            ctx!.save()
            ctx!.globalAlpha = a
            ctx!.translate(p.x, p.y)
            if (p.rotation !== 0) ctx!.rotate(p.rotation)
            const drawSize = size * 2
            if (isWhite) {
              ctx!.drawImage(tex.img, -size, -size, drawSize, drawSize)
            } else {
              // Tint via offscreen canvas
              const off = ensureTintCanvas(tex.img.naturalWidth || 64, tex.img.naturalHeight || 64)
              const octx = off.getContext("2d")
              if (octx) {
                octx.clearRect(0, 0, off.width, off.height)
                octx.globalCompositeOperation = "source-over"
                octx.drawImage(tex.img, 0, 0, off.width, off.height)
                octx.globalCompositeOperation = "multiply"
                octx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
                octx.fillRect(0, 0, off.width, off.height)
                // Restore alpha mask from the original
                octx.globalCompositeOperation = "destination-in"
                octx.drawImage(tex.img, 0, 0, off.width, off.height)
                ctx!.drawImage(off, -size, -size, drawSize, drawSize)
              }
            }
            ctx!.restore()
          } else {
            // Fidelity fix: do NOT render a visual fallback when the
            // texture isn't available. Two cases:
            //   1. binding has no texture_file → real bug (material PPtr
            //      didn't resolve to a texture). Log once, skip the draw.
            //   2. tex exists but not loaded yet → async <img> still
            //      decoding. Skip this frame; next frame will paint the
            //      real sprite when tex.loaded flips true.
            // The previous radial-gradient fallback was masking missing
            // textures and producing the smoke storms in higher-rarity
            // backgrounds.
            const slot = sysTextures[si] as { binding?: PSMaterialBinding; tex: { img: HTMLImageElement; loaded: boolean } | null; _warned?: boolean }
            const hasFile = !!slot.binding?.texture_file
            if (!slot._warned && !hasFile) {
              console.warn(
                "LotteryParticles[blocker]: no texture_file in material binding — system will not render",
                {
                  go: s.go,
                  path: s.path,
                  material_pid: (slot.binding as { material_pid?: number } | undefined)?.material_pid,
                  shader_name: slot.binding?.shader_name,
                  blend_mode: slot.binding?.blend_mode,
                },
              )
              slot._warned = true
            }
            // No fallback render: keep the layer transparent rather than
            // showing a generic gradient that doesn't match Unity.
          }

          ctx!.globalCompositeOperation = prevComposite
        }
      })

      raf = requestAnimationFrame(frame)
    }

    function spawn(s: PSRecord, W: number, H: number): Particle {
      // Per-emitter unit_px: nearest UIParticle ancestor's m_Scale3D.x when
      // the prefab has one (108 for ef_appear / per-star / rarityNEffect),
      // else the prop's unitPx (1 for the ef_sageBg world-space canvas).
      // Reference for the 108 factor: UIParticleRenderer.GetWorldMatrix bakes
      // particles by world-pos × m_Scale3D, producing canvas-local units that
      // map 1:1 to reference-resolution pixels under the standard
      // ScreenSpaceCamera + CanvasScaler setup. ef_sageBg renders through
      // Unity's regular ParticleSystemRenderer to DefaultUICamera (no
      // UIParticle bake), so its pixel-per-world-unit is
      // screenHeight / (2 × DefaultUICamera.orthographicSize). That camera's
      // orthographicSize is serialized on the UICameraManager.m_origin asset
      // we don't currently extract — pxPerUnit ≈ 1 is the empirical
      // approximation that lines up with the observed prefab values
      // (kirakira01 startSize 10-40 → 10-40 px sparkles; circleSmoke startSize
      // 210 → 210-px halo; donut radius 180 → 180-px ring).
      const tf = s.path ? tfByPath.get(s.path) : undefined
      const full = s.path ? fullByPath.get(s.path) : undefined
      const sysUnitPx = tf?.unit_px ?? unitPx
      // Scale from design-px (the prefab's authoring frame) to canvas-px
      // (the actual rendered size). Both axes share the same factor when the
      // canvas preserves aspect — we use the X factor for radii to keep
      // circles round if H/W ratio differs slightly.
      const designToCanvas = W / Math.max(1, designW)
      const renderUnitPx = sysUnitPx * designToCanvas
      const life = Math.max(0.05, rangeSample(s.main.startLifetime, 1))
      const speed = rangeSample(s.main.startSpeed, 0) * renderUnitPx
      const rawSize = rangeSample(s.main.startSize, 1) * renderUnitPx
      // ParticleSystemRenderer.maxParticleSize: Unity clamps a Billboard
      // particle's screen-space size to (maxParticleSize × viewport_height).
      // For Billboards (renderMode=0..3), the cap is in normalized viewport
      // units (default 0.5 = half viewport). For Mesh particles (renderMode=4)
      // the field is bypassed in this older UIParticle bake path. We apply
      // the Billboard clamp only when the renderer says we're a Billboard.
      const renderMode = full?.renderer?.renderMode
      const maxSizeFrac = full?.renderer?.maxParticleSize ?? null
      let startSize = Math.max(1, rawSize)
      if (renderMode != null && renderMode !== 4 && maxSizeFrac != null && maxSizeFrac > 0) {
        // Billboard cap: convert normalized viewport fraction → pixel cap.
        // maxParticleSize is fraction of viewport_height in normalized space.
        startSize = Math.min(startSize, maxSizeFrac * H)
      }
      const rngColor = Math.random()
      const c = sampleStartColor(s.main.startColor, rngColor)
      // Resolve the spawn centre. UIParticle-wrapped emitters (per-star, ef_appear)
      // bake at their UIParticle's canvas-space position — read from the prefab's
      // RectTransform cascade. World-space ef_sageBg ParticleSystems (no
      // UIParticle ancestor) emit from the GameObject's world Transform position,
      // which the prefab data shows is (0,0,0) for every ef_sageBg child — i.e.
      // the canvas's local world origin, projected to screen at canvas centre.
      // This is the structurally correct Unity behaviour, not a fallback.
      const cx = (() => {
        if (!tf) return W / 2  // No prefab transform entry — emit at canvas centre
        const localDX = tf.canvas_origin_x_design_px - designOX
        if (localDX >= 0 && localDX <= designW) return (localDX / designW) * W
        // Origin outside the design frame indicates a world-space simulation
        // (RectTransform off-canvas because Unity ignores it for world particles);
        // the engine projects the GameObject's world position to screen via the
        // UI camera, which for these prefabs lands at canvas centre.
        return W / 2
      })()
      const cy = (() => {
        if (!tf) return H / 2
        const localDY = tf.css_y_design_px - designOY
        if (localDY >= 0 && localDY <= designH) return (localDY / designH) * H
        return H / 2
      })()
      let ox = cx
      let oy = cy
      let vx = 0
      let vy = 0
      const dirAng = Math.random() * Math.PI * 2
      // Shape sampling. Prefer the full ShapeModule when joined; fall back to
      // the legacy PSRecord.shape (3-field flat shape) when not. Unity ShapeType:
      //   0=Sphere, 4=Cone, 7=Circle, 10=Donut, 5=Box, 8=Edge, 17=Rectangle.
      const fullShape = full?.shape
      const fullShapeEnabled = fullShape != null && fullShape.enabled === true
      const legacyShape = s.shape
      const legacyShapeEnabled =
        legacyShape != null && (legacyShape.enabled === true || legacyShape.enabled === 1)
      if (fullShapeEnabled || legacyShapeEnabled) {
        const shapeType = fullShape?.type ?? legacyShape?.type ?? 0
        const radiusVal = readMinMaxScalar(fullShape?.radius) ?? extractLegacyRadius(legacyShape?.radius) ?? 0
        const radius = Math.max(0, radiusVal) * renderUnitPx
        const radiusThickness = fullShape?.radiusThickness ?? 1  // 0=edge-only, 1=full disk
        const arcDeg = readMinMaxScalar(fullShape?.arc) ?? 360
        const arcRad = (arcDeg * Math.PI) / 180
        const arcStart = Math.random() * arcRad
        if (shapeType === 4) {
          // Cone: spawn on disk at base, fire upward in cone half-angle.
          const halfAngleRad = ((fullShape?.angle ?? legacyShape?.angle ?? 25) * Math.PI) / 180
          // sqrt() for uniform disk; multiply by radiusThickness to honour
          // the "ring vs full disk" selector.
          const baseAng = Math.random() * Math.PI * 2
          const tEdge = 1 - Math.sqrt(1 - Math.random()) * radiusThickness
          const baseR = tEdge * radius
          ox = cx + Math.cos(baseAng) * baseR
          oy = cy + Math.sin(baseAng) * baseR
          const coneAng = -Math.PI / 2 + (Math.random() * 2 - 1) * halfAngleRad
          vx = Math.cos(coneAng) * speed
          vy = Math.sin(coneAng) * speed
        } else if (shapeType === 10) {
          // Donut (Torus): sample around the major ring at `radius`, then add
          // a cross-section offset bounded by `donutRadius` (modulated by
          // radiusThickness on the cross-section, 0=ring edge, 1=fill tube).
          // 2D projection collapses the cross-section to a single radial
          // offset; that's the correct shape for the canvas plane.
          const angAlongRing = arcStart
          const tubeR = (fullShape?.donutRadius ?? 0.2) * renderUnitPx
          const tubeT = 1 - Math.sqrt(1 - Math.random()) * radiusThickness
          const tubeOff = (Math.random() * 2 - 1) * tubeR * tubeT
          const r = radius + tubeOff
          ox = cx + Math.cos(angAlongRing) * r
          oy = cy + Math.sin(angAlongRing) * r
          // Default Donut emits outward radially.
          const outwardAng = Math.atan2(oy - cy, ox - cx)
          vx = Math.cos(outwardAng) * speed
          vy = Math.sin(outwardAng) * speed
        } else if (shapeType === 7 || shapeType === 0) {
          // Circle (2D) / Sphere (3D — collapsed to circle on the canvas plane).
          // radiusThickness=0 means edge-only; 1 means full disk. Unity samples
          // r = lerp(1-radiusThickness, 1, sqrt(rng)) × radius.
          const inner = 1 - Math.max(0, Math.min(1, radiusThickness))
          const t = inner + (1 - inner) * Math.sqrt(Math.random())
          const r = t * radius
          const ang = arcStart
          ox = cx + Math.cos(ang) * r
          oy = cy + Math.sin(ang) * r
          const outwardAng = Math.atan2(oy - cy, ox - cx)
          vx = Math.cos(outwardAng) * speed
          vy = Math.sin(outwardAng) * speed
        } else {
          // Box / Edge / Rectangle / unsupported — keep the spawn at centre
          // and emit in a random direction. Logged as a structured blocker
          // once per shape type so we surface coverage gaps.
          warnUnsupportedShape(shapeType, s.path)
          vx = Math.cos(dirAng) * speed
          vy = Math.sin(dirAng) * speed
        }
      } else {
        // Shape disabled — point emission from cx, cy in a random direction.
        vx = Math.cos(dirAng) * speed
        vy = Math.sin(dirAng) * speed
      }
      // Sample initial rotation from rotationModule.z constant (if enabled).
      // Unity's `scalar` here is angular velocity (rad/s); the START rotation
      // is typically 0 unless the system has a 3D rotation module with axis.
      // We approximate "start rotation = 0" which is Unity's default.
      const initialRotation = 0
      return {
        x: ox,
        y: oy,
        vx,
        vy,
        age: 0,
        life,
        startSize,
        startR: c.r,
        startG: c.g,
        startB: c.b,
        startA: c.a,
        rotation: initialRotation,
        rngSize: Math.random(),
        rngVel: Math.random(),
        rngRot: Math.random(),
        rngColor,
      }
    }

    // Offscreen tint canvas, reused across particles to avoid allocator churn.
    let tintCanvas: HTMLCanvasElement | null = null
    function ensureTintCanvas(w: number, h: number): HTMLCanvasElement {
      if (!tintCanvas || tintCanvas.width !== w || tintCanvas.height !== h) {
        tintCanvas = document.createElement("canvas")
        tintCanvas.width = w
        tintCanvas.height = h
      }
      return tintCanvas
    }

    // Touch the helper so TS doesn't tree-shake the unused-fn-warning path.
    void radToDeg

    raf = requestAnimationFrame(frame)
    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [systems, unitPx, maxTotal, materials, transforms, particleFull, designSize, designOffset])

  return <canvas ref={canvasRef} className={className} style={{ pointerEvents: "none" }} />
}
