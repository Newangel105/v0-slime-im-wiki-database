"use client"

// The Archive Altar — a fully 3D arcane summoning altar for the home hero,
// rendered with the same three.js stack as the model viewer. One scene:
// a tiered night-ink dais with glowing concentric magic-circles engraved on
// its floor, crystal pylons ringing the rim (each carrying a record portrait),
// a back spire emblem, a volumetric ascension beam and ember motes — and the
// record's ACTUAL game model (the model viewer's GLB) materializing at the
// centre, idle animation playing, drag-to-spin with inertia. Everything that
// is not the model sits low and wide so the figure is never obstructed.
//
// Interactions: click a pylon portrait (or wheel / arrow keys) to choose a
// record — it materializes on the altar; drag anywhere to spin the figure.
import anime from "animejs"
import Link from "next/link"
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import { Billboard, Environment, Lightformer, Sparkles, useAnimations, useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { X } from "lucide-react"
import { mediaUrl } from "@/lib/media-cdn"
import type { HomeLatestCharacter } from "./home-client"

type Props = {
  items: HomeLatestCharacter[]
  // every model-bearing record, for the "choose a hero" picker (defaults to items)
  allItems?: HomeLatestCharacter[]
}

type SpinState = {
  velocity: number
  dragging: boolean
  moved: boolean
}

const NIGHT0 = "#080d15"
const NIGHT1 = "#0e1622"
const NIGHT2 = "#141e2e"
const NIGHT3 = "#1a2638"
const CREAM = "#ece4d4"
const RED = "#b5352b"
const RED_BRIGHT = "#d2453a"
const EMBER = "#ffa87a"
const STEEL = "#7ab0e0"
const GOLD = "#caa45c" // ornate filigree metal
const GOLD_LIT = "#ffd98a" // hot gold highlight
const STEEL_LIT = "#a9d2ff" // bright crystal blue

const PLATFORM_TOP = 0.53 // top surface of the dais (measured from the GLB: the
// top stage disc tops out at y≈0.53); the figure's feet rest here
const TRAY_STORE_KEY = "nk-altar-tray" // localStorage: the chosen 8 slots + active
const RING_RADIUS = 1.46 // pylon ring radius
const mod = (n: number, m: number) => ((n % m) + m) % m

/* ================================================================
   canvas textures (built once)
   ================================================================ */

/* the warm ascension beam gradient */
function makeBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 64
  canvas.height = 256
  const ctx = canvas.getContext("2d")!
  const grad = ctx.createLinearGradient(0, 256, 0, 0)
  grad.addColorStop(0, "rgba(255, 206, 178, 0.62)")
  grad.addColorStop(0.34, "rgba(210, 69, 58, 0.18)")
  grad.addColorStop(1, "rgba(120, 170, 220, 0.03)")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 256)
  const t = new THREE.CanvasTexture(canvas)
  t.needsUpdate = true
  return t
}

/* rounded-rect alpha mask for the record portraits */
function makeChipAlpha(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.roundRect(3, 3, size - 6, size - 6, 24)
  ctx.fill()
  const t = new THREE.CanvasTexture(canvas)
  t.needsUpdate = true
  return t
}

/* a richly detailed arcane magic-circle drawn to a transparent canvas; used
   flat on the dais floor with additive blending so every stroke reads as
   glowing ink. High-res with layered rings, dense rune bands, sacred geometry,
   filigree petals and a hot core — the centrepiece of the altar. */
function makeMagicCircle(kind: "outer" | "inner"): THREE.CanvasTexture {
  const S = 2048
  const C = S / 2
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = S
  const ctx = canvas.getContext("2d")!
  ctx.clearRect(0, 0, S, S)
  ctx.translate(C, C)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  const ember = (a: number) => `rgba(255, 150, 110, ${a})`
  const hot = (a: number) => `rgba(255, 210, 170, ${a})`
  const cream = (a: number) => `rgba(236, 228, 212, ${a})`
  const steel = (a: number) => `rgba(150, 196, 240, ${a})`

  const ring = (r: number, w: number, color: string, glow = 10) => {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.lineWidth = w
    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = glow
    ctx.stroke()
  }
  // a regular polygon inscribed at radius r (sacred geometry)
  const poly = (sides: number, r: number, w: number, color: string, rot = 0, glow = 8) => {
    ctx.beginPath()
    for (let k = 0; k <= sides; k++) {
      const a = rot + (k / sides) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.lineWidth = w
    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = glow
    ctx.stroke()
  }
  // a ring of small circles (orbit nodes)
  const nodeRing = (count: number, r: number, dot: number, color: string) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, dot, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 8
      ctx.fill()
    }
  }

  if (kind === "outer") {
    // double outer band with a dense tick crown between them
    ring(990, 9, ember(0.95), 18)
    ring(966, 3, hot(0.7), 8)
    ring(870, 4, ember(0.7), 10)
    ring(720, 2.4, cream(0.4), 6)
    // dense radial tick crown (240 ticks, every 6th long+hot)
    for (let i = 0; i < 240; i++) {
      const a = (i / 240) * Math.PI * 2
      const long = i % 6 === 0
      const r0 = 872
      const r1 = long ? 962 : 932
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
      ctx.lineWidth = long ? 4 : 1.4
      ctx.strokeStyle = long ? ember(0.85) : cream(0.3)
      ctx.shadowColor = ember(0.6)
      ctx.shadowBlur = long ? 8 : 2
      ctx.stroke()
    }
    // rune band at r=800 — alternating sigils
    const N = 36
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      ctx.save()
      ctx.rotate(a)
      ctx.translate(0, -800)
      ctx.strokeStyle = cream(0.62)
      ctx.fillStyle = ember(0.8)
      ctx.lineWidth = 3
      ctx.shadowColor = ember(0.5)
      ctx.shadowBlur = 6
      const t = i % 3
      if (t === 0) {
        ctx.beginPath()
        ctx.moveTo(0, -18)
        ctx.lineTo(13, 0)
        ctx.lineTo(0, 18)
        ctx.lineTo(-13, 0)
        ctx.closePath()
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(0, 0, 4, 0, Math.PI * 2)
        ctx.fill()
      } else if (t === 1) {
        ctx.beginPath()
        ctx.moveTo(0, -22)
        ctx.lineTo(0, 22)
        ctx.moveTo(-10, -10)
        ctx.lineTo(10, -10)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.arc(0, 0, 11, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(0, -4, 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    nodeRing(12, 720, 7, hot(0.8))
    // interlocking dodecagram (two hexagons) for the sacred-geometry web
    poly(6, 700, 2.4, ember(0.55), 0, 8)
    poly(6, 700, 2.4, ember(0.55), Math.PI / 6, 8)
  } else {
    // inner detail layer — concentric rings + hexagram + petals + hot core
    ring(640, 5, ember(0.9), 14)
    ring(612, 2, hot(0.55), 6)
    ring(470, 2.4, cream(0.42), 6)
    ring(300, 3, ember(0.85), 10)
    ring(190, 2, steel(0.5), 6)
    // hexagram inscribed in r=600
    poly(3, 600, 4, ember(0.62), 0, 10)
    poly(3, 600, 4, ember(0.62), Math.PI, 10)
    // square + rotated square (octagram) in r=470
    poly(4, 470, 2.6, cream(0.4), 0, 6)
    poly(4, 470, 2.6, cream(0.4), Math.PI / 4, 6)
    nodeRing(6, 600, 9, hot(0.85))
    nodeRing(12, 300, 5, steel(0.7))
    // 24 filigree petals between r=300 and r=600
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      ctx.save()
      ctx.rotate(a)
      ctx.beginPath()
      ctx.moveTo(0, -300)
      ctx.quadraticCurveTo(40, -450, 0, -600)
      ctx.quadraticCurveTo(-40, -450, 0, -300)
      ctx.lineWidth = 1.8
      ctx.strokeStyle = i % 2 ? cream(0.28) : ember(0.34)
      ctx.shadowColor = ember(0.4)
      ctx.shadowBlur = 4
      ctx.stroke()
      ctx.restore()
    }
    // hot glowing core
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 200)
    core.addColorStop(0, hot(0.5))
    core.addColorStop(0.4, ember(0.22))
    core.addColorStop(1, ember(0))
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(0, 0, 200, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

/* a soft radial glow sprite (additive, transparent-safe) — used to fake bloom
   radiance under the floor and at the crystals without an opaque composer */
let _glowTex: THREE.CanvasTexture | null = null
function glowTexture(): THREE.CanvasTexture {
  if (_glowTex) return _glowTex
  const S = 256
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = S
  const ctx = canvas.getContext("2d")!
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, "rgba(255,255,255,1)")
  g.addColorStop(0.25, "rgba(255,255,255,0.55)")
  g.addColorStop(0.55, "rgba(255,255,255,0.16)")
  g.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  _glowTex = new THREE.CanvasTexture(canvas)
  _glowTex.colorSpace = THREE.SRGBColorSpace
  return _glowTex
}

/* a gem matcap — a painted "lit polished sphere" sampled per facet so the
   faceted crystals read as real cut gems (highlights, colour gradient, sparkle)
   no matter the scene lighting. Built once per colour. */
const _gemMatcaps: Record<string, THREE.CanvasTexture> = {}
function gemMatcap(kind: "blue" | "pink"): THREE.CanvasTexture {
  if (_gemMatcaps[kind]) return _gemMatcaps[kind]
  const S = 256
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = S
  const ctx = canvas.getContext("2d")!
  const cx = S / 2
  const cy = S / 2
  const pal =
    kind === "pink"
      ? { hi: "#ffe2ef", mid: "#ff5fa2", deep: "#b81a5e", dark: "#3a0820" }
      : { hi: "#e8f3ff", mid: "#5aa0ff", deep: "#1748b8", dark: "#08183a" }
  // body: a sphere lit from the upper-left
  const g = ctx.createRadialGradient(cx - 52, cy - 60, 8, cx, cy, S * 0.52)
  g.addColorStop(0, pal.hi)
  g.addColorStop(0.28, pal.mid)
  g.addColorStop(0.72, pal.deep)
  g.addColorStop(1, pal.dark)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  // bright specular hotspot
  const hot = ctx.createRadialGradient(cx - 60, cy - 70, 0, cx - 60, cy - 70, 46)
  hot.addColorStop(0, "rgba(255,255,255,0.95)")
  hot.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = hot
  ctx.beginPath()
  ctx.arc(cx - 60, cy - 70, 46, 0, Math.PI * 2)
  ctx.fill()
  // cool rim light bottom-right (gives gem edges a glow)
  const rim = ctx.createRadialGradient(cx + 64, cy + 78, 0, cx + 64, cy + 78, 70)
  rim.addColorStop(0, kind === "pink" ? "rgba(255,150,200,0.6)" : "rgba(150,200,255,0.6)")
  rim.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = rim
  ctx.beginPath()
  ctx.arc(cx + 64, cy + 78, 70, 0, Math.PI * 2)
  ctx.fill()
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  _gemMatcaps[kind] = t
  return t
}

/* an additive billboard glow blob — transparent-safe bloom substitute */
function GlowSprite({ position, size, color, opacity = 0.6 }: { position: [number, number, number]; size: number; color: string; opacity?: number }) {
  const tex = useMemo(glowTexture, [])
  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={tex} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
  )
}

/* ================================================================
   the ornate altar — two Blender-modelled GLBs. The DAIS (heavy gold-
   framed tiers, dentil course, rim shards) ROTATES to a new facing on
   each record pick; the FRAME (four tall pylons + front gem crest)
   stays FIXED so it always frames the figure and never blocks the beam.
   Modeled at the scene scale/origin so they drop in directly.
   ================================================================ */
const ALTAR_DAIS = "/nightink/altar_dais.glb"
const ALTAR_FRAME = "/nightink/altar_frame.glb"
useGLTF.preload(ALTAR_DAIS)
useGLTF.preload(ALTAR_FRAME)

/* recolour the GLB materials: glowing blue/pink crystals (the baked
   transmission renders clear/white otherwise), lit gold, bright emissives */
function fixupAltar(root: THREE.Object3D) {
  // the GLB now carries real PBR textures (brushed gold, mottled stone, faceted
  // crystal colour/emissive/normal maps). Keep them — only enhance reflections
  // and let the emissive crystals/gold glow (toneMapped off).
  root.traverse((o) => {
    const mesh = o as THREE.Mesh & { isMesh?: boolean }
    if (!mesh.isMesh) return
    mesh.frustumCulled = false
    const list = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]
    for (const mat of list) {
      if (!mat) continue
      const name = mat.name || ""
      mat.envMapIntensity = mat.metalness > 0.5 ? 2.3 : 1.6
      if (name.startsWith("crystal")) {
        // the baked transmission renders gems clear/white — make them opaque,
        // saturated, glossy and glowing so they read as real blue/pink crystals
        const pink = name.includes("red")
        const phys = mat as THREE.MeshPhysicalMaterial
        if ("transmission" in phys) phys.transmission = 0
        mat.transparent = false
        mat.color = new THREE.Color(pink ? "#cf3a6c" : "#2f6fd6")
        mat.emissive = new THREE.Color(pink ? "#ff5a92" : "#5aa6ff")
        mat.emissiveIntensity = 0.9
        mat.metalness = 0
        mat.roughness = 0.06
        mat.envMapIntensity = 3
        mat.toneMapped = false
        mat.needsUpdate = true
      } else if (mat.emissive && mat.emissive.r + mat.emissive.g + mat.emissive.b > 0.03) {
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0, 0.5)
        mat.toneMapped = false
      }
    }
  })
  return root
}

// ── particle fire ───────────────────────────────────────────────────────────
// Each torch / brazier flame mesh in the GLB is used purely as an EMITTER marker
// (the mesh itself is hidden); real fire is a GPU point cloud of rising, swaying,
// fading particles — hot white-yellow at the base cooling to orange→red→smoke as
// they rise, additive-blended so they glow. Animated on the CPU (a few hundred
// particles) and drawn inside the altar group so the flames turn with it.
type Emitter = { x: number; y: number; z: number; radius: number }

function respawn(s: FireState, i: number, initial: boolean) {
  const a = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * s.rad[i] * 0.75
  s.ox[i] = Math.cos(a) * r
  s.oz[i] = Math.sin(a) * r
  s.vy[i] = 0.42 + Math.random() * 0.4 // rise speed (units / s)
  s.life[i] = 0.6 + Math.random() * 0.7
  s.age[i] = initial ? Math.random() * s.life[i] : 0
  s.seed[i] = Math.random() * 6.283
}

type FireState = {
  ex: Float32Array; ey: Float32Array; ez: Float32Array; rad: Float32Array
  ox: Float32Array; oz: Float32Array; vy: Float32Array
  age: Float32Array; life: Float32Array; seed: Float32Array
}

function FireParticles({ emitters, reduced }: { emitters: Emitter[]; reduced: boolean }) {
  const PER = reduced ? 24 : 50
  const N = Math.max(1, emitters.length * PER)
  const points = useRef<THREE.Points>(null)

  const { state, positions, aProgress, aSize } = useMemo(() => {
    const s: FireState = {
      ex: new Float32Array(N), ey: new Float32Array(N), ez: new Float32Array(N), rad: new Float32Array(N),
      ox: new Float32Array(N), oz: new Float32Array(N), vy: new Float32Array(N),
      age: new Float32Array(N), life: new Float32Array(N), seed: new Float32Array(N),
    }
    let i = 0
    for (const em of emitters) {
      for (let k = 0; k < PER; k++) {
        s.ex[i] = em.x; s.ey[i] = em.y; s.ez[i] = em.z; s.rad[i] = Math.max(em.radius, 0.05)
        respawn(s, i, true)
        i++
      }
    }
    return { state: s, positions: new Float32Array(N * 3), aProgress: new Float32Array(N), aSize: new Float32Array(N) }
  }, [emitters, N, PER])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { uScale: { value: 1700 } },
        vertexShader: `
          attribute float aProgress;
          attribute float aSize;
          varying float vP;
          uniform float uScale;
          void main() {
            vP = aProgress;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          varying float vP;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            float circle = smoothstep(0.5, 0.04, d);
            vec3 hot  = vec3(1.0, 0.95, 0.72);
            vec3 mid  = vec3(1.0, 0.52, 0.12);
            vec3 cool = vec3(0.86, 0.13, 0.02);
            vec3 col = mix(hot, mid, smoothstep(0.0, 0.42, vP));
            col = mix(col, cool, smoothstep(0.42, 1.0, vP));
            float alpha = sin(vP * 3.14159) * circle * 0.9;
            gl_FragColor = vec4(col, alpha);
          }`,
      }),
    [],
  )

  useFrame((_, dtRaw) => {
    const p = points.current
    if (!p) return
    const dt = Math.min(dtRaw, 0.05)
    const t = performance.now() * 0.001
    const s = state
    for (let i = 0; i < N; i++) {
      s.age[i] += dt
      let prog = s.age[i] / s.life[i]
      if (prog >= 1) { respawn(s, i, false); prog = 0 }
      const sway = prog * s.rad[i] * 0.9
      positions[i * 3] = s.ex[i] + s.ox[i] + Math.sin(t * 6.5 + s.seed[i]) * sway
      positions[i * 3 + 1] = s.ey[i] + s.vy[i] * s.age[i]
      positions[i * 3 + 2] = s.ez[i] + s.oz[i] + Math.cos(t * 5.5 + s.seed[i] * 1.3) * sway
      aProgress[i] = prog
      aSize[i] = Math.max(s.rad[i], 0.05) * (0.45 + 0.85 * Math.sin(prog * Math.PI))
    }
    const g = p.geometry
    g.attributes.position.needsUpdate = true
    g.attributes.aProgress.needsUpdate = true
    g.attributes.aSize.needsUpdate = true
  })

  return (
    <points ref={points} material={material} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aProgress" args={[aProgress, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[aSize, 1]} />
      </bufferGeometry>
    </points>
  )
}

function AltarModel({ reduced }: { reduced: boolean }) {
  const dais = useGLTF(ALTAR_DAIS)
  const frame = useGLTF(ALTAR_FRAME)
  const daisClone = useMemo(() => fixupAltar(dais.scene.clone(true)), [dais])
  const frameClone = useMemo(() => fixupAltar(frame.scene.clone(true)), [frame])

  // collect torch / brazier emitters from the GLB flame meshes, then hide them
  const emitters = useMemo(() => {
    const out: Emitter[] = []
    frameClone.updateMatrixWorld(true)
    frameClone.traverse((o) => {
      const mesh = o as THREE.Mesh & { isMesh?: boolean }
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (!mats.some((m) => (m?.name || "").startsWith("flame"))) return
      mesh.visible = false
      mesh.geometry.computeBoundingBox()
      const bb = mesh.geometry.boundingBox!
      const c = new THREE.Vector3(); bb.getCenter(c)
      const size = new THREE.Vector3(); bb.getSize(size)
      const base = new THREE.Vector3(c.x, bb.min.y + size.y * 0.18, c.z).applyMatrix4(mesh.matrixWorld)
      out.push({ x: base.x, y: base.y, z: base.z, radius: Math.max(size.x, size.z) * 0.5 })
    })
    return out
  }, [frameClone])

  // the altar stays fixed and centred so the staircase + brazier gap always face
  // the camera and a column torch never rotates in front of the figure. Only the
  // inner magic-circle mechanism spins (see MagicFloor) — the pillars, braziers
  // and crest stay put, which also keeps the whole altar visually centred.
  return (
    <group>
      <primitive object={daisClone} />
      <primitive object={frameClone} />
      <FireParticles emitters={emitters} reduced={reduced} />
    </group>
  )
}

/* ================================================================
   the tiered arcane dais — ornate gold-trimmed stone steps, glowing
   inlaid grooves, crystal shards, corner spires and a front emblem
   ================================================================ */
function stone(color: string, m = 0.6, r = 0.4) {
  return <meshStandardMaterial color={color} metalness={m} roughness={r} envMapIntensity={1.25} />
}

/* an ornate gold ring framing a tier edge (chunkier, reflective, lit) */
function GoldRim({ radius, y, tube = 0.022, intensity = 0.55 }: { radius: number; y: number; tube?: number; intensity?: number }) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, tube, 16, 160]} />
      <meshStandardMaterial color={GOLD} emissive={GOLD_LIT} emissiveIntensity={intensity} metalness={0.95} roughness={0.28} envMapIntensity={1.8} />
    </mesh>
  )
}

/* a glowing inlaid groove ring on the floor (additive so it reads as light) */
function Groove({ radius, y, color = EMBER, opacity = 0.9, thickness = 0.006 }: { radius: number; y: number; color?: string; opacity?: number; thickness?: number }) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, thickness, 8, 160]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/* a faceted crystal — bright physical gem used for shards, finials, the emblem */
function Crystal({ size, color, lit, intensity = 2.6 }: { size: number; color: string; lit: string; intensity?: number }) {
  return (
    <>
      <octahedronGeometry args={[size]} />
      <meshPhysicalMaterial
        color={color}
        emissive={lit}
        emissiveIntensity={intensity}
        metalness={0.05}
        roughness={0.05}
        transmission={0.55}
        thickness={0.5}
        ior={1.8}
        envMapIntensity={2}
        toneMapped={false}
      />
    </>
  )
}

/* an ornamental corner spire — gold-collared obelisk + glowing crystal finial */
function Spire({ angle, radius }: { angle: number; radius: number }) {
  const x = Math.sin(angle) * radius
  const z = Math.cos(angle) * radius
  return (
    <group position={[x, 0.2, z]} rotation={[0, -angle, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.1, 0.16, 0.1, 8]} />
        {stone(NIGHT3, 0.7, 0.32)}
      </mesh>
      <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.1, 0.018, 12, 24]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD_LIT} emissiveIntensity={0.5} metalness={0.95} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.035, 0.085, 0.8, 4]} />
        {stone(NIGHT2, 0.55, 0.42)}
      </mesh>
      {/* gold filigree bands up the shaft */}
      {[0.28, 0.52, 0.74].map((h, k) => (
        <mesh key={k} position={[0, h, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.06 - k * 0.012, 0.01, 8, 4]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD_LIT} emissiveIntensity={0.45} metalness={0.95} roughness={0.32} />
        </mesh>
      ))}
      <mesh position={[0, 1.0, 0]} rotation={[0, 0, Math.PI / 14]}>
        <Crystal size={0.17} color={STEEL} lit={STEEL_LIT} intensity={2.8} />
      </mesh>
    </group>
  )
}

/* the prominent front emblem — a big gold-framed gem seated on the front rim */
function FrontEmblem() {
  return (
    <group position={[0, 0.12, 1.5]} rotation={[Math.PI / 2.6, 0, 0]}>
      {/* gold diamond frame */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[0.2, 0.03, 4, 4]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD_LIT} emissiveIntensity={0.6} metalness={0.95} roughness={0.26} envMapIntensity={1.8} />
      </mesh>
      {/* the gem */}
      <mesh>
        <Crystal size={0.17} color={RED_BRIGHT} lit={"#ff6a78"} intensity={3.0} />
      </mesh>
      {/* lower point flourish */}
      <mesh position={[0, -0.26, 0]} rotation={[0, 0, Math.PI / 4]}>
        <coneGeometry args={[0.07, 0.16, 4]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD_LIT} emissiveIntensity={0.5} metalness={0.95} roughness={0.3} />
      </mesh>
    </group>
  )
}

function Dais() {
  // dentil teeth ringing the base
  const teeth = []
  const TN = 48
  for (let i = 0; i < TN; i++) {
    const a = (i / TN) * Math.PI * 2
    teeth.push(
      <mesh key={i} position={[Math.sin(a) * 1.66, 0.085, Math.cos(a) * 1.66]} rotation={[0, a, 0]}>
        <boxGeometry args={[0.06, 0.06, 0.06]} />
        {stone(NIGHT2, 0.7, 0.34)}
      </mesh>,
    )
  }
  // blue crystal shards embedded around the mid-tier rim
  const shards = []
  const SN = 12
  for (let i = 0; i < SN; i++) {
    const a = (i / SN) * Math.PI * 2 + Math.PI / SN
    shards.push(
      <mesh key={i} position={[Math.sin(a) * 1.34, 0.165, Math.cos(a) * 1.34]} rotation={[Math.PI / 2.4, a, 0]}>
        <Crystal size={0.07} color={STEEL} lit={STEEL_LIT} intensity={1.8} />
      </mesh>,
    )
  }
  return (
    <group>
      {/* dark base lip */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[1.78, 1.9, 0.04, 128]} />
        {stone(NIGHT0, 0.45, 0.6)}
      </mesh>
      {/* tier 1 */}
      <mesh position={[0, 0.065, 0]}>
        <cylinderGeometry args={[1.58, 1.72, 0.06, 128]} />
        {stone(NIGHT1, 0.6, 0.42)}
      </mesh>
      <GoldRim radius={1.58} y={0.096} tube={0.026} intensity={0.5} />
      {teeth}
      {/* tier 2 */}
      <mesh position={[0, 0.125, 0]}>
        <cylinderGeometry args={[1.3, 1.4, 0.06, 128]} />
        {stone(NIGHT2, 0.62, 0.4)}
      </mesh>
      <GoldRim radius={1.3} y={0.156} tube={0.022} intensity={0.55} />
      {shards}
      {/* tier 3 */}
      <mesh position={[0, 0.178, 0]}>
        <cylinderGeometry args={[1.04, 1.12, 0.05, 128]} />
        {stone(NIGHT3, 0.64, 0.36)}
      </mesh>
      <GoldRim radius={1.04} y={0.204} tube={0.018} intensity={0.6} />
      {/* top stage */}
      <mesh position={[0, 0.214, 0]}>
        <cylinderGeometry args={[0.9, 0.98, 0.04, 128]} />
        {stone("#1f2c40", 0.62, 0.34)}
      </mesh>
      <GoldRim radius={0.9} y={PLATFORM_TOP} tube={0.014} intensity={0.65} />
      {/* glowing inlaid grooves on the top floor */}
      <Groove radius={0.84} y={PLATFORM_TOP + 0.002} color={EMBER} opacity={0.85} />
      <Groove radius={0.64} y={PLATFORM_TOP + 0.002} color={STEEL_LIT} opacity={0.5} thickness={0.004} />
      <Groove radius={0.44} y={PLATFORM_TOP + 0.002} color={EMBER} opacity={0.75} />
      {/* two ornamental spires at the back corners — grandeur, no front block */}
      <Spire angle={(Math.PI * 3) / 4} radius={1.46} />
      <Spire angle={(Math.PI * 5) / 4} radius={1.46} />
      <FrontEmblem />
    </group>
  )
}

/* ================================================================
   glowing magic-circles on the floor — two counter-rotating layers
   on the top tier plus a big faint ring on the base tier
   ================================================================ */
function MagicFloor() {
  const outerTex = useMemo(() => makeMagicCircle("outer"), [])
  const innerTex = useMemo(() => makeMagicCircle("inner"), [])
  const outer = useRef<THREE.Mesh>(null)
  const inner = useRef<THREE.Mesh>(null)
  const base = useRef<THREE.Mesh>(null)
  const outerMat = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(({ clock }, delta) => {
    if (outer.current) outer.current.rotation.z -= delta * 0.06
    if (inner.current) inner.current.rotation.z += delta * 0.11
    if (base.current) base.current.rotation.z += delta * 0.03
    if (outerMat.current) outerMat.current.opacity = 0.85 + Math.sin(clock.elapsedTime * 1.3) * 0.12
  })

  const circleMat = (ref: React.Ref<THREE.MeshBasicMaterial> | undefined, tex: THREE.Texture, opacity: number) => (
    <meshBasicMaterial
      ref={ref as never}
      map={tex}
      transparent
      opacity={opacity}
      blending={THREE.AdditiveBlending}
      side={THREE.DoubleSide}
      depthWrite={false}
      toneMapped={false}
    />
  )

  return (
    <group>
      {/* big faint circle washed across the base tier */}
      <mesh ref={base} position={[0, 0.086, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.0, 3.0]} />
        {circleMat(undefined, outerTex, 0.18)}
      </mesh>
      {/* primary engraved circle on the top tier */}
      <mesh ref={outer} position={[0, PLATFORM_TOP + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.96, 1.96]} />
        {circleMat(outerMat, outerTex, 0.95)}
      </mesh>
      <mesh ref={inner} position={[0, PLATFORM_TOP + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
        {circleMat(undefined, innerTex, 0.9)}
      </mesh>
    </group>
  )
}

/* ================================================================
   decorative crystal pylons at the rim — pure ornament linked by a
   glowing filament. The ring rotates so the active record's crystal
   (ember-bright) sits front-and-centre. Record selection lives in
   the 2D tray below the altar, so nothing floats over the figure.
   ================================================================ */
function DecorPylons({ count, index, reduced }: { count: number; index: number; reduced: boolean }) {
  const ring = useRef<THREE.Group>(null)
  const target = -(index * ((Math.PI * 2) / Math.max(count, 1)))

  useFrame(() => {
    const g = ring.current
    if (!g) return
    if (reduced) g.rotation.y = target
    else g.rotation.y += (target - g.rotation.y) * 0.08
  })

  return (
    <group ref={ring} position={[0, 0.146, 0]}>
      {/* glowing filament linking the crystals */}
      <mesh position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RING_RADIUS, 0.005, 8, 160]} />
        <meshBasicMaterial color={EMBER} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i * Math.PI * 2) / count
        const x = Math.sin(angle) * RING_RADIUS
        const z = Math.cos(angle) * RING_RADIUS
        const active = i === index
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, -angle, 0]}>
            {/* footing */}
            <mesh position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.09, 0.14, 0.08, 8]} />
              {stone(NIGHT3, 0.72, 0.3)}
            </mesh>
            <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.1, 0.016, 12, 24]} />
              <meshStandardMaterial color={GOLD} emissive={GOLD_LIT} emissiveIntensity={0.45} metalness={0.95} roughness={0.3} />
            </mesh>
            {/* tapered shaft */}
            <mesh position={[0, 0.36, 0]}>
              <cylinderGeometry args={[0.03, 0.075, 0.5, 4]} />
              {stone(NIGHT2, 0.55, 0.42)}
            </mesh>
            {/* gold filigree bands */}
            {[0.22, 0.42].map((h, k) => (
              <mesh key={k} position={[0, h, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.062 - k * 0.014, 0.011, 8, 4]} />
                <meshStandardMaterial color={GOLD} emissive={GOLD_LIT} emissiveIntensity={0.4} metalness={0.95} roughness={0.32} />
              </mesh>
            ))}
            {/* crystal finial — active is ember-red, the rest steel-blue */}
            <mesh position={[0, 0.66, 0]} rotation={[0, 0, Math.PI / 12]}>
              <Crystal
                size={active ? 0.15 : 0.115}
                color={active ? RED_BRIGHT : STEEL}
                lit={active ? "#ff6a78" : STEEL_LIT}
                intensity={active ? 3.0 : 1.6}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/* ================================================================
   back spire emblem — a tall diamond behind the figure, framing it
   ================================================================ */
function BackSpire() {
  return (
    <group position={[0, 0, -1.18]}>
      <mesh position={[0, 1.04, 0]}>
        <octahedronGeometry args={[0.2]} />
        <meshStandardMaterial color={CREAM} emissive={CREAM} emissiveIntensity={0.55} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.012, 0.05, 0.9, 6]} />
        <meshStandardMaterial color={NIGHT3} emissive={EMBER} emissiveIntensity={0.18} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.42, 0]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.14, 0.14]} />
        <meshBasicMaterial color={EMBER} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* ================================================================
   the ascension beam — refined twin additive cones, flickering
   ================================================================ */
function Beam() {
  const texture = useMemo(makeBeamTexture, [])
  const outer = useRef<THREE.Mesh>(null)
  const inner = useRef<THREE.Mesh>(null)
  const outerMat = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(({ clock }, delta) => {
    if (outer.current) outer.current.rotation.y += delta * 0.14
    if (inner.current) inner.current.rotation.y -= delta * 0.2
    if (outerMat.current) outerMat.current.opacity = 0.5 + Math.sin(clock.elapsedTime * 1.6) * 0.08
  })

  return (
    <group position={[0, PLATFORM_TOP + 1.3, 0]}>
      <mesh ref={outer}>
        <cylinderGeometry args={[0.78, 0.26, 2.6, 48, 1, true]} />
        <meshBasicMaterial
          ref={outerMat}
          map={texture}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={inner} scale={[0.55, 1, 0.55]}>
        <cylinderGeometry args={[0.85, 0.24, 2.6, 32, 1, true]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/* ================================================================
   the materialized record — real GLB, idle anim, drag-spun
   ================================================================ */
function HoloModel({
  url,
  spin,
  reduced,
  onReady,
}: {
  url: string
  spin: React.MutableRefObject<SpinState>
  reduced: boolean
  onReady: () => void
}) {
  const { scene, animations } = useGLTF(url)
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(animations, scene)
  // per-model visibility sidecar (the SAME data the model-viewer uses): a map of
  // mesh-name -> default visibility. null = not fetched yet.
  const [visDefaults, setVisDefaults] = useState<Record<string, boolean> | null>(null)
  // very large models (e.g. Charybdis) are flagged so they DON'T auto-spin — a
  // wide creature turning would sweep through the pillars and look broken
  const isGiantRef = useRef(false)

  // fetch the sidecar so default-hidden props/effects never show on the altar —
  // and never inflate the bounding box that scales & seats the figure
  useEffect(() => {
    let cancelled = false
    setVisDefaults(null)
    const sidecar = url.replace(/\.glb(\?.*)?$/i, ".visibility.json")
    fetch(sidecar)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return
        // {defaults,tracks} (current) or a bare tracks dict (legacy → no defaults)
        setVisDefaults(j && j.defaults ? j.defaults : {})
      })
      .catch(() => {
        if (!cancelled) setVisDefaults({})
      })
    return () => {
      cancelled = true
    }
  }, [url])

  useEffect(() => {
    if (visDefaults === null) return // wait until the sidecar resolves (or fails)
    // apply default visibility (hide props the game keeps hidden) + disable frustum
    // culling: three computes skinned bounds from the bind pose, so heavy anims
    // would otherwise wrongly cull the figure at some angles.
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh & { isMesh?: boolean; isSkinnedMesh?: boolean; frustumCulled?: boolean }
      if (!(mesh.isMesh || mesh.isSkinnedMesh)) return
      mesh.frustumCulled = false
      const def = visDefaults[mesh.name]
      mesh.visible = def === undefined ? true : def
    })
    // game GLBs are authored at wildly different scales — human characters up to
    // giant bosses like Charybdis. Reset to identity, then normalise to a
    // consistent on-altar HEIGHT, but also cap the horizontal spin-diameter so a
    // wide pose/prop never clips the canvas as the figure turns. The box is built
    // from VISIBLE meshes only, so hidden props can't inflate it (which used to
    // shrink the figure and push stray geometry off to one side). drei caches
    // scenes across mounts, so the reset is essential.
    scene.scale.setScalar(1)
    scene.position.set(0, 0, 0)
    scene.rotation.set(0, 0, 0)
    scene.updateWorldMatrix(true, true)
    // Build the box in the scene's LOCAL frame. The scene is already parented under
    // the PLATFORM_TOP group + the π-facing group, so mesh.matrixWorld bakes those
    // in; using it directly would double-count the +PLATFORM_TOP offset when we
    // then set scene.position.y = -min.y*fit and drop the feet to y≈0. Multiplying
    // by scene.matrixWorld⁻¹ strips the parents back out.
    const sceneInv = scene.matrixWorld.clone().invert()
    const rel = new THREE.Matrix4()
    const box = new THREE.Box3()
    const tmp = new THREE.Box3()
    let found = false
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh & { isMesh?: boolean; isSkinnedMesh?: boolean }
      if (!(mesh.isMesh || mesh.isSkinnedMesh) || mesh.visible === false || !mesh.geometry) return
      let bb = mesh.geometry.boundingBox
      if (!bb) {
        mesh.geometry.computeBoundingBox()
        bb = mesh.geometry.boundingBox
      }
      if (!bb) return
      rel.multiplyMatrices(sceneInv, mesh.matrixWorld)
      tmp.copy(bb).applyMatrix4(rel)
      box.union(tmp)
      found = true
    })
    if (!found) box.setFromObject(scene)
    const size = new THREE.Vector3()
    box.getSize(size)
    const center = new THREE.Vector3()
    box.getCenter(center)
    // Size-preserving (but COMPRESSED) scale: a normal character lands near BASE_H,
    // while models that are genuinely larger in-game (e.g. Charybdis: ~14 tall, ~67
    // wide vs a human's ~1.75) stay proportionally bigger — "bigger, not gigantic".
    // A generous width cap then keeps even very wide creatures / spread wings from
    // clipping the canvas as the figure turns, without crushing them to a miniature.
    const h = Math.max(size.y, 1e-3)
    const spinD = Math.max(Math.hypot(size.x, size.z), 1e-3)
    const isGiant = h > 4 || spinD > 8 // genuinely huge models (e.g. Charybdis)
    let fit: number
    if (isGiant) {
      // Giants do NOT auto-spin (a wide body would sweep through the pillars), so
      // fit their STATIC width to roughly fill the stage — big and imposing,
      // "bigger, not gigantic" — with a height cap so a tall giant still fits.
      fit = Math.min(3.4 / Math.max(size.x, 1e-3), 2.0 / h)
    } else {
      // Size-preserving (COMPRESSED) scale: a normal character lands near BASE_H;
      // a slightly larger one stays proportionally bigger. A width cap keeps wide
      // poses / spread wings inside the column ring (radius ≈1.33) as it turns.
      const REF_H = 1.75
      const BASE_H = 1.7
      const COMPRESS = 0.4
      const H_MAX = 3.5
      const W_MAX = 2.6
      const targetH = Math.min(BASE_H * Math.pow(h / REF_H, COMPRESS), H_MAX)
      fit = targetH / h
      if (spinD * fit > W_MAX) fit = W_MAX / spinD // wide pose/wings: fit to width
    }
    isGiantRef.current = isGiant
    scene.scale.setScalar(fit)
    // lowest VISIBLE point -> the dais top surface (feet/hem rest on the platform);
    // x/z centred so the figure pivots about its own axis (never cut off to a side)
    scene.position.set(-center.x * fit, -box.min.y * fit, -center.z * fit)
    onReady()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, visDefaults])

  useEffect(() => {
    if (!names.length) return
    // Prefer the calm STANDING menu idle (…_ADV_Idle). The old regex matched
    // "loop" first and landed on a special showcase pose (…_ADV_Exclusive_1_Loop)
    // — a dynamic/low pose that read as the figure being "sunk" into the dais.
    const pick = (re: RegExp) => names.find((n) => re.test(n))
    const idle =
      pick(/ADV_Idle/i) ?? // standing adventure/menu idle — feet planted
      pick(/_Idle$/i) ?? // any "…Idle" (e.g. Battle_Idle)
      pick(/idle/i) ??
      pick(/stand|wait/i) ??
      pick(/loop/i) ??
      names[0]
    const action = idle ? actions[idle] : null
    if (action) {
      action.reset()
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.play()
    }
    return () => {
      Object.values(actions).forEach((a) => a?.stop())
    }
  }, [actions, names])

  useFrame((_, delta) => {
    const g = group.current
    const s = spin.current
    if (!g) return
    g.rotation.y += s.velocity
    if (!s.dragging) {
      s.velocity *= 0.94
      // giants stay put (a wide body auto-spinning would clip the pillars)
      if (!reduced && !isGiantRef.current && Math.abs(s.velocity) < 0.0025) g.rotation.y += delta * 0.26
    }
  })

  return (
    <group ref={group} position={[0, PLATFORM_TOP, 0]}>
      {/* rigs face -Z; turn them to meet the camera by default */}
      <group rotation={[0, Math.PI, 0]}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

/* records whose model failed to load: their full art as a hologram plane */
function ArtHologram({ url, onReady }: { url: string; onReady: () => void }) {
  const texture = useLoader(THREE.TextureLoader, url)
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace
  }, [texture])
  useEffect(() => {
    onReady()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture])
  const aspect = texture.image ? texture.image.width / texture.image.height : 0.6
  const height = 1.78
  return (
    <Billboard position={[0, PLATFORM_TOP + height / 2, 0]}>
      <mesh>
        <planeGeometry args={[height * aspect, height]} />
        <meshBasicMaterial map={texture} transparent opacity={0.96} toneMapped={false} depthWrite={false} />
      </mesh>
    </Billboard>
  )
}

class HoloBoundary extends Component<{ resetKey: string | number; onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  componentDidUpdate(prev: { resetKey: string | number }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/* materialize flash: spikes the ember uplight + a floor shockwave ring */
function MaterializeFx({ trigger, flareRef }: { trigger: number; flareRef: React.MutableRefObject<THREE.PointLight | null> }) {
  const ring = useRef<THREE.Mesh>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)

  useEffect(() => {
    if (!trigger) return
    const flare = flareRef.current
    if (flare) {
      const proxy = { i: 7 }
      anime({ targets: proxy, i: 2.3, duration: 950, easing: "easeOutCubic", update: () => (flare.intensity = proxy.i) })
    }
    const mesh = ring.current
    const mat = ringMat.current
    if (mesh && mat) {
      const proxy = { s: 0.3, o: 0.9 }
      anime({
        targets: proxy,
        s: 3.0,
        o: 0,
        duration: 850,
        easing: "easeOutCubic",
        update: () => {
          mesh.scale.setScalar(proxy.s)
          mat.opacity = proxy.o
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  return (
    <mesh ref={ring} position={[0, PLATFORM_TOP + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.3}>
      <ringGeometry args={[0.7, 0.78, 64]} />
      <meshBasicMaterial ref={ringMat} color={EMBER} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

/* ================================================================
   the component
   ================================================================ */
export function ArchiveDial({ items, allItems }: Props) {
  const count = Math.max(items.length, 1)
  const roster = allItems && allItems.length ? allItems : items

  const [index, setIndex] = useState(0)
  // the 8 tray slots start from the featured set but become editable via the
  // "choose a hero" picker, which swaps the active slot for any roster member
  const [tray, setTray] = useState<HomeLatestCharacter[]>(items)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState("")
  const [summoned, setSummoned] = useState<HomeLatestCharacter | null>(items[0] ?? null)
  const [ready, setReady] = useState(false)
  const [modelFailed, setModelFailed] = useState(false)
  const [fxTick, setFxTick] = useState(0)
  const [reduced, setReduced] = useState(false)

  const spin = useRef<SpinState>({ velocity: 0, dragging: false, moved: false })
  const flareRef = useRef<THREE.PointLight | null>(null)
  const dragStart = useRef<{ x: number } | null>(null)
  const recordRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  // the "choose a hero" picker is opened from the masthead settings gear
  // (NightInkSiteNav) so the home banner stays uncluttered
  useEffect(() => {
    const open = () => setPickerOpen(true)
    window.addEventListener("nk:open-hero-picker", open)
    return () => window.removeEventListener("nk:open-hero-picker", open)
  }, [])

  // restore the saved tray + active slot once on mount, then persist on change so
  // the visitor's altar choices survive a reload / page close
  const traySaveReady = useRef(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRAY_STORE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { ids?: Array<HomeLatestCharacter["id"]>; index?: number }
        if (saved.ids && saved.ids.length === items.length) {
          const byId = new Map(roster.map((c) => [c.id, c]))
          const restored = saved.ids.map((id) => byId.get(id))
          if (restored.every(Boolean)) setTray(restored as HomeLatestCharacter[])
        }
        if (typeof saved.index === "number") {
          setIndex(Math.min(Math.max(saved.index, 0), Math.max(items.length - 1, 0)))
        }
      }
    } catch {
      /* ignore corrupt/unavailable storage */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    // skip the initial commit so we never clobber saved data with the SSR default
    if (!traySaveReady.current) {
      traySaveReady.current = true
      return
    }
    try {
      localStorage.setItem(TRAY_STORE_KEY, JSON.stringify({ ids: tray.map((t) => t.id), index }))
    } catch {
      /* ignore */
    }
  }, [tray, index])

  /* choosing a record materializes it (debounced for wheel runs) */
  useEffect(() => {
    const target = tray[index]
    if (!target) return
    const handle = window.setTimeout(() => {
      setSummoned((current) => {
        if (current?.id === target.id) return current
        setReady(false)
        setModelFailed(false)
        return target
      })
    }, 240)
    return () => window.clearTimeout(handle)
  }, [index, tray])

  const onMaterialized = () => {
    setReady(true)
    setFxTick((t) => t + 1)
  }

  /* the "choose a hero" picker — browse/search every model-bearing record and
     summon it onto the altar (mirrors the model-viewer's character list) */
  const pickHero = (item: HomeLatestCharacter) => {
    const existing = tray.findIndex((t) => t.id === item.id)
    if (existing >= 0) {
      // already loaded on the dial — just rotate to it
      setIndex(existing)
    } else {
      // swap the active slot for the chosen record and summon it at once
      setTray((prev) => {
        const next = [...prev]
        next[index] = item
        return next
      })
      setReady(false)
      setModelFailed(false)
      setSummoned(item)
    }
    setPickerOpen(false)
    setPickerSearch("")
  }

  const pickerResults = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    const list = q
      ? roster.filter((c) => c.name.toLowerCase().includes(q) || (c.title ?? "").toLowerCase().includes(q))
      : roster
    // alphabetical by name so the grid is easy to scan
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [roster, pickerSearch])

  /* record card entrance */
  useEffect(() => {
    const card = recordRef.current
    if (!card || !ready || !summoned || reduced) return
    anime.remove(card)
    anime({ targets: card, opacity: [0, 1], translateY: [14, 0], duration: 500, easing: "easeOutCubic" })
  }, [ready, summoned, reduced])

  /* drag-to-spin (whole stage) + wheel/keys to cycle records */
  const onPointerDown = (event: React.PointerEvent) => {
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    spin.current.dragging = true
    spin.current.moved = false
    dragStart.current = { x: event.clientX }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!spin.current.dragging || !dragStart.current) return
    const dx = event.clientX - dragStart.current.x
    dragStart.current.x = event.clientX
    if (Math.abs(dx) > 1) spin.current.moved = true
    spin.current.velocity = dx * 0.0042
  }

  const onPointerUp = () => {
    spin.current.dragging = false
    window.setTimeout(() => {
      spin.current.moved = false
    }, 0)
  }

  const stageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      setIndex((i) => mod(i + (event.deltaY > 0 ? 1 : -1), count))
    }
    stage.addEventListener("wheel", onWheel, { passive: false })
    return () => stage.removeEventListener("wheel", onWheel)
  }, [count])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      setIndex((i) => mod(i + 1, count))
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      setIndex((i) => mod(i - 1, count))
    }
  }

  if (!items.length) return null

  const selected = tray[index]
  const showModel = summoned && summoned.modelGlb && !modelFailed
  const loading = !!summoned && !ready

  return (
    <div
      className="od-dial"
      ref={stageRef}
      role="application"
      aria-label="Archive altar — click a record portrait or use arrow keys; drag to spin the figure"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Canvas
        className="od3-canvas"
        // R3F forces inline width/height:100% on its wrapper, which overrides
        // CSS insets; width/height:auto here lets the symmetric offset box size
        // the canvas so it stays centred on the stage (aligned with the tray)
        // and wide enough that the whole altar fits with margin.
        style={{ position: "absolute", top: "-36px", right: "-46px", bottom: "54px", left: "-46px", width: "auto", height: "auto" }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 3.0, 7.4], fov: 30 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0.92, 0)
        }}
      >
        <ambientLight intensity={0.62} />
        <directionalLight position={[3.2, 5, 3.5]} intensity={1.4} color={"#fff1e0"} />
        <directionalLight position={[-4, 2.6, -2.5]} intensity={0.85} color={STEEL} />
        <pointLight position={[0, 1.4, 2.2]} intensity={0.5} color={EMBER} distance={6} />

        {/* reflections for the metal + crystals — built from light shapes, no
            external HDR fetch, so it works offline and on-brand */}
        <Environment resolution={256} frames={1} background={false}>
          <Lightformer intensity={2.2} color="#ffd9bf" position={[0, 4, 2]} scale={[6, 3, 1]} />
          <Lightformer intensity={1.2} color={STEEL} position={[-5, 2, -2]} scale={[4, 4, 1]} />
          <Lightformer intensity={1.6} color={RED_BRIGHT} position={[3, 1, -3]} scale={[3, 3, 1]} />
          <Lightformer intensity={0.6} color="#ffffff" position={[0, -3, 1]} scale={[6, 2, 1]} />
        </Environment>

        {/* the ornate altar — a Blender-modelled GLB (beveled lathe-turned
            stone, curve-beveled gold filigree, faceted crystal pylons, gem
            emblem, spires). Replaces the procedural primitives. */}
        <Suspense fallback={null}>
          <AltarModel reduced={reduced} />
        </Suspense>
        {/* dynamic glowing layers on top of the modelled altar */}
        <MagicFloor />
        <GlowSprite position={[0, PLATFORM_TOP + 0.02, 0]} size={2.6} color={EMBER} opacity={0.5} />
        <Beam />
        <MaterializeFx trigger={fxTick} flareRef={flareRef} />
        {/* ember uplight from the altar centre onto the figure */}
        <pointLight ref={flareRef} position={[0, 0.7, 0]} color={RED_BRIGHT} intensity={2.3} distance={4.5} decay={2} />

        {!reduced && (
          <>
            <Sparkles count={30} color={EMBER} size={2.6} speed={0.4} opacity={0.55} scale={[1.3, 2.6, 1.3]} position={[0, PLATFORM_TOP + 1.3, 0]} />
            <Sparkles count={24} color={CREAM} size={1.5} speed={0.16} opacity={0.3} scale={[3.4, 1.2, 3.4]} position={[0, 0.5, 0]} />
          </>
        )}

        {summoned && (
          <HoloBoundary resetKey={summoned.id} onError={() => setModelFailed(true)}>
            <Suspense fallback={null}>
              {showModel ? (
                <HoloModel key={summoned.id} url={mediaUrl(summoned.modelGlb!)} spin={spin} reduced={reduced} onReady={onMaterialized} />
              ) : (
                <ArtHologram key={`art-${summoned.id}`} url={summoned.info || summoned.thumb} onReady={onMaterialized} />
              )}
            </Suspense>
          </HoloBoundary>
        )}
      </Canvas>

      {loading && <span className="od-loading cap">Materializing&hellip;</span>}

      {/* the record selector — a clean 2D tray below the altar so nothing
          floats over the figure. Click a portrait to summon it. */}
      <div
        className="od-tray"
        onPointerDown={(event) => event.stopPropagation()}
        role="listbox"
        aria-label="Records"
      >
        {tray.map((item, i) => (
          <button
            key={`${item.id}-${i}`}
            type="button"
            role="option"
            aria-selected={i === index}
            className={`od-tray-item${i === index ? " is-active" : ""}`}
            title={item.name}
            onClick={() => setIndex(i)}
          >
            <img src={item.thumb} alt={item.name} draggable={false} loading="lazy" />
          </button>
        ))}
      </div>

      <span className="od-plate cap">{selected?.name}</span>
      <span className="od-hint cap">Pick a record &middot; drag to spin &middot; scroll to cycle</span>

      {summoned && ready && (
        <div className="od-record" ref={recordRef}>
          <button
            type="button"
            className="od-pop-close"
            onClick={() => {
              setSummoned(null)
              setReady(false)
            }}
            aria-label="Dismiss record"
          >
            <X aria-hidden="true" />
          </button>
          <strong>{summoned.name}</strong>
          {summoned.title ? <em>{summoned.title}</em> : null}
          <span className="od-record-links">
            <Link className="od-pop-cta" href={`/characters/${summoned.id}`}>
              Open record &rarr;
            </Link>
            {summoned.modelGlb && !modelFailed ? (
              <Link className="od-pop-cta ghost" href="/model-viewer">
                Model viewer &rarr;
              </Link>
            ) : null}
          </span>
        </div>
      )}

      {pickerOpen && typeof document !== "undefined" && createPortal(
        <div className="od-picker-scrim" onClick={() => setPickerOpen(false)}>
          <div className="od-picker" onClick={(event) => event.stopPropagation()}>
            <div className="od-picker-head">
              <strong>Choose a hero</strong>
              <input
                className="od-picker-search"
                placeholder="Search characters&hellip;"
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                autoFocus
              />
              <button type="button" className="od-picker-close" onClick={() => setPickerOpen(false)} aria-label="Close picker">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="od-picker-grid">
              {pickerResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`od-picker-item${summoned?.id === item.id ? " is-active" : ""}`}
                  title={item.name}
                  onClick={() => pickHero(item)}
                >
                  <img src={item.thumb} alt={item.name} draggable={false} loading="lazy" />
                  <span>{item.name}</span>
                </button>
              ))}
              {pickerResults.length === 0 && <p className="od-picker-empty">No heroes match.</p>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
