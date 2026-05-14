"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react"
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber"
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei"
import { Camera, Pause, Play, RotateCcw, Sparkles } from "lucide-react"
import * as THREE from "three"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"

type VisibilityData = {
  defaults: Record<string, boolean>
  tracks: Record<string, Record<string, { time: number; value: number }[]>>
}

type Key<T> = {
  time: number
  value: T
}

type CameraTrack = {
  name: string
  source?: string
  position?: Key<number[]>[]
  rotation?: Key<number[]>[]
  fieldOfView?: Key<number>[]
}

export type SkillSceneManifestScene = {
  id: string
  name: string
  clips: string[]
}

export type SkillSceneManifest = {
  variant: string
  scenes: SkillSceneManifestScene[]
  cameraTracks?: CameraTrack[] | Record<string, Omit<CameraTrack, "name">>
}

type SkillSceneFieldLayer = {
  url: string
  activationTrack?: string
  defaultVisible?: boolean
}

export type SkillSceneAssets = {
  glb: string
  manifest: string
  visibility?: string
  scene?: string
  sceneActivationTrack?: string
  battleField?: string
  battleFieldActivationTrack?: string
  fieldLayers?: SkillSceneFieldLayer[]
  cinematic?: string
}

type TimelineClip = {
  name: string
  start: number
  duration: number
  track?: string
}

type TimelineTrack = {
  name: string
  clips: TimelineClip[]
}

type CinematicParticleEmitter = {
  name: string
  path?: string
  role?: string
  primaryTexture?: string
  localPosition?: number[]
  localScale?: number[]
  worldPosition?: number[]
  worldRotation?: number[]
  worldScale?: number[]
  duration?: number
  startLifetime?: number
  startSpeed?: number
  particle?: {
    startDelay?: CurveValue
    startLifetime?: CurveValue
    startSpeed?: CurveValue
    startSize?: CurveValue
    startSizeY?: CurveValue
    startSizeZ?: CurveValue
    startRotation?: CurveValue
    startColor?: GradientValue
    lengthInSec?: number
    simulationSpeed?: number
    looping?: boolean
    randomSeed?: number
    maxParticles?: number
    size3D?: boolean
  }
  emission?: {
    enabled?: boolean
    rateOverTime?: CurveValue
    rateOverDistance?: CurveValue
    bursts?: { time?: number; count?: CurveValue; cycleCount?: number; repeatInterval?: number; probability?: number }[]
  }
  shape?: {
    enabled?: boolean
    type?: number
    angle?: number
    length?: number
    radius?: number
    scale?: number[]
    position?: number[]
    rotation?: number[]
    randomDirectionAmount?: number
    sphericalDirectionAmount?: number
    randomPositionAmount?: number
  }
  velocity?: {
    enabled?: boolean
    x?: CurveValue
    y?: CurveValue
    z?: CurveValue
    radial?: CurveValue
    speedModifier?: CurveValue
    inWorldSpace?: boolean
  }
  sizeOverLifetime?: {
    enabled?: boolean
    curve?: CurveValue
  }
  colorOverLifetime?: {
    enabled?: boolean
    gradient?: GradientValue
  }
  rotationOverLifetime?: {
    enabled?: boolean
    curve?: CurveValue
  }
  textureSheet?: {
    enabled?: boolean
    tilesX?: number
    tilesY?: number
    frameOverTime?: CurveValue
    startFrame?: CurveValue
  }
  renderer?: {
    enabled?: boolean
    renderMode?: number
    renderAlignment?: number
    sortingOrder?: number
    sortMode?: number
    velocityScale?: number
    lengthScale?: number
    mesh?: ParticleRendererMesh | null
    meshes?: ParticleRendererMesh[]
  }
  materials?: {
    name?: string
    shader?: string
    textures?: { property?: string; texture?: string }[]
    colors?: Record<string, number[]>
    floats?: Record<string, number>
  }[]
}

type ParticleRendererMesh = {
  slot?: string
  name?: string
  source?: string
}

type CurveValue = {
  state?: number
  scalar?: number
  minScalar?: number
  maxCurve?: Key<number>[]
  minCurve?: Key<number>[]
}

type GradientValue = {
  colors?: Key<number[]>[]
  alphas?: Key<number>[]
  minColor?: number[]
  maxColor?: number[]
}

type CinematicManifest = {
  variant: string
  scene?: string
  kind?: string
  textures?: Record<string, string>
  particleGroups?: Record<string, CinematicParticleEmitter[]>
  targetTracks?: Record<string, CinematicTargetTrack>
  timeline?: {
    duration?: number
    cutStarts?: Record<string, number>
    cutDurations?: Record<string, number>
    fovTracks?: Record<string, Key<number>[]>
    tracks?: TimelineTrack[]
  }
}

type CinematicTargetTrack = {
  source?: string
  position?: Key<number[]>[]
  rotation?: Key<number[]>[]
  scale?: Key<number[]>[]
}

type PlaybackInfo = {
  time: number
  total: number
  clip: string
}

type Segment = {
  clip: string
  start: number
  duration: number
}

function versionedUrl(url: string | undefined, version: number) {
  if (!url) return ""
  if (process.env.NODE_ENV !== "development") return url
  return `${url}${url.includes("?") ? "&" : "?"}v=${version}`
}

function dirname(url: string) {
  const index = url.lastIndexOf("/")
  return index >= 0 ? url.slice(0, index) : ""
}

function textureUrl(cinematic: CinematicManifest | null, baseUrl: string, textureName: string | undefined) {
  if (!cinematic || !textureName) return ""
  const rel = cinematic.textures?.[textureName]
  if (!rel) return ""
  if (/^https?:\/\//i.test(rel) || rel.startsWith("/")) return rel
  return `${baseUrl}/${rel}`
}

function materialTextureName(emitter: CinematicParticleEmitter, properties: string[]) {
  const wanted = new Set(properties)
  for (const material of emitter.materials ?? []) {
    for (const texture of material.textures ?? []) {
      if (texture.property && texture.texture && wanted.has(texture.property)) return texture.texture
    }
  }
  return ""
}

function primaryTextureInfo(emitter: CinematicParticleEmitter) {
  const primary = emitter.primaryTexture
  if (!primary) return null
  for (const material of emitter.materials ?? []) {
    for (const texture of material.textures ?? []) {
      if (texture.texture === primary) return texture
    }
  }
  return { texture: primary, property: "" }
}

function shaderName(emitter: CinematicParticleEmitter) {
  return emitter.materials?.[0]?.shader ?? ""
}

function isTempestVfxShader(emitter: CinematicParticleEmitter) {
  return shaderName(emitter).startsWith("TempestVFX/")
}

function isAlphaOnlyPrimaryTexture(emitter: CinematicParticleEmitter) {
  const property = primaryTextureInfo(emitter)?.property
  return isTempestVfxShader(emitter) && (property === "_Alpha" || property === "_AlphaMask" || property === "_MaskTex")
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function sampleNumber(keys: Key<number>[] | undefined, time: number, fallback: number) {
  if (!keys?.length) return fallback
  if (time <= keys[0].time) return Number(keys[0].value)
  for (let i = 1; i < keys.length; i += 1) {
    const prev = keys[i - 1]
    const next = keys[i]
    if (time <= next.time) {
      const span = Math.max(0.00001, next.time - prev.time)
      return lerp(Number(prev.value), Number(next.value), (time - prev.time) / span)
    }
  }
  return Number(keys[keys.length - 1].value)
}

function sampleVec3(keys: Key<number[]>[] | undefined, time: number, fallback: THREE.Vector3, out: THREE.Vector3) {
  if (!keys?.length) return out.copy(fallback)
  if (time <= keys[0].time) return out.fromArray(keys[0].value as [number, number, number])
  for (let i = 1; i < keys.length; i += 1) {
    const prev = keys[i - 1]
    const next = keys[i]
    if (time <= next.time) {
      const span = Math.max(0.00001, next.time - prev.time)
      const t = (time - prev.time) / span
      return out.set(
        lerp(prev.value[0] ?? 0, next.value[0] ?? 0, t),
        lerp(prev.value[1] ?? 0, next.value[1] ?? 0, t),
        lerp(prev.value[2] ?? 0, next.value[2] ?? 0, t),
      )
    }
  }
  return out.fromArray(keys[keys.length - 1].value as [number, number, number])
}

function sampleQuat(keys: Key<number[]>[] | undefined, time: number, fallback: THREE.Quaternion, out: THREE.Quaternion) {
  if (!keys?.length) return out.copy(fallback)
  const read = (value: number[]) => new THREE.Quaternion(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, value[3] ?? 1).normalize()
  if (time <= keys[0].time) return out.copy(read(keys[0].value))
  for (let i = 1; i < keys.length; i += 1) {
    const prev = keys[i - 1]
    const next = keys[i]
    if (time <= next.time) {
      const span = Math.max(0.00001, next.time - prev.time)
      return out.copy(read(prev.value)).slerp(read(next.value), (time - prev.time) / span)
    }
  }
  return out.copy(read(keys[keys.length - 1].value))
}

function evaluateVisibilityTrack(keys: { time: number; value: number }[] | undefined, time: number) {
  if (!keys?.length) return 1
  let value = keys[0].value
  for (const key of keys) {
    if (key.time <= time) value = key.value
    else break
  }
  return value
}

function curveScalar(value: CurveValue | undefined, fallback: number, normalizedTime = 0) {
  if (!value) return fallback
  const curve = value.maxCurve?.length ? value.maxCurve : value.minCurve
  if (curve?.length) return sampleNumber(curve, normalizedTime, value.scalar ?? fallback)
  return Number(value.scalar ?? value.minScalar ?? fallback)
}

function gradientColor(value: GradientValue | undefined, normalizedTime: number, fallback = [1, 1, 1, 1]) {
  if (!value) return fallback
  const colorKeys = value.colors
  const alphaKeys = value.alphas
  const out = [...(value.maxColor ?? value.minColor ?? fallback)]
  if (colorKeys?.length) {
    const a = colorKeys[0]
    let sampled = a.value
    for (let i = 1; i < colorKeys.length; i += 1) {
      const prev = colorKeys[i - 1]
      const next = colorKeys[i]
      if (normalizedTime <= next.time) {
        const span = Math.max(0.00001, next.time - prev.time)
        const t = (normalizedTime - prev.time) / span
        sampled = [
          lerp(prev.value[0] ?? 1, next.value[0] ?? 1, t),
          lerp(prev.value[1] ?? 1, next.value[1] ?? 1, t),
          lerp(prev.value[2] ?? 1, next.value[2] ?? 1, t),
          lerp(prev.value[3] ?? 1, next.value[3] ?? 1, t),
        ]
        break
      }
      sampled = next.value
    }
    out[0] = sampled[0] ?? out[0] ?? 1
    out[1] = sampled[1] ?? out[1] ?? 1
    out[2] = sampled[2] ?? out[2] ?? 1
    out[3] = sampled[3] ?? out[3] ?? 1
  }
  if (alphaKeys?.length) out[3] = sampleNumber(alphaKeys, normalizedTime, out[3] ?? 1)
  return out
}

const UNITY_BLEND_SRC_FACTORS: Record<number, THREE.BlendingSrcFactor> = {
  0: THREE.ZeroFactor,
  1: THREE.OneFactor,
  2: THREE.DstColorFactor,
  3: THREE.SrcColorFactor,
  4: THREE.OneMinusDstColorFactor,
  5: THREE.SrcAlphaFactor,
  6: THREE.OneMinusSrcColorFactor,
  7: THREE.DstAlphaFactor,
  8: THREE.OneMinusDstAlphaFactor,
  9: THREE.SrcAlphaSaturateFactor,
  10: THREE.OneMinusSrcAlphaFactor,
}

const UNITY_BLEND_DST_FACTORS: Record<number, THREE.BlendingDstFactor> = {
  0: THREE.ZeroFactor,
  1: THREE.OneFactor,
  2: THREE.DstColorFactor,
  3: THREE.SrcColorFactor,
  4: THREE.OneMinusDstColorFactor,
  5: THREE.SrcAlphaFactor,
  6: THREE.OneMinusSrcColorFactor,
  7: THREE.DstAlphaFactor,
  8: THREE.OneMinusDstAlphaFactor,
  10: THREE.OneMinusSrcAlphaFactor,
}

function makeRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function randomBetween(min: number, max: number, random: () => number) {
  return min + (max - min) * random()
}

function curveScalarRandom(value: CurveValue | undefined, fallback: number, normalizedTime: number, random: () => number) {
  if (!value) return fallback
  const state = Number(value.state ?? 0)
  if (state === 3) {
    return randomBetween(Number(value.minScalar ?? value.scalar ?? fallback), Number(value.scalar ?? fallback), random)
  }
  if (state === 2 && value.minCurve?.length && value.maxCurve?.length) {
    return randomBetween(
      sampleNumber(value.minCurve, normalizedTime, Number(value.minScalar ?? fallback)),
      sampleNumber(value.maxCurve, normalizedTime, Number(value.scalar ?? fallback)),
      random,
    )
  }
  return curveScalar(value, fallback, normalizedTime)
}

function materialVector(emitter: CinematicParticleEmitter, key: string) {
  const value = emitter.materials?.[0]?.colors?.[key]
  return Array.isArray(value) ? value : undefined
}

function materialFloat(emitter: CinematicParticleEmitter, key: string, fallback: number) {
  const value = emitter.materials?.[0]?.floats?.[key]
  return typeof value === "number" ? value : fallback
}

function eulerDegreesQuaternion(value: number[] | undefined) {
  if (!value?.length) return new THREE.Quaternion()
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(value[0] ?? 0),
      THREE.MathUtils.degToRad(value[1] ?? 0),
      THREE.MathUtils.degToRad(value[2] ?? 0),
      "XYZ",
    ),
  )
}

function buildCameraTrackMap(manifest: SkillSceneManifest, cinematic: CinematicManifest | null) {
  const out = new Map<string, CameraTrack>()
  const tracks = manifest.cameraTracks
  if (Array.isArray(tracks)) {
    for (const track of tracks) out.set(track.name, track)
  } else if (tracks) {
    for (const [name, track] of Object.entries(tracks)) out.set(name, { name, ...track })
  }
  const fovTracks = cinematic?.timeline?.fovTracks
  if (fovTracks) {
    for (const [name, fieldOfView] of Object.entries(fovTracks)) {
      const existing = out.get(name)
      out.set(name, { name, ...existing, fieldOfView })
    }
  }
  return out
}

function buildSegments(scene: SkillSceneManifestScene, animations: THREE.AnimationClip[], cinematic: CinematicManifest | null) {
  const durationByName = new Map(animations.map(clip => [clip.name, clip.duration]))
  const timeline = cinematic?.timeline
  let cursor = 0
  const segments = scene.clips.map(clip => {
    const timelineStart = timeline?.cutStarts?.[clip]
    const timelineDuration = timeline?.cutDurations?.[clip]
    const duration = Math.max(0.05, Number(timelineDuration ?? durationByName.get(clip) ?? 1))
    const start = Number.isFinite(timelineStart) ? Number(timelineStart) : cursor
    cursor = start + duration
    return { clip, start, duration }
  }).sort((a, b) => a.start - b.start)

  const end = segments.reduce((max, segment) => Math.max(max, segment.start + segment.duration), 0)
  return {
    segments,
    total: Math.max(0.1, Math.min(Number(timeline?.duration ?? end), end || Number(timeline?.duration ?? 0.1))),
  }
}

function findSegment(segments: Segment[], time: number) {
  if (!segments.length) return null
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i]
    if (time >= segment.start) return segment
  }
  return segments[0]
}

function activeClipForEmitter(clips: TimelineClip[], time: number) {
  return clips.find(clip => time >= clip.start && time <= clip.start + Math.max(0.01, clip.duration))
}

function buildParticleClipMap(cinematic: CinematicManifest | null) {
  const map = new Map<string, TimelineClip[]>()
  const tracks = cinematic?.timeline?.tracks ?? []
  for (const track of tracks) {
    for (const clip of track.clips ?? []) {
      const names = new Set([clip.name])
      if (track.name) names.add(track.name)
      for (const name of names) {
        const list = map.get(name) ?? []
        list.push(clip)
        map.set(name, list)
      }
    }
  }

  const cutStarts = cinematic?.timeline?.cutStarts ?? {}
  const cutDurations = cinematic?.timeline?.cutDurations ?? {}
  for (const groupName of Object.keys(cinematic?.particleGroups ?? {})) {
    if (map.has(groupName)) continue
    const cutMatch = groupName.match(/_C(\d{2})(?:_|$)/)
    if (!cutMatch) continue
    const cutSuffix = `_Cut_${cutMatch[1]}`
    const cutName = Object.keys(cutStarts).find(name => name.endsWith(cutSuffix))
    if (!cutName) continue
    map.set(groupName, [{
      name: groupName,
      start: cutStarts[cutName] ?? 0,
      duration: cutDurations[cutName] ?? 1,
      track: cutName,
    }])
  }

  for (const clips of map.values()) clips.sort((a, b) => a.start - b.start)
  return map
}

function isTimelineTrackActive(
  cinematic: CinematicManifest | null,
  trackName: string | undefined,
  time: number,
  fallback: boolean,
) {
  if (!trackName) return true
  const track = cinematic?.timeline?.tracks?.find(item => item.name === trackName)
  if (!track) return fallback
  return track.clips.some(clip => time >= clip.start && time <= clip.start + Math.max(0.001, clip.duration))
}

function SkillSceneStage({
  url,
  activationTrack,
  defaultVisible = true,
  cinematic,
  playbackRef,
}: {
  url: string
  activationTrack?: string
  defaultVisible?: boolean
  cinematic: CinematicManifest | null
  playbackRef: MutableRefObject<PlaybackInfo>
}) {
  const { scene } = useGLTF(url)
  const { camera } = useThree()
  const root = useRef<THREE.Object3D>(null)

  useEffect(() => {
    scene.visible = activationTrack ? defaultVisible : true
    scene.traverse(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.frustumCulled = false
      mesh.receiveShadow = true
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        material.depthWrite = material.transparent ? false : material.depthWrite
        material.needsUpdate = true
      }
    })
    const bounds = new THREE.Box3().setFromObject(scene)
    if (!bounds.isEmpty()) {
      const sphere = bounds.getBoundingSphere(new THREE.Sphere())
      const neededFar = sphere.center.length() + sphere.radius + 20
      if (camera instanceof THREE.PerspectiveCamera && camera.far < neededFar) {
        camera.far = neededFar
        camera.updateProjectionMatrix()
      }
    }
  }, [activationTrack, camera, defaultVisible, scene])

  useFrame(() => {
    const object = root.current
    if (!object) return
    object.visible = isTimelineTrackActive(cinematic, activationTrack, playbackRef.current.time, defaultVisible)
  })

  return <primitive ref={root} object={scene} />
}

function SkillSceneActor({
  url,
  sceneDef,
  manifest,
  cinematic,
  visibility,
  playing,
  playbackSpeed,
  seekTime,
  cameraLocked,
  restartToken,
  playbackRef,
  onPlaybackUpdate,
}: {
  url: string
  sceneDef: SkillSceneManifestScene
  manifest: SkillSceneManifest
  cinematic: CinematicManifest | null
  visibility: VisibilityData
  playing: boolean
  playbackSpeed: number
  seekTime: number | null
  cameraLocked: boolean
  restartToken: number
  playbackRef: MutableRefObject<PlaybackInfo>
  onPlaybackUpdate: (info: PlaybackInfo) => void
}) {
  const { scene, animations } = useGLTF(url)
  const { camera } = useThree()
  const { actions, mixer } = useAnimations(animations, scene)
  const meshes = useMemo(() => {
    const out: Record<string, THREE.Object3D> = {}
    scene.traverse(object => {
      const isMesh = (object as THREE.Mesh).isMesh || (object as THREE.SkinnedMesh).isSkinnedMesh
      if (isMesh) {
        out[object.name] = object
        ;(object as THREE.Mesh).frustumCulled = false
      }
    })
    return out
  }, [scene])
  const { segments, total } = useMemo(
    () => buildSegments(sceneDef, animations, cinematic),
    [animations, cinematic, sceneDef],
  )
  const cameraTracks = useMemo(() => buildCameraTrackMap(manifest, cinematic), [manifest, cinematic])
  const elapsedRef = useRef(0)
  const activeClipRef = useRef("")
  const activeActionRef = useRef<THREE.AnimationAction | null>(null)
  const lastUiUpdateRef = useRef(0)
  const position = useMemo(() => new THREE.Vector3(), [])
  const rotation = useMemo(() => new THREE.Quaternion(), [])
  const fallbackPosition = useMemo(() => new THREE.Vector3(0, 1.4, 5.5), [])
  const fallbackRotation = useMemo(() => new THREE.Quaternion(), [])

  const resetVisibility = useCallback(() => {
    for (const name in meshes) {
      const defaultValue = visibility.defaults?.[name]
      meshes[name].visible = defaultValue === undefined ? true : defaultValue
    }
  }, [meshes, visibility])

  useEffect(() => {
    elapsedRef.current = 0
    activeClipRef.current = ""
    activeActionRef.current?.stop()
    activeActionRef.current = null
    Object.values(actions).forEach(action => action?.stop())
    resetVisibility()
    playbackRef.current = { time: 0, total, clip: sceneDef.clips[0] ?? "" }
    onPlaybackUpdate(playbackRef.current)
  }, [actions, onPlaybackUpdate, playbackRef, resetVisibility, restartToken, sceneDef.clips, total])

  useEffect(() => {
    resetVisibility()
  }, [resetVisibility])

  useEffect(() => {
    if (seekTime === null || !Number.isFinite(seekTime) || total <= 0) return
    elapsedRef.current = Math.min(Math.max(0, seekTime), total - 0.001)
    lastUiUpdateRef.current = 0
  }, [seekTime, total])

  useFrame((state, delta) => {
    if (!segments.length) return
    if (playing) {
      elapsedRef.current = (elapsedRef.current + delta * playbackSpeed) % total
    }

    const elapsed = elapsedRef.current
    const segment = findSegment(segments, elapsed)
    if (!segment) return
    const localTime = Math.min(Math.max(0, elapsed - segment.start), segment.duration)

    if (segment.clip !== activeClipRef.current) {
      activeActionRef.current?.stop()
      Object.entries(actions).forEach(([name, action]) => {
        if (name !== segment.clip) action?.stop()
      })
      const nextAction = actions[segment.clip]
      if (nextAction) {
        nextAction.reset()
        nextAction.setLoop(THREE.LoopOnce, 1)
        nextAction.clampWhenFinished = true
        nextAction.enabled = true
        nextAction.play()
        activeActionRef.current = nextAction
      }
      activeClipRef.current = segment.clip
      resetVisibility()
    }

    const action = actions[segment.clip]
    if (action) {
      action.paused = true
      action.enabled = true
      action.setEffectiveWeight(1)
      action.time = Math.min(localTime, action.getClip().duration)
      mixer.update(0)
    }

    const clipVisibility = visibility.tracks?.[segment.clip]
    if (clipVisibility) {
      for (const meshName in clipVisibility) {
        const mesh = meshes[meshName]
        if (!mesh) continue
        mesh.visible = evaluateVisibilityTrack(clipVisibility[meshName], localTime) >= 0.5
      }
    }

    if (cameraLocked) {
      const track = cameraTracks.get(segment.clip)
      const nextPosition = sampleVec3(track?.position, localTime, fallbackPosition, position)
      camera.position.copy(nextPosition)
      if (track?.rotation?.length) {
        camera.quaternion.copy(sampleQuat(track.rotation, localTime, fallbackRotation, rotation))
      } else {
        camera.lookAt(0, 1, 0)
      }
      const fov = sampleNumber(track?.fieldOfView, localTime, 35)
      if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
    }

    const info = { time: elapsed, total, clip: segment.clip }
    playbackRef.current = info
    if (state.clock.elapsedTime - lastUiUpdateRef.current > 0.08) {
      lastUiUpdateRef.current = state.clock.elapsedTime
      onPlaybackUpdate(info)
    }
  })

  return <primitive object={scene} />
}

function emitterColor(emitter: CinematicParticleEmitter, normalizedTime: number) {
  const materialColor = emitter.materials?.[0]?.colors?._Color ?? emitter.materials?.[0]?.colors?._BaseColor
  const startColor = gradientColor(emitter.particle?.startColor, normalizedTime, materialColor ?? [1, 1, 1, 1])
  const overLifetime = emitter.colorOverLifetime?.enabled
    ? gradientColor(emitter.colorOverLifetime.gradient, normalizedTime, startColor)
    : startColor
  return overLifetime
}

function materialBlendPair(emitter: CinematicParticleEmitter) {
  const floats = emitter.materials?.[0]?.floats ?? {}
  const shader = shaderName(emitter).toLowerCase()
  if (shader.startsWith("tempestvfx/vfxdefault") || shader.includes("vfx_electrical")) {
    return {
      src: Number(floats._Src ?? 5),
      dst: Number(floats._Dst ?? 1),
    }
  }
  if (shader.includes("vfxdistortion") || shader.includes("vfxscreensubtract")) {
    return { src: 5, dst: 10 }
  }
  return {
    src: Number(floats._Src ?? floats._SrcBlend ?? NaN),
    dst: Number(floats._Dst ?? floats._DstBlend ?? NaN),
  }
}

function materialBlending(emitter: CinematicParticleEmitter) {
  const { src: srcBlend, dst: dstBlend } = materialBlendPair(emitter)
  const role = (emitter.role ?? "").toLowerCase()
  const shader = (emitter.materials?.[0]?.shader ?? "").toLowerCase()
  if (srcBlend === 5 && dstBlend === 10) return THREE.NormalBlending
  if (dstBlend === 1 || (srcBlend === 1 && dstBlend === 1)) return THREE.AdditiveBlending
  if (shader.includes("rock_opaque")) return THREE.NormalBlending
  if (shader.startsWith("tempestvfx/") && isAlphaOnlyPrimaryTexture(emitter)) return THREE.AdditiveBlending
  if (role.includes("smoke") || role.includes("dust") || role.includes("wind") || role.includes("water")) {
    return THREE.NormalBlending
  }
  return colorScale(emitter) > 2.5 ? THREE.AdditiveBlending : THREE.NormalBlending
}

function applyUnityBlendFactors(material: THREE.Material, emitter: CinematicParticleEmitter) {
  const { src, dst } = materialBlendPair(emitter)
  const blendSrc = UNITY_BLEND_SRC_FACTORS[src]
  const blendDst = UNITY_BLEND_DST_FACTORS[dst]
  if (blendSrc === undefined || blendDst === undefined) return
  if (!(src === 5 && dst === 10)) return
  if (materialBlending(emitter) !== THREE.NormalBlending) return
  material.blending = THREE.CustomBlending
  material.blendSrc = blendSrc
  material.blendDst = blendDst
  material.blendEquation = THREE.AddEquation
}

function materialSide(emitter: CinematicParticleEmitter) {
  const floats = emitter.materials?.[0]?.floats ?? {}
  const shader = shaderName(emitter).toLowerCase()
  const cull = shader.startsWith("tempestvfx/")
    ? Number(floats._CullMode ?? 0)
    : Number(floats._Cull ?? 2)
  return cull === 0 ? THREE.DoubleSide : THREE.FrontSide
}

function materialDepthWrite(emitter: CinematicParticleEmitter) {
  const shader = (emitter.materials?.[0]?.shader ?? "").toLowerCase()
  if (!shader.includes("rock_opaque")) return false
  return Number(emitter.materials?.[0]?.floats?._ZWrite ?? 0) !== 0
}

function colorScale(emitter: CinematicParticleEmitter) {
  return Math.max(0, Number(emitter.materials?.[0]?.floats?._ColorScale ?? 1))
}

function alphaScale(emitter: CinematicParticleEmitter) {
  return Math.max(0, materialFloat(emitter, "_Alpha_Scale", 1))
}

function colorParams(emitter: CinematicParticleEmitter) {
  return new THREE.Vector4(
    materialFloat(emitter, "_ColorPower", 1),
    materialFloat(emitter, "_ColorSaturate", 1),
    materialFloat(emitter, "_ColorRemapMin", 0),
    Math.max(materialFloat(emitter, "_ColorRemapMax", 1), materialFloat(emitter, "_ColorRemapMin", 0) + 0.001),
  )
}

function distortionParams(emitter: CinematicParticleEmitter) {
  return new THREE.Vector4(
    materialFloat(emitter, "_TDColorScale", 0) + materialFloat(emitter, "_DistortionScale", 0),
    materialFloat(emitter, "_TDAlphaScale", 0),
    materialFloat(emitter, "_VertexOffset_Scale", 0),
    materialFloat(emitter, "_TDDissolveScale", 0),
  )
}

function dissolveParams(emitter: CinematicParticleEmitter) {
  const switchValue = Math.max(
    materialFloat(emitter, "_DissolveSwitch", 0),
    materialFloat(emitter, "_DissolveAlphaSwitch", 0),
    materialFloat(emitter, "_TDColorDissolveSwitch", 0),
  )
  return new THREE.Vector4(
    switchValue,
    materialFloat(emitter, "_DissolveLength", 0),
    materialFloat(emitter, "_DissolveEggeColorScale", 0),
    materialFloat(emitter, "_DissolveRotator", 0),
  )
}

function fresnelParams(emitter: CinematicParticleEmitter) {
  return new THREE.Vector4(
    Math.max(materialFloat(emitter, "_FresnelColorSwitch", 0), materialFloat(emitter, "_FresnelAlphaSwitch", 0)),
    materialFloat(emitter, "_FresnelColorScale", 0),
    materialFloat(emitter, "_FresnelColorPower", 0),
    materialFloat(emitter, "_FresnelAlphaScale", 1),
  )
}

function materialColor(emitter: CinematicParticleEmitter, name: string, fallback: [number, number, number, number]) {
  const value = emitter.materials?.[0]?.colors?.[name]
  return new THREE.Vector4(value?.[0] ?? fallback[0], value?.[1] ?? fallback[1], value?.[2] ?? fallback[2], value?.[3] ?? fallback[3])
}

function particleLocalTime(emitter: CinematicParticleEmitter, clip: TimelineClip, timelineTime: number) {
  const startDelay = Math.max(0, curveScalar(emitter.particle?.startDelay, 0))
  const raw = timelineTime - clip.start - startDelay
  if (raw < 0) return null
  const particleDuration = Math.max(0.01, emitter.particle?.lengthInSec ?? emitter.duration ?? clip.duration)
  if (emitter.particle?.looping) return raw % particleDuration
  if (raw > Math.max(clip.duration, particleDuration)) return null
  return raw
}

function particleFrame(emitter: CinematicParticleEmitter, clips: TimelineClip[], timelineTime: number) {
  const active = activeClipForEmitter(clips, timelineTime)
  if (!active) return null

  const local = particleLocalTime(emitter, active, timelineTime)
  if (local === null) return null

  const lifetime = Math.max(0.01, emitter.startLifetime ?? curveScalar(emitter.particle?.startLifetime, active.duration))
  const normalized = clamp01(local / lifetime)
  const sizeCurve = emitter.sizeOverLifetime?.enabled ? curveScalar(emitter.sizeOverLifetime.curve, 1, normalized) : 1
  const baseSize = Math.max(0.0001, curveScalar(emitter.particle?.startSize, 1, 0))
  const sizeY = emitter.particle?.size3D
    ? Math.max(0.0001, curveScalar(emitter.particle?.startSizeY, baseSize, 0))
    : baseSize
  const sizeZ = emitter.particle?.size3D
    ? Math.max(0.0001, curveScalar(emitter.particle?.startSizeZ, baseSize, 0))
    : baseSize
  const worldScale = emitter.worldScale ?? [1, 1, 1]
  const color = emitterColor(emitter, normalized)
  const scale = colorScale(emitter)
  const alpha = alphaScale(emitter)
  const rotation =
    curveScalar(emitter.particle?.startRotation, 0, 0) +
    (emitter.rotationOverLifetime?.enabled ? curveScalar(emitter.rotationOverLifetime.curve, 0, normalized) : 0)

  return {
    local,
    normalized,
    color: [
      Math.min(10, (color[0] ?? 1) * scale),
      Math.min(10, (color[1] ?? 1) * scale),
      Math.min(10, (color[2] ?? 1) * scale),
      clamp01((color[3] ?? 1) * alpha),
    ],
    scale: new THREE.Vector3(
      Math.abs(worldScale[0] ?? 1) * baseSize * sizeCurve,
      Math.abs(worldScale[1] ?? 1) * sizeY * sizeCurve,
      Math.abs(worldScale[2] ?? 1) * sizeZ * sizeCurve,
    ),
    rotation,
  }
}

function configureTexture(texture: THREE.Texture, emitter: CinematicParticleEmitter) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = true
  const tiling = materialVector(emitter, "_ColorTilingOffset")
  texture.wrapS = emitter.textureSheet?.enabled || (tiling?.[0] ?? 1) !== 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  texture.wrapT = emitter.textureSheet?.enabled || (tiling?.[1] ?? 1) !== 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  if (tiling?.length) {
    texture.repeat.set(tiling[0] || 1, tiling[1] || 1)
    texture.offset.set(tiling[2] || 0, tiling[3] || 0)
  }
  const sheet = emitter.textureSheet
  if (sheet?.enabled) {
    texture.repeat.set(1 / Math.max(1, sheet.tilesX ?? 1), 1 / Math.max(1, sheet.tilesY ?? 1))
  }
  texture.needsUpdate = true
}

function updateTextureFrame(texture: THREE.Texture | null, emitter: CinematicParticleEmitter, normalized: number) {
  if (!texture) return
  const tiling = materialVector(emitter, "_ColorTilingOffset")
  const sheet = emitter.textureSheet
  if (!sheet?.enabled) {
    if (tiling?.length) {
      texture.offset.set(tiling?.[2] ?? 0, tiling?.[3] ?? 0)
    }
    return
  }
  const tilesX = Math.max(1, sheet.tilesX ?? 1)
  const tilesY = Math.max(1, sheet.tilesY ?? 1)
  const tileCount = tilesX * tilesY
  const start = curveScalar(sheet.startFrame, 0, 0)
  const frame = Math.floor(start + curveScalar(sheet.frameOverTime, 0, normalized) * Math.max(1, tileCount - 1)) % tileCount
  const x = frame % tilesX
  const y = Math.floor(frame / tilesX)
  texture.repeat.set(1 / tilesX, 1 / tilesY)
  texture.offset.set((tiling?.[2] ?? 0) + x / tilesX, (tiling?.[3] ?? 0) + 1 - (y + 1) / tilesY)
}

const particleFragmentShader = `
uniform sampler2D map;
uniform sampler2D distortionMap;
uniform sampler2D alphaMap;
uniform bool hasMap;
uniform bool hasDistortionMap;
uniform bool hasAlphaMap;
uniform vec4 tintColor;
uniform vec4 colorParams;
uniform vec4 distortionParams;
uniform vec4 dissolveParams;
uniform vec4 fresnelParams;
uniform vec4 dissolveEdgeColor;
uniform vec4 fresnelColor;
uniform vec4 colorSpeed;
uniform vec4 distortionSpeed;
uniform float localTime;
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
void main() {
  vec2 uv = vUv;
  vec2 distortionUv = vUv + distortionSpeed.xy * localTime;
  float distortionNoise = hasDistortionMap ? texture2D(distortionMap, distortionUv).r : 1.0;
  if (hasDistortionMap) {
    vec2 distortion = texture2D(distortionMap, distortionUv).rg * 2.0 - 1.0;
    uv += distortion * (distortionParams.x + distortionParams.y + distortionParams.z) * 0.025;
  }
  uv += colorSpeed.xy * localTime;
  vec4 texel = hasMap ? texture2D(map, uv) : vec4(1.0);
  float alphaMask = hasAlphaMap ? texture2D(alphaMap, uv).r : 1.0;
  float luminanceAlpha = max(max(texel.r, texel.g), texel.b);
  vec3 remapped = clamp((texel.rgb - vec3(colorParams.z)) / max(0.001, colorParams.w - colorParams.z), 0.0, 1.0);
  float gray = dot(remapped, vec3(0.299, 0.587, 0.114));
  remapped = mix(vec3(gray), remapped, max(0.0, colorParams.y));
  remapped = pow(max(remapped, vec3(0.0)), vec3(max(0.001, colorParams.x)));
  float dissolve = 1.0;
  if (dissolveParams.x > 0.5 && dissolveParams.y > 0.001) {
    float width = max(0.03, min(0.24, dissolveParams.y));
    dissolve = mix(1.0, smoothstep(0.02, width, distortionNoise), 0.35);
    float edge = smoothstep(width, width + 0.08, distortionNoise) - smoothstep(width + 0.08, width + 0.16, distortionNoise);
    remapped += dissolveEdgeColor.rgb * edge * dissolveParams.z;
  }
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDir = normalize(vViewDir);
  float viewFresnel = pow(clamp(1.0 - abs(dot(normal, viewDir)), 0.0, 1.0), max(0.25, fresnelParams.z));
  vec2 centeredUv = vUv * 2.0 - 1.0;
  float uvFresnel = smoothstep(0.45, 1.15, length(centeredUv));
  float fresnel = max(viewFresnel, uvFresnel) * fresnelParams.x;
  remapped += fresnelColor.rgb * fresnel * fresnelParams.y;
  float alpha = texel.a * luminanceAlpha * alphaMask * tintColor.a * dissolve;
  alpha += fresnel * fresnelParams.w * 0.08;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(remapped * tintColor.rgb, clamp(alpha, 0.0, 1.0));
}
`

const particleInstancedFragmentShader = `
uniform sampler2D map;
uniform sampler2D distortionMap;
uniform sampler2D alphaMap;
uniform bool hasMap;
uniform bool hasDistortionMap;
uniform bool hasAlphaMap;
uniform vec4 colorParams;
uniform vec4 distortionParams;
uniform vec4 dissolveParams;
uniform vec4 fresnelParams;
uniform vec4 dissolveEdgeColor;
uniform vec4 fresnelColor;
uniform vec4 colorSpeed;
uniform vec4 distortionSpeed;
uniform float localTime;
varying vec2 vUv;
varying vec4 vParticleColor;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
void main() {
  vec2 uv = vUv;
  vec2 distortionUv = vUv + distortionSpeed.xy * localTime;
  float distortionNoise = hasDistortionMap ? texture2D(distortionMap, distortionUv).r : 1.0;
  if (hasDistortionMap) {
    vec2 distortion = texture2D(distortionMap, distortionUv).rg * 2.0 - 1.0;
    uv += distortion * (distortionParams.x + distortionParams.y + distortionParams.z) * 0.025;
  }
  uv += colorSpeed.xy * localTime;
  vec4 texel = hasMap ? texture2D(map, uv) : vec4(1.0);
  float alphaMask = hasAlphaMap ? texture2D(alphaMap, uv).r : 1.0;
  float luminanceAlpha = max(max(texel.r, texel.g), texel.b);
  vec3 remapped = clamp((texel.rgb - vec3(colorParams.z)) / max(0.001, colorParams.w - colorParams.z), 0.0, 1.0);
  float gray = dot(remapped, vec3(0.299, 0.587, 0.114));
  remapped = mix(vec3(gray), remapped, max(0.0, colorParams.y));
  remapped = pow(max(remapped, vec3(0.0)), vec3(max(0.001, colorParams.x)));
  float dissolve = 1.0;
  if (dissolveParams.x > 0.5 && dissolveParams.y > 0.001) {
    float width = max(0.03, min(0.24, dissolveParams.y));
    dissolve = mix(1.0, smoothstep(0.02, width, distortionNoise), 0.35);
    float edge = smoothstep(width, width + 0.08, distortionNoise) - smoothstep(width + 0.08, width + 0.16, distortionNoise);
    remapped += dissolveEdgeColor.rgb * edge * dissolveParams.z;
  }
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDir = normalize(vViewDir);
  float viewFresnel = pow(clamp(1.0 - abs(dot(normal, viewDir)), 0.0, 1.0), max(0.25, fresnelParams.z));
  vec2 centeredUv = vUv * 2.0 - 1.0;
  float uvFresnel = smoothstep(0.45, 1.15, length(centeredUv));
  float fresnel = max(viewFresnel, uvFresnel) * fresnelParams.x;
  remapped += fresnelColor.rgb * fresnel * fresnelParams.y;
  float alpha = texel.a * luminanceAlpha * alphaMask * vParticleColor.a * dissolve;
  alpha += fresnel * fresnelParams.w * 0.08;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(remapped * vParticleColor.rgb, clamp(alpha, 0.0, 1.0));
}
`

function configureParticleMaterial(material: THREE.Material, emitter: CinematicParticleEmitter) {
  material.transparent = true
  material.depthWrite = materialDepthWrite(emitter)
  material.depthTest = true
  material.blending = materialBlending(emitter)
  material.side = materialSide(emitter)
  material.toneMapped = false
  applyUnityBlendFactors(material, emitter)
}

function particleUniforms(
  texture: THREE.Texture | null,
  distortionTexture: THREE.Texture | null,
  alphaTexture: THREE.Texture | null,
  emitter: CinematicParticleEmitter,
) {
  const colorSpeedValue = materialVector(emitter, "_ColorSpeed") ?? [0, 0, 0, 0]
  const distortionSpeedValue = materialVector(emitter, "_TDColorSpeed") ?? materialVector(emitter, "_TDTextureDistotionSpeed") ?? [0, 0, 0, 0]
  return {
    map: { value: texture },
    distortionMap: { value: distortionTexture },
    alphaMap: { value: alphaTexture },
    hasMap: { value: Boolean(texture) },
    hasDistortionMap: { value: Boolean(distortionTexture) },
    hasAlphaMap: { value: Boolean(alphaTexture) },
    tintColor: { value: new THREE.Vector4(1, 1, 1, 0) },
    colorParams: { value: colorParams(emitter) },
    distortionParams: { value: distortionParams(emitter) },
    dissolveParams: { value: dissolveParams(emitter) },
    fresnelParams: { value: fresnelParams(emitter) },
    dissolveEdgeColor: { value: materialColor(emitter, "_DissolveEggeColor", [1, 1, 1, 0]) },
    fresnelColor: { value: materialColor(emitter, "_FresnelColor", [1, 1, 1, 0]) },
    colorSpeed: { value: new THREE.Vector4(colorSpeedValue[0] ?? 0, colorSpeedValue[1] ?? 0, colorSpeedValue[2] ?? 0, colorSpeedValue[3] ?? 0) },
    distortionSpeed: { value: new THREE.Vector4(distortionSpeedValue[0] ?? 0, distortionSpeedValue[1] ?? 0, distortionSpeedValue[2] ?? 0, distortionSpeedValue[3] ?? 0) },
    localTime: { value: 0 },
  }
}

function makeParticleMaterial(
  texture: THREE.Texture | null,
  distortionTexture: THREE.Texture | null,
  alphaTexture: THREE.Texture | null,
  emitter: CinematicParticleEmitter,
) {
  const material = new THREE.ShaderMaterial({
    uniforms: particleUniforms(texture, distortionTexture, alphaTexture, emitter),
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = cameraPosition - worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: particleFragmentShader,
  })
  configureParticleMaterial(material, emitter)
  return material
}

function makeInstancedParticleMaterial(
  texture: THREE.Texture | null,
  distortionTexture: THREE.Texture | null,
  alphaTexture: THREE.Texture | null,
  emitter: CinematicParticleEmitter,
) {
  const material = new THREE.ShaderMaterial({
    uniforms: particleUniforms(texture, distortionTexture, alphaTexture, emitter),
    vertexShader: `
      attribute vec4 instanceParticleColor;
      varying vec2 vUv;
      varying vec4 vParticleColor;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vParticleColor = instanceParticleColor;
        vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vViewDir = cameraPosition - worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: particleInstancedFragmentShader,
  })
  configureParticleMaterial(material, emitter)
  return material
}

type ParticleEmitterProps = {
  emitter: CinematicParticleEmitter
  clips: TimelineClip[]
  playbackRef: MutableRefObject<PlaybackInfo>
  textureUrl?: string
  distortionUrl?: string
  alphaMaskUrl?: string
  meshUrl?: string
  useLocalTransform?: boolean
}

type ParticleSeed = {
  spawnTime: number
  lifetime: number
  size: number
  sizeY: number
  sizeZ: number
  rotation: number
  offset: THREE.Vector3
  velocity: THREE.Vector3
}

function visualParticleLimit(emitter: CinematicParticleEmitter) {
  const requested = Math.max(1, Number(emitter.particle?.maxParticles ?? 128))
  if (emitter.renderer?.renderMode === 4) return Math.min(requested, 72)
  return Math.min(requested, 1200)
}

function shapeOffset(emitter: CinematicParticleEmitter, random: () => number) {
  const shape = emitter.shape
  const offset = new THREE.Vector3()
  if (!shape?.enabled) return offset
  const scale = shape.scale ?? [1, 1, 1]
  const radius = Math.max(0, Number(shape.radius ?? 0) || 0)
  const type = Number(shape.type ?? 0)
  if (type === 5) {
    offset.set((random() - 0.5) * (scale[0] ?? 1), (random() - 0.5) * (scale[1] ?? 1), (random() - 0.5) * (scale[2] ?? 1))
  } else if (type === 10 || type === 11) {
    const angle = random() * Math.PI * 2
    const r = type === 11 ? radius : Math.sqrt(random()) * radius
    offset.set(Math.cos(angle) * r * (scale[0] ?? 1), 0, Math.sin(angle) * r * (scale[2] ?? 1))
  } else {
    const theta = random() * Math.PI * 2
    const z = randomBetween(type === 2 || type === 3 ? 0 : -1, 1, random)
    const r = Math.sqrt(Math.max(0, 1 - z * z)) * Math.cbrt(random()) * radius
    offset.set(Math.cos(theta) * r * (scale[0] ?? 1), z * radius * (scale[1] ?? 1), Math.sin(theta) * r * (scale[2] ?? 1))
  }
  const shapePosition = shape.position ?? [0, 0, 0]
  offset.add(new THREE.Vector3(shapePosition[0] ?? 0, shapePosition[1] ?? 0, shapePosition[2] ?? 0))
  offset.applyQuaternion(eulerDegreesQuaternion(shape.rotation))
  return offset
}

function buildParticleSeeds(emitter: CinematicParticleEmitter, clips: TimelineClip[]) {
  const maxDuration = Math.max(0.1, ...clips.map(clip => clip.duration))
  const duration = Math.max(0.05, emitter.particle?.lengthInSec ?? emitter.duration ?? maxDuration)
  const seedBase = Number(emitter.particle?.randomSeed || 0) || hashString(`${emitter.path ?? emitter.name}:${emitter.primaryTexture ?? ""}`)
  const random = makeRandom(seedBase)
  const seeds: ParticleSeed[] = []
  const limit = visualParticleLimit(emitter)
  const pushSeed = (spawnTime: number) => {
    if (seeds.length >= limit) return
    const lifetime = Math.max(0.02, curveScalarRandom(emitter.particle?.startLifetime, emitter.startLifetime ?? 1, 0, random))
    const size = Math.max(0.0001, curveScalarRandom(emitter.particle?.startSize, 1, 0, random))
    const sizeY = emitter.particle?.size3D ? Math.max(0.0001, curveScalarRandom(emitter.particle?.startSizeY, size, 0, random)) : size
    const sizeZ = emitter.particle?.size3D ? Math.max(0.0001, curveScalarRandom(emitter.particle?.startSizeZ, size, 0, random)) : size
    const offset = shapeOffset(emitter, random)
    const direction = offset.lengthSq() > 0.000001 ? offset.clone().normalize() : new THREE.Vector3(0, 1, 0)
    const startSpeed = curveScalarRandom(emitter.particle?.startSpeed, emitter.startSpeed ?? 0, 0, random)
    const velocity = direction.multiplyScalar(startSpeed)
    if (emitter.velocity?.enabled) {
      velocity.add(new THREE.Vector3(
        curveScalarRandom(emitter.velocity.x, 0, 0, random),
        curveScalarRandom(emitter.velocity.y, 0, 0, random),
        curveScalarRandom(emitter.velocity.z, 0, 0, random),
      ).multiplyScalar(curveScalar(emitter.velocity.speedModifier, 1, 0)))
    }
    seeds.push({
      spawnTime,
      lifetime,
      size,
      sizeY,
      sizeZ,
      rotation: curveScalarRandom(emitter.particle?.startRotation, 0, 0, random),
      offset,
      velocity,
    })
  }

  for (const burst of emitter.emission?.bursts ?? []) {
    const count = Math.max(0, Math.round(curveScalarRandom(burst.count, 0, 0, random)))
    const cycles = Math.max(1, Number((burst as { cycleCount?: number }).cycleCount ?? 1))
    const interval = Math.max(0, Number((burst as { repeatInterval?: number }).repeatInterval ?? 0))
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      for (let i = 0; i < count; i += 1) pushSeed(Number(burst.time ?? 0) + cycle * interval)
    }
  }

  if (emitter.emission?.enabled) {
    const rate = Math.max(0, curveScalar(emitter.emission.rateOverTime, 0, 0))
    if (rate > 0) {
      const step = 1 / rate
      for (let t = 0; t <= duration && seeds.length < limit; t += step) pushSeed(t)
    }
  }

  if (!seeds.length && (emitter.renderer?.mesh?.source || emitter.primaryTexture)) pushSeed(0)
  seeds.sort((a, b) => a.spawnTime - b.spawnTime)
  return { seeds, duration }
}

function particleActiveLocalTime(emitter: CinematicParticleEmitter, clips: TimelineClip[], timelineTime: number) {
  const active = activeClipForEmitter(clips, timelineTime)
  if (!active) return null
  const startDelay = Math.max(0, curveScalar(emitter.particle?.startDelay, 0))
  const raw = timelineTime - active.start - startDelay
  if (raw < 0) return null
  const duration = Math.max(0.05, emitter.particle?.lengthInSec ?? emitter.duration ?? active.duration)
  return {
    clip: active,
    local: emitter.particle?.looping ? raw % duration : raw,
    raw,
    duration,
  }
}

type ParticleMeshEmitterProps = ParticleEmitterProps & {
  meshUrl: string
}

function ParticleMeshEmitter({ emitter, clips, playbackRef, textureUrl: mapUrl, distortionUrl, alphaMaskUrl, meshUrl, useLocalTransform }: ParticleMeshEmitterProps) {
  const loadedObject = useLoader(OBJLoader, meshUrl)
  const loadedTexture = mapUrl ? useLoader(THREE.TextureLoader, mapUrl) : null
  const loadedDistortionTexture = distortionUrl ? useLoader(THREE.TextureLoader, distortionUrl) : null
  const loadedAlphaTexture = alphaMaskUrl ? useLoader(THREE.TextureLoader, alphaMaskUrl) : null
  const texture = useMemo(() => (loadedTexture ? loadedTexture.clone() : null), [loadedTexture])
  const distortionTexture = useMemo(() => (loadedDistortionTexture ? loadedDistortionTexture.clone() : null), [loadedDistortionTexture])
  const alphaTexture = useMemo(() => (loadedAlphaTexture ? loadedAlphaTexture.clone() : null), [loadedAlphaTexture])
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => {
    let found: THREE.BufferGeometry | null = null
    loadedObject.traverse(child => {
      const mesh = child as THREE.Mesh
      if (!found && mesh.isMesh) found = mesh.geometry.clone()
    })
    return found
  }, [loadedObject])
  const material = useMemo(() => makeInstancedParticleMaterial(texture, distortionTexture, alphaTexture, emitter), [alphaTexture, distortionTexture, emitter, texture])
  const { seeds } = useMemo(() => buildParticleSeeds(emitter, clips), [clips, emitter])
  const maxInstances = Math.max(1, seeds.length)
  const colorAttribute = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(maxInstances * 4), 4), [maxInstances])
  const basePosition = useMemo(
    () => new THREE.Vector3().fromArray(((useLocalTransform ? emitter.localPosition : emitter.worldPosition) ?? [0, 0, 0]) as [number, number, number]),
    [emitter.localPosition, emitter.worldPosition, useLocalTransform],
  )
  const baseRotation = useMemo(() => {
    const q = useLocalTransform ? [0, 0, 0, 1] : emitter.worldRotation ?? [0, 0, 0, 1]
    return new THREE.Quaternion(q[0] ?? 0, q[1] ?? 0, q[2] ?? 0, q[3] ?? 1).normalize()
  }, [emitter.worldRotation, useLocalTransform])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const position = useMemo(() => new THREE.Vector3(), [])
  const scale = useMemo(() => new THREE.Vector3(), [])
  const color = useMemo(() => new THREE.Vector4(), [])

  useEffect(() => {
    if (texture) configureTexture(texture, emitter)
    if (distortionTexture) configureTexture(distortionTexture, emitter)
    if (alphaTexture) configureTexture(alphaTexture, emitter)
  }, [alphaTexture, distortionTexture, emitter, texture])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.geometry.setAttribute("instanceParticleColor", colorAttribute)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    colorAttribute.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.renderOrder = Number(emitter.renderer?.sortingOrder ?? 0)
    return () => {
      material.dispose()
      geometry?.dispose()
      texture?.dispose()
      distortionTexture?.dispose()
      alphaTexture?.dispose()
    }
  }, [alphaTexture, colorAttribute, distortionTexture, emitter.renderer?.sortingOrder, geometry, material, texture])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || !seeds.length) return
    const active = particleActiveLocalTime(emitter, clips, playbackRef.current.time)
    if (!active) {
      mesh.visible = false
      return
    }

    let visible = 0
    const worldScale = (useLocalTransform ? emitter.localScale : emitter.worldScale) ?? [1, 1, 1]
    const rotationOverLifetime = emitter.rotationOverLifetime?.enabled
    const sizeOverLifetime = emitter.sizeOverLifetime?.enabled
    const simulationSpeed = Math.max(0.0001, Number(emitter.particle?.simulationSpeed ?? 1))
    for (const seed of seeds) {
      const age = (active.local - seed.spawnTime) * simulationSpeed
      if (age < 0 || age > seed.lifetime) continue
      const normalized = clamp01(age / seed.lifetime)
      const sizeCurve = sizeOverLifetime ? curveScalar(emitter.sizeOverLifetime?.curve, 1, normalized) : 1
      const rotation =
        seed.rotation +
        (rotationOverLifetime ? curveScalar(emitter.rotationOverLifetime?.curve, 0, normalized) * age : 0)
      const frameColor = emitterColor(emitter, normalized)
      const colorMultiplier = colorScale(emitter)
      color.set(
        Math.min(10, (frameColor[0] ?? 1) * colorMultiplier),
        Math.min(10, (frameColor[1] ?? 1) * colorMultiplier),
        Math.min(10, (frameColor[2] ?? 1) * colorMultiplier),
        clamp01((frameColor[3] ?? 1) * alphaScale(emitter)),
      )
      if (color.w <= 0.001) continue
      position.copy(basePosition).add(seed.offset).addScaledVector(seed.velocity, age)
      scale.set(
        Math.abs(worldScale[0] ?? 1) * seed.size * sizeCurve,
        Math.abs(worldScale[1] ?? 1) * seed.sizeY * sizeCurve,
        Math.abs(worldScale[2] ?? 1) * seed.sizeZ * sizeCurve,
      )
      dummy.position.copy(position)
      dummy.quaternion.copy(baseRotation)
      dummy.rotateZ(rotation)
      dummy.scale.copy(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(visible, dummy.matrix)
      colorAttribute.setXYZW(visible, color.x, color.y, color.z, color.w)
      visible += 1
      if (visible >= maxInstances) break
    }
    mesh.count = visible
    mesh.visible = visible > 0
    mesh.instanceMatrix.needsUpdate = true
    colorAttribute.needsUpdate = true
    material.uniforms.localTime.value = active.raw
    const sheetTime = active.local / Math.max(0.01, active.duration)
    updateTextureFrame(texture, emitter, sheetTime)
    updateTextureFrame(alphaTexture, emitter, sheetTime)
    updateTextureFrame(distortionTexture, emitter, sheetTime)
  })

  if (!geometry) return null
  return <instancedMesh ref={meshRef} args={[geometry, material, maxInstances]} />
}

function ParticleBillboardEmitter({ emitter, clips, playbackRef, textureUrl: mapUrl, distortionUrl, alphaMaskUrl, useLocalTransform }: ParticleEmitterProps) {
  const loadedTexture = mapUrl ? useLoader(THREE.TextureLoader, mapUrl) : null
  const loadedDistortionTexture = distortionUrl ? useLoader(THREE.TextureLoader, distortionUrl) : null
  const loadedAlphaTexture = alphaMaskUrl ? useLoader(THREE.TextureLoader, alphaMaskUrl) : null
  const texture = useMemo(() => (loadedTexture ? loadedTexture.clone() : null), [loadedTexture])
  const distortionTexture = useMemo(() => (loadedDistortionTexture ? loadedDistortionTexture.clone() : null), [loadedDistortionTexture])
  const alphaTexture = useMemo(() => (loadedAlphaTexture ? loadedAlphaTexture.clone() : null), [loadedAlphaTexture])
  const { camera } = useThree()
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { seeds } = useMemo(() => buildParticleSeeds(emitter, clips), [clips, emitter])
  const maxInstances = Math.max(1, seeds.length)
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const material = useMemo(() => makeInstancedParticleMaterial(texture, distortionTexture, alphaTexture, emitter), [alphaTexture, distortionTexture, emitter, texture])
  const basePosition = useMemo(
    () => new THREE.Vector3().fromArray(((useLocalTransform ? emitter.localPosition : emitter.worldPosition) ?? [0, 0, 0]) as [number, number, number]),
    [emitter.localPosition, emitter.worldPosition, useLocalTransform],
  )
  const baseRotation = useMemo(() => {
    const q = useLocalTransform ? [0, 0, 0, 1] : emitter.worldRotation ?? [0, 0, 0, 1]
    return new THREE.Quaternion(q[0] ?? 0, q[1] ?? 0, q[2] ?? 0, q[3] ?? 1).normalize()
  }, [emitter.worldRotation, useLocalTransform])
  const colorAttribute = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(maxInstances * 4), 4), [maxInstances])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const position = useMemo(() => new THREE.Vector3(), [])
  const scale = useMemo(() => new THREE.Vector3(), [])
  const billboardQuat = useMemo(() => new THREE.Quaternion(), [])
  const horizontalBillboardQuat = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0, "XYZ")), [])
  const verticalEuler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), [])
  const color = useMemo(() => new THREE.Vector4(), [])

  useEffect(() => {
    if (texture) configureTexture(texture, emitter)
    if (distortionTexture) configureTexture(distortionTexture, emitter)
    if (alphaTexture) configureTexture(alphaTexture, emitter)
    return () => {
      geometry.dispose()
      material.dispose()
      texture?.dispose()
      distortionTexture?.dispose()
      alphaTexture?.dispose()
    }
  }, [alphaTexture, distortionTexture, emitter, geometry, material, texture])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.geometry.setAttribute("instanceParticleColor", colorAttribute)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    colorAttribute.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.renderOrder = Number(emitter.renderer?.sortingOrder ?? 0)
  }, [colorAttribute, emitter.renderer?.sortingOrder])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || !seeds.length) return
    const active = particleActiveLocalTime(emitter, clips, playbackRef.current.time)
    if (!active) {
      mesh.visible = false
      return
    }
    let visible = 0
    const worldScale = (useLocalTransform ? emitter.localScale : emitter.worldScale) ?? [1, 1, 1]
    const rotationOverLifetime = emitter.rotationOverLifetime?.enabled
    const sizeOverLifetime = emitter.sizeOverLifetime?.enabled
    const simulationSpeed = Math.max(0.0001, Number(emitter.particle?.simulationSpeed ?? 1))
    for (const seed of seeds) {
      const age = (active.local - seed.spawnTime) * simulationSpeed
      if (age < 0 || age > seed.lifetime) continue
      const normalized = clamp01(age / seed.lifetime)
      const sizeCurve = sizeOverLifetime ? curveScalar(emitter.sizeOverLifetime?.curve, 1, normalized) : 1
      const rotation =
        seed.rotation +
        (rotationOverLifetime ? curveScalar(emitter.rotationOverLifetime?.curve, 0, normalized) * age : 0)
      const frameColor = emitterColor(emitter, normalized)
      const colorMultiplier = colorScale(emitter)
      color.set(
        Math.min(10, (frameColor[0] ?? 1) * colorMultiplier),
        Math.min(10, (frameColor[1] ?? 1) * colorMultiplier),
        Math.min(10, (frameColor[2] ?? 1) * colorMultiplier),
        clamp01((frameColor[3] ?? 1) * alphaScale(emitter)),
      )
      if (color.w <= 0.001) continue
      position.copy(basePosition).add(seed.offset).addScaledVector(seed.velocity, age)
      scale.set(
        Math.abs(worldScale[0] ?? 1) * seed.size * sizeCurve,
        Math.abs(worldScale[1] ?? 1) * seed.sizeY * sizeCurve,
        1,
      )
      if (emitter.renderer?.renderMode === 1) {
        scale.x *= Math.max(1, Number(emitter.renderer.lengthScale ?? 1))
      }
      if (emitter.renderer?.renderMode === 2) {
        billboardQuat.copy(baseRotation).multiply(horizontalBillboardQuat)
      } else if (emitter.renderer?.renderMode === 3) {
        verticalEuler.set(0, camera.rotation.y, 0)
        billboardQuat.setFromEuler(verticalEuler)
      } else if (emitter.renderer?.renderAlignment === 0) {
        billboardQuat.copy(camera.quaternion)
      } else {
        billboardQuat.copy(baseRotation)
      }
      dummy.position.copy(position)
      dummy.quaternion.copy(billboardQuat)
      dummy.rotateZ(rotation)
      dummy.scale.copy(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(visible, dummy.matrix)
      colorAttribute.setXYZW(visible, color.x, color.y, color.z, color.w)
      visible += 1
      if (visible >= maxInstances) break
    }
    mesh.count = visible
    mesh.visible = visible > 0
    mesh.instanceMatrix.needsUpdate = true
    colorAttribute.needsUpdate = true
    material.uniforms.localTime.value = active.raw
    const sheetTime = active.local / Math.max(0.01, active.duration)
    updateTextureFrame(texture, emitter, sheetTime)
    updateTextureFrame(alphaTexture, emitter, sheetTime)
    updateTextureFrame(distortionTexture, emitter, sheetTime)
  })

  if (!mapUrl && !alphaMaskUrl) return null
  return <instancedMesh ref={meshRef} args={[geometry, material, maxInstances]} />
}

function ParticleEmitter(props: ParticleEmitterProps) {
  if (props.emitter.renderer?.enabled === false) return null
  if (!props.textureUrl && !props.alphaMaskUrl && !props.meshUrl) return null
  if (props.meshUrl && props.emitter.renderer?.renderMode === 4) return <ParticleMeshEmitter {...props} meshUrl={props.meshUrl} />
  return <ParticleBillboardEmitter {...props} />
}

function targetTimelineTrackName(groupName: string) {
  if (!groupName.startsWith("VFX_Target_")) return ""
  return `VFXAnim_Target_${groupName.slice("VFX_Target_".length)}`
}

function activeTargetClip(cinematic: CinematicManifest, groupName: string, timelineTime: number) {
  const trackName = targetTimelineTrackName(groupName)
  if (!trackName) return null
  const tracks = cinematic.timeline?.tracks ?? []
  const track = tracks.find(item => item.name === trackName)
  if (!track) return null
  return activeClipForEmitter(track.clips ?? [], timelineTime)
}

function ParticleGroupTransform({
  cinematic,
  groupName,
  clips,
  playbackRef,
  children,
}: {
  cinematic: CinematicManifest
  groupName: string
  clips: TimelineClip[]
  playbackRef: MutableRefObject<PlaybackInfo>
  children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null)
  const position = useMemo(() => new THREE.Vector3(), [])
  const quaternion = useMemo(() => new THREE.Quaternion(), [])
  const scale = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const fallbackPosition = useMemo(() => new THREE.Vector3(), [])
  const fallbackRotation = useMemo(() => new THREE.Quaternion(), [])
  const fallbackScale = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  useFrame(() => {
    const group = ref.current
    if (!group) return
    const timelineTime = playbackRef.current.time
    const targetClip = activeTargetClip(cinematic, groupName, timelineTime)
    const directClip = activeClipForEmitter(clips, timelineTime)
    if (!targetClip || !cinematic.targetTracks?.[targetClip.name]) {
      group.position.set(0, 0, 0)
      group.quaternion.identity()
      group.scale.set(1, 1, 1)
      group.visible = Boolean(directClip)
      return
    }
    const track = cinematic.targetTracks[targetClip.name]
    const localTime = Math.max(0, timelineTime - targetClip.start)
    group.visible = true
    group.position.copy(sampleVec3(track.position, localTime, fallbackPosition, position))
    group.quaternion.copy(sampleQuat(track.rotation, localTime, fallbackRotation, quaternion))
    group.scale.copy(sampleVec3(track.scale, localTime, fallbackScale, scale))
  })

  return <group ref={ref}>{children}</group>
}

function CinematicParticles({
  cinematic,
  baseUrl,
  playbackRef,
}: {
  cinematic: CinematicManifest
  baseUrl: string
  playbackRef: MutableRefObject<PlaybackInfo>
}) {
  const clipMap = useMemo(() => buildParticleClipMap(cinematic), [cinematic])
  const groups = cinematic.particleGroups ?? {}

  return (
    <>
      {Object.entries(groups).flatMap(([groupName, emitters]) => {
        const clips = clipMap.get(groupName) ?? []
        if (!clips.length) return []
        const useLocalTransform = groupName.startsWith("VFX_Target_")
        return (
          <ParticleGroupTransform
            key={groupName}
            cinematic={cinematic}
            groupName={groupName}
            clips={clips}
            playbackRef={playbackRef}
          >
            {emitters.map((emitter, index) => {
              const alphaOnlyPrimary = isAlphaOnlyPrimaryTexture(emitter)
              const mainTextureName = alphaOnlyPrimary
                ? materialTextureName(emitter, ["_MainTex", "_BaseMap", "_Color", "_TintTex"])
                : emitter.primaryTexture
              const alphaTextureName =
                materialTextureName(emitter, ["_AlphaMask", "_MaskTex", "_Alpha"]) ||
                (alphaOnlyPrimary ? emitter.primaryTexture : "")
              const mapUrl = textureUrl(cinematic, baseUrl, mainTextureName)
              const distortionUrl = textureUrl(
                cinematic,
                baseUrl,
                materialTextureName(emitter, ["_TDTextureDistotion", "_Dissolve", "_NoiseTex", "_DistortionTex"]),
              )
              const alphaMaskUrl = textureUrl(cinematic, baseUrl, alphaTextureName)
              const meshSource = emitter.renderer?.renderMode === 4 ? emitter.renderer?.mesh?.source : undefined
              const meshUrl = meshSource ? `${baseUrl}/${meshSource}` : undefined
              const key = `${groupName}:${emitter.path ?? emitter.name}:${index}`
              return (
                <ParticleEmitter
                  key={key}
                  emitter={emitter}
                  clips={clips}
                  playbackRef={playbackRef}
                  textureUrl={mapUrl || undefined}
                  distortionUrl={distortionUrl || undefined}
                  alphaMaskUrl={alphaMaskUrl || undefined}
                  meshUrl={meshUrl}
                  useLocalTransform={useLocalTransform}
                />
              )
            })}
          </ParticleGroupTransform>
        )
      })}
    </>
  )
}

function trackWeight(cinematic: CinematicManifest, pattern: RegExp, time: number) {
  let weight = 0
  for (const track of cinematic.timeline?.tracks ?? []) {
    if (!pattern.test(track.name)) continue
    for (const clip of track.clips ?? []) {
      const start = Number(clip.start ?? 0)
      const duration = Math.max(0.001, Number(clip.duration ?? 0))
      const local = time - start
      if (local < 0 || local > duration) continue
      const fade = Math.min(0.18, duration * 0.35)
      const rampIn = fade > 0 ? clamp01(local / fade) : 1
      const rampOut = fade > 0 ? clamp01((duration - local) / fade) : 1
      weight = Math.max(weight, Math.min(rampIn, rampOut))
    }
  }
  return weight
}

function makePostShader() {
  return {
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      bloomStrength: { value: 0 },
      radialBlurStrength: { value: 0 },
      motionBlurStrength: { value: 0 },
      vignetteStrength: { value: 0 },
      tintStrength: { value: 0 },
      fogStrength: { value: 0 },
      colorCurveStrength: { value: 0 },
      gammaStrength: { value: 0 },
      lensDistortionStrength: { value: 0 },
      tintColor: { value: new THREE.Vector3(0.18, 0.28, 0.55) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float bloomStrength;
      uniform float radialBlurStrength;
      uniform float motionBlurStrength;
      uniform float vignetteStrength;
      uniform float tintStrength;
      uniform float fogStrength;
      uniform float colorCurveStrength;
      uniform float gammaStrength;
      uniform float lensDistortionStrength;
      uniform vec3 tintColor;
      varying vec2 vUv;

      vec3 sampleScene(vec2 uv) {
        vec2 centered = uv - 0.5;
        float r2 = dot(centered, centered);
        uv = uv + centered * r2 * lensDistortionStrength * 0.18;
        return texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
      }

      void main() {
        vec2 uv = vUv;
        vec3 color = sampleScene(uv);
        vec2 center = vec2(0.5, 0.48);

        vec3 radial = color;
        for (int i = 1; i <= 7; i++) {
          float t = float(i) / 7.0;
          radial += sampleScene(mix(uv, center, t * radialBlurStrength * 0.34));
        }
        color = mix(color, radial / 8.0, clamp(radialBlurStrength, 0.0, 1.0));

        vec2 motionStep = vec2(1.8, 0.35) / resolution * motionBlurStrength * 14.0;
        vec3 motion = color;
        motion += sampleScene(uv - motionStep);
        motion += sampleScene(uv + motionStep);
        color = mix(color, motion / 3.0, clamp(motionBlurStrength, 0.0, 1.0) * 0.55);

        vec3 bloom = vec3(0.0);
        vec2 px = 1.0 / resolution;
        for (int x = -2; x <= 2; x++) {
          for (int y = -2; y <= 2; y++) {
            vec3 tap = sampleScene(uv + vec2(float(x), float(y)) * px * 3.0);
            float bright = max(max(tap.r, tap.g), tap.b);
            bloom += tap * smoothstep(0.62, 1.35, bright);
          }
        }
        color += bloom / 25.0 * bloomStrength * 1.8;

        float luma = dot(color, vec3(0.299, 0.587, 0.114));
        vec3 curved = pow(max(color, vec3(0.0)), vec3(mix(1.0, 0.82, colorCurveStrength)));
        curved = mix(vec3(luma), curved, 1.0 + colorCurveStrength * 0.28);
        color = mix(color, curved, clamp(colorCurveStrength, 0.0, 1.0));
        color = pow(max(color, vec3(0.0)), vec3(mix(1.0, 0.92, gammaStrength)));

        float vignette = smoothstep(0.95, 0.22, distance(uv, center));
        color *= mix(1.0, vignette, clamp(vignetteStrength, 0.0, 1.0) * 0.78);
        color = mix(color, color * tintColor, tintStrength * 0.38);

        float fog = smoothstep(0.18, 0.78, 1.0 - uv.y) * fogStrength;
        color = mix(color, vec3(0.10, 0.16, 0.28), fog * 0.48);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  }
}

function CinematicPostProcess({
  cinematic,
  playbackRef,
}: {
  cinematic: CinematicManifest
  playbackRef: MutableRefObject<PlaybackInfo>
}) {
  const { gl, scene, camera, size } = useThree()
  const composer = useMemo(() => {
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
      type: THREE.UnsignedByteType,
    })
    renderTarget.texture.name = "SkillScenePost.rt"
    renderTarget.texture.colorSpace = THREE.SRGBColorSpace
    return new EffectComposer(gl, renderTarget)
  }, [gl])
  const shaderPass = useMemo(() => {
    const pass = new ShaderPass(makePostShader())
    pass.renderToScreen = true
    return pass
  }, [])

  useEffect(() => {
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)
    composer.addPass(shaderPass)
    return () => {
      composer.removePass(renderPass)
      composer.removePass(shaderPass)
      renderPass.dispose()
    }
  }, [camera, composer, scene, shaderPass])

  useEffect(() => {
    const dpr = gl.getPixelRatio()
    const width = Math.max(1, Math.floor(size.width * dpr))
    const height = Math.max(1, Math.floor(size.height * dpr))
    composer.setPixelRatio(dpr)
    composer.setSize(size.width, size.height)
    shaderPass.uniforms.resolution.value.set(width, height)
  }, [composer, gl, shaderPass, size.height, size.width])

  useEffect(() => () => composer.dispose(), [composer])

  useFrame(() => {
    if (playbackRef.current.total <= 1.01) {
      gl.render(scene, camera)
      return
    }
    const time = playbackRef.current.time
    shaderPass.uniforms.bloomStrength.value = trackWeight(cinematic, /Bloom/i, time) * 0.38
    shaderPass.uniforms.radialBlurStrength.value = trackWeight(cinematic, /RadialBlur/i, time) * 0.32
    shaderPass.uniforms.motionBlurStrength.value = trackWeight(cinematic, /MotionBlur/i, time) * 0.22
    shaderPass.uniforms.vignetteStrength.value = trackWeight(cinematic, /Vignette/i, time) * 0.55
    shaderPass.uniforms.tintStrength.value = trackWeight(cinematic, /Field Global Tint/i, time) * 0.35
    shaderPass.uniforms.fogStrength.value = trackWeight(cinematic, /Fog Activation/i, time)
    shaderPass.uniforms.colorCurveStrength.value = trackWeight(cinematic, /ColorCurves|Color_/i, time) * 0.35
    shaderPass.uniforms.gammaStrength.value = trackWeight(cinematic, /Gamma/i, time) * 0.35
    shaderPass.uniforms.lensDistortionStrength.value = trackWeight(cinematic, /LensDistortion/i, time) * 0.4
    composer.render()
  }, 1)

  return null
}

export default function SkillSceneThreePlayer({
  assets,
  manifest,
  scene,
  assetVersion,
}: {
  assets: SkillSceneAssets
  manifest: SkillSceneManifest
  scene: SkillSceneManifestScene
  assetVersion: number
}) {
  const [visibility, setVisibility] = useState<VisibilityData>({ defaults: {}, tracks: {} })
  const [cinematic, setCinematic] = useState<CinematicManifest | null>(null)
  const [playing, setPlaying] = useState(true)
  const [cameraLocked, setCameraLocked] = useState(true)
  const [fxEnabled, setFxEnabled] = useState(true)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [seekTime, setSeekTime] = useState<number | null>(null)
  const [restartToken, setRestartToken] = useState(0)
  const [playback, setPlayback] = useState<PlaybackInfo>({ time: 0, total: 1, clip: scene.clips[0] ?? "" })
  const playbackRef = useRef<PlaybackInfo>(playback)
  const cinematicBaseUrl = assets.cinematic ? dirname(assets.cinematic) : dirname(assets.glb)
  const skillGlbUrl = versionedUrl(assets.glb, assetVersion)
  const fieldLayers = useMemo(() => {
    if (assets.fieldLayers?.length) {
      return assets.fieldLayers.map(layer => ({
        ...layer,
        url: versionedUrl(layer.url, assetVersion),
      }))
    }
    const layers: SkillSceneFieldLayer[] = []
    if (assets.scene) {
      layers.push({
        url: versionedUrl(assets.scene, assetVersion),
        activationTrack: assets.sceneActivationTrack,
        defaultVisible: true,
      })
    }
    if (assets.battleField) {
      layers.push({
        url: versionedUrl(assets.battleField, assetVersion),
        activationTrack: assets.battleFieldActivationTrack,
        defaultVisible: false,
      })
    }
    return layers
  }, [
    assetVersion,
    assets.battleField,
    assets.battleFieldActivationTrack,
    assets.fieldLayers,
    assets.scene,
    assets.sceneActivationTrack,
  ])

  useEffect(() => {
    setVisibility({ defaults: {}, tracks: {} })
    if (!assets.visibility) return
    fetch(versionedUrl(assets.visibility, assetVersion), { cache: "no-store" })
      .then(response => (response.ok ? response.json() : null))
      .then(json => {
        if (!json) return
        if (json.defaults && json.tracks) setVisibility(json)
        else setVisibility({ defaults: {}, tracks: json })
      })
      .catch(() => setVisibility({ defaults: {}, tracks: {} }))
  }, [assetVersion, assets.visibility])

  useEffect(() => {
    setCinematic(null)
    if (!assets.cinematic) return
    fetch(versionedUrl(assets.cinematic, assetVersion), { cache: "no-store" })
      .then(response => (response.ok ? response.json() : null))
      .then(json => setCinematic(json))
      .catch(() => setCinematic(null))
  }, [assetVersion, assets.cinematic])

  useEffect(() => {
    setPlaying(true)
    setSeekTime(null)
    setRestartToken(token => token + 1)
    setPlayback({ time: 0, total: 1, clip: scene.clips[0] ?? "" })
  }, [assets.glb, scene])

  const handlePlaybackUpdate = useCallback((info: PlaybackInfo) => {
    playbackRef.current = info
    setPlayback(info)
  }, [])

  const handleTimelineSeek = useCallback((time: number) => {
    setPlaying(false)
    setSeekTime(time)
    const nextPlayback = { ...playbackRef.current, time }
    playbackRef.current = nextPlayback
    setPlayback(nextPlayback)
  }, [])

  const progress = playback.total > 0 ? clamp01(playback.time / playback.total) : 0

  return (
    <div className="absolute inset-0">
      <Canvas
        key={`${skillGlbUrl}:${scene.id}`}
        className="relative z-10"
        camera={{ position: [0, 1.4, 5.5], fov: 35, near: 0.03, far: 140 }}
        dpr={[1, 1.5]}
        gl={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#06070a"]} />
        <ambientLight intensity={0.48} />
        <hemisphereLight intensity={0.34} groundColor={"#12151b"} />
        <directionalLight position={[3, 5, 5]} intensity={1.2} />
        <directionalLight position={[-4, 2, -4]} intensity={0.42} color={"#ff9ba1"} />
        <Suspense fallback={null}>
          {fieldLayers.map(layer => (
            <SkillSceneStage
              key={`${layer.url}:${layer.activationTrack ?? "always"}`}
              url={layer.url}
              activationTrack={layer.activationTrack}
              defaultVisible={layer.defaultVisible}
              cinematic={cinematic}
              playbackRef={playbackRef}
            />
          ))}
          <SkillSceneActor
            url={skillGlbUrl}
            sceneDef={scene}
            manifest={manifest}
            cinematic={cinematic}
            visibility={visibility}
            playing={playing}
            playbackSpeed={playbackSpeed}
            seekTime={seekTime}
            cameraLocked={cameraLocked}
            restartToken={restartToken}
            playbackRef={playbackRef}
            onPlaybackUpdate={handlePlaybackUpdate}
          />
          {fxEnabled && cinematic ? (
            <CinematicParticles cinematic={cinematic} baseUrl={cinematicBaseUrl} playbackRef={playbackRef} />
          ) : null}
        </Suspense>
        {!cameraLocked ? (
          <OrbitControls
            makeDefault
            enableDamping
            enablePan
            panSpeed={1}
            zoomSpeed={1.1}
            minDistance={0.4}
            maxDistance={24}
            target={[0, 1, 0]}
          />
        ) : null}
        {fxEnabled && cinematic ? (
          <CinematicPostProcess cinematic={cinematic} playbackRef={playbackRef} />
        ) : null}
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3">
        <div className="pointer-events-auto mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#111216]/88 px-3 py-2 shadow-2xl shadow-black/30 backdrop-blur">
          <button
            type="button"
            onClick={() => setPlaying(value => !value)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-[#222327] px-3 text-sm font-bold text-white transition hover:border-[#da3e44]/40 hover:bg-[#2a2b30]"
            aria-label={playing ? "Pause skill scene" : "Play skill scene"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSeekTime(null)
              setRestartToken(token => token + 1)
            }}
            className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-[#222327] text-white transition hover:border-[#da3e44]/40 hover:bg-[#2a2b30]"
            aria-label="Restart skill scene"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCameraLocked(value => !value)}
            className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-bold transition ${
              cameraLocked
                ? "border-[#da3e44]/40 bg-[#da3e44]/18 text-white"
                : "border-white/10 bg-[#222327] text-slate-300 hover:border-[#da3e44]/40 hover:text-white"
            }`}
            aria-label="Toggle authored camera"
          >
            <Camera className="h-4 w-4" />
            Camera
          </button>
          <button
            type="button"
            onClick={() => setFxEnabled(value => !value)}
            className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-bold transition ${
              fxEnabled
                ? "border-[#da3e44]/40 bg-[#da3e44]/18 text-white"
                : "border-white/10 bg-[#222327] text-slate-300 hover:border-[#da3e44]/40 hover:text-white"
            }`}
            aria-label="Toggle cinematic effects"
          >
            <Sparkles className="h-4 w-4" />
            FX
          </button>
          <select
            value={playbackSpeed}
            onChange={event => setPlaybackSpeed(Number(event.target.value))}
            className="h-9 rounded-md border border-white/10 bg-[#222327] px-2 text-sm font-bold text-white outline-none focus:border-[#da3e44]/40 focus:ring-2 focus:ring-[#da3e44]/30"
            aria-label="Playback speed"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
          <div className="min-w-[160px] flex-1">
            <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="pointer-events-none h-full rounded-full bg-[#da3e44] shadow-[0_0_18px_rgba(218,62,68,0.55)]"
                style={{ width: `${progress * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={Math.max(0.001, playback.total)}
                step={1 / 60}
                value={Math.min(playback.time, Math.max(0, playback.total))}
                onChange={event => handleTimelineSeek(Number(event.target.value))}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Skill timeline"
              />
            </div>
            <div className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {playback.clip.replace(`${manifest.variant}_Battle_`, "")}
            </div>
          </div>
          <div className="w-24 text-right text-xs font-semibold tabular-nums text-slate-300">
            {playback.time.toFixed(1)} / {playback.total.toFixed(1)}s
          </div>
        </div>
      </div>
    </div>
  )
}
