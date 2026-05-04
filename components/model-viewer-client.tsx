"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, useAnimations, Environment } from "@react-three/drei"
import * as THREE from "three"

export type ModelEntry = {
  id: string
  name: string
  affiliation_name?: string
  glb: string
  icon?: string
}

// Per-mesh fallback visibility (used when an anim doesn't author the mesh)
// plus per-anim, per-mesh keyframe tracks.
type VisibilityData = {
  defaults: Record<string, boolean>
  tracks: Record<string, Record<string, { time: number; value: number }[]>>
}

type SkillSceneVideoEntry = {
  variant: string
  group?: string
  kind?: string
  scene: string
  mp4?: string
  webm?: string
  poster?: string
}

type SkillSceneVideoCatalog = {
  generatedAt?: string
  videos: SkillSceneVideoEntry[]
}

// Step interpolation: at time t, find last key whose time <= t and return its value.
function evaluateTrack(keys: { time: number; value: number }[], t: number): number {
  if (!keys || keys.length === 0) return 1
  let v = keys[0].value
  for (const k of keys) {
    if (k.time <= t) v = k.value
    else break
  }
  return v
}

function Model({
  url, autoRotate, scale, animationName, onAnimationsList, visibility,
}: {
  url: string
  autoRotate: boolean
  scale: number
  animationName: string
  visibility: VisibilityData
  onAnimationsList: (names: string[]) => void
}) {
  const { scene, animations } = useGLTF(url)
  const root = useRef<THREE.Group>(null)
  // Use the loaded scene directly. SkeletonUtils.clone breaks morph-target
  // animation binding because morphTargetInfluences/Dictionary aren't deep-cloned.
  const cloned = scene
  const { actions, names } = useAnimations(animations, cloned)

  // Cache mesh-bearing nodes by name for fast lookup. Also disable frustum
  // culling on every SkinnedMesh — three.js computes bounding spheres from the
  // bind pose, not the animated pose, so heavy root-motion anims trigger
  // incorrect culling and the mesh "disappears" at certain camera angles.
  const meshes = useMemo(() => {
    const out: Record<string, THREE.Object3D> = {}
    cloned.traverse(o => {
      const isMesh = (o as any).isMesh || (o as any).isSkinnedMesh
      if (isMesh) {
        out[o.name] = o
        ;(o as any).frustumCulled = false
      }
    })
    return out
  }, [cloned])

  useEffect(() => {
    onAnimationsList(names)
  }, [names, onAnimationsList])

  useEffect(() => {
    if (!actions) return
    Object.values(actions).forEach(a => a?.fadeOut(0.2))
    if (animationName && actions[animationName]) {
      const action = actions[animationName]!
      action.reset().fadeIn(0.2)
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
      action.play()
    }
  }, [animationName, actions])

  // When the scene, visibility data, OR animation changes, reset every mesh
  // to its sidecar-default visibility. This is a one-shot baseline — the
  // per-anim track loop in useFrame can then override per-frame.
  useEffect(() => {
    for (const name in meshes) {
      const def = visibility.defaults?.[name]
      meshes[name].visible = def === undefined ? true : def
    }
  }, [meshes, visibility, animationName])

  // Per-frame, only override visibility for meshes that the current animation
  // explicitly authors (has a track for). Anything else keeps its baseline.
  useFrame((_, dt) => {
    if (root.current && autoRotate) root.current.rotation.y += dt * 0.4
    const action = animationName ? actions[animationName] : null
    const t = action ? action.time : 0
    const tracks = animationName ? visibility.tracks[animationName] : undefined
    if (!tracks) return
    for (const name in tracks) {
      if (!meshes[name]) continue
      meshes[name].visible = evaluateTrack(tracks[name], t) >= 0.5
    }
  })

  return (
    <group ref={root} scale={scale}>
      <primitive object={cloned} />
    </group>
  )
}

function SkillSceneVideo({ entry }: { entry: SkillSceneVideoEntry }) {
  const key = `${entry.variant}::${entry.scene}::${entry.mp4 ?? entry.webm ?? ""}`
  return (
    <video
      key={key}
      className="absolute inset-0 h-full w-full bg-black object-contain"
      poster={entry.poster}
      controls
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
    >
      {entry.webm && <source src={entry.webm} type="video/webm" />}
      {entry.mp4 && <source src={entry.mp4} type="video/mp4" />}
    </video>
  )
}

export default function ModelViewerClient({ models }: { models: ModelEntry[] }) {
  const [selectedId, setSelectedId] = useState(models[0]?.id ?? "")
  const [modelSearch, setModelSearch] = useState("")
  const [viewerMode, setViewerMode] = useState<"character" | "skill">("character")
  const [autoRotate, setAutoRotate] = useState(false)
  const [scale, setScale] = useState(1)
  const [animationName, setAnimationName] = useState<string>("")
  const [animationList, setAnimationList] = useState<string[]>([])
  const [visibility, setVisibility] = useState<VisibilityData>({ defaults: {}, tracks: {} })
  const [videoCatalog, setVideoCatalog] = useState<SkillSceneVideoCatalog | null>(null)
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0)
  const [assetVersion, setAssetVersion] = useState(() => Date.now())

  const selected = models.find(m => m.id === selectedId) ?? models[0]
  const modelUrl = selected
    ? (process.env.NODE_ENV === "development" ? `${selected.glb}?v=${assetVersion}` : selected.glb)
    : ""
  const videosForVariant = useMemo(
    () => (videoCatalog?.videos ?? []).filter(v => v.variant === selected?.id && (v.mp4 || v.webm)),
    [videoCatalog, selected?.id],
  )
  const activeVideo = videosForVariant[selectedVideoIndex] ?? videosForVariant[0]
  const hasSkillScene = videosForVariant.length > 0
  const activeMode = viewerMode === "skill" && hasSkillScene ? "skill" : "character"

  const normalizedModelSearch = modelSearch.trim().toLowerCase()
  const filteredModels = useMemo(() => {
    if (!normalizedModelSearch) return models

    return models.filter(model => {
      const searchable = [
        model.name,
        model.id,
        model.affiliation_name ?? "",
      ].join(" ").toLowerCase()

      return searchable.includes(normalizedModelSearch)
    })
  }, [models, normalizedModelSearch])

  useEffect(() => {
    setAnimationName("")
    setAnimationList([])
    setVisibility({ defaults: {}, tracks: {} })
    setAssetVersion(Date.now())
    if (!selected) return
    const sidecarUrl = selected.glb.replace(/\.glb$/i, ".visibility.json")
    fetch(sidecarUrl, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!j) return
        // Backward compat: older sidecars were just the tracks dict directly.
        if (j.defaults && j.tracks) setVisibility(j)
        else setVisibility({ defaults: {}, tracks: j })
      })
      .catch(() => {})
  }, [selectedId, selected])

  useEffect(() => {
    setViewerMode("character")
    setSelectedVideoIndex(0)
  }, [selectedId])

  useEffect(() => {
    fetch("/skill-videos/catalog.json", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then((j: SkillSceneVideoCatalog | null) => setVideoCatalog(j))
      .catch(() => setVideoCatalog(null))
  }, [])

  if (!selected) {
    return <p className="text-gray-400">No models available yet.</p>
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-xl border border-gray-700 bg-[#0d1320] p-3 max-h-[70vh] overflow-hidden flex flex-col">
        <label className="text-xs uppercase tracking-wider text-gray-400 mb-2" htmlFor="model-search">
          Models
        </label>
        <div className="relative mb-3">
          <input
            id="model-search"
            type="search"
            value={modelSearch}
            onChange={e => setModelSearch(e.target.value)}
            placeholder="Search models..."
            className="w-full rounded-md border border-gray-700 bg-[#111827] px-3 py-2 pr-8 text-sm text-white placeholder:text-gray-500 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
          {modelSearch && (
            <button
              type="button"
              onClick={() => setModelSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-gray-400 hover:bg-white/10 hover:text-white"
              aria-label="Clear model search"
            >
              ×
            </button>
          )}
        </div>
        <div className="mb-2 text-xs text-gray-500">
          {filteredModels.length} / {models.length} models
        </div>
        <ul className="space-y-1 overflow-y-auto pr-1">
          {filteredModels.map(m => {
            const active = m.id === selected.id
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors ${active ? "bg-white/15 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"}`}
                >
                  <div className="font-medium">{m.name}</div>
                  {m.affiliation_name && (
                    <div className="text-[11px] text-gray-400">{m.affiliation_name}</div>
                  )}
                </button>
              </li>
            )
          })}
          {filteredModels.length === 0 && (
            <li className="rounded-md border border-dashed border-gray-700 px-3 py-4 text-center text-sm text-gray-400">
              No models found.
            </li>
          )}
        </ul>
      </aside>

      <div className="rounded-xl border border-gray-700 bg-[#0d1320] overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-800 px-3 py-2 text-sm">
          <div className="font-semibold text-white">{selected.name}</div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {hasSkillScene && (
              <div className="flex rounded-md border border-gray-700 bg-[#111827] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewerMode("character")}
                  className={`rounded px-2 py-1 text-sm ${activeMode === "character" ? "bg-white/15 text-white" : "text-gray-300 hover:text-white"}`}
                >
                  Character
                </button>
                <button
                  type="button"
                  onClick={() => setViewerMode("skill")}
                  className={`rounded px-2 py-1 text-sm ${activeMode === "skill" ? "bg-white/15 text-white" : "text-gray-300 hover:text-white"}`}
                >
                  Skill Scene
                </button>
              </div>
            )}
            {activeMode === "skill" ? (
              <label className="flex items-center gap-1.5 text-gray-300">
                Scene
                <select
                  value={String(selectedVideoIndex)}
                  onChange={e => setSelectedVideoIndex(Number(e.target.value))}
                  className="rounded-md bg-[#111827] border border-gray-700 px-2 py-1 text-sm text-white max-w-[260px]"
                  disabled={videosForVariant.length <= 1}
                >
                  {videosForVariant.map((v, i) => (
                    <option key={`${v.scene}-${i}`} value={i}>{v.scene}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="flex items-center gap-1.5 text-gray-300">
                Animation
                <select
                  value={animationName}
                  onChange={e => setAnimationName(e.target.value)}
                  className="rounded-md bg-[#111827] border border-gray-700 px-2 py-1 text-sm text-white max-w-[260px]"
                  disabled={animationList.length === 0}
                >
                  <option value="">-- rest pose --</option>
                  {animationList.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-1.5 text-gray-300">
              <input
                type="checkbox"
                checked={autoRotate}
                onChange={e => setAutoRotate(e.target.checked)}
                disabled={activeMode === "skill"}
              />
              Auto-rotate
            </label>
            <label className="flex items-center gap-1.5 text-gray-300">
              Scale
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.05}
                value={scale}
                onChange={e => setScale(Number(e.target.value))}
                disabled={activeMode === "skill"}
                className="w-28"
              />
              <span className="w-8 tabular-nums text-right">{(activeMode === "skill" ? 1 : scale).toFixed(2)}</span>
            </label>
          </div>
        </div>

        <div
          className={`relative overflow-hidden bg-gradient-to-b from-[#1a2438] to-[#0a0f1c] ${activeMode === "skill" ? "aspect-video" : "h-[78vh]"}`}
        >
          {activeMode === "skill" && activeVideo ? (
            <SkillSceneVideo entry={activeVideo} />
          ) : (
            <Canvas className="relative z-10" camera={{ position: [0, 1.4, 2.6], fov: 38 }} dpr={[1, 2]} gl={{ alpha: true }}>
              <ambientLight intensity={0.6} />
              <hemisphereLight intensity={0.4} groundColor={"#202b40"} />
              <directionalLight position={[3, 5, 2]} intensity={1.2} />
              <directionalLight position={[-3, 2, -2]} intensity={0.4} />
              <Suspense fallback={null}>
                <Model
                  key={modelUrl}
                  url={modelUrl}
                  autoRotate={autoRotate}
                  scale={scale}
                  animationName={animationName}
                  visibility={visibility}
                  onAnimationsList={setAnimationList}
                />
                <Environment preset="city" />
              </Suspense>
              <OrbitControls
                makeDefault
                enableDamping
                enablePan
                panSpeed={1.2}
                zoomSpeed={1.2}
                minDistance={0.3}
                maxDistance={20}
                screenSpacePanning
                target={[0, 1, 0]}
              />
            </Canvas>
          )}
        </div>
        <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-800">
          Left-drag rotate · Right-drag (or Shift+drag) pan · Scroll zoom
        </div>
      </div>
    </div>
  )
}
