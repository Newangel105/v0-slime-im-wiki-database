"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei"
import * as THREE from "three"
import { mediaUrl } from "@/lib/media-cdn"
import { Mouse } from "lucide-react"

export type ModelEntry = {
  id: string
  name: string
  affiliation_name?: string
  glb: string
  icon?: string
  skillScene?: SkillSceneAssetEntry
}

type SkillSceneAssetEntry = {
  glb: string
  manifest: string
  visibility?: string
  scene?: string
  sceneActivationTrack?: string
  battleField?: string
  battleFieldActivationTrack?: string
  fieldLayers?: {
    url: string
    activationTrack?: string
    defaultVisible?: boolean
  }[]
  cinematic?: string
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
      {entry.webm && <source src={mediaUrl(entry.webm)} type="video/webm" />}
      {entry.mp4 && <source src={mediaUrl(entry.mp4)} type="video/mp4" />}
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
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0)
  const [assetVersion, setAssetVersion] = useState(() => Date.now())

  const selected = models.find(m => m.id === selectedId) ?? models[0]
  const versionAsset = (url?: string) =>
    url ? (process.env.NODE_ENV === "development" ? `${url}?v=${assetVersion}` : url) : ""
  const modelUrl = selected ? versionAsset(mediaUrl(selected.glb)) : ""
  const videosForVariant = useMemo(
    () => (videoCatalog?.videos ?? []).filter(v => v.variant === selected?.id && (v.mp4 || v.webm)),
    [videoCatalog, selected?.id],
  )
  const activeVideo = videosForVariant[selectedSceneIndex] ?? videosForVariant[0]
  const hasSkillVideo = videosForVariant.length > 0
  // Skill tab is movie-only; the older skill.glb 3D rendering path is dropped.
  const hasSkillScene = hasSkillVideo
  const activeMode = viewerMode === "skill" && hasSkillScene ? "skill" : "character"
  const skillSceneOptions = videosForVariant.map(v => ({ id: v.scene, name: v.scene }))

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
    const sidecarUrl = mediaUrl(selected.glb.replace(/\.glb$/i, ".visibility.json"))
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
    setSelectedSceneIndex(0)
  }, [selectedId])

  useEffect(() => {
    if (skillSceneOptions.length > 0 && selectedSceneIndex >= skillSceneOptions.length) {
      setSelectedSceneIndex(0)
    }
  }, [selectedSceneIndex, skillSceneOptions.length])

  useEffect(() => {
    fetch("/skill-videos/catalog.json", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then((j: SkillSceneVideoCatalog | null) => setVideoCatalog(j))
      .catch(() => setVideoCatalog(null))
  }, [])

  if (!selected) {
    return (
      <div className="glass-panel p-8 text-center text-muted-foreground">
        No models available yet.
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="glass-panel order-last flex max-h-[55vh] min-h-0 flex-col overflow-hidden p-4 lg:order-none lg:max-h-[78vh] lg:min-h-[520px]">
        <div className="mb-4">
          <div className="section-kicker">Model Library</div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">Archive</h2>
          <div className="accent-rule mt-4" />
        </div>

        <label className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground" htmlFor="model-search">
          Search models
        </label>

        <div className="relative mb-3">
          <input
            id="model-search"
            type="search"
            value={modelSearch}
            onChange={e => setModelSearch(e.target.value)}
            placeholder="Search models..."
            className="theme-input h-10 w-full rounded-md px-3 py-2 pr-9 text-sm"
          />
          {modelSearch && (
            <button
              type="button"
              onClick={() => setModelSearch("")}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-accent/50 hover:text-foreground"
              aria-label="Clear model search"
            >
              ×
            </button>
          )}
        </div>

        <div className="mb-3 flex items-center justify-between rounded-xl border border-border bg-card/80 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Models</span>
          <span className="text-xs font-semibold text-muted-foreground">
            {filteredModels.length} / {models.length}
          </span>
        </div>

        <ul className="image-scroll space-y-1.5 overflow-y-auto pr-1">
          {filteredModels.map(m => {
            const active = m.id === selected.id
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`group w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                    active
                      ? "border-accent/40 bg-card text-foreground shadow-[0_0_24px_rgba(210,69,58,0.12)]"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-card/70 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        active ? "bg-accent shadow-[0_0_14px_rgba(210,69,58,0.6)]" : "bg-[#3a4862] group-hover:bg-[#55657f]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{m.name}</div>
                      {m.affiliation_name && (
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{m.affiliation_name}</div>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}

          {filteredModels.length === 0 && (
            <li className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
              No models found.
            </li>
          )}
        </ul>
      </aside>

      <section className="glass-panel-strong order-first overflow-hidden lg:order-none">
        <div className="flex flex-col gap-3 border-b border-border bg-card/95 px-4 py-4">
          <div className="min-w-0">
            <div className="section-kicker">Active Model</div>
            <h2 className="mt-1 truncate text-[clamp(1.35rem,1.1vw,2rem)] font-black leading-[1.02] tracking-tight text-foreground">
              {selected.name}
            </h2>
            {selected.affiliation_name ? (
              <p className="mt-1 truncate text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">{selected.affiliation_name}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            {hasSkillScene && (
              <div
                role="tablist"
                aria-label="Viewer mode"
                className="inline-flex h-10 shrink-0 items-center rounded-xl border border-border bg-card p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeMode === "character"}
                  onClick={() => setViewerMode("character")}
                  className={`h-8 whitespace-nowrap rounded-lg px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] transition ${
                    activeMode === "character"
                      ? "bg-accent/20 text-foreground shadow-[0_0_0_1px_rgba(210,69,58,0.45)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Model
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeMode === "skill"}
                  onClick={() => setViewerMode("skill")}
                  className={`h-8 whitespace-nowrap rounded-lg px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] transition ${
                    activeMode === "skill"
                      ? "bg-accent/20 text-foreground shadow-[0_0_0_1px_rgba(210,69,58,0.45)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Movie
                </button>
              </div>
            )}
            {activeMode === "skill" ? (
              // the Movie tab is just the video; only offer a Scene picker when
              // there's actually more than one movie to choose between
              skillSceneOptions.length > 1 ? (
                <label className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Scene</span>
                  <select
                    value={String(selectedSceneIndex)}
                    onChange={e => setSelectedSceneIndex(Number(e.target.value))}
                    className="h-10 max-w-[260px] rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/30"
                  >
                    {skillSceneOptions.map((scene, i) => (
                      <option key={`${scene.id}-${i}`} value={i}>{scene.name}</option>
                    ))}
                  </select>
                </label>
              ) : null
            ) : (
              <label className="flex items-center gap-2 text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Animation</span>
                <select
                  value={animationName}
                  onChange={e => setAnimationName(e.target.value)}
                  className="h-10 max-w-[260px] rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/30"
                  disabled={animationList.length === 0}
                >
                  <option value="">-- rest pose --</option>
                  {animationList.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Auto-rotate + Scale are model-only controls — hidden on the Movie tab */}
            {activeMode !== "skill" && (
              <>
                <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={autoRotate}
                    onChange={e => setAutoRotate(e.target.checked)}
                    className="accent-[#d2453a]"
                  />
                  <span className="text-sm font-semibold">Auto-rotate</span>
                </label>

                <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground">
                  <span className="text-sm font-semibold">Scale</span>
                  <input
                    type="range"
                    min={0.25}
                    max={3}
                    step={0.05}
                    value={scale}
                    onChange={e => setScale(Number(e.target.value))}
                    className="w-28 accent-[#d2453a]"
                  />
                  <span className="w-9 text-right text-sm tabular-nums text-foreground">{scale.toFixed(2)}</span>
                </label>
              </>
            )}
          </div>
        </div>

        {activeMode !== "skill" && (
          <div className="hidden items-center gap-2 border-b border-border bg-background/80 px-4 py-2 text-xs text-muted-foreground lg:flex">
            <Mouse className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>Left-drag <span className="font-semibold text-foreground/90">rotate</span></span>
            <span className="text-foreground/40">·</span>
            <span><kbd className="rounded border border-border/[0.22] bg-border/10 px-1.5 py-0.5 font-mono font-semibold text-foreground/90">Shift</kbd> + drag or Right-drag <span className="font-semibold text-foreground/90">pan</span></span>
            <span className="text-foreground/40">·</span>
            <span>Scroll <span className="font-semibold text-foreground/90">zoom</span></span>
          </div>
        )}

        <div
          className={`relative overflow-hidden ${
            activeMode === "skill" ? "aspect-video" : "h-[58vh] lg:h-[78vh]"
          }`}
          style={{
            background:
              "radial-gradient(circle at 50% 4%, rgba(210,69,58,0.09), transparent 24rem), linear-gradient(180deg, #101a2b 0%, #0b1421 52%, #080d15 100%)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(236,228,212,0.035)_1px,transparent_1px),linear-gradient(180deg,rgba(236,228,212,0.025)_1px,transparent_1px)] bg-[size:52px_52px] opacity-40" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />

          {activeMode === "skill" && activeVideo ? (
            <SkillSceneVideo entry={activeVideo} />
          ) : (
            <Canvas className="relative z-10" camera={{ position: [0, 1.4, 2.6], fov: 38 }} dpr={[1, 2]} gl={{ alpha: true }}>
              <ambientLight intensity={0.65} />
              <hemisphereLight intensity={0.35} groundColor={"#1a1a1e"} />
              <directionalLight position={[3, 5, 2]} intensity={1.15} />
              <directionalLight position={[-3, 2, -2]} intensity={0.35} />
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

        <div className="flex items-center justify-end border-t border-border bg-card/95 px-4 py-3">
          <span className="rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
            3D Viewer
          </span>
        </div>
      </section>
    </div>
  )
}
