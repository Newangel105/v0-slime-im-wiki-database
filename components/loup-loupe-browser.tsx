"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  ChevronLeft,
  ChevronRight,
  Gem,
  LogIn,
  LogOut,
  MapPinned,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  StickyNote,
  Trash2,
  Trophy,
  Undo2,
} from "lucide-react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WikiEnemy } from "@/lib/enemies";
import { getCurrentGuideAuthor, guidesSupabase, guidesSupabaseConfigured } from "@/lib/guides";
import towerAssetManifest from "@/lib/loup-loupe-assets.generated.json";
import type {
  LoupLoupeChallengeReward,
  LoupLoupeEffect,
  LoupLoupeEvent,
  LoupLoupeFloor,
  LoupLoupeQuest,
  LoupLoupeReward,
  LoupLoupeTile,
} from "@/lib/loup-loupe";

type LoupLoupeBrowserProps = {
  floors: LoupLoupeFloor[];
  enemies: WikiEnemy[];
};

type ModalState =
  | { kind: "tile"; tile: LoupLoupeTile }
  | { kind: "details" }
  | { kind: "clearRewards" }
  | { kind: "challengeRewards" }
  | null;

type RewardGroup = {
  key: string;
  title: string;
  subtitle?: string;
  rewards: LoupLoupeReward[];
};

type RouteDefinition = {
  id: string;
  floorNumber: number;
  label: string;
  description?: string;
  notes?: string;
  tileNotes?: Record<string, string>;
  tileNumbers: number[];
  branches?: number[][];
  color: string;
};

type RoutePathId = "main" | `branch-${number}`;

type RouteEditorPointerHandlers = {
  active: boolean;
  onTileClick?: (tile: LoupLoupeTile) => void;
  onPointerDown: (tile: LoupLoupeTile) => void;
  onPointerEnter: (tile: LoupLoupeTile) => void;
  onPointerUp: () => void;
};

type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];
type Quat = [number, number, number, number];

type TowerMaterialInfo = {
  name: string;
  texture: string;
  textureSlot?: string;
  textureOffset?: [number, number];
  textureScale?: [number, number];
  alphaMaskTexture?: string;
  alphaMaskSlot?: string;
  alphaMaskOffset?: [number, number];
  alphaMaskScale?: [number, number];
  emissionTexture: string;
  emissionSlot?: string;
  emissionOffset?: [number, number];
  emissionScale?: [number, number];
  baseColor: [number, number, number, number];
  emissionColor: [number, number, number, number];
  renderQueue?: number;
  shader?: string;
  shaderSource?: string;
  floats?: Record<string, number>;
  vectors?: Record<string, Vec4>;
};

// Shader-family classifier.  When the JSON's `shader` field is non-empty
// (either resolved from the actual Shader asset or hinted by the Python
// generator from the material name), we can pick the correct composition
// path here instead of falling back to material-name heuristics.
function classifyShaderFamily(materialInfo?: TowerMaterialInfo): {
  family: "tempestVFX" | "urpLit" | "tempestTower" | "unknown";
  isAdditive: boolean;
  isInvisible: boolean;
  isShadow: boolean;
  isDistortion: boolean;
} {
  const shader = materialInfo?.shader ?? "";
  const lower = shader.toLowerCase();
  const isAdditive =
    /tempestvfx|vfx|additive|particles\/additive/i.test(shader) ||
    (materialInfo?.name ? /add$|_add$|Flare|Aura|Kira/i.test(materialInfo.name) : false);
  const isInvisible = /invisible/i.test(lower);
  const isShadow = /shadow/i.test(lower);
  const isDistortion = /distort/i.test(lower);
  if (/tempestvfx|vfxdefault|vfxdistortion/i.test(lower)) {
    return { family: "tempestVFX", isAdditive, isInvisible, isShadow, isDistortion };
  }
  if (/^urp\/lit|^universal render pipeline\/lit/i.test(lower)) {
    return { family: "urpLit", isAdditive, isInvisible, isShadow, isDistortion };
  }
  if (/^tempest\/tower/i.test(lower)) {
    return { family: "tempestTower", isAdditive, isInvisible, isShadow, isDistortion };
  }
  return { family: "unknown", isAdditive, isInvisible, isShadow, isDistortion };
}

type TowerPrefabNode = {
  name: string;
  path?: string;
  mesh: string;
  materials: string[];
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
};

type TowerPrefabParticle = {
  name: string;
  path?: string;
  materials: string[];
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
  renderer?: ParticleRendererInfo;
  settings?: {
    startSize?: number;
    startColor?: [number, number, number, number];
    modules?: ParticleModuleInfo;
  };
};

type UnityCurveKey = {
  time: number;
  value: number;
  inSlope: number;
  outSlope: number;
};

type UnityMinMaxCurve = {
  minMaxState?: number;
  scalar?: number;
  minScalar?: number;
  maxScalar?: number;
  minCurve?: UnityCurveKey[];
  maxCurve?: UnityCurveKey[];
};

type UnityMultiModeParameter = {
  mode?: number;
  spread?: number;
  value?: number;
  speed?: UnityMinMaxCurve;
};

type ParticleModuleInfo = {
  lengthInSec?: number;
  simulationSpeed?: number;
  looping?: boolean;
  randomSeed?: number;
  prewarm?: boolean;
  playOnAwake?: boolean;
  moveWithTransform?: number;
  scalingMode?: number;
  size3D?: boolean;
  rotation3D?: boolean;
  startSize?: UnityMinMaxCurve;
  startSizeY?: UnityMinMaxCurve;
  startSizeZ?: UnityMinMaxCurve;
  startRotation?: UnityMinMaxCurve;
  emission?: {
    enabled?: boolean;
    rateOverTime?: UnityMinMaxCurve;
    rateOverDistance?: UnityMinMaxCurve;
    burstCount?: number;
    bursts?: Array<{
      time?: number;
      cycleCount?: number;
      repeatInterval?: number;
      probability?: number;
      count?: UnityMinMaxCurve;
    }>;
  };
  velocity?: {
    enabled?: boolean;
    orbitalX?: UnityMinMaxCurve;
    orbitalY?: UnityMinMaxCurve;
    orbitalZ?: UnityMinMaxCurve;
    orbitalOffsetX?: UnityMinMaxCurve;
    orbitalOffsetY?: UnityMinMaxCurve;
    orbitalOffsetZ?: UnityMinMaxCurve;
    speedModifier?: UnityMinMaxCurve;
  };
  rotationOverLifetime?: {
    enabled?: boolean;
    curve?: UnityMinMaxCurve;
    x?: UnityMinMaxCurve;
    y?: UnityMinMaxCurve;
  };
  shape?: {
    enabled?: boolean;
    radius?: UnityMultiModeParameter;
    arc?: UnityMultiModeParameter;
    angle?: number;
    length?: number;
    donutRadius?: number;
    radiusThickness?: number;
    randomPositionAmount?: number;
  };
  subEmitters?: {
    enabled?: boolean;
    items?: Array<{
      targetName?: string;
      type?: number;
      properties?: number;
      emitProbability?: number;
    }>;
  };
};

type ParticleRendererInfo = {
  renderMode?: number;
  renderAlignment?: number;
  sortMode?: number;
  sortingFudge?: number;
  minParticleSize?: number;
  maxParticleSize?: number;
  cameraVelocityScale?: number;
  velocityScale?: number;
  lengthScale?: number;
  normalDirection?: number;
  pivot?: Vec3;
  mesh?: string;
};

type StreamedClipFrame = {
  time: number;
  values: Record<string, number>;
};

type TowerAnimationClip = {
  name: string;
  duration: number;
  curveCount: number;
  frames: StreamedClipFrame[];
  bindings: Array<{
    path: number;
    attribute: number;
    customType: number;
    typeID: number;
  }>;
};

type TowerPrefabAnimation =
  | {
      type: "TowerMapObjectAnimator";
      target: string;
      targetPath?: string;
      speed: number;
      force: number;
      randomDelay: boolean;
      parentScale?: Vec3;
      curve: UnityCurveKey[];
    }
  | {
      type: "PlayerCursorRotator";
      target: string;
      targetPath?: string;
      speed: number;
    }
  | {
      type: "Animator";
      target: string;
      targetPath?: string;
      controller: string;
      clips: TowerAnimationClip[];
    };

type TowerPrefab = {
  name: string;
  assetPath: string;
  nodes: TowerPrefabNode[];
  particles?: TowerPrefabParticle[];
  animations?: TowerPrefabAnimation[];
  lights: Array<{
    name: string;
    type: number;
    position: Vec3;
    rotation: [number, number, number, number];
    color: [number, number, number, number];
    intensity: number;
    range: number;
  }>;
};

type TowerSpriteAtlas = {
  name: string;
  image: string;
  imageSize: [number, number];
  sprites: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
};

type SpriteRef = TowerSpriteAtlas["sprites"][number] & {
  atlas: TowerSpriteAtlas;
};

// Real per-scene lighting extracted by export_loup_loupe_assets.py from
// the tower's Unity scene bundle (RenderSettings + scene-level Light
// components).  Unity LightType: 0=Spot, 1=Directional, 2=Point, 3=Area.
type TowerSceneLight = {
  name: string;
  type: 0 | 1 | 2 | 3;
  color: [number, number, number, number] | null;
  intensity: number;
  range: number;
  spotAngle: number;
  innerSpotAngle: number;
  position: [number, number, number] | null;
  rotation: [number, number, number, number] | null;
};

type TowerSceneLighting = {
  bundlePath: string;
  renderSettings: {
    ambientMode: number;
    ambientIntensity: number;
    ambientSkyColor: [number, number, number, number] | null;
    ambientEquatorColor: [number, number, number, number] | null;
    ambientGroundColor: [number, number, number, number] | null;
    fog: boolean;
    fogColor: [number, number, number, number] | null;
    fogStartDistance: number;
    fogEndDistance: number;
    reflectionIntensity: number;
    subtractiveShadowColor: [number, number, number, number] | null;
  } | null;
  lights: TowerSceneLight[];
};

type TowerAssetManifest = {
  camera: {
    orthographicSizeByTileCount: Record<string, number>;
  };
  tileLayout: {
    xPitch: number;
    zPitch: number;
    zOffset: number;
  };
  maps: {
    frames: Record<string, string>;
    grounds: Record<string, Record<string, string>>;
  };
  chips: {
    common: Record<string, string>;
    variations: Record<string, Record<string, string>>;
  };
  objects: Record<string, string>;
  effects: Record<string, string>;
  runtimeReferences?: {
    variationChips: Record<string, Array<string | null>>;
    variationGrounds: Record<string, Record<string, string | null>>;
    frames: Record<string, string | null>;
    eventChips: Record<string, Array<string | null>>;
    eventObjects: Record<string, Array<string | null>>;
    playerObject: string | null;
    shadowObject: string | null;
    highlightObjects: Array<string | null>;
  };
  prefabs: Record<string, TowerPrefab>;
  /** Real Unity RenderSettings + scene-level Light components extracted from
   * each tower scene's .unity bundle.  Keyed by map_scene_name. */
  sceneLighting?: Record<string, TowerSceneLighting>;
  materials: Record<string, TowerMaterialInfo>;
  spriteAtlases: Record<string, TowerSpriteAtlas>;
};

type ObjectPlacement = {
  key: string;
  scale: Vec3;
  position: Vec3;
};

const towerAssets = towerAssetManifest as unknown as TowerAssetManifest;
const PRISM_TEXTURE =
  "/Effect/TowerIzis/Common/Texture/t_TowerIzisMap_prism_uv_00.png";
const TILE_GLOW_TEXTURE =
  "/Effect/TowerIzis/Common/Texture/t_TowerIzisMap_glow_uv_00.png";
const TREASURE_BAG = "/UI/Texture/BattleAtlas/dropItem2.webp";
const GOLD_ICON = "/Image/Item/Gold/3100001/gold_3100001_ItemL.png";
const TILE_RADIUS = 0.66;
const SPIRIT_ORB_GROUND_Y = 0.1;
const SPIRIT_ORB_CENTER_LIMIT = TILE_RADIUS * 0.28;

// These shader materials keep their texture in a non-standard Unity slot.
// The atlas fallback is still a real TowerIzis texture.
const MATERIAL_TEXTURE_FALLBACKS: Record<string, string> = {
  TowerIzisMapHexagon_InvisibleMT:
    "/loup-loupe/textures/TowerIzisMapHexagon_m3975670673667910697.png",
  Chip_InvisibleMT:
    "/loup-loupe/textures/TowerIzisMapHexagon_m3975670673667910697.png",
};

function getMaterialTexture(
  materialInfo: TowerMaterialInfo | undefined,
): string {
  if (!materialInfo) return "";
  if (materialInfo.texture) return materialInfo.texture;
  return MATERIAL_TEXTURE_FALLBACKS[materialInfo.name] ?? "";
}

function usesTiledTexture(materialName: string): boolean {
  return materialName.startsWith("Ground_");
}

function usesAdditiveTexture(materialName: string, materialInfo?: TowerMaterialInfo): boolean {
  // Prefer shader-driven classification when available; fall back to name
  // heuristics if the Python generator could not resolve a shader.
  if (materialInfo) {
    const cls = classifyShaderFamily(materialInfo);
    if (cls.family === "tempestVFX" || cls.isAdditive) return true;
    if (cls.isShadow || cls.isInvisible) return false;
  }
  return /add$|_add$|Flare|Aura|Kira/i.test(materialName);
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
};

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
};

function getUnityBlendConfig(materialInfo: TowerMaterialInfo | undefined) {
  const src = materialInfo?.floats?._Src ?? materialInfo?.floats?._SrcBlend;
  const dst = materialInfo?.floats?._Dst ?? materialInfo?.floats?._DstBlend;
  if (typeof src !== "number" || typeof dst !== "number") return null;
  const blendSrc = UNITY_BLEND_SRC_FACTORS[src];
  const blendDst = UNITY_BLEND_DST_FACTORS[dst];
  if (blendSrc === undefined || blendDst === undefined) return null;
  return {
    blending: THREE.CustomBlending,
    blendSrc,
    blendDst,
    blendEquation: THREE.AddEquation,
  };
}

function materialVector(
  materialInfo: TowerMaterialInfo | undefined,
  key: string,
): Vec4 | undefined {
  return materialInfo?.vectors?.[key];
}

function materialFloat(
  materialInfo: TowerMaterialInfo | undefined,
  key: string,
  fallback: number,
): number {
  const value = materialInfo?.floats?.[key];
  return typeof value === "number" ? value : fallback;
}

function materialUvBase(
  tilingOffset: Vec4 | undefined,
  textureOffset: [number, number] | undefined,
  textureScale: [number, number] | undefined,
): { repeat: [number, number]; offset: [number, number] } {
  const repeatX =
    tilingOffset && tilingOffset[0] > 0
      ? tilingOffset[0]
      : (textureScale?.[0] ?? 1);
  const repeatY =
    tilingOffset && tilingOffset[1] > 0
      ? tilingOffset[1]
      : (textureScale?.[1] ?? 1);
  const offsetX = (textureOffset?.[0] ?? 0) + (tilingOffset?.[2] ?? 0);
  const offsetY = (textureOffset?.[1] ?? 0) + (tilingOffset?.[3] ?? 0);
  return {
    repeat: [repeatX, repeatY],
    offset: [offsetX, offsetY],
  };
}

function flipUvBaseX(base: {
  repeat: [number, number];
  offset: [number, number];
}): { repeat: [number, number]; offset: [number, number] } {
  return {
    repeat: [-base.repeat[0], base.repeat[1]],
    offset: [base.offset[0] + base.repeat[0], base.offset[1]],
  };
}

function applyParticleTextureSettings(
  texture: THREE.Texture,
  base: { repeat: [number, number]; offset: [number, number] },
  speed: Vec4 | undefined,
) {
  const animated = Boolean(speed && (speed[0] !== 0 || speed[1] !== 0));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.wrapS =
    animated || base.repeat[0] !== 1
      ? THREE.RepeatWrapping
      : THREE.ClampToEdgeWrapping;
  texture.wrapT =
    animated || base.repeat[1] !== 1
      ? THREE.RepeatWrapping
      : THREE.ClampToEdgeWrapping;
  texture.repeat.set(base.repeat[0], base.repeat[1]);
  texture.offset.set(base.offset[0], base.offset[1]);
  texture.needsUpdate = true;
}

function usesMirroredFlareMesh(
  particle: TowerPrefabParticle,
  materialInfo: TowerMaterialInfo | undefined,
): boolean {
  return Boolean(
    particle.renderer?.renderMode === 4 &&
    particle.renderer.mesh &&
    /plane_13/i.test(particle.renderer.mesh) &&
    materialInfo?.textureSlot === "_Alpha",
  );
}

function getEmissionColor(materialInfo: TowerMaterialInfo): THREE.Color {
  const [r, g, b] = materialInfo.emissionColor;
  if (Math.max(r, g, b) > 0) return new THREE.Color(r, g, b);
  return new THREE.Color(1, 1, 1);
}

function getEmissionOpacity(materialInfo: TowerMaterialInfo): number {
  const [r, g, b] = materialInfo.emissionColor;
  const maxChannel = Math.max(r, g, b);
  if (maxChannel > 0) return Math.min(1, Math.max(0.45, maxChannel * 0.42));
  return 0.58;
}

function applyMaterialTextureSettings(
  texture: THREE.Texture,
  materialInfo: TowerMaterialInfo,
  offset: [number, number] | undefined,
  scale: [number, number] | undefined,
) {
  const tiled = usesTiledTexture(materialInfo.name);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.wrapS = tiled ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = tiled ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.offset.set(offset?.[0] ?? 0, offset?.[1] ?? 0);
  texture.repeat.set(scale?.[0] ?? 1, scale?.[1] ?? 1);
  texture.needsUpdate = true;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatRate(value: number): string {
  if (!value) return "";
  return `${Number((value / 100).toFixed(2))}%`;
}

function eventKey(event: LoupLoupeEvent | null): string {
  return event?.master_tower_map_event_type_label ?? "None";
}

function eventType(event: LoupLoupeEvent | null): number {
  return event?.master_tower_map_event_type ?? 1;
}

function isInteractiveTile(tile: LoupLoupeTile): boolean {
  const key = eventKey(tile.event);
  return key !== "None" && key !== "Obstacle";
}

function isTreasureEvent(event: LoupLoupeEvent | null): boolean {
  const key = eventKey(event);
  return key === "Treasure" || key === "Limited Treasure";
}

function getFloorBackground(floor: LoupLoupeFloor): string {
  return floor.background_path ? `/${floor.background_path}.png` : "";
}

function getRewardName(reward: LoupLoupeReward): string {
  return reward.display_name || reward.reward_type_label || "Reward";
}

function getRewardGroups(event: LoupLoupeEvent | null): RewardGroup[] {
  if (!event) return [];
  const groups: RewardGroup[] = [];

  if (event.first_treasure_rewards.length > 0) {
    groups.push({
      key: "first-clear",
      title: "First Clear",
      rewards: event.first_treasure_rewards,
    });
  }

  for (const treasure of event.treasures) {
    const rate = formatRate(treasure.drop_rate);
    groups.push({
      key: String(treasure.master_tower_treasure_id),
      title: treasure.master_tower_treasure_grade_label || "Treasure",
      subtitle: rate ? `${rate} drop` : undefined,
      rewards: treasure.rewards,
    });
  }

  return groups;
}

function getEventCounts(floor: LoupLoupeFloor): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const tile of floor.tiles) {
    const key = eventKey(tile.event);
    if (key === "None" || key === "Obstacle") continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function getTreasureCount(floor: LoupLoupeFloor): number {
  return floor.tiles.filter((tile) => isTreasureEvent(tile.event)).length;
}

const HARD_CODED_ROUTES: RouteDefinition[] = [
  {
    "id": "manual-1-challenge-route-mp5j5192",
    "floorNumber": 1,
    "label": "Challenge Route",
    "color": "#84f75d",
    "tileNumbers": [
      1,
      2,
      5,
      11,
      19,
      11,
      19,
      20,
      30,
      20,
      30,
      31,
      30,
      31
    ]
  },
  {
    "id": "manual-1-main-route-mp5j730t",
    "floorNumber": 1,
    "label": "Main Route",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      3,
      8,
      15,
      23,
      22,
      21,
      31,
      21,
      31
    ]
  },
  {
    "id": "manual-2-challenge-route-mp5jb3jo",
    "floorNumber": 2,
    "label": "Challenge Route",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      3,
      7,
      13,
      21,
      13,
      21,
      31,
      21,
      31,
      1
    ]
  },
  {
    "id": "manual-2-main-route-mp5jbwak",
    "floorNumber": 2,
    "label": "Main Route",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      4,
      9,
      15,
      23,
      15,
      23,
      22,
      23,
      22,
      32,
      22,
      32,
      22,
      32,
      31
    ]
  },
  {
    "id": "manual-3-challenge-route-mp5jdpy8",
    "floorNumber": 3,
    "label": "Challenge Route",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      3,
      1,
      3,
      8,
      15,
      23,
      22,
      32,
      31
    ]
  },
  {
    "id": "manual-3-main-route-mp5jesw3",
    "floorNumber": 3,
    "label": "Main Route",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      24,
      23,
      33,
      31
    ]
  },
  {
    "id": "manual-4-challenge-route-mp5jidut",
    "floorNumber": 4,
    "label": "Challenge Route",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      3,
      7,
      3,
      7,
      13,
      21,
      31
    ]
  },
  {
    "id": "manual-4-main-route-mp5jizz6",
    "floorNumber": 4,
    "label": "Main Route",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      3,
      1,
      3,
      1,
      3,
      7,
      19,
      29,
      31
    ]
  },
  {
    "id": "manual-5-challenge-route-mp5jjtiu",
    "floorNumber": 5,
    "label": "Challenge Route",
    "color": "#f7e85d",
    "tileNumbers": [
      1,
      3,
      7,
      13,
      21,
      31,
      21,
      31,
      1
    ]
  },
  {
    "id": "manual-5-route-1-mp5jkddf",
    "floorNumber": 5,
    "label": "Route 1",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      2,
      5,
      10,
      5,
      10,
      28,
      31
    ]
  },
  {
    "id": "manual-5-route-2-mp5jkwmj",
    "floorNumber": 5,
    "label": "Route 2",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      25,
      35,
      31
    ]
  },
  {
    "id": "manual-6-route-1-mp5jn30h",
    "floorNumber": 6,
    "label": "Route 1",
    "color": "#fff689",
    "tileNumbers": [
      1,
      17,
      27,
      31
    ]
  },
  {
    "id": "manual-6-route-2-mp5jnl5f",
    "floorNumber": 6,
    "label": "Route 2",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      4,
      9,
      33,
      31
    ]
  },
  {
    "id": "manual-7-route-1-mp5joj70",
    "floorNumber": 7,
    "label": "Route 1",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      2,
      5,
      19,
      20,
      30,
      31
    ]
  },
  {
    "id": "manual-7-route-2-mp5jp34k",
    "floorNumber": 7,
    "label": "Route 2",
    "color": "#8dfff1",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      25,
      36,
      31
    ]
  },
  {
    "id": "manual-7-route-3-mp5jrlx2",
    "floorNumber": 7,
    "label": "Route 3",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      4,
      9,
      33,
      31
    ]
  },
  {
    "id": "manual-8-route-1-mp5jsse0",
    "floorNumber": 8,
    "label": "Route 1",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      36,
      31
    ]
  },
  {
    "id": "manual-8-challenge-route-mp5jthia",
    "floorNumber": 8,
    "label": "Challenge Route",
    "color": "#8dfff1",
    "tileNumbers": [
      1,
      3,
      7,
      13,
      21,
      31
    ]
  },
  {
    "id": "manual-9-route-1-mp5ju0vd",
    "floorNumber": 9,
    "label": "Route 1",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      2,
      12,
      19,
      29,
      31
    ]
  },
  {
    "id": "manual-9-route-2-mp5jumq3",
    "floorNumber": 9,
    "label": "Route 2",
    "color": "#8dfff1",
    "tileNumbers": [
      1,
      2,
      30,
      31
    ]
  },
  {
    "id": "manual-10-route-1-mp5jvcne",
    "floorNumber": 10,
    "label": "Route 1",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      9,
      15,
      23,
      34,
      33,
      22,
      32,
      31
    ]
  },
  {
    "id": "manual-10-route-2-mp5jw28o",
    "floorNumber": 10,
    "label": "Route 2",
    "color": "#8dfff1",
    "tileNumbers": [
      1,
      2,
      5,
      11,
      19,
      28,
      31
    ]
  },
  {
    "id": "manual-10-route-3-mp5jwjqx",
    "floorNumber": 10,
    "label": "Route 3",
    "color": "#ffa9ec",
    "tileNumbers": [
      1,
      2,
      30,
      31
    ]
  },
  {
    "id": "manual-11-route-1-mp5jy7ga",
    "floorNumber": 11,
    "label": "Route 1",
    "color": "#8dfff1",
    "tileNumbers": [
      1,
      4,
      9,
      15,
      24,
      46,
      43,
      57
    ]
  },
  {
    "id": "manual-11-route-2-mp5jyza1",
    "floorNumber": 11,
    "label": "Route 2",
    "color": "#fff789",
    "tileNumbers": [
      1,
      2,
      5,
      10,
      28,
      52,
      57
    ]
  },
  {
    "id": "manual-11-route-3-mp5jzi64",
    "floorNumber": 11,
    "label": "Route 3",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      4,
      9,
      23,
      34,
      33,
      45,
      43,
      57
    ]
  },
  {
    "id": "manual-12-route-1-mp5k0gzh",
    "floorNumber": 12,
    "label": "Route 1",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      2,
      5,
      10,
      28,
      29,
      30,
      42,
      56,
      57
    ]
  },
  {
    "id": "manual-12-route-2-mp5k1a4f",
    "floorNumber": 12,
    "label": "Route 2",
    "color": "#ff9e62",
    "tileNumbers": [
      1,
      4,
      9,
      33,
      45,
      44,
      58,
      57
    ]
  },
  {
    "id": "manual-12-route-3-mp5k1vqr",
    "floorNumber": 12,
    "label": "Route 3",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      4,
      9,
      59,
      57
    ]
  },
  {
    "id": "manual-13-route-1-mp5k2oos",
    "floorNumber": 13,
    "label": "Route 1",
    "color": "#fff789",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      24,
      22,
      33,
      45,
      43,
      57
    ]
  },
  {
    "id": "manual-13-route-2-mp5k39ep",
    "floorNumber": 13,
    "label": "Route 2",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      5,
      11,
      27,
      39,
      43,
      57
    ]
  },
  {
    "id": "manual-13-route-3-mp5k3vzk",
    "floorNumber": 13,
    "label": "Route 3",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      60,
      57
    ]
  },
  {
    "id": "manual-14-route-1-mp5k4h74",
    "floorNumber": 14,
    "label": "Route 1",
    "color": "#ff9f5a",
    "tileNumbers": [
      1,
      4,
      9,
      8,
      14,
      34,
      46,
      43,
      57
    ]
  },
  {
    "id": "manual-14-route-2-mp5k55hn",
    "floorNumber": 14,
    "label": "Route 2",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      2,
      42,
      43,
      57
    ]
  },
  {
    "id": "manual-15-route-1-mp5k5lxi",
    "floorNumber": 15,
    "label": "Route 1",
    "color": "#62e6ff",
    "tileNumbers": [
      1,
      3,
      1,
      3,
      35,
      32,
      58,
      57
    ]
  },
  {
    "id": "manual-15-route-2-mp5k6aow",
    "floorNumber": 15,
    "label": "Route 2",
    "color": "#a5fd56",
    "tileNumbers": [
      1,
      2,
      10,
      17,
      27,
      30,
      42,
      56,
      57
    ]
  },
  {
    "id": "manual-15-route-3-mp5k6we6",
    "floorNumber": 15,
    "label": "Route 3",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      7,
      21,
      31,
      43,
      57
    ]
  },
  {
    "id": "manual-16-route-1-mp5k7w30",
    "floorNumber": 16,
    "label": "Route 1",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      2,
      5,
      11,
      18,
      21,
      41,
      43,
      57
    ]
  },
  {
    "id": "manual-16-route-2-mp5k8rho",
    "floorNumber": 16,
    "label": "Route 2",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      5,
      11,
      18,
      28,
      40,
      41,
      43,
      57
    ]
  },
  {
    "id": "manual-16-route-3-mp5k9lul",
    "floorNumber": 16,
    "label": "Route 3",
    "color": "#a5fe56",
    "tileNumbers": [
      1,
      4,
      22,
      21,
      32,
      44,
      43,
      57
    ]
  },
  {
    "id": "manual-16-route-4-mp5kab6j",
    "floorNumber": 16,
    "label": "Route 4",
    "color": "#8dfff1",
    "tileNumbers": [
      1,
      4,
      44,
      43,
      57
    ]
  },
  {
    "id": "manual-16-route-5-mp5kbbmg",
    "floorNumber": 16,
    "label": "Route 5",
    "color": "#ffa9ec",
    "tileNumbers": [
      1,
      2,
      42,
      43,
      57
    ]
  },
  {
    "id": "manual-17-route-1-mp5kc56b",
    "floorNumber": 17,
    "label": "Route 1",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      25,
      36,
      33,
      45,
      60,
      57
    ]
  },
  {
    "id": "manual-17-route-2-mp5kcm38",
    "floorNumber": 17,
    "label": "Route 2",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      3,
      8,
      14,
      40,
      42,
      56,
      57
    ]
  },
  {
    "id": "manual-17-route-3-mp5kdg5q",
    "floorNumber": 17,
    "label": "Route 3",
    "color": "#fff789",
    "tileNumbers": [
      1,
      3,
      8,
      58,
      57
    ]
  },
  {
    "id": "manual-18-route-1-mp5kenm1",
    "floorNumber": 18,
    "label": "Route 1",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      4,
      9,
      15,
      24,
      22,
      33,
      45,
      59,
      45,
      44,
      43,
      44,
      43,
      44,
      43,
      57,
      59,
      58
    ]
  },
  {
    "id": "manual-19-route-1-mp5kg4i2",
    "floorNumber": 19,
    "label": "Route 1",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      2,
      5,
      11,
      5,
      11,
      27,
      39,
      41,
      42,
      56,
      57
    ]
  },
  {
    "id": "manual-19-route-2-mp5kgu9y",
    "floorNumber": 19,
    "label": "Route 2",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      2,
      5,
      11,
      13,
      21,
      32,
      31,
      57
    ]
  },
  {
    "id": "manual-20-route-1-mp5khjdf",
    "floorNumber": 20,
    "label": "Route 1",
    "color": "#fff789",
    "tileNumbers": [
      1,
      2,
      5,
      11,
      27,
      29,
      41,
      43,
      57
    ]
  },
  {
    "id": "manual-20-route-2-mp5ki6ul",
    "floorNumber": 20,
    "label": "Route 2",
    "color": "#fe9655",
    "tileNumbers": [
      1,
      4,
      9,
      45,
      44,
      58,
      57
    ]
  },
  {
    "id": "manual-21-route-1-mp5kisyw",
    "floorNumber": 21,
    "label": "Route 1",
    "color": "#ffa9ec",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      25,
      36,
      48,
      62,
      61,
      95,
      91
    ]
  },
  {
    "id": "manual-21-route-2-mp5kjegb",
    "floorNumber": 21,
    "label": "Route 2",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      3,
      7,
      52,
      54,
      70,
      72,
      90,
      91
    ]
  },
  {
    "id": "manual-21-route-3-mp5kk3bl",
    "floorNumber": 21,
    "label": "Route 3",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      3,
      7,
      19,
      29,
      30,
      54,
      55,
      71,
      72,
      90,
      91
    ]
  },
  {
    "id": "manual-21-route-4-mp5kkxv4",
    "floorNumber": 21,
    "label": "Route 4",
    "color": "#8dfff1",
    "tileNumbers": [
      1,
      3,
      7,
      19,
      41,
      54,
      55,
      71,
      72,
      90,
      91
    ]
  },
  {
    "id": "manual-22-route-1-mp5kmhxq",
    "floorNumber": 22,
    "label": "Route 1",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      24,
      23,
      45,
      77,
      76,
      94,
      91
    ]
  },
  {
    "id": "manual-22-route-2-mp5kn0rv",
    "floorNumber": 22,
    "label": "Route 2",
    "color": "#fff789",
    "tileNumbers": [
      1,
      9,
      16,
      24,
      23,
      33,
      31,
      76,
      94,
      91
    ]
  },
  {
    "id": "manual-22-route-3-mp5knpr4",
    "floorNumber": 22,
    "label": "Route 3",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      2,
      5,
      29,
      41,
      54,
      70,
      72,
      73,
      91
    ]
  },
  {
    "id": "manual-23-route-1-mp5koi3j",
    "floorNumber": 23,
    "label": "Route 1",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      2,
      5,
      11,
      27,
      53,
      85,
      91
    ]
  },
  {
    "id": "manual-23-route-2-mp5kp9tm",
    "floorNumber": 23,
    "label": "Route 2",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      9,
      16,
      25,
      47,
      62,
      78,
      97,
      91
    ]
  },
  {
    "id": "manual-23-route-3-mp5kq1gy",
    "floorNumber": 23,
    "label": "Route 3",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      2,
      5,
      55,
      57,
      91
    ]
  },
  {
    "id": "manual-23-route-4-mp5krci7",
    "floorNumber": 23,
    "label": "Route 4",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      9,
      16,
      46,
      45,
      59,
      57,
      91
    ]
  },
  {
    "id": "manual-24-route-1-mp5ks9t3",
    "floorNumber": 24,
    "label": "Route 1",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      9,
      23,
      34,
      31,
      76,
      73,
      91
    ]
  },
  {
    "id": "manual-24-route-2-mp5ksw5a",
    "floorNumber": 24,
    "label": "Route 2",
    "color": "#fcf487",
    "tileNumbers": [
      1,
      2,
      5,
      71,
      88,
      91
    ]
  },
  {
    "id": "manual-24-route-3-mp5ktcac",
    "floorNumber": 24,
    "label": "Route 3",
    "color": "#7bd3fa",
    "tileNumbers": [
      1,
      2,
      5,
      89,
      91
    ]
  },
  {
    "id": "manual-25-route-1-mp5ku503",
    "floorNumber": 25,
    "label": "Route 1",
    "color": "#ff9955",
    "tileNumbers": [
      1,
      2,
      5,
      11,
      18,
      40,
      41,
      54,
      70,
      71,
      88,
      90,
      91
    ]
  },
  {
    "id": "manual-25-route-2-mp5kuv70",
    "floorNumber": 25,
    "label": "Route 2",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      25,
      24,
      34,
      47,
      77,
      96,
      91
    ]
  },
  {
    "id": "manual-25-route-3-mp5kveoa",
    "floorNumber": 25,
    "label": "Route 3",
    "color": "#a6ff4d",
    "tileNumbers": [
      1,
      3,
      8,
      14,
      23,
      33,
      32,
      45,
      75,
      74,
      92,
      91
    ]
  },
  {
    "id": "manual-26-route-1-mp5kwi7x",
    "floorNumber": 26,
    "label": "Route 1",
    "color": "#ff9f5a",
    "tileNumbers": [
      1,
      3,
      11,
      19,
      84,
      67,
      70,
      88,
      91
    ]
  },
  {
    "id": "manual-26-route-2-mp5kxm0u",
    "floorNumber": 26,
    "label": "Route 2",
    "color": "#a4fe56",
    "tileNumbers": [
      1,
      3,
      11,
      41,
      42,
      56,
      74,
      73,
      91
    ]
  },
  {
    "id": "manual-26-route-3-mp5kylps",
    "floorNumber": 26,
    "label": "Route 3",
    "color": "#fff789",
    "tileNumbers": [
      1,
      4,
      9,
      23,
      33,
      46,
      44,
      58,
      57,
      91
    ]
  },
  {
    "id": "manual-26-route-4-mp5kzb4d",
    "floorNumber": 26,
    "label": "Route 4",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      16,
      25,
      77,
      73,
      91
    ]
  },
  {
    "id": "manual-27-route-1-mp5l0jvc",
    "floorNumber": 27,
    "label": "Route 1",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      2,
      5,
      10,
      17,
      26,
      86,
      91
    ]
  },
  {
    "id": "manual-27-route-2-mp5l11ed",
    "floorNumber": 27,
    "label": "Route 2",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      25,
      22,
      33,
      45,
      44,
      95,
      91
    ]
  },
  {
    "id": "manual-27-route-3-mp5l1iok",
    "floorNumber": 27,
    "label": "Route 3",
    "color": "#7cd5fd",
    "tileNumbers": [
      1,
      2,
      6,
      11,
      19,
      20,
      29,
      41,
      42,
      70,
      88,
      91
    ]
  },
  {
    "id": "manual-28-route-1-mp5l2kx9",
    "floorNumber": 28,
    "label": "Route 1",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      2,
      10,
      17,
      27,
      51,
      67,
      72,
      90,
      91
    ]
  },
  {
    "id": "manual-28-route-2-mp5l3hs2",
    "floorNumber": 28,
    "label": "Route 2",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      2,
      5,
      19,
      20,
      30,
      31,
      55,
      71,
      72,
      90,
      91
    ]
  },
  {
    "id": "manual-28-route-3-mp5l46ya",
    "floorNumber": 28,
    "label": "Route 3",
    "color": "#fff789",
    "tileNumbers": [
      1,
      36,
      49,
      97,
      91
    ]
  },
  {
    "id": "manual-28-route-4-mp5l4rix",
    "floorNumber": 28,
    "label": "Route 4",
    "color": "#d88bfe",
    "tileNumbers": [
      1,
      2,
      17,
      27,
      29,
      55,
      70,
      72,
      90,
      91
    ]
  },
  {
    "id": "manual-29-route-1-mp5l5o22",
    "floorNumber": 29,
    "label": "Route 1",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      2,
      5,
      11,
      51,
      67,
      70,
      88,
      91
    ]
  },
  {
    "id": "manual-29-route-2-mp5l6rj3",
    "floorNumber": 29,
    "label": "Route 2",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      25,
      36,
      48,
      63,
      62,
      96,
      91
    ]
  },
  {
    "id": "manual-29-route-3-mp5l76xv",
    "floorNumber": 29,
    "label": "Route 3",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      2,
      30,
      31,
      42,
      72,
      73,
      91
    ]
  },
  {
    "id": "manual-30-route-1-mp5l8036",
    "floorNumber": 30,
    "label": "Route 1",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      36,
      49,
      64,
      81,
      78,
      97,
      95,
      76,
      74,
      92,
      91
    ]
  },
  {
    "id": "manual-30-route-2-mp5l8igk",
    "floorNumber": 30,
    "label": "Route 2",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      3,
      24,
      34,
      55,
      71,
      72,
      90,
      91
    ]
  },
  {
    "id": "manual-30-route-3-mp5l98rr",
    "floorNumber": 30,
    "label": "Route 3",
    "color": "#fff789",
    "tileNumbers": [
      1,
      4,
      9,
      75,
      73,
      91
    ]
  },
  {
    "id": "manual-32-route-1-mp5la6cs",
    "floorNumber": 32,
    "label": "Route 1",
    "color": "#a6ff55",
    "tileNumbers": [
      1,
      4,
      9,
      33,
      46,
      88,
      89,
      72,
      73,
      91
    ]
  },
  {
    "id": "manual-32-route-2-mp5lazku",
    "floorNumber": 32,
    "label": "Route 2",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      2,
      5,
      19,
      20,
      40,
      42,
      72,
      73,
      91
    ]
  },
  {
    "id": "manual-32-route-3-mp5lbv1b",
    "floorNumber": 32,
    "label": "Route 3",
    "color": "#7dd7fe",
    "tileNumbers": [
      1,
      2,
      5,
      10,
      17,
      26,
      27,
      66,
      68,
      86,
      69,
      87,
      89,
      72,
      73,
      91
    ]
  },
  {
    "id": "manual-32-route-4-mp5lcf6a",
    "floorNumber": 32,
    "label": "Route 4",
    "color": "#7dd7fe",
    "tileNumbers": [
      1,
      9,
      25,
      36,
      35,
      80,
      78,
      96,
      94,
      75,
      93,
      91
    ]
  },
  {
    "id": "manual-33-route-1-mp5ldf3g",
    "floorNumber": 33,
    "label": "Route 1",
    "color": "#a5ff54",
    "tileNumbers": [
      1,
      2,
      5,
      7,
      12,
      20,
      21,
      30,
      42,
      43,
      56,
      90,
      91
    ]
  },
  {
    "id": "manual-33-route-2-mp5leh17",
    "floorNumber": 33,
    "label": "Route 2",
    "color": "#ff9654",
    "tileNumbers": [
      1,
      2,
      5,
      7,
      84,
      67,
      68,
      86,
      69,
      70,
      88,
      71,
      72,
      90,
      91
    ]
  },
  {
    "id": "manual-33-route-3-mp5lfjkv",
    "floorNumber": 33,
    "label": "Route 3",
    "color": "#fff789",
    "tileNumbers": [
      1,
      25,
      24,
      34,
      98,
      79,
      78,
      96,
      77,
      73,
      91
    ]
  },
  {
    "id": "manual-33-route-4-mp5lg6x8",
    "floorNumber": 33,
    "label": "Route 4",
    "color": "#ffc2f7",
    "tileNumbers": [
      1,
      2,
      90,
      91
    ]
  },
  {
    "id": "manual-34-route-1-mp5lgqnd",
    "floorNumber": 34,
    "label": "Route 1",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      2,
      5,
      10,
      17,
      27,
      66,
      84,
      85,
      68,
      73,
      91
    ]
  },
  {
    "id": "manual-34-route-2-mp5lh7oi",
    "floorNumber": 34,
    "label": "Route 2",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      9,
      25,
      35,
      80,
      98,
      97,
      78,
      77,
      95,
      76,
      73,
      91
    ]
  },
  {
    "id": "manual-34-route-3-mp5lhyoj",
    "floorNumber": 34,
    "label": "Route 3",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      2,
      5,
      10,
      18,
      19,
      28,
      40,
      54,
      55,
      71,
      73,
      91
    ]
  },
  {
    "id": "manual-35-route-1-mp5linap",
    "floorNumber": 35,
    "label": "Route 1",
    "color": "#a5ff55",
    "tileNumbers": [
      1,
      4,
      9,
      49,
      63,
      80,
      79,
      97,
      91
    ]
  },
  {
    "id": "manual-35-route-2-mp5lj2po",
    "floorNumber": 35,
    "label": "Route 2",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      2,
      10,
      17,
      26,
      37,
      38,
      66,
      67,
      85,
      90,
      91
    ]
  },
  {
    "id": "manual-35-route-3-mp5ljkb9",
    "floorNumber": 35,
    "label": "Route 3",
    "color": "#8bc3ff",
    "tileNumbers": [
      1,
      9,
      16,
      25,
      47,
      46,
      60,
      58,
      92,
      91
    ]
  },
  {
    "id": "manual-36-route-1-mp5lk34r",
    "floorNumber": 36,
    "label": "Route 1",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      25,
      36,
      48,
      63,
      57
    ]
  },
  {
    "id": "manual-36-route-2-mp5lkjd9",
    "floorNumber": 36,
    "label": "Route 2",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      2,
      6,
      7,
      19,
      29,
      30,
      41,
      55,
      42,
      43,
      57
    ]
  },
  {
    "id": "manual-36-route-3-mp5ll70k",
    "floorNumber": 36,
    "label": "Route 3",
    "color": "#7cd6fe",
    "tileNumbers": [
      1,
      2,
      5,
      29,
      40,
      41,
      55,
      42,
      43,
      57
    ]
  },
  {
    "id": "manual-37-route-1-mp5lm5vp",
    "floorNumber": 37,
    "label": "Route 1",
    "color": "#ff9655",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      24,
      21,
      31,
      95,
      94,
      75,
      73,
      91
    ]
  },
  {
    "id": "manual-37-route-2-mp5lmomt",
    "floorNumber": 37,
    "label": "Route 2",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      4,
      9,
      23,
      21,
      31,
      55,
      71,
      72,
      73,
      91
    ]
  },
  {
    "id": "manual-37-route-3-mp5ln6en",
    "floorNumber": 37,
    "label": "Route 3",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      2,
      5,
      11,
      38,
      39,
      67,
      69,
      87,
      89,
      72,
      73,
      91
    ]
  },
  {
    "id": "manual-38-route-1-mp5lo5kl",
    "floorNumber": 38,
    "label": "Route 1",
    "color": "#ff9f5a",
    "tileNumbers": [
      1,
      5,
      10,
      17,
      26,
      29,
      41,
      86,
      69,
      70,
      88,
      90,
      73,
      91
    ]
  },
  {
    "id": "manual-38-route-2-mp5losst",
    "floorNumber": 38,
    "label": "Route 2",
    "color": "#7ad7ff",
    "tileNumbers": [
      1,
      3,
      7,
      13,
      21,
      60,
      94,
      92,
      73,
      91
    ]
  },
  {
    "id": "manual-38-route-3-mp5lph17",
    "floorNumber": 38,
    "label": "Route 3",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      25,
      36,
      33,
      45,
      60,
      94,
      92,
      73,
      91
    ]
  },
  {
    "id": "manual-39-route-1-mp5lq8y2",
    "floorNumber": 39,
    "label": "Route 1",
    "color": "#c448fe",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      24,
      30,
      95,
      93,
      74,
      73,
      91
    ]
  },
  {
    "id": "manual-39-route-2-mp5lr4a3",
    "floorNumber": 39,
    "label": "Route 2",
    "color": "#ffa9ec",
    "tileNumbers": [
      1,
      2,
      10,
      65,
      82,
      65,
      72,
      90,
      91
    ]
  },
  {
    "id": "manual-39-route-3-mp5lrkur",
    "floorNumber": 39,
    "label": "Route 3",
    "color": "#9bef51",
    "tileNumbers": [
      1,
      2,
      5,
      10,
      17,
      53,
      54,
      70,
      72,
      90,
      91
    ]
  },
  {
    "id": "manual-39-route-4-mp5ls1pw",
    "floorNumber": 39,
    "label": "Route 4",
    "color": "#7cd6fe",
    "tileNumbers": [
      1,
      2,
      5,
      29,
      40,
      70,
      72,
      90,
      91
    ]
  },
  {
    "id": "manual-40-route-1-mp5lsvv2",
    "floorNumber": 40,
    "label": "Route 1",
    "color": "#ff9755",
    "tileNumbers": [
      1,
      4,
      9,
      49,
      81,
      100,
      98,
      79,
      78,
      96,
      77,
      76,
      94,
      93,
      74,
      92,
      91
    ]
  },
  {
    "id": "manual-40-route-2-mp5lte14",
    "floorNumber": 40,
    "label": "Route 2",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      2,
      12,
      22,
      21,
      31,
      70,
      88,
      91
    ]
  },
  {
    "id": "manual-40-route-3-mp5ltxso",
    "floorNumber": 40,
    "label": "Route 3",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      5,
      10,
      17,
      27,
      51,
      67,
      84,
      67,
      70,
      88,
      91
    ]
  },
  {
    "id": "manual-42-route-1-mp5lv2gw",
    "floorNumber": 42,
    "label": "Route 1",
    "color": "#a4fc56",
    "tileNumbers": [
      1,
      64,
      81,
      99,
      97,
      78,
      73,
      91
    ]
  },
  {
    "id": "manual-42-route-2-mp5lvnkc",
    "floorNumber": 42,
    "label": "Route 2",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      10,
      26,
      50,
      65,
      82,
      85,
      68,
      73,
      91
    ]
  },
  {
    "id": "manual-42-route-3-mp5lwce6",
    "floorNumber": 42,
    "label": "Route 3",
    "color": "#7cd7ff",
    "tileNumbers": [
      1,
      5,
      10,
      54,
      57,
      91
    ]
  },
  {
    "id": "manual-42-route-4-mp5lws1s",
    "floorNumber": 42,
    "label": "Route 4",
    "color": "#d88bff",
    "tileNumbers": [
      1,
      9,
      16,
      60,
      57,
      73,
      91
    ]
  },
  {
    "id": "manual-43-route-1-mp5lxcsb",
    "floorNumber": 43,
    "label": "Route 1",
    "color": "#84f75d",
    "tileNumbers": [
      1,
      2,
      5,
      10,
      5,
      10,
      40,
      41,
      71,
      89,
      91
    ]
  },
  {
    "id": "manual-43-route-2-mp5lxv5w",
    "floorNumber": 43,
    "label": "Route 2",
    "color": "#8dfff1",
    "tileNumbers": [
      1,
      2,
      1,
      4,
      2,
      3,
      4,
      3,
      7,
      3,
      7,
      14,
      23,
      21,
      31,
      44,
      59,
      75,
      94,
      93,
      74,
      73,
      91
    ]
  },
  {
    "id": "manual-43-route-3-mp5lz15o",
    "floorNumber": 43,
    "label": "Route 3",
    "color": "#7cdaff",
    "tileNumbers": [
      1,
      4,
      16,
      25,
      36,
      96,
      77,
      76,
      94,
      93,
      74,
      73,
      91
    ]
  },
  {
    "id": "manual-44-route-1-mp5lzts1",
    "floorNumber": 44,
    "label": "Route 1",
    "color": "#90fffb",
    "tileNumbers": [
      1,
      4,
      9,
      16,
      46,
      78,
      76,
      94,
      75,
      73,
      91
    ]
  },
  {
    "id": "manual-44-route-2-mp5m0bbe",
    "floorNumber": 44,
    "label": "Route 2",
    "color": "#fff789",
    "tileNumbers": [
      1,
      3,
      8,
      74,
      73,
      91
    ]
  },
  {
    "id": "manual-44-route-3-mp5m0wf8",
    "floorNumber": 44,
    "label": "Route 3",
    "color": "#a6ff56",
    "tileNumbers": [
      1,
      2,
      5,
      29,
      68,
      73,
      91
    ]
  },
  {
    "id": "manual-45-route-1-mp5m1gdj",
    "floorNumber": 45,
    "label": "Route 1",
    "color": "#62e6ff",
    "tileNumbers": [
      1,
      4,
      49,
      64,
      81,
      78,
      96,
      94,
      93,
      74,
      73,
      91
    ]
  },
  {
    "id": "manual-45-route-2-mp5m1w48",
    "floorNumber": 45,
    "label": "Route 2",
    "color": "#a5ff56",
    "tileNumbers": [
      1,
      2,
      5,
      10,
      5,
      10,
      18,
      38,
      52,
      53,
      69,
      71,
      89,
      91
    ]
  },
  {
    "id": "manual-45-route-3-mp5m2gvk",
    "floorNumber": 45,
    "label": "Route 3",
    "color": "#d88bfe",
    "tileNumbers": [
      1,
      2,
      10,
      37,
      50,
      65,
      66,
      84,
      91
    ]
  },
  {
    "id": "manual-45-route-4-mp5m2uh1",
    "floorNumber": 45,
    "label": "Route 4",
    "color": "#ff00ff",
    "tileNumbers": [
      1,
      25,
      35,
      80,
      98,
      91
    ]
  }
];

const ENABLE_ROUTE_EDITOR = true;
const ROUTE_EDITOR_STORAGE_KEY = "loup-loupe-manual-routes-v1";
const ROUTE_SET_STORAGE_KEY = "manual-routes";
const DEFAULT_ROUTE_COLORS = ["#84f75d", "#ff9f5a", "#62e6ff", "#ff5e80", "#f7e85d", "#c084fc"];
const NO_ROUTE_SELECT_VALUE = "__no_route__";
type RouteEditorAccessState = "checking" | "allowed" | "signed-out" | "unconfigured";
type RouteStoreStatus = "loading" | "ready" | "unconfigured" | "error";

function normalizeOptionalRouteText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeRoutePath(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tileNumber): tileNumber is number => Number.isFinite(tileNumber));
}

function normalizeRouteBranches(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeRoutePath)
    .filter((path) => path.length > 0);
}

function isMapTileMaterial(materialName: string): boolean {
  return /^(Chip_|Ground_|TowerIzisMapHexagon|TowerIzisMapBaseFrame|WarpBase)/i.test(materialName);
}

// Lit material families: URP/Lit + Tempest/Tower/* shaders are URP-lit in
// the actual game.  With real scene RenderSettings + scene Lights wired
// into THREE we can finally use a lit THREE material here without losing
// brightness.
function shouldUseLitMaterial(materialInfo?: TowerMaterialInfo): boolean {
  if (!materialInfo) return false;
  const cls = classifyShaderFamily(materialInfo);
  if (cls.isInvisible || cls.isShadow || cls.isAdditive || cls.isDistortion) return false;
  return false;
}

function brightenMapMaterialColor(color: THREE.Color, materialInfo: TowerMaterialInfo): THREE.Color {
  const cls = classifyShaderFamily(materialInfo);
  if (isMapTileMaterial(materialInfo.name)) return color.clone().multiplyScalar(1.28);
  if (cls.family === "urpLit" || cls.family === "tempestTower") return color.clone().multiplyScalar(1.18);
  return color;
}

function cleanRouteForExport(route: RouteDefinition): RouteDefinition {
  const description = normalizeOptionalRouteText(route.description);
  const notes = normalizeOptionalRouteText(route.notes ?? route.description);
  const branches = normalizeRouteBranches(route.branches);
  const tileNotes = Object.fromEntries(
    Object.entries(route.tileNotes ?? {})
      .map(([tileNumber, note]) => [tileNumber, normalizeOptionalRouteText(note)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  return {
    id: route.id,
    floorNumber: route.floorNumber,
    label: route.label,
    description,
    notes,
    tileNotes: Object.keys(tileNotes).length ? tileNotes : undefined,
    color: route.color,
    tileNumbers: normalizeRoutePath(route.tileNumbers),
    branches: branches.length > 0 ? branches : undefined,
  };
}

function isRouteDefinition(value: unknown): value is RouteDefinition {
  const candidate = value as Partial<RouteDefinition> | null;
  return Boolean(
    candidate &&
      typeof candidate.id === "string" &&
      typeof candidate.floorNumber === "number" &&
      typeof candidate.label === "string" &&
      typeof candidate.color === "string" &&
      Array.isArray(candidate.tileNumbers),
  );
}

function normalizeRouteDefinitions(value: unknown): RouteDefinition[] {
  if (!Array.isArray(value)) return [];
  const normalized = value.filter(isRouteDefinition).map((route) => ({
    ...cleanRouteForExport(route),
    tileNumbers: normalizeRoutePath(route.tileNumbers),
    branches: normalizeRouteBranches(route.branches),
  }));
  return dedupeRouteDefinitions(normalized);
}

function getRouteNotes(route: RouteDefinition | null | undefined): string {
  return normalizeOptionalRouteText(route?.notes ?? route?.description) ?? "";
}

function dedupeRouteDefinitions(routes: RouteDefinition[]): RouteDefinition[] {
  const byId = new Map<string, RouteDefinition>();
  for (const route of routes) byId.set(route.id, route);
  return Array.from(byId.values());
}

function makeManualRouteId(floorNumber: number, label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "route";
  return `manual-${floorNumber}-${slug}-${Date.now().toString(36)}`;
}

function getRouteDefinitionsForFloor(floorNumber: number): RouteDefinition[] {
  return HARD_CODED_ROUTES.filter((route) => route.floorNumber === floorNumber);
}

function getMergedRouteDefinitionsForFloor(
  floorNumber: number,
  editorRoutes: RouteDefinition[],
): RouteDefinition[] {
  const byId = new Map<string, RouteDefinition>();
  for (const route of getRouteDefinitionsForFloor(floorNumber)) byId.set(route.id, route);
  for (const route of editorRoutes) {
    if (route.floorNumber === floorNumber) byId.set(route.id, route);
  }
  return Array.from(byId.values());
}

function getTileByMapNumber(
  floor: LoupLoupeFloor,
  mapNumber: number,
): LoupLoupeTile | null {
  return floor.tiles.find((tile) => tile.map_number === mapNumber) ?? null;
}

function getRouteTiles(
  floor: LoupLoupeFloor,
  route: RouteDefinition | null,
): LoupLoupeTile[] {
  if (!route) return [];
  return getRouteTileNumbers(route)
    .map((mapNumber) => getTileByMapNumber(floor, mapNumber))
    .filter(Boolean) as LoupLoupeTile[];
}

function getRoutePaths(route: RouteDefinition | null | undefined): Array<{
  id: RoutePathId;
  label: string;
  tileNumbers: number[];
}> {
  if (!route) return [];
  return [
    { id: "main", label: "Main Path", tileNumbers: normalizeRoutePath(route.tileNumbers) },
    ...normalizeRouteBranches(route.branches).map((tileNumbers, index) => ({
      id: `branch-${index}` as RoutePathId,
      label: `Fork ${index + 1}`,
      tileNumbers,
    })),
  ];
}

function getRouteTileNumbers(route: RouteDefinition | null | undefined): number[] {
  const seen = new Set<number>();
  const tileNumbers: number[] = [];
  for (const path of getRoutePaths(route)) {
    for (const tileNumber of path.tileNumbers) {
      if (seen.has(tileNumber)) continue;
      seen.add(tileNumber);
      tileNumbers.push(tileNumber);
    }
  }
  return tileNumbers;
}

function routeHasTile(route: RouteDefinition | null | undefined, tileNumber: number): boolean {
  return getRoutePaths(route).some((path) => path.tileNumbers.includes(tileNumber));
}

function getRoutePathTileNumbers(route: RouteDefinition, pathId: RoutePathId): number[] {
  if (pathId === "main") return route.tileNumbers;
  const branchIndex = Number(pathId.replace("branch-", ""));
  return route.branches?.[branchIndex] ?? route.tileNumbers;
}

function updateRoutePath(
  route: RouteDefinition,
  pathId: RoutePathId,
  updater: (tileNumbers: number[]) => number[],
): RouteDefinition {
  if (pathId === "main") {
    return { ...route, tileNumbers: updater(route.tileNumbers) };
  }
  const branchIndex = Number(pathId.replace("branch-", ""));
  if (!Number.isInteger(branchIndex) || branchIndex < 0) {
    return { ...route, tileNumbers: updater(route.tileNumbers) };
  }
  const branches = normalizeRouteBranches(route.branches);
  branches[branchIndex] = updater(branches[branchIndex] ?? []);
  return {
    ...route,
    branches: branches.filter((path) => path.length > 0),
  };
}

type RouteTileNoteDisplay = {
  tile: LoupLoupeTile;
  tileNumber: number;
  note: string;
  noteIndex: number;
};

function getRouteTileNoteDisplays(
  floor: LoupLoupeFloor,
  route: RouteDefinition | null,
): RouteTileNoteDisplay[] {
  if (!route?.tileNotes) return [];
  const firstVisitByTile = new Map<number, number>();
  let visitIndex = 0;
  for (const path of getRoutePaths(route)) {
    for (const tileNumber of path.tileNumbers) {
      if (!firstVisitByTile.has(tileNumber)) firstVisitByTile.set(tileNumber, visitIndex);
      visitIndex += 1;
    }
  }

  return Object.entries(route.tileNotes)
    .map(([tileNumberText, note]) => {
      const tileNumber = Number(tileNumberText);
      const normalizedNote = normalizeOptionalRouteText(note);
      const tile = getTileByMapNumber(floor, tileNumber);
      if (!tile || !normalizedNote) return null;
      return {
        tile,
        tileNumber,
        note: normalizedNote,
        firstVisit: firstVisitByTile.get(tileNumber) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => a.firstVisit - b.firstVisit || a.tileNumber - b.tileNumber)
    .map(({ firstVisit: _firstVisit, ...entry }, index) => ({
      ...entry,
      noteIndex: index + 1,
    }));
}

function getWarpHighlightColor(warpPointColor: number): string {
  switch (warpPointColor) {
    case 1:
      return "#ff7272";
    case 2:
      return "#67ff9d";
    case 3:
      return "#59a8ff";
    case 4:
      return "#ffd84d";
    case 5:
      return "#ffae57";
    case 6:
      return "#d18cff";
    default:
      return "#7be8ff";
  }
}

function resolveWarpDestinations(
  floor: LoupLoupeFloor,
  tile: LoupLoupeTile,
  warp: LoupLoupeEvent["warp_points"][number],
): LoupLoupeTile[] {
  const directDestination = floor.tiles.find(
    (candidate) =>
      candidate.master_tower_map_id !== tile.master_tower_map_id &&
      candidate.map_number === warp.warp_number,
  );

  if (directDestination) return [directDestination];

  // Destination portals often share the same warp group as their incoming
  // source, so use the group as a reverse link when the direct target is self.
  const exactMatches = floor.tiles.filter(
    (candidate) =>
      candidate.master_tower_map_id !== tile.master_tower_map_id &&
      candidate.event?.warp_points?.some(
        (otherWarp) =>
          otherWarp.warp_number === warp.warp_number &&
          otherWarp.master_tower_warp_point_group_id ===
            warp.master_tower_warp_point_group_id,
      ),
  );

  if (exactMatches.length > 0) return exactMatches;

  return floor.tiles.filter(
    (candidate) =>
      candidate.master_tower_map_id !== tile.master_tower_map_id &&
      candidate.event?.warp_points?.some(
        (otherWarp) =>
          otherWarp.warp_number === warp.warp_number &&
          otherWarp.warp_point_color === warp.warp_point_color,
      ),
  );
}

// Tempest.TowerMapUtility builds m_gridPositions as rows of 1, 3, 5, ...
// entries. A36 uses the first 6 rows, A64 the first 8, and so on.
function getTowerGridXY(mapNumber: number): { x: number; y: number } {
  let cumulative = 0;
  for (let y = 0; y < 12; y++) {
    const width = y * 2 + 1;
    if (mapNumber <= cumulative + width) {
      return { x: mapNumber - cumulative - 1, y };
    }
    cumulative += width;
  }
  return { x: 0, y: 0 };
}

function getTilePosition(tile: LoupLoupeTile): Vec3 {
  const { xPitch, zPitch, zOffset } = towerAssets.tileLayout;
  const { x, y } = getTowerGridXY(tile.map_number);
  const diagonal = x - y;
  // Negate worldX to mirror horizontally; the camera sees the diamond from
  // the opposite side compared to the in-game render.
  const worldX = -diagonal * xPitch;
  const worldZ = y - Math.abs(diagonal) * zPitch + zOffset;
  return [worldX, 0.02, worldZ];
}

function getChipPrefabKey(floor: LoupLoupeFloor, tile: LoupLoupeTile): string {
  const common = towerAssets.chips.common;
  const refs = towerAssets.runtimeReferences;
  const eventChip =
    refs?.eventChips[String(eventType(tile.event))]?.find(Boolean);
  if (eventChip) return eventChip;

  const runtimeVariation =
    refs?.variationChips[floor.map_variation] ?? refs?.variationChips.TowerIzis;
  const runtimeChip = runtimeVariation?.find(Boolean);
  if (runtimeChip) return runtimeChip;

  const variation =
    towerAssets.chips.variations[floor.map_variation] ??
    towerAssets.chips.variations.TowerIzis;
  return variation?.ChipA ?? common.GridChip_Unselected;
}

function getTowerBuffType(event: LoupLoupeEvent | null): number | null {
  for (const effect of event?.effects ?? []) {
    const towerBuffType = effect.tower_buff_type;
    if (typeof towerBuffType === "number" && towerBuffType > 0)
      return towerBuffType;
  }
  return null;
}

function getObjectPlacements(tile: LoupLoupeTile): ObjectPlacement[] {
  const event = tile.event;
  const refs = towerAssets.runtimeReferences;
  const type = eventType(event);
  const runtimeObjects = refs?.eventObjects[String(type)] ?? [];
  const defaultScale: Vec3 = [1, 1, 1];
  const defaultPos: Vec3 = [0, 0, 0];
  const place = (key: string | null | undefined): ObjectPlacement | null =>
    key ? { key, scale: defaultScale, position: defaultPos } : null;

  if (type === 9)
    return [place(refs?.playerObject ?? towerAssets.objects.Player)].filter(
      Boolean,
    ) as ObjectPlacement[];
  if (type === 8) {
    return runtimeObjects.map(place).filter(Boolean) as ObjectPlacement[];
  }
  if (type === 5) {
    const grade = Math.max(1, event?.master_tower_enemy_grade ?? 1);
    return [
      place(
        runtimeObjects[grade - 1] ??
          runtimeObjects[0] ??
          towerAssets.objects.EnemySymbol,
      ),
    ].filter(Boolean) as ObjectPlacement[];
  }
  if (type === 6 || type === 7) {
    const towerBuffType = getTowerBuffType(event);
    const spiritObjects =
      runtimeObjects.length > 0
        ? runtimeObjects
        : (refs?.eventObjects["6"] ?? []);
    return [
      place(towerBuffType === null ? null : spiritObjects[towerBuffType]),
    ].filter(Boolean) as ObjectPlacement[];
  }
  if (type === 10) {
    const color = event?.warp_points?.[0]?.warp_point_color ?? 0;
    return [place(runtimeObjects[color - 1])].filter(
      Boolean,
    ) as ObjectPlacement[];
  }
  if (type === 3 || type === 4 || type === 11) {
    return [place(runtimeObjects[0])].filter(Boolean) as ObjectPlacement[];
  }

  return [];
}

function RewardCard({ reward }: { reward: LoupLoupeReward }) {
  return (
    <div className="flex min-h-24 items-center gap-3 rounded-md border border-border bg-muted/55 p-3 shadow-inner shadow-white/[0.02]">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-border/[0.06]">
        {reward.icon_path ? (
          <img
            src={reward.icon_path}
            alt={getRewardName(reward)}
            className="h-14 w-14 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]"
          />
        ) : (
          <Gem className="h-8 w-8 text-accent" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-black leading-tight text-foreground">
          {getRewardName(reward)}
        </p>
      </div>
      <span className="shrink-0 rounded-md border border-border/[0.22] bg-border/[0.12] px-2 py-1 text-sm font-black text-foreground">
        x{formatNumber(reward.quantity)}
      </span>
    </div>
  );
}

function RewardGrid({ rewards }: { rewards: LoupLoupeReward[] }) {
  if (rewards.length === 0) {
    return (
      <p className="rounded-md border border-border bg-background/45 p-4 text-sm font-semibold text-muted-foreground">
        No rewards.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rewards.map((reward) => (
        <RewardCard key={reward.master_reward_id} reward={reward} />
      ))}
    </div>
  );
}

function RewardGroups({ groups }: { groups: RewardGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.key} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[#fbbf24]">
              {group.title}
            </h3>
            {group.subtitle ? (
              <span className="text-xs font-bold text-muted-foreground">
                {group.subtitle}
              </span>
            ) : null}
          </div>
          <RewardGrid rewards={group.rewards} />
        </section>
      ))}
    </div>
  );
}

function ChallengeRewardGroups({
  rewards,
}: {
  rewards: LoupLoupeChallengeReward[];
}) {
  if (rewards.length === 0) {
    return (
      <p className="rounded-md border border-border bg-background/45 p-4 text-sm font-semibold text-muted-foreground">
        No challenge rewards.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {rewards.map((reward) => (
        <section
          key={reward.master_tower_challenge_reward_id}
          className="space-y-2"
        >
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-accent">
            Challenge {reward.progress_num}/3
          </h3>
          <RewardGrid rewards={reward.rewards} />
        </section>
      ))}
    </div>
  );
}

function InfoChip({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-md border border-border bg-border/[0.08] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-black text-foreground">
        {value || "None"}
      </p>
    </div>
  );
}

function QuestPayout({ quest }: { quest: LoupLoupeQuest | null }) {
  if (!quest) return null;

  const payouts = [
    { label: "Gold", value: quest.reward_gold, icon: GOLD_ICON },
    { label: "User EXP", value: quest.reward_user_exp, icon: "" },
    { label: "Character EXP", value: quest.reward_pc_exp, icon: "" },
  ].filter((payout) => payout.value > 0);

  if (payouts.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {payouts.map((payout) => (
        <div
          key={payout.label}
          className="flex items-center gap-3 rounded-md border border-border bg-muted/55 p-3"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-border/[0.06]">
            {payout.icon ? (
              <img
                src={payout.icon}
                alt=""
                className="h-10 w-10 object-contain"
              />
            ) : (
              <Sparkles className="h-6 w-6 text-accent" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {payout.label}
            </p>
            <p className="text-base font-black text-foreground">
              {formatNumber(payout.value)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function EnemyPanel({
  event,
  enemy,
}: {
  event: LoupLoupeEvent;
  enemy?: WikiEnemy;
}) {
  const quest = event.quest;
  const title =
    enemy?.name ||
    quest?.quest_name ||
    event.master_tower_enemy_grade_label ||
    "Enemy";

  return (
    <div className="grid gap-4 rounded-md border border-border bg-muted/55 p-4 sm:grid-cols-[120px_1fr]">
      <div className="flex h-28 w-28 items-center justify-center justify-self-center rounded-md border border-border bg-border/[0.06]">
        {enemy?.thumb ? (
          <img
            src={enemy.thumb}
            alt={enemy.name}
            className="h-full w-full object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.8)]"
          />
        ) : (
          <Sparkles className="h-10 w-10 text-rose-100" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xl font-black text-foreground">{title}</p>
        {quest?.quest_name && quest.quest_name !== title ? (
          <p className="mt-1 truncate text-sm font-semibold text-muted-foreground">
            {quest.quest_name}
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <InfoChip
            label="Element"
            value={enemy?.element || quest?.recommend_master_element_type_label}
          />
          <InfoChip
            label="Attack"
            value={
              enemy?.attack_type || quest?.recommend_master_attack_type_label
            }
          />
          <InfoChip
            label="EP"
            value={quest?.recommend_ep ? formatNumber(quest.recommend_ep) : ""}
          />
          <InfoChip
            label="Grade"
            value={event.master_tower_enemy_grade_label}
          />
        </div>
      </div>
    </div>
  );
}

function humanizeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[_/.-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b(Hp|hp)\b/g, "HP")
    .replace(/\b(Ep|ep)\b/g, "EP")
    .replace(/\b(Sp|sp)\b/g, "SP")
    .replace(/\b(Atk|atk)\b/g, "ATK")
    .replace(/\b(Def|def)\b/g, "DEF")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulLabel(value: string | null | undefined): boolean {
  const label = humanizeLabel(value);
  return Boolean(
    label &&
    !/^Unknown\(/i.test(label) &&
    label !== "Invalid" &&
    label !== "None",
  );
}

function formatEffectNumber(
  value: number,
  valueType?: number,
  parameterType?: number,
): string {
  const absolute = Math.abs(value || 0);
  const percentParameters = new Set([
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 300, 301, 302,
    303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317,
    318, 319, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413,
    414, 415, 416, 417, 418, 419, 420, 500, 501, 502, 503, 504, 505, 506, 507,
    508, 509, 510, 511, 512, 513, 514, 515, 600, 601, 602, 603, 604, 605, 606,
    607, 608, 609, 610, 611, 612, 613, 614, 615, 616, 617, 700, 701, 702, 703,
    704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718,
    719, 720, 721, 722, 723, 801, 901, 902, 903, 1001, 1101, 1102, 1200, 1201,
    1202, 1300, 1301, 1302, 1303, 1304, 1305, 1306, 1400, 1401, 1402, 1403,
    1501, 1502, 1503, 1504, 1505, 1506, 1507, 1508, 1509, 1510, 1511, 1512,
    1513, 1514, 1515, 1516, 1517, 1518, 1519, 1520, 1521, 1522, 1523, 1524,
    1525, 1526, 1527, 1528, 1701, 1802, 1803, 1804, 1805, 1806, 1807, 1808,
    1809, 1810, 1811, 1812, 9900,
  ]);
  if (
    valueType === 0 ||
    valueType === 2 ||
    valueType === 3 ||
    percentParameters.has(parameterType || -1)
  ) {
    const percent = absolute / 100;
    return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toString()}%`;
  }
  return formatNumber(absolute);
}

function getParameterLabel(effect: LoupLoupeEffect): string {
  const label =
    effect.effect_parameter_label ||
    effect.source_buff_effect?.parameter_type_label ||
    "effect";
  if (/^parameter\s+\d+$/i.test(label)) {
    if (effect.source_buff_effect?.parameter_type === 902)
      return "protection gauge increase";
    if (effect.source_buff_effect?.parameter_type === 901)
      return "skill point increase";
    if (effect.source_buff_effect?.parameter_type === 903)
      return "secret skill gauge increase";
  }
  return label.toLowerCase();
}

function getTargetLabel(effect: LoupLoupeEffect): string {
  const target =
    effect.effect_target_label ||
    effect.source_buff_effect?.target_label ||
    effect.source_attack_effect?.target_label ||
    "all allies";
  const normalized = target.toLowerCase();
  if (normalized === "all character" || normalized === "all characters")
    return "all allies";
  return normalized;
}

function getTargetBadge(effect: LoupLoupeEffect): string {
  const badge =
    effect.effect_target_badge ||
    effect.source_buff_effect?.target_badge ||
    effect.source_attack_effect?.target_badge ||
    "";
  if (badge) return badge;
  const target = getTargetLabel(effect);
  if (target === "all allies") return "ALL";
  if (target === "self") return "SELF";
  return "";
}

function getEffectSummary(effect: LoupLoupeEffect): string {
  if (
    effect.effect_summary &&
    !/Parameter \d+|Value type \d+|Source effect|Direction:/i.test(
      effect.effect_summary,
    )
  ) {
    return effect.effect_summary;
  }

  const isDown =
    effect.effect_value_type_label === "Down" ||
    effect.buff_type_label === "Debuff";
  const verb = isDown ? "Decreases" : "Increases";
  const target = getTargetLabel(effect);
  const parameter = getParameterLabel(effect);
  const amount =
    effect.effect_amount_label ||
    effect.source_buff_effect?.value_display ||
    formatEffectNumber(
      effect.source_buff_effect?.value ||
        effect.source_attack_effect?.value ||
        effect.description_value ||
        0,
      effect.source_buff_effect?.value_type,
      effect.source_buff_effect?.parameter_type,
    );

  return `${verb} ${target} ${parameter} by ${amount}.`;
}

function getEffectDetailRows(effect: LoupLoupeEffect): Array<[string, string]> {
  const rows: Array<[string, string]> = [];

  if (effect.source_buff_effect?.turn && effect.source_buff_effect.turn > 0) {
    rows.push([
      "Duration",
      `${formatNumber(effect.source_buff_effect.turn)} turn${effect.source_buff_effect.turn === 1 ? "" : "s"}`,
    ]);
  }

  if (effect.limit_action_count > 0)
    rows.push([
      "Limit",
      `${formatNumber(effect.limit_action_count)} action${effect.limit_action_count === 1 ? "" : "s"}`,
    ]);
  if (effect.is_init_turn_only) rows.push(["Timing", "Initial turn only"]);

  return rows;
}

function EffectPanel({ effects }: { effects: LoupLoupeEffect[] }) {
  if (effects.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {effects.map((effect) => {
        const rows = getEffectDetailRows(effect);
        const title =
          effect.effect_title ||
          (effect.buff_type_label === "Debuff" ? "Weakening" : "Enhancements");
        const targetBadge = getTargetBadge(effect);

        return (
          <div
            key={effect.master_tower_effect_id}
            className="rounded-md border border-border bg-muted/55 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black text-foreground">{title}</p>
              {targetBadge ? (
                <span className="rounded-full border border-accent/15 bg-accent/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-accent">
                  {targetBadge}
                </span>
              ) : null}
            </div>

            <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground/90">
              {getEffectSummary(effect)}
            </p>

            {rows.length > 0 ? (
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                {rows.map(([label, value]) => (
                  <div
                    key={`${effect.master_tower_effect_id}-${label}`}
                    className="rounded-md border border-border bg-border/5 px-2.5 py-2"
                  >
                    <dt className="font-black uppercase tracking-[0.12em] text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="mt-0.5 font-bold text-accent">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function collectSubmeshes(group: THREE.Group): THREE.BufferGeometry[] {
  const list: THREE.BufferGeometry[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry as THREE.BufferGeometry;
      // The exported .obj files do not carry vertex normals (`vn` lines
      // were dropped during export).  Without normals meshLambertMaterial
      // can't compute lambertian lighting and the mesh renders black.
      // Compute flat-shaded face normals once at load time so any lit
      // material we attach gets correct light contribution.
      if (!geometry.getAttribute("normal")) {
        geometry.computeVertexNormals();
      }
      list.push(geometry);
    }
  });
  return list;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function scalarCurveValue(
  curve: UnityMinMaxCurve | undefined,
  fallback = 0,
): number {
  if (!curve) return fallback;
  if (typeof curve.scalar === "number") return curve.scalar;
  if (typeof curve.maxScalar === "number") return curve.maxScalar;
  if (typeof curve.minScalar === "number") return curve.minScalar;
  return fallback;
}

function evaluateUnityCurve(keys: UnityCurveKey[], time: number): number {
  if (keys.length === 0) return 0;
  if (keys.length === 1 || time <= keys[0].time) return keys[0].value;
  for (let i = 0; i < keys.length - 1; i++) {
    const left = keys[i];
    const right = keys[i + 1];
    if (time > right.time) continue;
    const span = Math.max(0.0001, right.time - left.time);
    const t = (time - left.time) / span;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return (
      h00 * left.value +
      h10 * span * left.outSlope +
      h01 * right.value +
      h11 * span * right.inSlope
    );
  }
  return keys[keys.length - 1].value;
}

function positiveClipFrames(clip: TowerAnimationClip): StreamedClipFrame[] {
  const values: Record<string, number> = {};
  const frames: StreamedClipFrame[] = [];
  for (const frame of clip.frames) {
    Object.assign(values, frame.values);
    if (frame.time >= 0 && Number.isFinite(frame.time)) {
      frames.push({ time: frame.time, values: { ...values } });
    }
  }
  return frames;
}

function sampleClipValues(
  clip: TowerAnimationClip,
  elapsed: number,
): Record<string, number> {
  const frames = positiveClipFrames(clip);
  if (frames.length === 0) return {};
  const duration =
    clip.duration > 0 ? clip.duration : frames[frames.length - 1].time;
  const time = duration > 0 ? elapsed % duration : 0;
  let previous = frames[0];
  let next = frames[frames.length - 1];
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].time <= time) previous = frames[i];
    if (frames[i].time >= time) {
      next = frames[i];
      break;
    }
  }
  if (previous === next) return previous.values;
  const span = Math.max(0.0001, next.time - previous.time);
  const t = (time - previous.time) / span;
  const values: Record<string, number> = { ...previous.values };
  for (const key of Object.keys(next.values)) {
    const a = previous.values[key] ?? next.values[key];
    const b = next.values[key];
    values[key] = a + (b - a) * t;
  }
  return values;
}

function animationForTarget(
  prefab: TowerPrefab,
  target: string,
  type: TowerPrefabAnimation["type"],
): TowerPrefabAnimation | undefined {
  return (prefab.animations ?? []).find(
    (animation) => animation.target === target && animation.type === type,
  );
}

function animationForNode(
  prefab: TowerPrefab,
  node: TowerPrefabNode,
  type: TowerPrefabAnimation["type"],
): TowerPrefabAnimation | undefined {
  const nodePath = node.path ?? node.name;
  return (prefab.animations ?? []).find((animation) => {
    if (animation.type !== type) return false;
    const targetPath = animation.targetPath ?? animation.target;
    return (
      nodePath === targetPath ||
      nodePath.startsWith(`${targetPath}/`) ||
      node.name === animation.target
    );
  });
}

function firstAnimatorClip(
  prefab: TowerPrefab,
  clipName: string,
): TowerAnimationClip | undefined {
  for (const animation of prefab.animations ?? []) {
    if (animation.type !== "Animator") continue;
    const clip = animation.clips.find(
      (candidate) => candidate.name === clipName,
    );
    if (clip) return clip;
  }
  return undefined;
}

function PlainSubmesh({
  geometry,
  materialInfo,
}: {
  geometry: THREE.BufferGeometry;
  materialInfo?: TowerMaterialInfo;
}) {
  const color = useMemo(() => {
    const base = new THREE.Color(...(materialInfo?.baseColor.slice(0, 3) ?? [1, 1, 1]));
    return materialInfo ? brightenMapMaterialColor(base, materialInfo) : base;
  }, [materialInfo]);
  const lit = shouldUseLitMaterial(materialInfo);
  return (
    <mesh geometry={geometry} dispose={null}>
      {lit ? (
        <meshLambertMaterial color={color} side={THREE.DoubleSide} />
      ) : (
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
}

function TexturedSubmesh({
  geometry,
  materialInfo,
  texturePath,
  colorOverride,
  opacityOverride,
  colorClip,
}: {
  geometry: THREE.BufferGeometry;
  materialInfo: TowerMaterialInfo;
  texturePath: string;
  colorOverride?: THREE.Color;
  opacityOverride?: number;
  colorClip?: TowerAnimationClip;
}) {
  const texturePaths = useMemo(
    () =>
      materialInfo.emissionTexture
        ? [texturePath, materialInfo.emissionTexture]
        : [texturePath],
    [materialInfo.emissionTexture, texturePath],
  );
  const loadedTextures = useLoader(
    THREE.TextureLoader,
    texturePaths,
  ) as THREE.Texture[];
  const texture = loadedTextures[0];
  const emissionTexture = materialInfo.emissionTexture
    ? loadedTextures[1]
    : undefined;
  const baseColor = useMemo(
    () => brightenMapMaterialColor(new THREE.Color(...materialInfo.baseColor.slice(0, 3)), materialInfo),
    [materialInfo],
  );
  const emissionColor = useMemo(
    () => getEmissionColor(materialInfo),
    [materialInfo],
  );
  const emissionOpacity = useMemo(
    () => getEmissionOpacity(materialInfo),
    [materialInfo],
  );
  const additive = usesAdditiveTexture(materialInfo.name, materialInfo);
  const alpha = materialInfo.baseColor[3];
  // Use a lit material for URP/Lit and Tempest/Tower/* shader families so
  // the scene lights actually contribute (the way they do in Unity at
  // runtime) instead of multiplying baseColor by a magic number.  Additive,
  // distortion, invisible, and shadow shaders remain unlit.
  const lit = !additive && shouldUseLitMaterial(materialInfo);
  const materialRef = useRef<THREE.MeshBasicMaterial | THREE.MeshLambertMaterial>(null);
  const emissionMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  // Only treat as transparent when the material explicitly uses the alpha channel
  // for transparency (composited/mask textures) or sits in the transparent render
  // queue.  Standard colour-only slots (_MainTexture, _BaseMap, …) use alpha for
  // effects (specular masks, rim-light) — treating them as transparent discards
  // pixels whose alpha happens to be 0 even though the mesh is opaque.
  const usesAlphaChannel =
    (materialInfo.textureSlot?.includes("Alpha") ?? false) ||
    (materialInfo.renderQueue ?? -1) >= 3000;
  const needsTransparency = additive || usesAlphaChannel || Boolean(colorClip);

  useMemo(() => {
    applyMaterialTextureSettings(
      texture,
      materialInfo,
      materialInfo.textureOffset,
      materialInfo.textureScale,
    );
    if (emissionTexture) {
      applyMaterialTextureSettings(
        emissionTexture,
        materialInfo,
        materialInfo.emissionOffset,
        materialInfo.emissionScale,
      );
    }
  }, [emissionTexture, materialInfo, texture]);

  useFrame(({ clock }) => {
    if (!colorClip) return;
    const values = sampleClipValues(colorClip, clock.getElapsedTime());
    const r = values["0"];
    const g = values["1"];
    const b = values["2"];
    const a = values["3"];
    if (
      typeof r === "number" &&
      typeof g === "number" &&
      typeof b === "number"
    ) {
      materialRef.current?.color.setRGB(r, g, b);
      emissionMaterialRef.current?.color.setRGB(r, g, b);
    }
    if (typeof a === "number") {
      if (materialRef.current)
        materialRef.current.opacity = Math.max(0, Math.min(1, a));
      if (emissionMaterialRef.current)
        emissionMaterialRef.current.opacity = Math.max(0, Math.min(1, a));
    }
  });

  return (
    <group>
      <mesh geometry={geometry} dispose={null}>
        {lit ? (
          <meshLambertMaterial
            ref={materialRef as React.Ref<THREE.MeshLambertMaterial>}
            alphaTest={needsTransparency ? 0.04 : 0}
            color={colorOverride ?? baseColor}
            depthWrite={!colorClip}
            map={texture}
            opacity={opacityOverride ?? materialInfo.baseColor[3]}
            side={THREE.DoubleSide}
            transparent={needsTransparency}
          />
        ) : (
          <meshBasicMaterial
            ref={materialRef as React.Ref<THREE.MeshBasicMaterial>}
            alphaTest={needsTransparency ? 0.04 : 0}
            blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
            color={colorOverride ?? baseColor}
            depthWrite={!additive && !colorClip}
            map={texture}
            opacity={
              opacityOverride ?? (additive ? 0.58 : materialInfo.baseColor[3])
            }
            side={THREE.DoubleSide}
            transparent={needsTransparency}
          />
        )}
      </mesh>
      {emissionTexture ? (
        <mesh geometry={geometry} dispose={null} renderOrder={2}>
          <meshBasicMaterial
            ref={emissionMaterialRef}
            alphaTest={0.02}
            blending={THREE.AdditiveBlending}
            color={emissionColor}
            depthWrite={false}
            map={emissionTexture}
            opacity={emissionOpacity}
            side={THREE.DoubleSide}
            transparent
          />
        </mesh>
      ) : null}
    </group>
  );
}

function MeshNode({
  node,
  prefab,
  prefabKey,
}: {
  node: TowerPrefabNode;
  prefab: TowerPrefab;
  prefabKey: string;
}) {
  const group = useLoader(OBJLoader, node.mesh);
  const submeshes = useMemo(() => collectSubmeshes(group), [group]);
  const quaternion = useMemo(
    () => new THREE.Quaternion(...node.rotation),
    [node.rotation],
  );
  const animatedGroup = useRef<THREE.Group>(null);
  const bobAnimation = animationForNode(prefab, node, "TowerMapObjectAnimator");
  const rotatorAnimation = animationForNode(
    prefab,
    node,
    "PlayerCursorRotator",
  );
  const selectedColorClip =
    prefab.name === "GridChip_Selected"
      ? firstAnimatorClip(prefab, "GridChip_Selected")
      : undefined;
  const circleClip = prefab.name.startsWith("WarpBase")
    ? firstAnimatorClip(prefab, "CircleAnime")
    : undefined;

  useFrame(({ clock }) => {
    const target = animatedGroup.current;
    if (!target) return;
    const elapsed = clock.getElapsedTime();
    target.position.set(node.position[0], node.position[1], node.position[2]);
    target.rotation.set(0, 0, 0);

    if (
      bobAnimation?.type === "TowerMapObjectAnimator" &&
      bobAnimation.curve.length > 0
    ) {
      const duration =
        bobAnimation.curve[bobAnimation.curve.length - 1]?.time ?? 1;
      const seedPath = bobAnimation.targetPath ?? bobAnimation.target;
      const phase = bobAnimation.randomDelay
        ? (hashString(`${prefabKey}:${seedPath}`) / 0xffffffff) * duration
        : 0;
      const time =
        duration > 0 ? (elapsed * bobAnimation.speed + phase) % duration : 0;
      const parentYScale = bobAnimation.parentScale?.[1] ?? 1;
      target.position.y =
        node.position[1] +
        evaluateUnityCurve(bobAnimation.curve, time) *
          bobAnimation.force *
          parentYScale;
    }

    if (rotatorAnimation?.type === "PlayerCursorRotator") {
      target.rotation.y = THREE.MathUtils.degToRad(
        elapsed * rotatorAnimation.speed,
      );
    }

    if (
      circleClip &&
      (node.name === "MagicCircleBase" || node.name === "MagicCircleLetter")
    ) {
      const values = sampleClipValues(circleClip, elapsed);
      const rotationIndex = node.name === "MagicCircleBase" ? "2" : "5";
      target.rotation.z = THREE.MathUtils.degToRad(values[rotationIndex] ?? 0);
    }
  });

  if (submeshes.length === 0) return null;

  return (
    <group ref={animatedGroup} position={node.position}>
      <group quaternion={quaternion} scale={node.scale}>
        {submeshes.map((geometry, index) => {
          // Match each submesh to its material slot. Unity's OBJ export emits one
          // submesh per material in the order Unity assigns; if a node only has
          // one geometry but multiple materials, the first material wins.
          const materialName = node.materials[index] ?? node.materials[0];
          const materialInfo = materialName
            ? towerAssets.materials[materialName]
            : undefined;
          const texturePath = getMaterialTexture(materialInfo);
          const key = `${node.mesh}-${index}`;
          if (materialInfo && texturePath) {
            return (
              <TexturedSubmesh
                key={key}
                geometry={geometry}
                materialInfo={materialInfo}
                texturePath={texturePath}
                colorClip={selectedColorClip}
              />
            );
          }
          return (
            <PlainSubmesh
              key={key}
              geometry={geometry}
              materialInfo={materialInfo}
            />
          );
        })}
      </group>
    </group>
  );
}

// Spirit prefabs drive the visible orbs through invisible sub-emitter
// controllers. Each controller emits one parent particle from its own Shape
// module, then spawns a co-located Glow and Flare child at that emitted point.
function isSpiritParticle(particle: TowerPrefabParticle): boolean {
  return particle.materials.some((material) =>
    material.startsWith("T_Spirit_Particle"),
  );
}

function isSpiritControllerParticle(particle: TowerPrefabParticle): boolean {
  return Boolean(
    /T_Spirit_Particle_Common/i.test(particle.path ?? particle.name) &&
    particle.settings?.modules?.subEmitters?.enabled &&
    particle.settings.modules.subEmitters.items?.length,
  );
}

function isGlowParticle(particle: TowerPrefabParticle): boolean {
  return (
    /Glow/i.test(particle.name) ||
    particle.materials.some((material) => /Glow/i.test(material))
  );
}

function isFlareParticle(particle: TowerPrefabParticle): boolean {
  return (
    /Flare/i.test(particle.name) ||
    particle.materials.some((material) => /Flare/i.test(material))
  );
}

function particleAtPosition(
  particle: TowerPrefabParticle,
  position: Vec3,
): TowerPrefabParticle {
  return { ...particle, position };
}

type SpiritOrbPair = {
  position: Vec3;
  y: number;
  controller?: TowerPrefabParticle;
  glow?: TowerPrefabParticle;
  flare?: TowerPrefabParticle;
};

function childParticleForSubEmitter(
  particlesByPath: Map<string, TowerPrefabParticle>,
  particles: TowerPrefabParticle[],
  controller: TowerPrefabParticle,
  targetName: string | undefined,
): TowerPrefabParticle | undefined {
  if (!targetName || !controller.path) return undefined;
  const exact = particlesByPath.get(`${controller.path}/${targetName}`);
  if (exact) return exact;
  return particles.find(
    (particle) =>
      particle.path?.startsWith(`${controller.path}/`) &&
      particle.name === targetName,
  );
}

function buildControllerSpiritPairs(
  particles: TowerPrefabParticle[],
): SpiritOrbPair[] {
  const particlesByPath = new Map<string, TowerPrefabParticle>();
  for (const particle of particles) {
    if (particle.path) particlesByPath.set(particle.path, particle);
  }

  const pairs: SpiritOrbPair[] = [];
  for (const controller of particles.filter(isSpiritControllerParticle)) {
    let glow: TowerPrefabParticle | undefined;
    let flare: TowerPrefabParticle | undefined;
    for (const item of controller.settings?.modules?.subEmitters?.items ?? []) {
      const child = childParticleForSubEmitter(
        particlesByPath,
        particles,
        controller,
        item.targetName,
      );
      if (!child) continue;
      if (isGlowParticle(child)) glow = child;
      if (isFlareParticle(child)) flare = child;
    }
    if (glow && flare) {
      pairs.push({
        controller,
        glow,
        flare,
        position: controller.position,
        y: controller.position[1],
      });
    }
  }
  return pairs.sort((a, b) => a.y - b.y);
}

function buildFallbackSpiritPairs(
  particles: TowerPrefabParticle[],
): SpiritOrbPair[] {
  const pairsByY = new Map<string, SpiritOrbPair>();

  for (const particle of particles) {
    const isOrbPart =
      isSpiritParticle(particle) &&
      (isGlowParticle(particle) || isFlareParticle(particle));
    if (!isOrbPart) continue;

    const y = particle.position[1];
    const yKey = y.toFixed(6);
    const pair = pairsByY.get(yKey) ?? { position: particle.position, y };
    if (isGlowParticle(particle)) pair.glow = particle;
    if (isFlareParticle(particle)) pair.flare = particle;
    pairsByY.set(yKey, pair);
  }

  return Array.from(pairsByY.values())
    .filter((pair) => pair.glow && pair.flare)
    .sort((a, b) => a.y - b.y);
}

function buildSpiritOrbPairs(particles: TowerPrefabParticle[]): {
  pairs: SpiritOrbPair[];
} {
  const pairs = buildControllerSpiritPairs(particles);
  if (pairs.length === 0) pairs.push(...buildFallbackSpiritPairs(particles));
  return {
    pairs: pairs.map((pair) => {
      const position: Vec3 = [
        pair.position[0],
        SPIRIT_ORB_GROUND_Y,
        pair.position[2],
      ];
      return { ...pair, position, y: position[1] };
    }),
  };
}

function sampleMinMaxCurve(
  curve: UnityMinMaxCurve | undefined,
  seed: number,
  fallback = 0,
): number {
  if (!curve) return fallback;
  if (
    curve.minMaxState === 3 &&
    typeof curve.scalar === "number" &&
    typeof curve.minScalar === "number"
  ) {
    return curve.minScalar + (curve.scalar - curve.minScalar) * seed;
  }
  return scalarCurveValue(curve, fallback);
}

function clampSpiritTileXZ(x: number, z: number): [number, number] {
  const distance = Math.hypot(x, z);
  if (distance <= SPIRIT_ORB_CENTER_LIMIT || distance === 0) return [x, z];
  const scale = SPIRIT_ORB_CENTER_LIMIT / distance;
  return [x * scale, z * scale];
}

function pairMotion(
  pair: SpiritOrbPair,
  index: number,
): { radius: number; speed: number; phase: number } {
  const controllerModules = pair.controller?.settings?.modules;
  const velocitySource = pair.glow ?? pair.flare ?? pair.controller;
  const velocityModules = velocitySource?.settings?.modules;
  const seedSource = pair.controller ?? velocitySource;
  const phaseSeed =
    typeof seedSource?.settings?.modules?.randomSeed === "number"
      ? (seedSource.settings.modules.randomSeed % 10000) / 9999
      : (hashString(
          `${seedSource?.path ?? seedSource?.name ?? "orb"}:${pair.y}:${index}`,
        ) %
          10000) /
        9999;
  const velocitySeed =
    typeof velocityModules?.randomSeed === "number"
      ? (velocityModules.randomSeed % 10000) / 9999
      : phaseSeed;
  const shape = controllerModules?.shape;
  const shapeRadius =
    shape?.donutRadius && shape.donutRadius > 0
      ? shape.donutRadius
      : (shape?.radius?.value ?? 0);
  const radius = shape?.enabled
    ? shapeRadius *
      Math.max(
        Math.abs(pair.controller?.scale[0] ?? 1),
        Math.abs(pair.controller?.scale[2] ?? 1),
      )
    : 0;
  const clampedRadius = Math.min(radius, SPIRIT_ORB_CENTER_LIMIT);
  return {
    radius: clampedRadius,
    speed:
      clampedRadius > 0
        ? sampleMinMaxCurve(
            velocityModules?.velocity?.orbitalY,
            velocitySeed,
            0,
          ) * (velocityModules?.simulationSpeed ?? 1)
        : 0,
    phase: phaseSeed * Math.PI * 2,
  };
}

function SpiritOrbPairBillboard({
  pair,
  index,
}: {
  pair: SpiritOrbPair;
  index: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const motion = useMemo(() => pairMotion(pair, index), [index, pair]);
  const glow = useMemo(
    () => (pair.glow ? particleAtPosition(pair.glow, [0, 0, 0]) : null),
    [pair.glow],
  );
  const flare = useMemo(
    () => (pair.flare ? particleAtPosition(pair.flare, [0, 0, 0]) : null),
    [pair.flare],
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const angle = motion.phase + clock.getElapsedTime() * motion.speed;
    const [x, z] = clampSpiritTileXZ(
      pair.position[0] + Math.cos(angle) * motion.radius,
      pair.position[2] + Math.sin(angle) * motion.radius,
    );
    ref.current.position.set(x, pair.position[1], z);
  });

  return (
    <group ref={ref} position={pair.position}>
      {glow ? <ParticleBillboard particle={glow} renderOrder={8} /> : null}
      {flare ? <ParticleBillboard particle={flare} renderOrder={8} /> : null}
    </group>
  );
}

function SpiritParticles({ particles }: { particles: TowerPrefabParticle[] }) {
  const { pairs } = useMemo(() => buildSpiritOrbPairs(particles), [particles]);
  return (
    <>
      {pairs.map((pair, index) => (
        <SpiritOrbPairBillboard
          key={`${pair.y}-${index}`}
          pair={pair}
          index={index}
        />
      ))}
    </>
  );
}

function commonParticleHorizontalOffset(
  prefab: TowerPrefab,
  particles: TowerPrefabParticle[],
): Vec3 {
  if (prefab.nodes.length > 0 || particles.length === 0) return [0, 0, 0];
  const [x, , z] = particles[0].position;
  const hasCommonOffset = particles.every(
    (particle) =>
      Math.abs(particle.position[0] - x) < 0.0001 &&
      Math.abs(particle.position[2] - z) < 0.0001,
  );
  return hasCommonOffset ? [-x, 0, -z] : [0, 0, 0];
}

function offsetParticlePosition(
  particle: TowerPrefabParticle,
  offset: Vec3,
): TowerPrefabParticle {
  if (offset[0] === 0 && offset[1] === 0 && offset[2] === 0) return particle;
  return {
    ...particle,
    position: [
      particle.position[0] + offset[0],
      particle.position[1] + offset[1],
      particle.position[2] + offset[2],
    ],
  };
}

function shouldRenderPrefabParticle(
  prefab: TowerPrefab,
  particle: TowerPrefabParticle,
): boolean {
  if (
    prefab.name === "T_Chip_Boss" &&
    particle.materials.includes("T_Chip_Boss_Cylinder")
  ) {
    return false;
  }
  return true;
}

function PrefabInstance({
  prefabKey,
  position = [0, 0, 0],
  scale = [1, 1, 1],
}: {
  prefabKey: string;
  position?: Vec3;
  scale?: Vec3;
}) {
  const prefab = towerAssets.prefabs[prefabKey];
  if (!prefab) return null;

  const originalParticles = (prefab.particles ?? []).filter((particle) =>
    shouldRenderPrefabParticle(prefab, particle),
  );
  const particleOffset = useMemo(
    () => commonParticleHorizontalOffset(prefab, originalParticles),
    [originalParticles, prefab],
  );
  const particles = useMemo(
    () =>
      originalParticles.map((particle) =>
        offsetParticlePosition(particle, particleOffset),
      ),
    [originalParticles, particleOffset],
  );
  const isSpiritPrefab = prefab.name.startsWith("T_Spirit_");

  return (
    <group position={position} scale={scale}>
      {prefab.nodes.map((node, index) => {
        return (
          <MeshNode
            key={`${node.mesh}-${index}`}
            node={node}
            prefab={prefab}
            prefabKey={prefabKey}
          />
        );
      })}
      {isSpiritPrefab ? (
        <SpiritParticles particles={particles} />
      ) : (
        particles.map((part, index) => (
          <ParticleBillboard key={`${part.name}-${index}`} particle={part} />
        ))
      )}
      {prefab.lights.map((light, index) => {
        // Real game data: type 0=Spot, 1=Directional, 2=Point.  No magic
        // intensity scale — Unity intensity values map 1:1 to THREE.js
        // gamma-pipeline intensity.
        const color = new THREE.Color(light.color[0], light.color[1], light.color[2]);
        const key = `${light.name}-${index}`;
        if (light.type === 0) {
          const q = new THREE.Quaternion(
            light.rotation[0],
            light.rotation[1],
            light.rotation[2],
            light.rotation[3],
          );
          const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
          const target: [number, number, number] = [
            light.position[0] + forward.x,
            light.position[1] + forward.y,
            light.position[2] + forward.z,
          ];
          return (
            <SpotLightWithTarget
              key={key}
              color={color}
              intensity={light.intensity}
              position={light.position}
              target={target}
              distance={light.range}
              angle={Math.PI / 6}
              penumbra={0.4}
            />
          );
        }
        if (light.type === 1) {
          return (
            <directionalLight
              key={key}
              color={color}
              intensity={light.intensity}
              position={light.position}
            />
          );
        }
        return (
          <pointLight
            key={key}
            color={color}
            intensity={light.intensity}
            position={light.position}
            distance={light.range}
            decay={0}
          />
        );
      })}
    </group>
  );
}

// Renders the actual in-game lighting for the tower scene the floor lives
// in.  Reads sceneLighting from the JSON the Python generator extracted
// directly from FieldBattle_*Tower*.unity.  No multipliers, no fudge
// factors: ambient + lights map 1:1 from RenderSettings + scene Light
// components, with the Unity LightType enum converted to the matching
// THREE light primitive (0=Spot→spotLight, 1=Directional→directionalLight,
// 2=Point→pointLight, 3=Area→rectAreaLight).
const UNITY_TOWER_LIGHT_X_UNIT = 1.447633;
const UNITY_TOWER_LIGHT_Z_UNIT = 0.928425;
const MAX_BOARD_SCENE_LIGHTS = 16;

function getFloorBoardCenterZ(floor: LoupLoupeFloor): number {
  const { zOffset } = towerAssets.tileLayout;
  return (floor.map_side - 1) / 2 + zOffset;
}

function getUnityToBoardLightScale(): { x: number; y: number; z: number; uniform: number } {
  const { xPitch, zPitch } = towerAssets.tileLayout;
  const x = xPitch / UNITY_TOWER_LIGHT_X_UNIT;
  const z = zPitch / UNITY_TOWER_LIGHT_Z_UNIT;
  const uniform = (x + z) / 2;
  return { x, y: uniform, z, uniform };
}

function unityScenePositionToBoard(
  floor: LoupLoupeFloor,
  position: [number, number, number],
): [number, number, number] {
  const scale = getUnityToBoardLightScale();
  return [
    -position[0] * scale.x,
    position[1] * scale.y,
    position[2] * scale.z + getFloorBoardCenterZ(floor),
  ];
}

function unitySceneDirectionToBoard(direction: THREE.Vector3): THREE.Vector3 {
  const scale = getUnityToBoardLightScale();
  const mapped = new THREE.Vector3(
    -direction.x * scale.x,
    direction.y * scale.y,
    direction.z * scale.z,
  );
  if (mapped.lengthSq() === 0) return new THREE.Vector3(0, -1, 0);
  return mapped.normalize();
}

function unityLightForward(rotation: [number, number, number, number] | null): THREE.Vector3 {
  if (!rotation) return new THREE.Vector3(0, -1, 0);
  const q = new THREE.Quaternion(rotation[0], rotation[1], rotation[2], rotation[3]);
  return new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();
}

function lightTargetFromDirection(
  position: [number, number, number],
  direction: THREE.Vector3,
): [number, number, number] {
  const distanceToBoard = direction.y < -0.001 ? Math.max(1, position[1] / -direction.y) : 8;
  return [
    position[0] + direction.x * distanceToBoard,
    position[1] + direction.y * distanceToBoard,
    position[2] + direction.z * distanceToBoard,
  ];
}

function BoardFillLights({ ambientColor }: { floor: LoupLoupeFloor; ambientColor?: THREE.Color }) {
  const baseAmbient = ambientColor ?? new THREE.Color("#e5f1ff");

  return (
    <>
      <ambientLight color={baseAmbient} intensity={1.25} />
    </>
  );
}

function getBoardSceneLights(lighting: TowerSceneLighting): TowerSceneLight[] {
  return [...lighting.lights]
    .filter((light) => light.intensity > 0)
    .sort((a, b) => {
      const priority = (light: TowerSceneLight) => {
        const typeWeight = light.type === 1 ? 1000 : light.type === 0 ? 650 : light.type === 3 ? 320 : 0;
        return typeWeight + light.intensity * Math.max(1, light.range || 1);
      };
      return priority(b) - priority(a);
    })
    .slice(0, MAX_BOARD_SCENE_LIGHTS);
}

function SceneLightingFromGame({ floor }: { floor: LoupLoupeFloor }) {
  const sceneName = floor.map_scene_name as string | undefined;
  const lighting = sceneName ? towerAssets.sceneLighting?.[sceneName] : undefined;
  if (!lighting) {
    return <BoardFillLights floor={floor} />;
  }
  const rs = lighting.renderSettings;
  const ambEq = rs?.ambientEquatorColor;
  const ambientColor = ambEq
    ? new THREE.Color(ambEq[0], ambEq[1], ambEq[2]).lerp(new THREE.Color("#e5f1ff"), 0.62)
    : undefined;
  return <BoardFillLights floor={floor} ambientColor={ambientColor} />;
}

function DirectionalLightWithTarget({
  color,
  intensity,
  position,
  target,
}: {
  color: THREE.Color;
  intensity: number;
  position: [number, number, number];
  target: [number, number, number];
}) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);
  return (
    <>
      <directionalLight ref={lightRef} color={color} intensity={intensity} position={position} />
      <object3D ref={targetRef} position={target} />
    </>
  );
}

function SpotLightWithTarget({
  color,
  intensity,
  position,
  target,
  distance,
  angle,
  penumbra,
}: {
  color: THREE.Color;
  intensity: number;
  position: [number, number, number];
  target: [number, number, number];
  distance: number;
  angle: number;
  penumbra: number;
}) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);
  // decay=0 matches Unity's non-physical (gamma-space) light model where
  // intensity is a direct scene multiplier rather than candela-per-square-
  // metre.  Without this, THREE r184's default inverse-square fall-off
  // crushes the in-game intensity-9 spots to near-zero by the time their
  // cone reaches the tile floor 7-20 units away.
  return (
    <>
      <spotLight
        ref={lightRef}
        color={color}
        intensity={intensity}
        position={position}
        distance={distance}
        angle={angle}
        penumbra={penumbra}
        decay={0}
      />
      <object3D ref={targetRef} position={target} />
    </>
  );
}

function BoardCamera({ floor }: { floor: LoupLoupeFloor }) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const { zOffset } = towerAssets.tileLayout;
    const centerZ = (floor.map_side - 1) / 2 + zOffset;
    const zoomByTileCount: Record<number, number> = {
      36: 82,
      64: 68,
      100: 55,
      144: 46,
    };
    const mobileScale = size.width < 720 ? 0.40 : 1;
    camera.position.set(0, 10.5600004, centerZ - 9.1599998);
    camera.lookAt(0, 0, centerZ);
    camera.zoom = (zoomByTileCount[floor.tile_count] ?? 58) * mobileScale;
    camera.near = 0.1;
    camera.far = 100;
    camera.updateProjectionMatrix();
  }, [camera, floor.map_side, floor.tile_count, size.width]);

  return null;
}

function TileHitTarget({
  tile,
  onTileClick,
  routeEditor,
}: {
  tile: LoupLoupeTile;
  onTileClick: (tile: LoupLoupeTile) => void;
  routeEditor: RouteEditorPointerHandlers | null;
}) {
  const routeEditorActive = Boolean(routeEditor?.active);
  const interactive = isInteractiveTile(tile) || routeEditorActive;
  if (!interactive) return null;

  return (
    <mesh
      position={[0, 0.36, 0]}
      rotation={[-Math.PI / 2, 0, Math.PI / 6]}
      onClick={(event) => {
        event.stopPropagation();
        if (routeEditorActive) {
          routeEditor?.onTileClick?.(tile);
          return;
        }
        onTileClick(tile);
      }}
      onPointerDown={(event) => {
        if (!routeEditorActive) return;
        event.stopPropagation();
        routeEditor?.onPointerDown(tile);
      }}
      onPointerEnter={(event) => {
        if (!routeEditorActive) return;
        event.stopPropagation();
        routeEditor?.onPointerEnter(tile);
      }}
      onPointerUp={(event) => {
        if (!routeEditorActive) return;
        event.stopPropagation();
        routeEditor?.onPointerUp();
      }}
      onPointerOver={() => {
        document.body.style.cursor = routeEditorActive ? "crosshair" : "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <circleGeometry args={[TILE_RADIUS, 6]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function AtlasBillboard({
  sprite,
  position,
  height = 0.42,
}: {
  sprite: SpriteRef;
  position: Vec3;
  height?: number;
}) {
  const baseTexture = useLoader(THREE.TextureLoader, sprite.atlas.image);
  const texture = useMemo(() => {
    const clone = baseTexture.clone();
    const [atlasWidth, atlasHeight] = sprite.atlas.imageSize;
    clone.colorSpace = THREE.SRGBColorSpace;
    clone.flipY = false;
    clone.wrapS = THREE.ClampToEdgeWrapping;
    clone.wrapT = THREE.ClampToEdgeWrapping;
    clone.repeat.set(sprite.width / atlasWidth, sprite.height / atlasHeight);
    clone.offset.set(
      sprite.x / atlasWidth,
      (atlasHeight - sprite.y - sprite.height) / atlasHeight,
    );
    clone.needsUpdate = true;
    return clone;
  }, [baseTexture, sprite]);
  const width = height * (sprite.width / sprite.height);

  return (
    <sprite position={position} scale={[width, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function useParticleRenderState(
  particle: TowerPrefabParticle,
  useAlphaMask: boolean,
) {
  const matName = particle.materials[0];
  const matInfo = matName ? towerAssets.materials[matName] : undefined;
  const texturePath = getMaterialTexture(matInfo);
  const loadedTexture = useLoader(
    THREE.TextureLoader,
    texturePath || TILE_GLOW_TEXTURE,
  );
  const alphaMaskPath = useAlphaMask ? matInfo?.alphaMaskTexture : undefined;
  const loadedAlphaMaskTexture = useLoader(
    THREE.TextureLoader,
    alphaMaskPath || TILE_GLOW_TEXTURE,
  );
  const texture = useMemo(() => loadedTexture.clone(), [loadedTexture]);
  const alphaMapTexture = useMemo(
    () => (alphaMaskPath ? loadedAlphaMaskTexture.clone() : undefined),
    [alphaMaskPath, loadedAlphaMaskTexture],
  );
  const colorSpeed = materialVector(matInfo, "_ColorSpeed");
  const colorTiling = materialVector(matInfo, "_ColorTilingOffset");
  const alphaMaskSpeed = materialVector(matInfo, "_AlphaMaskSpeed");
  const alphaMaskTiling =
    materialVector(matInfo, "_AlphaMaskTilingOffset") ??
    materialVector(matInfo, "_AlphaMaskTillingOffset");
  const flipColorU = usesMirroredFlareMesh(particle, matInfo);
  const colorUvBase = useMemo(() => {
    const base = materialUvBase(
      colorTiling,
      matInfo?.textureOffset,
      matInfo?.textureScale,
    );
    return flipColorU ? flipUvBaseX(base) : base;
  }, [colorTiling, flipColorU, matInfo?.textureOffset, matInfo?.textureScale]);
  const alphaMaskUvBase = useMemo(
    () =>
      materialUvBase(
        alphaMaskTiling,
        matInfo?.alphaMaskOffset,
        matInfo?.alphaMaskScale,
      ),
    [alphaMaskTiling, matInfo?.alphaMaskOffset, matInfo?.alphaMaskScale],
  );

  useMemo(() => {
    applyParticleTextureSettings(texture, colorUvBase, colorSpeed);
    if (alphaMapTexture) {
      applyParticleTextureSettings(
        alphaMapTexture,
        alphaMaskUvBase,
        alphaMaskSpeed,
      );
      alphaMapTexture.colorSpace = THREE.NoColorSpace;
    }
  }, [
    alphaMapTexture,
    alphaMaskSpeed,
    alphaMaskUvBase,
    colorSpeed,
    colorUvBase,
    texture,
  ]);

  // Tint = particle.startColor (per Unity ParticleSystem InitialModule).
  // Falls back to material baseColor or white.
  const startColor = particle.settings?.startColor;
  const baseColor = matInfo?.baseColor;
  const colorScale = materialFloat(matInfo, "_ColorScale", 1);
  const alphaScale = materialFloat(matInfo, "_Alpha_Scale", 1);
  const opacity = Math.min(
    1,
    (startColor?.[3] ?? baseColor?.[3] ?? 1) * alphaScale,
  );
  const color = useMemo(() => {
    if (startColor)
      return new THREE.Color(
        startColor[0],
        startColor[1],
        startColor[2],
      ).multiplyScalar(colorScale);
    if (baseColor)
      return new THREE.Color(
        baseColor[0],
        baseColor[1],
        baseColor[2],
      ).multiplyScalar(colorScale);
    return new THREE.Color(1, 1, 1).multiplyScalar(colorScale);
  }, [startColor, baseColor, colorScale]);

  // Most TowerIzis particles fall into two visual categories:
  //   - Magic-circle / mahojin: lies FLAT on the ground, rotates around Y
  //   - Glow / flare orb: faces the camera (sprite billboard)
  const isFlatCircle =
    /mahojin|MagicCircle/i.test(matName ?? "") ||
    /mahojin|MagicCircle/i.test(matInfo?.name ?? "");
  const modules = particle.settings?.modules;
  const startSize =
    particle.settings?.startSize ?? scalarCurveValue(modules?.startSize, 1);
  const meshScale = particle.scale[0] * startSize;
  const spriteScaleX = particle.scale[0] * startSize;
  const spriteScaleY =
    particle.scale[1] *
    (modules?.size3D
      ? scalarCurveValue(modules.startSizeY, startSize)
      : startSize);
  const spriteScaleZ =
    particle.scale[2] *
    (modules?.size3D
      ? scalarCurveValue(modules.startSizeZ, startSize)
      : startSize);
  const blendConfig = getUnityBlendConfig(matInfo);
  const rotationSpeed = modules?.rotationOverLifetime?.enabled
    ? scalarCurveValue(modules.rotationOverLifetime.curve, 0) *
      (modules.simulationSpeed ?? 1)
    : 0;
  const startRotation = scalarCurveValue(modules?.startRotation, 0);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const rotation = startRotation + elapsed * rotationSpeed;
    if (colorSpeed)
      texture.offset.set(
        colorUvBase.offset[0] + colorSpeed[0] * elapsed,
        colorUvBase.offset[1] + colorSpeed[1] * elapsed,
      );
    if (alphaMapTexture && alphaMaskSpeed) {
      alphaMapTexture.offset.set(
        alphaMaskUvBase.offset[0] + alphaMaskSpeed[0] * elapsed,
        alphaMaskUvBase.offset[1] + alphaMaskSpeed[1] * elapsed,
      );
    }
  });

  return {
    alphaMapTexture,
    blendConfig,
    color,
    isFlatCircle,
    matInfo,
    matName,
    meshScale,
    rotationSpeed,
    spriteScaleX,
    spriteScaleY,
    spriteScaleZ,
    startRotation,
    opacity,
    texture,
    texturePath,
  };
}

function ParticleBillboard({
  particle,
  renderOrder = 0,
}: {
  particle: TowerPrefabParticle;
  renderOrder?: number;
}) {
  const effectiveRenderOrder =
    renderOrder + (particle.renderer?.sortingFudge ?? 0) / 1000;
  const meshPath =
    particle.renderer?.renderMode === 4 ? particle.renderer.mesh : undefined;
  if (meshPath) {
    return (
      <ParticleMeshBillboard
        particle={particle}
        renderOrder={effectiveRenderOrder}
        meshPath={meshPath}
      />
    );
  }
  return (
    <ParticleSpriteBillboard
      particle={particle}
      renderOrder={effectiveRenderOrder}
    />
  );
}

function ParticleMeshBillboard({
  particle,
  renderOrder = 0,
  meshPath,
}: {
  particle: TowerPrefabParticle;
  renderOrder?: number;
  meshPath: string;
}) {
  const group = useLoader(OBJLoader, meshPath);
  const submeshes = useMemo(() => collectSubmeshes(group), [group]);
  const quaternion = useMemo(
    () => new THREE.Quaternion(...particle.rotation),
    [particle.rotation],
  );
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const visual = useParticleRenderState(particle, true);
  const isMirroredFlare = usesMirroredFlareMesh(particle, visual.matInfo);
  const meshScaleX =
    visual.spriteScaleX /
    (isMirroredFlare ? Math.max(1, particle.renderer?.lengthScale ?? 1) : 1);

  useFrame(({ clock }) => {
    const target = ref.current;
    if (!target) return;
    const rotation =
      visual.startRotation + clock.getElapsedTime() * visual.rotationSpeed;
    if (particle.renderer?.renderAlignment === 0) {
      target.quaternion.copy(camera.quaternion);
    } else {
      target.quaternion.copy(quaternion);
    }
    target.rotateZ(rotation);
  });

  if (!visual.texturePath || submeshes.length === 0) return null;

  return (
    <group
      ref={ref}
      position={particle.position}
      quaternion={quaternion}
      scale={[meshScaleX, visual.spriteScaleY, visual.spriteScaleZ]}
      renderOrder={renderOrder}
    >
      {submeshes.map((geometry, index) => (
        <mesh
          key={`${meshPath}-${index}`}
          geometry={geometry}
          dispose={null}
          renderOrder={renderOrder}
        >
          <meshBasicMaterial
            alphaTest={0.01}
            alphaMap={visual.alphaMapTexture}
            map={visual.texture}
            color={visual.color}
            opacity={visual.opacity}
            transparent
            depthWrite={false}
            blending={visual.blendConfig?.blending ?? THREE.NormalBlending}
            blendSrc={visual.blendConfig?.blendSrc}
            blendDst={visual.blendConfig?.blendDst}
            blendEquation={visual.blendConfig?.blendEquation}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function ParticleSpriteBillboard({
  particle,
  renderOrder = 0,
}: {
  particle: TowerPrefabParticle;
  renderOrder?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const spriteMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const visual = useParticleRenderState(particle, true);

  useFrame(({ clock }) => {
    const rotation =
      visual.startRotation + clock.getElapsedTime() * visual.rotationSpeed;
    if (meshRef.current) meshRef.current.rotation.z = rotation;
    if (spriteMaterialRef.current)
      spriteMaterialRef.current.rotation = rotation;
  });

  if (!visual.texturePath) return null;

  if (visual.isFlatCircle) {
    return (
      <mesh
        ref={meshRef}
        position={particle.position}
        rotation={[-Math.PI / 2, 0, visual.startRotation]}
        scale={[visual.meshScale, visual.meshScale, visual.meshScale]}
        renderOrder={renderOrder}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          alphaTest={0.01}
          alphaMap={visual.alphaMapTexture}
          map={visual.texture}
          color={visual.color}
          opacity={visual.opacity}
          transparent
          depthWrite={false}
          blending={visual.blendConfig?.blending ?? THREE.NormalBlending}
          blendSrc={visual.blendConfig?.blendSrc}
          blendDst={visual.blendConfig?.blendDst}
          blendEquation={visual.blendConfig?.blendEquation}
        />
      </mesh>
    );
  }
  return (
    <sprite
      position={particle.position}
      scale={[visual.spriteScaleX, visual.spriteScaleY, 1]}
      renderOrder={renderOrder}
    >
      <spriteMaterial
        ref={spriteMaterialRef}
        alphaTest={0.01}
        alphaMap={visual.alphaMapTexture}
        map={visual.texture}
        color={visual.color}
        opacity={visual.opacity}
        transparent
        depthWrite={false}
        blending={visual.blendConfig?.blending ?? THREE.NormalBlending}
        blendSrc={visual.blendConfig?.blendSrc}
        blendDst={visual.blendConfig?.blendDst}
        blendEquation={visual.blendConfig?.blendEquation}
      />
    </sprite>
  );
}

function TileInstance({
  floor,
  tile,
  selected,
  onTileClick,
  routeEditor,
}: {
  floor: LoupLoupeFloor;
  tile: LoupLoupeTile;
  selected: boolean;
  onTileClick: (tile: LoupLoupeTile) => void;
  routeEditor: RouteEditorPointerHandlers | null;
}) {
  const position = getTilePosition(tile);
  const chipPrefabKey = getChipPrefabKey(floor, tile);
  const selectedChipKey =
    towerAssets.runtimeReferences?.highlightObjects?.[0] ??
    towerAssets.chips.common.GridChip_Selected;
  const objectPlacements = getObjectPlacements(tile);

  return (
    <group position={position}>
      <PrefabInstance prefabKey={chipPrefabKey} />
      {selected && selectedChipKey ? (
        <PrefabInstance prefabKey={selectedChipKey} position={[0, 0.035, 0]} />
      ) : null}
      {objectPlacements.map((objectPlacement, index) => (
        <PrefabInstance
          key={`${objectPlacement.key}-${index}`}
          prefabKey={objectPlacement.key}
          position={objectPlacement.position}
          scale={objectPlacement.scale}
        />
      ))}
      <TileHitTarget tile={tile} onTileClick={onTileClick} routeEditor={routeEditor} />
    </group>
  );
}

function RouteSegment({
  from,
  to,
  color,
  offset,
  repeated,
}: {
  from: LoupLoupeTile;
  to: LoupLoupeTile;
  color: string;
  offset: number;
  repeated: boolean;
}) {
  const { start, end } = getOffsetRoutePoints(from, to, offset, 0.3);

  return (
    <group>
      <CylinderBetween
        start={start}
        end={end}
        radius={repeated ? 0.095 : 0.082}
        color="#02060f"
        opacity={0.62}
        renderOrder={88}
      />
      <CylinderBetween
        start={start}
        end={end}
        radius={repeated ? 0.071 : 0.062}
        color={color}
        opacity={0.24}
        renderOrder={89}
      />
      <CylinderBetween
        start={start}
        end={end}
        radius={repeated ? 0.041 : 0.036}
        color={color}
        opacity={0.94}
        renderOrder={90}
      />
      <RouteArrowHead start={start} end={end} color={color} renderOrder={91} />
    </group>
  );
}

function RouteTileMarker({
  tile,
  color,
  isStart,
  isEnd,
  visitCount,
}: {
  tile: LoupLoupeTile;
  color: string;
  isStart: boolean;
  isEnd: boolean;
  visitCount: number;
}) {
  const position = getTilePosition(tile);
  const endpoint = isStart || isEnd;
  const label = isStart ? "Start" : isEnd ? "End" : "";
  const visitPips = Array.from({ length: Math.min(visitCount, 5) });
  return (
    <group position={[position[0], 0.31, position[2]]}>
      <mesh renderOrder={95}>
        <cylinderGeometry args={[endpoint ? 0.29 : 0.22, endpoint ? 0.29 : 0.22, 0.035, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={endpoint ? 0.72 : 0.34}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.034, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={96}>
        <ringGeometry args={[endpoint ? 0.29 : 0.22, endpoint ? 0.37 : 0.29, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={endpoint ? 0.96 : 0.7}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {visitCount > 1
        ? visitPips.map((_, index) => {
            const angle = -Math.PI / 2 + (index - (visitPips.length - 1) / 2) * 0.42;
            return (
              <mesh
                key={`visit-pip-${tile.master_tower_map_id}-${index}`}
                position={[Math.cos(angle) * 0.28, 0.075, Math.sin(angle) * 0.28]}
                renderOrder={98}
              >
                <sphereGeometry args={[0.045, 12, 8]} />
                <meshBasicMaterial color={color} transparent opacity={0.95} depthTest={false} depthWrite={false} />
              </mesh>
            );
          })
        : null}
      {label ? (
        <Html center position={[0, 0.24, 0]} style={{ pointerEvents: "none" }}>
          <span
            className="whitespace-nowrap rounded-md border bg-background/85 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-foreground shadow-lg"
            style={{
              borderColor: `${color}99`,
              boxShadow: `0 0 16px ${color}66`,
            }}
          >
            {label}
          </span>
        </Html>
      ) : null}
    </group>
  );
}

function RouteTileNoteMarker({
  tile,
  color,
  noteIndex,
}: {
  tile: LoupLoupeTile;
  color: string;
  noteIndex: number;
}) {
  const position = getTilePosition(tile);
  return (
    <Html center position={[position[0] + 0.28, 0.78, position[2] - 0.24]} style={{ pointerEvents: "none" }}>
      <span
        className="flex h-7 min-w-7 items-center justify-center rounded-full border-2 bg-background px-1 text-[12px] font-black leading-none text-foreground shadow-2xl"
        style={{
          borderColor: color,
          boxShadow: `0 0 0 2px rgba(0,0,0,0.75), 0 0 18px ${color}aa`,
        }}
      >
        {noteIndex}
      </span>
    </Html>
  );
}

type RouteSegmentRenderInfo = {
  from: LoupLoupeTile;
  to: LoupLoupeTile;
  pathId: RoutePathId;
  index: number;
  offset: number;
  repeated: boolean;
  warp: LoupLoupeEvent["warp_points"][number] | null;
};

type RouteMarkerRenderInfo = {
  tile: LoupLoupeTile;
  firstIndex: number;
  lastIndex: number;
  visitCount: number;
};

function routeSegmentKey(from: LoupLoupeTile, to: LoupLoupeTile): string {
  const a = from.map_number;
  const b = to.map_number;
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function findWarpConnection(
  floor: LoupLoupeFloor,
  from: LoupLoupeTile,
  to: LoupLoupeTile,
): LoupLoupeEvent["warp_points"][number] | null {
  for (const warp of from.event?.warp_points ?? []) {
    if (resolveWarpDestinations(floor, from, warp).some((tile) => tile.master_tower_map_id === to.master_tower_map_id)) {
      return warp;
    }
  }
  for (const warp of to.event?.warp_points ?? []) {
    if (resolveWarpDestinations(floor, to, warp).some((tile) => tile.master_tower_map_id === from.master_tower_map_id)) {
      return warp;
    }
  }
  return null;
}

function getRouteSegmentRenderInfo(
  floor: LoupLoupeFloor,
  routePaths: Array<{ id: RoutePathId; tiles: LoupLoupeTile[] }>,
): RouteSegmentRenderInfo[] {
  const baseSegments = routePaths.flatMap((path) =>
    path.tiles.slice(0, -1).map((tile, index) => ({
      from: tile,
      to: path.tiles[index + 1],
      pathId: path.id,
      index,
      key: routeSegmentKey(tile, path.tiles[index + 1]),
    })),
  );
  const segmentCounts = new Map<string, number>();
  for (const segment of baseSegments) {
    segmentCounts.set(segment.key, (segmentCounts.get(segment.key) ?? 0) + 1);
  }

  const seenSegments = new Map<string, number>();
  return baseSegments.map((segment) => {
    const count = segmentCounts.get(segment.key) ?? 1;
    const occurrence = seenSegments.get(segment.key) ?? 0;
    seenSegments.set(segment.key, occurrence + 1);
    const offset = count > 1 ? (occurrence - (count - 1) / 2) * 0.24 : 0;
    return {
      from: segment.from,
      to: segment.to,
      pathId: segment.pathId,
      index: segment.index,
      offset,
      repeated: count > 1,
      warp: findWarpConnection(floor, segment.from, segment.to),
    };
  });
}

function getRouteMarkerRenderInfo(routePaths: Array<{ tiles: LoupLoupeTile[] }>): RouteMarkerRenderInfo[] {
  const markerByTile = new Map<number, RouteMarkerRenderInfo>();
  let visitIndex = 0;
  for (const path of routePaths) {
    path.tiles.forEach((tile, pathIndex) => {
      const existing = markerByTile.get(tile.map_number);
      if (existing) {
        existing.lastIndex = visitIndex;
        existing.visitCount += 1;
      } else {
        markerByTile.set(tile.map_number, {
          tile,
          firstIndex: visitIndex,
          lastIndex: visitIndex,
          visitCount: 1,
        });
      }
      visitIndex += 1;
      if (pathIndex === path.tiles.length - 1) visitIndex += 0.25;
    });
  }
  return Array.from(markerByTile.values()).sort((a, b) => a.firstIndex - b.firstIndex);
}

function getOffsetRoutePoints(
  from: LoupLoupeTile,
  to: LoupLoupeTile,
  offset: number,
  y: number,
): { start: THREE.Vector3; end: THREE.Vector3 } {
  const fromPosition = getTilePosition(from);
  const toPosition = getTilePosition(to);
  const start = new THREE.Vector3(fromPosition[0], y, fromPosition[2]);
  const end = new THREE.Vector3(toPosition[0], y, toPosition[2]);
  const stableStart = from.map_number <= to.map_number ? fromPosition : toPosition;
  const stableEnd = from.map_number <= to.map_number ? toPosition : fromPosition;
  const stableDirection = new THREE.Vector3(
    stableEnd[0] - stableStart[0],
    0,
    stableEnd[2] - stableStart[2],
  );
  const normal = new THREE.Vector3(-stableDirection.z, 0, stableDirection.x);
  if (normal.lengthSq() > 0.0001 && offset !== 0) {
    normal.normalize().multiplyScalar(offset);
    start.add(normal);
    end.add(normal);
  }
  return { start, end };
}

function CylinderBetween({
  start,
  end,
  radius,
  color,
  opacity,
  renderOrder,
  radialSegments = 14,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  color: string;
  opacity: number;
  renderOrder: number;
  radialSegments?: number;
}) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length <= 0.001) return null;

  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );

  return (
    <mesh
      position={[midpoint.x, midpoint.y, midpoint.z]}
      quaternion={quaternion}
      renderOrder={renderOrder}
    >
      <cylinderGeometry args={[radius, radius, length, radialSegments]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function RouteArrowHead({
  start,
  end,
  color,
  renderOrder,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  renderOrder: number;
}) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length <= 0.35) return null;
  const normalized = direction.normalize();
  const position = end.clone().addScaledVector(normalized, -0.18);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalized);

  return (
    <mesh
      position={[position.x, position.y, position.z]}
      quaternion={quaternion}
      renderOrder={renderOrder}
    >
      <coneGeometry args={[0.105, 0.24, 18]} />
      <meshBasicMaterial color={color} transparent opacity={0.96} depthTest={false} depthWrite={false} />
    </mesh>
  );
}

function RouteOverlay({
  floor,
  route,
}: {
  floor: LoupLoupeFloor;
  route: RouteDefinition | null;
}) {
  const routePaths = getRoutePaths(route)
    .map((path) => ({
      ...path,
      tiles: path.tileNumbers
        .map((tileNumber) => getTileByMapNumber(floor, tileNumber))
        .filter(Boolean) as LoupLoupeTile[],
    }))
    .filter((path) => path.tiles.length > 0);
  if (!route || routePaths.length === 0) return null;
  const segments = getRouteSegmentRenderInfo(floor, routePaths);
  const markers = getRouteMarkerRenderInfo(routePaths);
  const lastMarkerIndex = markers.reduce((max, marker) => Math.max(max, marker.lastIndex), -1);
  const tileNotes = getRouteTileNoteDisplays(floor, route);

  return (
    <group>
      {segments.map((segment) =>
        segment.warp ? (
          <RouteWarpSegment
            key={`${route.id}-warp-segment-${segment.pathId}-${segment.from.master_tower_map_id}-${segment.index}`}
            from={segment.from}
            to={segment.to}
            color={route.color}
            offset={segment.offset}
            warp={segment.warp}
          />
        ) : (
          <RouteSegment
            key={`${route.id}-segment-${segment.pathId}-${segment.from.master_tower_map_id}-${segment.index}`}
            from={segment.from}
            to={segment.to}
            color={route.color}
            offset={segment.offset}
            repeated={segment.repeated}
          />
        ),
      )}
      {markers.map((marker) => (
        <RouteTileMarker
          key={`${route.id}-marker-${marker.tile.master_tower_map_id}`}
          tile={marker.tile}
          color={route.color}
          isStart={marker.firstIndex === 0}
          isEnd={marker.lastIndex === lastMarkerIndex}
          visitCount={marker.visitCount}
        />
      ))}
      {tileNotes.map(({ tile, noteIndex }) => (
        <RouteTileNoteMarker
          key={`${route.id}-tile-note-${tile.master_tower_map_id}`}
          tile={tile}
          color={route.color}
          noteIndex={noteIndex}
        />
      ))}
    </group>
  );
}

function WarpLinkSegment({
  from,
  to,
  color,
}: {
  from: LoupLoupeTile;
  to: LoupLoupeTile;
  color: string;
}) {
  return <DashedWarpArc from={from} to={to} color={color} secondaryColor={color} offset={0} />;
}

function RouteWarpSegment({
  from,
  to,
  color,
  offset,
  warp,
}: {
  from: LoupLoupeTile;
  to: LoupLoupeTile;
  color: string;
  offset: number;
  warp: LoupLoupeEvent["warp_points"][number];
}) {
  const warpColor = getWarpHighlightColor(warp.warp_point_color);
  const label = `W${warp.warp_number}`;
  return (
    <group>
      <DashedWarpArc from={from} to={to} color={color} secondaryColor={warpColor} offset={offset} />
      <WarpPortalMarker tile={from} color={warpColor} label={label} />
      <WarpPortalMarker tile={to} color={warpColor} label={label} />
    </group>
  );
}

function DashedWarpArc({
  from,
  to,
  color,
  secondaryColor,
  offset,
}: {
  from: LoupLoupeTile;
  to: LoupLoupeTile;
  color: string;
  secondaryColor: string;
  offset: number;
}) {
  const { start, end } = getOffsetRoutePoints(from, to, offset, 0.5);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length <= 0.001) return null;

  const normal = new THREE.Vector3(-direction.z, 0, direction.x);
  if (normal.lengthSq() > 0.0001) {
    normal.normalize().multiplyScalar(Math.min(0.5, Math.max(0.16, length * 0.045)));
  }
  const midpoint = start.clone().lerp(end, 0.5);
  const control = midpoint.clone().add(normal);
  control.y += Math.min(1.35, Math.max(0.58, length * 0.12));
  const curve = new THREE.QuadraticBezierCurve3(start, control, end);
  const points = curve.getPoints(34);
  const dashPairs: Array<[THREE.Vector3, THREE.Vector3]> = [];
  for (let index = 0; index < points.length - 1; index += 2) {
    dashPairs.push([points[index], points[index + 1]]);
  }

  return (
    <group>
      {dashPairs.map(([dashStart, dashEnd], index) => (
        <group key={`warp-dash-${from.master_tower_map_id}-${to.master_tower_map_id}-${index}`}>
          <CylinderBetween
            start={dashStart}
            end={dashEnd}
            radius={0.064}
            color={secondaryColor}
            opacity={0.2}
            renderOrder={92}
          />
          <CylinderBetween
            start={dashStart}
            end={dashEnd}
            radius={0.034}
            color={color}
            opacity={0.92}
            renderOrder={93}
          />
        </group>
      ))}
      <RouteArrowHead start={points[Math.max(0, points.length - 4)]} end={end} color={color} renderOrder={94} />
    </group>
  );
}

function WarpPortalMarker({
  tile,
  color,
  label,
}: {
  tile: LoupLoupeTile;
  color: string;
  label?: string;
}) {
  const position = getTilePosition(tile);
  return (
    <group position={[position[0], 0.35, position[2]]} renderOrder={97}>
      <mesh renderOrder={96}>
        <cylinderGeometry args={[0.34, 0.34, 0.032, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={97}>
        <ringGeometry args={[0.23, 0.34, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.96} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={98}>
        <ringGeometry args={[0.39, 0.46, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.42} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {label ? (
        <Html center position={[0, 0.26, 0]} style={{ pointerEvents: "none" }}>
          <span
            className="rounded-full border bg-background/90 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-foreground shadow-lg"
            style={{
              borderColor: `${color}aa`,
              boxShadow: `0 0 18px ${color}66`,
            }}
          >
            {label}
          </span>
        </Html>
      ) : null}
    </group>
  );
}

function WarpOverlay({
  sourceTile,
  destinations,
}: {
  sourceTile: LoupLoupeTile | null;
  destinations: LoupLoupeTile[];
}) {
  if (!sourceTile || destinations.length === 0) return null;
  const warp = sourceTile.event?.warp_points?.[0] ?? null;
  const color = getWarpHighlightColor(warp?.warp_point_color ?? 0);
  const label = warp ? `W${warp.warp_number}` : "Warp";

  return (
    <group>
      {destinations.map((destination) => (
        <WarpLinkSegment
          key={`warp-link-${sourceTile.master_tower_map_id}-${destination.master_tower_map_id}`}
          from={sourceTile}
          to={destination}
          color={color}
        />
      ))}
      <WarpPortalMarker tile={sourceTile} color={color} label={label} />
      {destinations.map((destination) => (
        <WarpPortalMarker
          key={`warp-marker-${destination.master_tower_map_id}`}
          tile={destination}
          color={color}
          label={label}
        />
      ))}
    </group>
  );
}

function TowerBoardScene({
  floor,
  selectedTileId,
  onTileClick,
  selectedRoute,
  warpSourceTile,
  warpDestinations,
  routeEditor,
}: {
  floor: LoupLoupeFloor;
  selectedTileId: number | null;
  onTileClick: (tile: LoupLoupeTile) => void;
  selectedRoute: RouteDefinition | null;
  warpSourceTile: LoupLoupeTile | null;
  warpDestinations: LoupLoupeTile[];
  routeEditor: RouteEditorPointerHandlers | null;
}) {
  const sizeKey = String(floor.tile_count);
  const sizeTypeKey = String(floor.map_size_type);
  const framePrefabKey =
    towerAssets.runtimeReferences?.frames[sizeTypeKey] ??
    towerAssets.maps.frames[sizeKey];
  const groundPrefabKey =
    towerAssets.runtimeReferences?.variationGrounds[floor.map_variation]?.[
      sizeTypeKey
    ] ??
    towerAssets.maps.grounds[floor.map_variation]?.[sizeKey] ??
    towerAssets.maps.grounds.TowerIzis?.[sizeKey];

  return (
    <>
      <BoardCamera floor={floor} />
      <SceneLightingFromGame floor={floor} />
      <group>
        {groundPrefabKey ? (
          <PrefabInstance prefabKey={groundPrefabKey} />
        ) : null}
        {floor.tiles.map((tile) => (
          <TileInstance
            key={tile.master_tower_map_id}
            floor={floor}
            tile={tile}
            selected={selectedTileId === tile.master_tower_map_id}
            onTileClick={onTileClick}
            routeEditor={routeEditor}
          />
        ))}
        <RouteOverlay floor={floor} route={selectedRoute} />
        <WarpOverlay sourceTile={warpSourceTile} destinations={warpDestinations} />
        {framePrefabKey ? <PrefabInstance prefabKey={framePrefabKey} /> : null}
      </group>
    </>
  );
}

function TowerBoard({
  floor,
  selectedTileId,
  selectedRoute,
  warpSourceTile,
  warpDestinations,
  routeEditor,
  onTileClick,
}: {
  floor: LoupLoupeFloor;
  selectedTileId: number | null;
  selectedRoute: RouteDefinition | null;
  warpSourceTile: LoupLoupeTile | null;
  warpDestinations: LoupLoupeTile[];
  routeEditor: RouteEditorPointerHandlers | null;
  onTileClick: (tile: LoupLoupeTile) => void;
}) {
  return (
    <div className="loup-board-wrap relative h-[min(72vh,48rem)] min-h-[30rem] w-full overflow-hidden">
      <Canvas
        orthographic
        dpr={[1, 1.8]}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        <Suspense fallback={null}>
          <TowerBoardScene
            floor={floor}
            selectedTileId={selectedTileId}
            selectedRoute={selectedRoute}
            warpSourceTile={warpSourceTile}
            warpDestinations={warpDestinations}
            routeEditor={routeEditor}
            onTileClick={onTileClick}
          />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
    </div>
  );
}

function lookupSprite(
  atlasName: "TowerAtlas" | "TowerDisplayAtlas",
  spriteName: string,
): SpriteRef | null {
  const atlas = towerAssets.spriteAtlases?.[atlasName];
  if (!atlas) return null;
  const sprite = atlas.sprites.find((s) => s.name === spriteName);
  if (!sprite) return null;
  return { ...sprite, atlas };
}

// Renders a single sprite from a packed atlas as a CSS background-position
// crop. The atlas image is in Unity coordinates (origin bottom-left) so we
// flip Y when computing the background offset.
function AtlasSprite({
  sprite,
  className = "",
  style,
}: {
  sprite: SpriteRef | null;
  className?: string;
  style?: CSSProperties;
}) {
  if (!sprite) return null;
  const [aw, ah] = sprite.atlas.imageSize;
  const { x, y, width, height } = sprite;
  const flippedY = ah - (y + height);
  return (
    <span
      aria-hidden
      className={`pointer-events-none inline-block ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundImage: `url("${sprite.atlas.image}")`,
        backgroundSize: `${aw}px ${ah}px`,
        backgroundPosition: `-${x}px -${flippedY}px`,
        backgroundRepeat: "no-repeat",
        ...style,
      }}
    />
  );
}

function FloorTowerSegment({
  floor,
  active,
  onSelect,
}: {
  floor: LoupLoupeFloor;
  active: boolean;
  onSelect: (floorNumber: number) => void;
}) {
  const treasures = getTreasureCount(floor);
  const tileSprite = lookupSprite(
    "TowerAtlas",
    active ? "TowerIcon_FloorA_Active" : "TowerIcon_FloorA",
  );
  const selectionFrame = lookupSprite("TowerAtlas", "frameSelected");
  const treasureIcon =
    lookupSprite("TowerAtlas", "icTreasureBoxS") ??
    lookupSprite("TowerAtlas", "icTreasureBox");

  // Native sprite is large; scale it down proportionally so the row is ~64px
  // tall while preserving aspect ratio.
  const tileScale = tileSprite ? 64 / tileSprite.height : 1;

  return (
    <button
      type="button"
      onClick={() => onSelect(floor.floor_number)}
      data-active={active || undefined}
      className="group relative flex h-16 w-full shrink-0 items-center justify-start text-left transition focus:outline-none"
      style={{ paddingLeft: "10px", paddingRight: "10px" }}
    >
      {tileSprite ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url("${tileSprite.atlas.image}")`,
            backgroundSize: `${tileSprite.atlas.imageSize[0] * tileScale}px ${tileSprite.atlas.imageSize[1] * tileScale}px`,
            backgroundPosition: `-${tileSprite.x * tileScale}px -${(tileSprite.atlas.imageSize[1] - tileSprite.y - tileSprite.height) * tileScale}px`,
            backgroundRepeat: "no-repeat",
          }}
        />
      ) : (
        <span
          className={`pointer-events-none absolute inset-0 rounded-[6px] border-y-2 ${
            active
              ? "border-accent/90 bg-[linear-gradient(180deg,rgba(45,99,142,0.92),rgba(20,33,55,0.95))]"
              : "border-border/[0.22] bg-[linear-gradient(180deg,rgba(28,38,60,0.85),rgba(14,20,34,0.9))]"
          }`}
        />
      )}
      {active && selectionFrame ? (
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            top: "-4px",
            bottom: "-4px",
            left: "-4px",
            right: "-4px",
            backgroundImage: `url("${selectionFrame.atlas.image}")`,
            backgroundSize: `${selectionFrame.atlas.imageSize[0]}px ${selectionFrame.atlas.imageSize[1]}px`,
            backgroundPosition: `-${selectionFrame.x}px -${selectionFrame.atlas.imageSize[1] - selectionFrame.y - selectionFrame.height}px`,
            backgroundRepeat: "no-repeat",
            transform: `scale(${(64 + 8) / selectionFrame.height})`,
            transformOrigin: "center",
          }}
        />
      ) : null}
      <span className="relative z-10 text-2xl font-black text-foreground drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
        {floor.floor_name}
      </span>
      <span className="relative z-10 ml-auto flex items-center gap-1 text-xs font-black text-[#fbbf24] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        {treasureIcon ? (
          <AtlasSprite
            sprite={treasureIcon}
            style={{ transform: "scale(0.7)", transformOrigin: "center" }}
          />
        ) : (
          <img src={TREASURE_BAG} alt="" className="h-5 w-5 object-contain" />
        )}
        {treasures}
      </span>
    </button>
  );
}

function FloorTowerStack({
  floors,
  selectedFloorNumber,
  onSelectFloor,
}: {
  floors: LoupLoupeFloor[];
  selectedFloorNumber: number;
  onSelectFloor: (floorNumber: number) => void;
}) {
  return (
    <div className="image-scroll relative flex h-full flex-col gap-1 overflow-y-auto rounded-md border border-border bg-background/70 p-2 shadow-[inset_0_0_20px_rgba(0,0,0,0.6)]">
      {floors.map((floor) => (
        <FloorTowerSegment
          key={floor.master_tower_floor_id}
          floor={floor}
          active={floor.floor_number === selectedFloorNumber}
          onSelect={onSelectFloor}
        />
      ))}
    </div>
  );
}

function FloorTowerStackHorizontal({
  floors,
  selectedFloorNumber,
  onSelectFloor,
}: {
  floors: LoupLoupeFloor[];
  selectedFloorNumber: number;
  onSelectFloor: (floorNumber: number) => void;
}) {
  return (
    <div className="image-scroll flex w-full gap-2 overflow-x-auto">
      {floors.map((floor) => {
        const active = floor.floor_number === selectedFloorNumber;
        return (
          <button
            key={floor.master_tower_floor_id}
            type="button"
            onClick={() => onSelectFloor(floor.floor_number)}
            className={`relative flex h-14 w-28 shrink-0 items-center gap-2 overflow-hidden rounded-md border px-3 text-left shadow-lg transition ${
              active
                ? "border-accent bg-[linear-gradient(90deg,rgba(20,72,118,0.97),rgba(18,40,64,0.97))] ring-2 ring-accent/80"
                : "border-border bg-muted/60 hover:border-accent/50 hover:bg-accent/50"
            }`}
          >
            <span className="text-2xl font-black leading-none text-foreground drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">
              {floor.floor_name}
            </span>
            <span className="ml-auto flex items-center gap-1 rounded bg-muted/60 px-1.5 py-1 text-xs font-black text-[#fbbf24]">
              <img
                src={TREASURE_BAG}
                alt=""
                className="h-5 w-5 object-contain"
              />
              {getTreasureCount(floor)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TileDialog({
  modal,
  floor,
  enemyById,
  onClose,
}: {
  modal: ModalState;
  floor: LoupLoupeFloor;
  enemyById: Map<number, WikiEnemy>;
  onClose: () => void;
}) {
  const tile = modal?.kind === "tile" ? modal.tile : null;
  const event = tile?.event ?? null;
  const enemy = event?.icon_master_enemy_id
    ? enemyById.get(event.icon_master_enemy_id)
    : undefined;
  const rewardGroups = getRewardGroups(event);
  const eventName = eventKey(event);
  const title =
    modal?.kind === "clearRewards"
      ? "Clear Rewards"
      : modal?.kind === "challengeRewards"
        ? "Challenge Rewards"
        : modal?.kind === "details"
          ? "Floor Details"
          : enemy?.name || event?.quest?.quest_name || eventName;

  return (
    <Dialog open={Boolean(modal)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="slime-page-loup-loupe max-h-[88vh] max-w-3xl overflow-auto border-[#fbbf24]/20 bg-popover/95 text-foreground shadow-2xl shadow-black/70 image-scroll">
        <DialogHeader>
          <DialogTitle className="pr-8 text-2xl font-black uppercase tracking-wide text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Loup Loupe floor contents
          </DialogDescription>
        </DialogHeader>

        {modal?.kind === "tile" && event ? (
          <div className="space-y-5">
            {event.icon_master_enemy_id || event.quest ? (
              <EnemyPanel event={event} enemy={enemy} />
            ) : null}
            {rewardGroups.length > 0 ? (
              <RewardGroups groups={rewardGroups} />
            ) : null}
            {event.quest ? <QuestPayout quest={event.quest} /> : null}
            {event.effects.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-accent">
                  Field Effect
                </h3>
                <EffectPanel effects={event.effects} />
              </section>
            ) : null}
          </div>
        ) : null}

        {modal?.kind === "clearRewards" ? (
          <RewardGrid rewards={floor.clear_rewards} />
        ) : null}
        {modal?.kind === "challengeRewards" ? (
          <ChallengeRewardGroups rewards={floor.challenge_rewards} />
        ) : null}
        {modal?.kind === "details" ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {getEventCounts(floor).map(([name, count]) => (
                <InfoChip key={name} label={name} value={formatNumber(count)} />
              ))}
            </div>
            {floor.floor_effects.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-accent">
                  Floor Effect
                </h3>
                <EffectPanel effects={floor.floor_effects} />
              </section>
            ) : null}
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[#fbbf24]">
                Clear Rewards
              </h3>
              <RewardGrid rewards={floor.clear_rewards} />
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RouteEditorPanel({
  floor,
  editorRoutes,
  selectedRouteId,
  routeName,
  routeColor,
  routeNotes,
  selectedNoteTileNumber,
  selectedPathId,
  routeStoreStatus,
  routeStoreMessage,
  isSavingRoutes,
  onRouteNameChange,
  onRouteColorChange,
  onRouteNotesChange,
  onSelectNoteTile,
  onUpdateTileNote,
  onSelectPath,
  onForkPath,
  onAddRoute,
  onSelectRoute,
  onUpdateSelectedRoute,
  onUndoTile,
  onClearTiles,
  onDeleteRoute,
  onSaveRoutes,
}: {
  floor: LoupLoupeFloor;
  editorRoutes: RouteDefinition[];
  selectedRouteId: string;
  routeName: string;
  routeColor: string;
  routeNotes: string;
  selectedNoteTileNumber: string;
  selectedPathId: RoutePathId;
  routeStoreStatus: RouteStoreStatus;
  routeStoreMessage: string | null;
  isSavingRoutes: boolean;
  onRouteNameChange: (value: string) => void;
  onRouteColorChange: (value: string) => void;
  onRouteNotesChange: (value: string) => void;
  onSelectNoteTile: (value: string) => void;
  onUpdateTileNote: (tileNumber: number, note: string) => void;
  onSelectPath: (value: RoutePathId) => void;
  onForkPath: (tileNumber: number) => void;
  onAddRoute: () => void;
  onSelectRoute: (value: string) => void;
  onUpdateSelectedRoute: () => void;
  onUndoTile: () => void;
  onClearTiles: () => void;
  onDeleteRoute: () => void;
  onSaveRoutes: () => void;
}) {
  const floorRoutes = editorRoutes.filter((route) => route.floorNumber === floor.floor_number);
  const selectedRoute = floorRoutes.find((route) => route.id === selectedRouteId) ?? null;
  const routePaths = getRoutePaths(selectedRoute);
  const selectedPath = routePaths.find((path) => path.id === selectedPathId) ?? routePaths[0] ?? null;
  const tileCount = selectedPath?.tileNumbers.length ?? 0;
  const selectedRouteTileKey = getRouteTileNumbers(selectedRoute).join(",");
  const uniqueRouteTileNumbers = useMemo(
    () => getRouteTileNumbers(selectedRoute),
    [selectedRouteTileKey],
  );
  const selectedTileNote = selectedNoteTileNumber
    ? selectedRoute?.tileNotes?.[selectedNoteTileNumber] ?? ""
    : "";
  const routeTileNotes = Object.entries(selectedRoute?.tileNotes ?? {})
    .map(([tileNumber, note]) => ({
      tileNumber: Number(tileNumber),
      note: normalizeOptionalRouteText(note),
    }))
    .filter((entry): entry is { tileNumber: number; note: string } =>
      Number.isFinite(entry.tileNumber) && Boolean(entry.note),
    )
    .sort((a, b) => a.tileNumber - b.tileNumber);

  return (
    <aside className="relative z-20 max-h-[calc(100vh-11rem)] w-full overflow-y-auto rounded-lg border border-accent/20 bg-muted/[0.92] p-4 text-foreground shadow-2xl shadow-black/60 backdrop-blur image-scroll">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-accent">Route Editor</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Drag across tiles to build a route. Click a routed tile to edit its note.
          </p>
        </div>
        <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-accent">
          {isSavingRoutes ? "Saving" : routeStoreStatus === "ready" ? "Supabase" : routeStoreStatus === "loading" ? "Loading" : "Local"}
        </span>
      </div>
      {routeStoreMessage ? (
        <p className="mt-3 rounded-md border border-[#fbbf24]/20 bg-[#fcd34d]/10 p-2 text-[11px] font-semibold text-[#fbbf24]">
          Route store: {routeStoreMessage}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={routeName}
          onChange={(event) => onRouteNameChange(event.target.value)}
          placeholder={`${floor.floor_name} route name`}
          className="h-10 rounded-md border border-border/[0.22] bg-muted/60 px-3 text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/50"
        />
        <input
          type="color"
          value={routeColor}
          onChange={(event) => onRouteColorChange(event.target.value)}
          className="h-10 w-16 rounded-md border border-border/[0.22] bg-muted/60 p-1"
          aria-label="Route color"
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddRoute}
          className="inline-flex items-center gap-2 rounded-md border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-accent transition hover:border-accent/50 hover:bg-accent/20"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Route
        </button>
        <button
          type="button"
          disabled={!selectedRoute}
          onClick={onUpdateSelectedRoute}
          className="inline-flex items-center gap-2 rounded-md border border-border/[0.22] bg-border/[0.12] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-foreground transition hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          Save Details
        </button>
      </div>

      {floorRoutes.length > 0 ? (
        <div className="mt-3 space-y-2">
          <Select value={selectedRoute?.id ?? NO_ROUTE_SELECT_VALUE} onValueChange={onSelectRoute}>
            <SelectTrigger className="h-10 border-border/[0.22] bg-muted/90 text-sm font-black text-foreground">
              <SelectValue placeholder="Select manual route" />
            </SelectTrigger>
            <SelectContent className="slime-page-loup-loupe border-border bg-popover text-foreground">
              <SelectItem value={NO_ROUTE_SELECT_VALUE}>No route</SelectItem>
              {floorRoutes.map((route) => (
                <SelectItem key={route.id} value={route.id}>
                  {route.label} - {getRouteTileNumbers(route).length} tiles
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedRoute ? (
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <Select value={selectedPath?.id ?? "main"} onValueChange={(value) => onSelectPath(value as RoutePathId)}>
                <SelectTrigger className="h-9 border-border/[0.22] bg-muted/90 text-xs font-black text-foreground">
                  <SelectValue placeholder="Path" />
                </SelectTrigger>
                <SelectContent className="slime-page-loup-loupe border-border bg-popover text-foreground">
                  {routePaths.map((path) => (
                    <SelectItem key={path.id} value={path.id}>
                      {path.label} - {path.tileNumbers.length} tiles
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                disabled={!selectedNoteTileNumber || !routeHasTile(selectedRoute, Number(selectedNoteTileNumber))}
                onClick={() => onForkPath(Number(selectedNoteTileNumber))}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-accent/20 bg-accent/10 px-3 text-xs font-black uppercase tracking-[0.14em] text-accent transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Fork From Tile {selectedNoteTileNumber || ""}
              </button>
            </div>
          ) : null}
          <p className="text-xs font-semibold text-muted-foreground">
            Selected: <span className="font-black text-foreground">{selectedRoute?.label ?? "None"}</span>
            {selectedPath ? ` - ${selectedPath.label}` : ""} - {tileCount} tile{tileCount === 1 ? "" : "s"}
          </p>
          <p className="max-h-16 overflow-auto rounded-md border border-border bg-background/50 p-2 text-[11px] font-semibold leading-relaxed text-muted-foreground image-scroll">
            {selectedPath?.tileNumbers.length ? selectedPath.tileNumbers.join(" -> ") : "Drag across the map to add tiles."}
          </p>
          <label className="block space-y-1">
            <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-accent">
              <StickyNote className="h-3.5 w-3.5" />
              Notes for {selectedRoute?.label ?? "selected route"}
            </span>
            <textarea
              value={routeNotes}
              disabled={!selectedRoute}
              onChange={(event) => onRouteNotesChange(event.target.value)}
              placeholder="Add route notes, warnings, rewards, or strategy reminders."
              className="h-20 w-full rounded-md border border-border bg-background/50 p-2 text-xs font-semibold leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/50 disabled:cursor-not-allowed disabled:opacity-45 image-scroll"
            />
          </label>
          <div className="rounded-md border border-border bg-background/45 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-accent">
                Tile note
              </span>
              <span className="rounded-full border border-accent/15 bg-accent/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-accent">
                {selectedNoteTileNumber ? `Tile ${selectedNoteTileNumber}` : "No tile"}
              </span>
            </div>
            {uniqueRouteTileNumbers.length > 0 ? (
              <div className="mb-2 flex max-h-20 flex-wrap gap-1.5 overflow-auto pr-1 image-scroll">
                {uniqueRouteTileNumbers.map((tileNumber) => {
                  const value = String(tileNumber);
                  const hasNote = Boolean(normalizeOptionalRouteText(selectedRoute?.tileNotes?.[value]));
                  const active = selectedNoteTileNumber === value;
                  return (
                    <button
                      key={tileNumber}
                      type="button"
                      onClick={() => onSelectNoteTile(value)}
                      className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                        active
                          ? "border-accent/60 bg-accent/15 text-accent"
                          : "border-border bg-border/[0.06] text-muted-foreground hover:border-accent/35"
                      }`}
                    >
                      {hasNote ? <StickyNote className="h-3 w-3" /> : null}
                      {tileNumber}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <textarea
              value={selectedTileNote}
              disabled={!selectedRoute || !selectedNoteTileNumber}
              onChange={(event) => onUpdateTileNote(Number(selectedNoteTileNumber), event.target.value)}
              placeholder="Add a note for this tile."
              className="h-16 w-full rounded-md border border-border bg-background/50 p-2 text-xs font-semibold leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/50 disabled:cursor-not-allowed disabled:opacity-45 image-scroll"
            />
            {routeTileNotes.length > 0 ? (
              <div className="mt-2 max-h-28 space-y-1 overflow-auto pr-1 image-scroll">
                {routeTileNotes.map(({ tileNumber, note }) => (
                  <button
                    key={`note-${tileNumber}`}
                    type="button"
                    onClick={() => onSelectNoteTile(String(tileNumber))}
                    className="block w-full rounded-md border border-border bg-border/[0.06] px-2 py-1.5 text-left text-[11px] font-semibold leading-snug text-foreground/90 transition hover:border-accent/35"
                  >
                    <span className="mr-1 font-black text-accent">Tile {tileNumber}</span>
                    {note}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!selectedRoute || tileCount === 0}
              onClick={onUndoTile}
              className="inline-flex items-center gap-2 rounded-md border border-border/[0.22] bg-border/[0.12] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-foreground transition hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo Tile
            </button>
            <button
              type="button"
              disabled={!selectedRoute || tileCount === 0}
              onClick={onClearTiles}
              className="inline-flex items-center gap-2 rounded-md border border-[#fbbf24]/20 bg-[#fcd34d]/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#fbbf24] transition hover:border-[#fbbf24]/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear Path
            </button>
            <button
              type="button"
              disabled={!selectedRoute}
              onClick={onDeleteRoute}
              className="inline-flex items-center gap-2 rounded-md border border-rose-200/20 bg-rose-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-rose-100 transition hover:border-rose-100/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Route
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-border bg-background/50 p-3 text-xs font-semibold text-muted-foreground">
          No manual routes on {floor.floor_name} yet. Add one, then drag over tiles.
        </p>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={onSaveRoutes}
          disabled={isSavingRoutes || routeStoreStatus === "unconfigured"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-accent transition hover:border-accent/50 hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Save className="h-3.5 w-3.5" />
          {isSavingRoutes ? "Saving Route Table" : "Save Route Table"}
        </button>
      </div>
    </aside>
  );
}

function RouteSummaryPanel({ floor, route }: { floor: LoupLoupeFloor; route: RouteDefinition }) {
  const routeNotes = getRouteNotes(route);
  const tileNotes = getRouteTileNoteDisplays(floor, route);

  return (
    <section className="w-full rounded-lg border border-border bg-muted/60 p-4 text-foreground shadow-xl shadow-black/40 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full shadow-[0_0_14px_currentColor]"
            style={{ color: route.color, backgroundColor: route.color }}
          />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-accent">
              Route Notes
            </p>
            <h2 className="truncate text-base font-black text-foreground">
              {route.label}
            </h2>
          </div>
        </div>
        <span className="rounded-full border border-border bg-border/[0.08] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-foreground/90">
          {floor.floor_name}
        </span>
      </div>
      {routeNotes ? (
        <p className="mt-3 whitespace-pre-line rounded-md border border-accent/15 bg-accent/10 p-3 text-sm font-semibold leading-relaxed text-foreground">
          {routeNotes}
        </p>
      ) : null}
      {tileNotes.length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {tileNotes.map(({ tileNumber, note, noteIndex }) => (
            <div
              key={`route-summary-note-${route.id}-${tileNumber}`}
              className="grid grid-cols-[2rem_1fr] gap-3 rounded-md border border-border bg-border/[0.06] p-3 text-sm font-semibold leading-relaxed text-foreground/90"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-black text-foreground"
                style={{
                  borderColor: route.color,
                  boxShadow: `0 0 12px ${route.color}66`,
                }}
              >
                {noteIndex}
              </span>
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-accent">
                  Tile {tileNumber}
                </p>
                <p className="whitespace-pre-line">{note}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function LoupLoupeBrowser({ floors, enemies }: LoupLoupeBrowserProps) {
  const [selectedFloorNumber, setSelectedFloorNumber] = useState(
    floors[0]?.floor_number ?? 1,
  );
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [editorRoutes, setEditorRoutes] = useState<RouteDefinition[]>([]);
  const [hasLoadedEditorRoutes, setHasLoadedEditorRoutes] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [routeColor, setRouteColor] = useState(DEFAULT_ROUTE_COLORS[0]);
  const [routeNotes, setRouteNotes] = useState("");
  const [selectedRouteNoteTileNumber, setSelectedRouteNoteTileNumber] = useState("");
  const [selectedRoutePathId, setSelectedRoutePathId] = useState<RoutePathId>("main");
  const [routeEditorAccess, setRouteEditorAccess] = useState<RouteEditorAccessState>(
    ENABLE_ROUTE_EDITOR ? "checking" : "signed-out",
  );
  const [routeStoreStatus, setRouteStoreStatus] = useState<RouteStoreStatus>(
    guidesSupabaseConfigured ? "loading" : "unconfigured",
  );
  const [routeStoreMessage, setRouteStoreMessage] = useState<string | null>(null);
  const [isSavingRoutes, setIsSavingRoutes] = useState(false);
  const [routeAuthorName, setRouteAuthorName] = useState<string | null>(null);
  const [showRouteLogin, setShowRouteLogin] = useState(false);
  const [routeLoginEmail, setRouteLoginEmail] = useState("");
  const [routeLoginPassword, setRouteLoginPassword] = useState("");
  const [routeLoginMessage, setRouteLoginMessage] = useState<string | null>(null);
  const [routeLoginLoading, setRouteLoginLoading] = useState(false);
  const [isRouteDrawing, setIsRouteDrawing] = useState(false);
  const isRouteDrawingRef = useRef(false);
  const routeEditorEnabled = ENABLE_ROUTE_EDITOR && routeEditorAccess === "allowed";

  const enemyById = useMemo(() => {
    const map = new Map<number, WikiEnemy>();
    for (const enemy of enemies) map.set(enemy.master_enemy_id, enemy);
    return map;
  }, [enemies]);

  const floor = useMemo(
    () =>
      floors.find(
        (candidate) => candidate.floor_number === selectedFloorNumber,
      ) ?? floors[0],
    [floors, selectedFloorNumber],
  );
  const routes = useMemo(() => {
    const floorNumber = floor?.floor_number ?? 0;
    return getMergedRouteDefinitionsForFloor(floorNumber, editorRoutes);
  }, [editorRoutes, floor]);
  const selectedRoute =
    selectedRouteId === NO_ROUTE_SELECT_VALUE ? null : (routes.find((route) => route.id === selectedRouteId) ?? null);
  const selectedTile =
    floor?.tiles.find((tile) => tile.master_tower_map_id === selectedTileId) ?? null;
  const warpSourceTile =
    selectedTile && selectedTile.event?.warp_points.length ? selectedTile : null;
  const warpDestinations = useMemo(() => {
    if (!floor || !warpSourceTile?.event) return [] as LoupLoupeTile[];
    const resolved = warpSourceTile.event.warp_points.flatMap((warp) =>
      resolveWarpDestinations(floor, warpSourceTile, warp),
    );
    return resolved.filter(
      (tile, index, array) =>
        array.findIndex((candidate) => candidate.master_tower_map_id === tile.master_tower_map_id) === index,
    );
  }, [floor, warpSourceTile]);
  const selectedEditorRoute = editorRoutes.find((route) => route.id === selectedRouteId) ?? null;

  useEffect(() => {
    if (!selectedEditorRoute) {
      setSelectedRoutePathId("main");
      return;
    }
    if (!getRoutePaths(selectedEditorRoute).some((path) => path.id === selectedRoutePathId)) {
      setSelectedRoutePathId("main");
    }
  }, [selectedEditorRoute, selectedRoutePathId]);

  const selectRouteNoteTile = (tile: LoupLoupeTile) => {
    setSelectedRouteNoteTileNumber(String(tile.map_number));
    setSelectedTileId(tile.master_tower_map_id);
    setModal(null);
  };

  const appendTileToSelectedRoute = (
    tile: LoupLoupeTile,
    options: { skipExistingStart?: boolean } = {},
  ) => {
    if (!floor || !routeEditorEnabled || !selectedEditorRoute || tile.master_tower_floor_id !== floor.master_tower_floor_id) return;
    const activePathId = selectedRoutePathId;
    selectRouteNoteTile(tile);
    if (options.skipExistingStart && getRoutePathTileNumbers(selectedEditorRoute, activePathId).includes(tile.map_number)) return;
    setEditorRoutes((currentRoutes) =>
      currentRoutes.map((route) => {
        if (route.id !== selectedEditorRoute.id) return route;
        return updateRoutePath(route, activePathId, (tileNumbers) => {
          const lastTileNumber = tileNumbers[tileNumbers.length - 1];
          if (lastTileNumber === tile.map_number) return tileNumbers;
          return [...tileNumbers, tile.map_number];
        });
      }),
    );
  };

  const routeEditorHandlers: RouteEditorPointerHandlers | null = routeEditorEnabled
    ? {
        active: Boolean(selectedEditorRoute),
        onTileClick: (tile) => {
          selectRouteNoteTile(tile);
        },
        onPointerDown: (tile) => {
          isRouteDrawingRef.current = true;
          setIsRouteDrawing(true);
          appendTileToSelectedRoute(tile, { skipExistingStart: true });
        },
        onPointerEnter: (tile) => {
          if (!isRouteDrawingRef.current) return;
          appendTileToSelectedRoute(tile);
        },
        onPointerUp: () => {
          isRouteDrawingRef.current = false;
          setIsRouteDrawing(false);
        },
      }
    : null;

  const saveRoutesToSupabase = async (routesToSave: RouteDefinition[]) => {
    if (!guidesSupabaseConfigured) {
      setRouteStoreStatus("unconfigured");
      return;
    }
    setIsSavingRoutes(true);
    setRouteStoreMessage(null);
    const {
      data: { user },
    } = await guidesSupabase.auth.getUser();
    if (!user) {
      setIsSavingRoutes(false);
      return;
    }
    const { error } = await guidesSupabase
      .from("loup_loupe_route_sets")
      .upsert(
        {
          key: ROUTE_SET_STORAGE_KEY,
          routes: routesToSave.map(cleanRouteForExport),
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    if (error) {
      console.warn("Failed to save Loup Loupe routes to Supabase", error);
      setRouteStoreStatus("error");
      setRouteStoreMessage(error.message);
    } else {
      setRouteStoreStatus("ready");
    }
    setIsSavingRoutes(false);
  };


  useEffect(() => {
    if (!floor) return;
    setSelectedTileId(null);
    setModal(null);
    setSelectedRouteId(NO_ROUTE_SELECT_VALUE);
    setRouteName("");
    setRouteColor(DEFAULT_ROUTE_COLORS[(floor.floor_number - 1) % DEFAULT_ROUTE_COLORS.length]);
    setRouteNotes("");
    setSelectedRouteNoteTileNumber("");
    setSelectedRoutePathId("main");
  }, [floor]);

  // Do not auto-select routes. The default view should show no route until the user chooses one.

  const selectedEditorRouteTileKey = selectedEditorRoute ? getRouteTileNumbers(selectedEditorRoute).join(",") : "";
  useEffect(() => {
    if (!selectedEditorRoute) {
      setSelectedRouteNoteTileNumber("");
      return;
    }
    const routeTileNumbers = getRouteTileNumbers(selectedEditorRoute);
    const currentTileNumber = Number(selectedRouteNoteTileNumber);
    if (routeHasTile(selectedEditorRoute, currentTileNumber)) return;
    const firstTileWithNote = routeTileNumbers.find((tileNumber) =>
      normalizeOptionalRouteText(selectedEditorRoute.tileNotes?.[String(tileNumber)]),
    );
    setSelectedRouteNoteTileNumber(String(firstTileWithNote ?? routeTileNumbers[0] ?? ""));
  }, [selectedEditorRoute?.id, selectedEditorRouteTileKey, selectedRouteNoteTileNumber, selectedEditorRoute]);

  useEffect(() => {
    if (!ENABLE_ROUTE_EDITOR) {
      setRouteEditorAccess("signed-out");
      return;
    }
    if (!guidesSupabaseConfigured) {
      setRouteEditorAccess("unconfigured");
      return;
    }

    let active = true;
    const loadRouteEditorAccess = async () => {
      const author = await getCurrentGuideAuthor();
      if (active) {
        setRouteEditorAccess(author ? "allowed" : "signed-out");
        setRouteAuthorName(author?.display_name ?? null);
      }
    };

    loadRouteEditorAccess();
    const { data } = guidesSupabase.auth.onAuthStateChange(() => {
      void loadRouteEditorAccess();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadRoutes = async () => {
      if (!guidesSupabaseConfigured) {
        setRouteStoreStatus("unconfigured");
        setHasLoadedEditorRoutes(true);
        return;
      }

      setRouteStoreStatus("loading");
      setRouteStoreMessage(null);
      setHasLoadedEditorRoutes(false);
      const { data, error } = await guidesSupabase
        .from("loup_loupe_route_sets")
        .select("routes")
        .eq("key", ROUTE_SET_STORAGE_KEY)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.warn("Failed to load Loup Loupe routes from Supabase", error);
        setRouteStoreStatus("error");
        setRouteStoreMessage(error.message);
        try {
          const storedRoutes = window.localStorage.getItem(ROUTE_EDITOR_STORAGE_KEY);
          if (storedRoutes) setEditorRoutes(normalizeRouteDefinitions(JSON.parse(storedRoutes)));
        } catch (storageError) {
          console.warn("Failed to load legacy Loup Loupe manual routes", storageError);
        } finally {
          setHasLoadedEditorRoutes(true);
        }
        return;
      }

      const remoteRoutes = normalizeRouteDefinitions((data as { routes?: unknown } | null)?.routes ?? []);
      setEditorRoutes(remoteRoutes.length > 0 ? remoteRoutes : HARD_CODED_ROUTES.map(cleanRouteForExport));
      setRouteStoreStatus("ready");
      setHasLoadedEditorRoutes(true);
    };

    void loadRoutes();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!routeEditorEnabled || !hasLoadedEditorRoutes || !guidesSupabaseConfigured) return;
    const timeout = window.setTimeout(async () => {
      await saveRoutesToSupabase(editorRoutes);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [editorRoutes, hasLoadedEditorRoutes, routeEditorEnabled]);

  useEffect(() => {
    if (!isRouteDrawing) return;
    const stopDrawing = () => {
      isRouteDrawingRef.current = false;
      setIsRouteDrawing(false);
    };
    window.addEventListener("pointerup", stopDrawing);
    window.addEventListener("blur", stopDrawing);
    return () => {
      window.removeEventListener("pointerup", stopDrawing);
      window.removeEventListener("blur", stopDrawing);
    };
  }, [isRouteDrawing]);

  if (!floor) {
    return (
      <div className="rounded-lg border border-border bg-muted/55 p-6 text-sm font-semibold text-muted-foreground">
        No Loup Loupe floor data found.
      </div>
    );
  }

  const currentIndex = floors.findIndex(
    (candidate) => candidate.floor_number === floor.floor_number,
  );
  const previousFloor = floors[currentIndex - 1];
  const nextFloor = floors[currentIndex + 1];
  const backgroundPath = getFloorBackground(floor);

  const addManualRoute = () => {
    const label = routeName.trim() || `${floor.floor_name} Route ${editorRoutes.filter((route) => route.floorNumber === floor.floor_number).length + 1}`;
    const route: RouteDefinition = {
      id: makeManualRouteId(floor.floor_number, label),
      floorNumber: floor.floor_number,
      label,
      color: routeColor,
      tileNumbers: [],
    };
    setEditorRoutes((currentRoutes) => [...currentRoutes, route]);
    setSelectedRouteId(route.id);
    setRouteNotes("");
    setSelectedRoutePathId("main");
  };

  const updateSelectedManualRoute = () => {
    if (!selectedEditorRoute) return;
    setEditorRoutes((currentRoutes) =>
      currentRoutes.map((route) =>
        route.id === selectedEditorRoute.id
          ? {
              ...route,
              label: routeName.trim() || route.label,
              color: routeColor,
              description: undefined,
              notes: normalizeOptionalRouteText(routeNotes),
            }
          : route,
      ),
    );
  };

  const updateSelectedRouteTileNote = (tileNumber: number, note: string) => {
    if (!selectedEditorRoute || !Number.isFinite(tileNumber)) return;
    setEditorRoutes((currentRoutes) =>
      currentRoutes.map((route) => {
        if (route.id !== selectedEditorRoute.id) return route;
        const tileNotes = { ...(route.tileNotes ?? {}) };
        const normalized = normalizeOptionalRouteText(note);
        if (normalized) {
          tileNotes[String(tileNumber)] = note;
        } else {
          delete tileNotes[String(tileNumber)];
        }
        return {
          ...route,
          tileNotes: Object.keys(tileNotes).length ? tileNotes : undefined,
        };
      }),
    );
  };

  const updateRouteNotesDraft = (value: string) => {
    setRouteNotes(value);
    if (!selectedEditorRoute) return;
    setEditorRoutes((currentRoutes) =>
      currentRoutes.map((route) =>
        route.id === selectedEditorRoute.id
          ? {
              ...route,
              description: undefined,
              notes: normalizeOptionalRouteText(value),
            }
          : route,
      ),
    );
  };

  const undoManualRouteTile = () => {
    if (!selectedEditorRoute) return;
    setEditorRoutes((currentRoutes) =>
      currentRoutes.map((route) =>
        route.id === selectedEditorRoute.id
          ? updateRoutePath(route, selectedRoutePathId, (tileNumbers) => tileNumbers.slice(0, -1))
          : route,
      ),
    );
  };

  const clearManualRouteTiles = () => {
    if (!selectedEditorRoute) return;
    setEditorRoutes((currentRoutes) =>
      currentRoutes.map((route) =>
        route.id === selectedEditorRoute.id
          ? updateRoutePath(route, selectedRoutePathId, () => [])
          : route,
      ),
    );
  };

  const forkSelectedRoutePath = (tileNumber: number) => {
    if (!selectedEditorRoute || !Number.isFinite(tileNumber) || !routeHasTile(selectedEditorRoute, tileNumber)) return;
    const nextBranchIndex = normalizeRouteBranches(selectedEditorRoute.branches).length;
    const nextPathId = `branch-${nextBranchIndex}` as RoutePathId;
    setEditorRoutes((currentRoutes) =>
      currentRoutes.map((route) => {
        if (route.id !== selectedEditorRoute.id) return route;
        const branches = normalizeRouteBranches(route.branches);
        return { ...route, branches: [...branches, [tileNumber]] };
      }),
    );
    setSelectedRoutePathId(nextPathId);
    setSelectedRouteNoteTileNumber(String(tileNumber));
  };

  const deleteManualRoute = () => {
    if (!selectedEditorRoute) return;
    setEditorRoutes((currentRoutes) => currentRoutes.filter((route) => route.id !== selectedEditorRoute.id));
    setSelectedRouteId("");
    setRouteNotes("");
    setSelectedRouteNoteTileNumber("");
    setSelectedRoutePathId("main");
  };

  const signInRouteEditor = async () => {
    setRouteLoginLoading(true);
    setRouteLoginMessage(null);
    const { error } = await guidesSupabase.auth.signInWithPassword({
      email: routeLoginEmail.trim(),
      password: routeLoginPassword,
    });
    setRouteLoginLoading(false);
    if (error) {
      setRouteLoginMessage(error.message);
      return;
    }
    setRouteLoginEmail("");
    setRouteLoginPassword("");
    setShowRouteLogin(false);
  };

  const signOutRouteEditor = async () => {
    await guidesSupabase.auth.signOut();
    setRouteAuthorName(null);
    setRouteEditorAccess(guidesSupabaseConfigured ? "signed-out" : "unconfigured");
    setShowRouteLogin(false);
  };

  return (
    <section className="loup-loupe-shell relative min-h-[calc(100vh-5rem)] overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl shadow-black/40">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-85"
        style={{
          backgroundImage: backgroundPath
            ? `linear-gradient(90deg, rgba(4,7,13,0.94), rgba(4,7,13,0.35) 42%, rgba(4,7,13,0.58)), url("${backgroundPath}")`
            : undefined,
        }}
      />
      <div
        className="absolute inset-0 opacity-25 mix-blend-screen"
        style={{
          backgroundImage: `url("${PRISM_TEXTURE}")`,
          backgroundSize: "26rem 26rem",
        }}
      />
      <div className="absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/85 to-transparent" />

      <header className="loup-loupe-header relative z-20 flex flex-col gap-3 border-b border-border bg-muted/60 px-4 py-3 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-accent">
            Tower Archive
          </p>
          <h1 className="mt-1 truncate text-3xl font-black uppercase leading-none text-foreground drop-shadow-[0_3px_0_rgba(0,0,0,0.8)]">
            Loup Loupe
          </h1>
        </div>

        <div className="loup-loupe-controls flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-muted/60 text-foreground transition hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-35"
            disabled={!previousFloor}
            onClick={() =>
              previousFloor &&
              setSelectedFloorNumber(previousFloor.floor_number)
            }
            aria-label="Previous floor"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <Select
            value={String(floor.floor_number)}
            onValueChange={(value) => setSelectedFloorNumber(Number(value))}
          >
            <SelectTrigger className="h-11 w-36 border-border/[0.22] bg-muted/90 text-base font-black text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="slime-page-loup-loupe max-h-72 border-border bg-popover text-foreground">
              {floors.map((candidate) => (
                <SelectItem
                  key={candidate.master_tower_floor_id}
                  value={String(candidate.floor_number)}
                >
                  {candidate.floor_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-muted/60 text-foreground transition hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-35"
            disabled={!nextFloor}
            onClick={() =>
              nextFloor && setSelectedFloorNumber(nextFloor.floor_number)
            }
            aria-label="Next floor"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex h-11 items-center gap-2 rounded-md border border-border/[0.22] bg-muted/60 px-3 text-sm font-black text-foreground transition hover:border-accent/60"
            onClick={() => setModal({ kind: "details" })}
          >
            <MapPinned className="h-4 w-4 text-accent" />
            Floor Details
          </button>
          <button
            type="button"
            className="flex h-11 items-center gap-2 rounded-md border border-border/[0.22] bg-muted/60 px-3 text-sm font-black text-foreground transition hover:border-[#fbbf24]/60"
            onClick={() => setModal({ kind: "clearRewards" })}
          >
            <Trophy className="h-4 w-4 text-[#fbbf24]" />
            Clear Rewards
          </button>
          <button
            type="button"
            className="flex h-11 items-center gap-2 rounded-md border border-border/[0.22] bg-muted/60 px-3 text-sm font-black text-foreground transition hover:border-accent/60"
            onClick={() => setModal({ kind: "challengeRewards" })}
          >
            <Gem className="h-4 w-4 text-accent" />
            Challenge
          </button>
          {ENABLE_ROUTE_EDITOR ? (
            routeEditorEnabled ? (
              <button
                type="button"
                className="flex h-11 items-center gap-2 rounded-md border border-accent/20 bg-accent/10 px-3 text-sm font-black text-accent transition hover:border-accent/60"
                onClick={signOutRouteEditor}
                title={routeAuthorName ? `Signed in as ${routeAuthorName}` : "Signed in"}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            ) : (
              <button
                type="button"
                className="flex h-11 items-center gap-2 rounded-md border border-border/[0.22] bg-muted/60 px-3 text-sm font-black text-foreground transition hover:border-accent/60"
                onClick={() => setShowRouteLogin((value) => !value)}
              >
                <LogIn className="h-4 w-4 text-accent" />
                Login
              </button>
            )
          ) : null}
          {routes.length > 0 ? (
            <Select
              value={selectedRouteId || NO_ROUTE_SELECT_VALUE}
              onValueChange={(routeId) => {
                setSelectedRouteId(routeId);
                if (routeId === NO_ROUTE_SELECT_VALUE) {
                setRouteNotes("");
                setSelectedRouteNoteTileNumber("");
                return;
              }
              const route = routes.find((candidate) => candidate.id === routeId);
              if (route) {
                setRouteName(route.label);
                setRouteColor(route.color);
                setRouteNotes(getRouteNotes(route));
                const firstTileWithNote = route.tileNumbers.find((tileNumber) =>
                  normalizeOptionalRouteText(route.tileNotes?.[String(tileNumber)]),
                );
                setSelectedRouteNoteTileNumber(String(firstTileWithNote ?? route.tileNumbers[0] ?? ""));
              }
            }}
            >
              <SelectTrigger className="h-11 w-44 border-border/[0.22] bg-muted/90 text-sm font-black text-foreground">
                <SelectValue placeholder="Route" />
              </SelectTrigger>
              <SelectContent className="slime-page-loup-loupe border-border bg-popover text-foreground">
                <SelectItem value={NO_ROUTE_SELECT_VALUE}>No route</SelectItem>
                {routes.map((route) => (
                  <SelectItem key={route.id} value={route.id}>
                    {route.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </header>

      {showRouteLogin ? (
        <div className="relative z-20 border-b border-border bg-background/70 px-4 py-3 backdrop-blur">
          <div className="ml-auto grid max-w-2xl gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input
              value={routeLoginEmail}
              onChange={(event) => setRouteLoginEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="h-10 rounded-md border border-border/[0.22] bg-muted/60 px-3 text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/50"
            />
            <input
              value={routeLoginPassword}
              onChange={(event) => setRouteLoginPassword(event.target.value)}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              onKeyDown={(event) => {
                if (event.key === "Enter") void signInRouteEditor();
              }}
              className="h-10 rounded-md border border-border/[0.22] bg-muted/60 px-3 text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/50"
            />
            <button
              type="button"
              disabled={routeLoginLoading || !routeLoginEmail.trim() || !routeLoginPassword}
              onClick={() => void signInRouteEditor()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-accent/20 bg-accent/10 px-4 text-xs font-black uppercase tracking-[0.14em] text-accent transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <LogIn className="h-3.5 w-3.5" />
              {routeLoginLoading ? "Signing in" : "Login"}
            </button>
          </div>
          {routeLoginMessage ? (
            <p className="ml-auto mt-2 max-w-2xl rounded-md border border-rose-200/20 bg-rose-300/10 p-2 text-xs font-semibold text-rose-100">
              {routeLoginMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="loup-mobile-floor-rail relative z-20 flex gap-2 overflow-x-auto border-b border-border bg-background/50 px-3 py-2 image-scroll md:hidden">
        <FloorTowerStackHorizontal
          floors={floors}
          selectedFloorNumber={floor.floor_number}
          onSelectFloor={setSelectedFloorNumber}
        />
      </div>

      <aside className="absolute left-4 top-28 bottom-4 z-20 hidden w-36 md:block">
        <FloorTowerStack
          floors={floors}
          selectedFloorNumber={floor.floor_number}
          onSelectFloor={setSelectedFloorNumber}
        />
      </aside>

      <div className="loup-board-region relative z-10 min-h-[calc(100vh-11rem)] overflow-hidden px-2 py-5 md:pl-44 md:pr-4">
        <div className="mx-auto flex w-full max-w-[78rem] flex-col items-center gap-4">
          <TowerBoard
            floor={floor}
            selectedTileId={selectedTileId}
            selectedRoute={selectedRoute}
            warpSourceTile={warpSourceTile}
            warpDestinations={warpDestinations}
            routeEditor={routeEditorHandlers}
            onTileClick={(tile) => {
              if (!isInteractiveTile(tile)) return;
              if (tile.event?.warp_points.length) {
                setSelectedTileId((currentTileId) =>
                  currentTileId === tile.master_tower_map_id ? null : tile.master_tower_map_id,
                );
                setModal(null);
                return;
              }
              setSelectedTileId(tile.master_tower_map_id);
              setModal({ kind: "tile", tile });
            }}
          />
          {routeEditorEnabled ? (
            <RouteEditorPanel
              floor={floor}
              editorRoutes={editorRoutes}
              selectedRouteId={selectedRouteId || NO_ROUTE_SELECT_VALUE}
              routeName={routeName}
              routeColor={routeColor}
              routeNotes={routeNotes}
              selectedNoteTileNumber={selectedRouteNoteTileNumber}
              selectedPathId={selectedRoutePathId}
              routeStoreStatus={routeStoreStatus}
              routeStoreMessage={routeStoreMessage}
              isSavingRoutes={isSavingRoutes}
              onRouteNameChange={setRouteName}
              onRouteColorChange={setRouteColor}
              onRouteNotesChange={updateRouteNotesDraft}
              onSelectNoteTile={setSelectedRouteNoteTileNumber}
              onUpdateTileNote={updateSelectedRouteTileNote}
              onSelectPath={setSelectedRoutePathId}
              onForkPath={forkSelectedRoutePath}
              onAddRoute={addManualRoute}
              onSelectRoute={(routeId) => {
                setSelectedRouteId(routeId);
                setSelectedRoutePathId("main");
                if (routeId === NO_ROUTE_SELECT_VALUE) {
                  setRouteNotes("");
                  setSelectedRouteNoteTileNumber("");
                  return;
                }
                const route = editorRoutes.find((candidate) => candidate.id === routeId);
                if (route) {
                  setRouteName(route.label);
                  setRouteColor(route.color);
                  setRouteNotes(getRouteNotes(route));
                  const routeTileNumbers = getRouteTileNumbers(route);
                  const firstTileWithNote = routeTileNumbers.find((tileNumber) =>
                    normalizeOptionalRouteText(route.tileNotes?.[String(tileNumber)]),
                  );
                  setSelectedRouteNoteTileNumber(String(firstTileWithNote ?? routeTileNumbers[0] ?? ""));
                }
              }}
              onUpdateSelectedRoute={updateSelectedManualRoute}
              onUndoTile={undoManualRouteTile}
              onClearTiles={clearManualRouteTiles}
              onDeleteRoute={deleteManualRoute}
              onSaveRoutes={() => void saveRoutesToSupabase(editorRoutes)}
            />
          ) : selectedRoute ? (
            <RouteSummaryPanel floor={floor} route={selectedRoute} />
          ) : null}
        </div>
      </div>

      <TileDialog
        modal={modal}
        floor={floor}
        enemyById={enemyById}
        onClose={() => setModal(null)}
      />
    </section>
  );
}
