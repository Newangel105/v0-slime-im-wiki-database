// Loads the extracted ParticleSystem param sets and exposes the visible
// top-level emitters per stage. The params are 1:1 from the prefab; the
// filtering picks the user-visible glow/sparkle layers (the prefab nests
// dozens of sub-emitters; we render the representative real ones rather
// than inventing new effects).
import promo from "./lottery_runtime_data/UILotteryPromotion.particles.json"
import appear from "./lottery_runtime_data/UILotteryCharacterAppear.particles.json"
import result from "./lottery_runtime_data/UILotteryResult.particles.json"
import particleMaterials from "./lottery_runtime_data/character_appear_particle_materials.json"
import resultParticleMaterials from "./lottery_runtime_data/result_particle_materials.json"
import particleTransforms from "./lottery_runtime_data/character_appear_particle_transforms.json"
import particleFull from "./lottery_runtime_data/character_appear_particle_full.json"
import type { PSRecord, PSMaterialBinding, PSEmitterTransform, PSEmitterFull } from "@/components/lottery-particles"

const promoSystems = (promo as { systems: PSRecord[] }).systems
// UILotteryCharacterAppear.particles.json adds a `path` field per system
// (the full transform path from the UILotteryCharacterAppear root) so we
// can group systems by parent anchor — see the JSON's _meta.
type AppearSystem = PSRecord & { path?: string | null }
const appearSystems = (appear as { systems: AppearSystem[] }).systems

function firstOfEachName(systems: PSRecord[], names: string[]): PSRecord[] {
  const out: PSRecord[] = []
  for (const n of names) {
    const hit = systems.find((s) => s.go === n)
    if (hit) out.push(hit)
  }
  return out
}

// UILotteryPromotion: the floating purple glow particles seen behind the
// hieroglyph text (ef_e_Glow00..03 — real life 1-3s, emit 2-20/s,
// violet startColor straight from the prefab).
export const PROMOTION_GLOW_PARTICLES: PSRecord[] = firstOfEachName(
  promoSystems,
  ["ef_e_Glow00", "ef_e_Glow01", "ef_e_Glow02", "ef_e_Glow03"],
)

// UILotteryCharacterAppear has two distinct particle layers:
//   1) The CENTRAL burst at container/ef_appear (Light00, appearAura,
//      MagicCiecle, etc.) — wraps the whole character.
//   2) The PER-STAR bursts at characterName/rarityStar/rarity<N>Effect
//      (ef_e_flash, ef_e_shine, ef_e_particle, ef_e_circle) — 9 particles
//      per star, 6 stars total = 54 particles.
// The path-based filter below splits them so the central burst stays in one
// canvas at the ef_appear anchor and each per-star burst gets its own canvas
// at its rarity<N>Effect anchor (the prefab nest provides the anchor; we
// inject a sized slot to give each canvas a visible 400×400 design-space
// area centred on the 0×0 prefab anchor).

const isCentralAppearPath = (p: string | null | undefined) =>
  !!p && p.includes("/container/ef_appear/")
const isRarityEffectPath = (p: string | null | undefined, n: number) =>
  !!p && p.includes(`/rarityStar/rarity${n}Effect/`)
// The background cosmic-galaxy aura + sparkle layer lives under
// container/centers/ef_sageBg/ef_view_<rarity>. Six rarity subtrees exist;
// only one is active at runtime (via XIUIFrame.ChangeByIndex). The path is
// the discriminator — we filter to the matching rarity tier per call.
const isBgPath = (p: string | null | undefined, rarityLabel: string) =>
  !!p && p.includes(`/container/centers/ef_sageBg/ef_view_${rarityLabel}/`)

// Central burst — particles whose transform path is under container/ef_appear.
// This is the "rim of light around the character" layer; the rendering
// remains a full-stage canvas via the existing FullArtRevealStage slot.
export const CHARACTER_APPEAR_CENTRAL_PARTICLES: PSRecord[] = appearSystems.filter(
  (s) => isCentralAppearPath(s.path),
)

// Per-star burst — particles under rarity<N>Effect for a specific star.
// LotteryParticles renders these in a per-anchor canvas that is positioned
// 1:1 with the rarity<N>Effect prefab anchor (see CHARACTER_APPEAR_RARITY_EFFECT_ORIGINS).
//
// Optionally pass a `hideRel` set of relative paths (from
// per_rarity_swaps.json's hide_paths_from_active_finals) to drop particle
// systems whose AnimationClip m_IsActive final value is 0 for the current
// rarity. Without this filter, PrefabTree's per-rarity hide list correctly
// suppresses the corresponding DOM nodes, but LotteryParticles (canvas)
// receives the full 9-system list and keeps emitting their particles —
// producing the "little sparkles around the stars after placement" artifact
// the user reported. Data-driven: the hide list IS the clip's active_finals.
export function characterAppearRarityEffectParticles(n: number, hideRel?: ReadonlySet<string> | null): PSRecord[] {
  const baseList = appearSystems.filter((s) => isRarityEffectPath(s.path, n))
  if (!hideRel || hideRel.size === 0) return baseList
  // hideRel entries are relative ("container/.../rarity1Effect/ef_e_flash_01");
  // PSRecord.path is the full prefab-rooted path. Compare the relative tail.
  return baseList.filter((s) => {
    const rel = (s.path || "").replace(/^UILotteryCharacterAppear\//, "")
    return !hideRel.has(rel)
  })
}

// Design-space (1920×1080) centre of each rarity<N>Effect anchor, computed
// by walking the prefab cascade for UILotteryCharacterAppear (see the python
// helper that emitted these). Positions are in CSS Y-down design-space px;
// the per-star canvas slot positions each canvas 200 px left + 200 px up of
// these centres so the resulting 400×400 canvas is exactly centred on the
// anchor.
export const CHARACTER_APPEAR_RARITY_EFFECT_ORIGINS: Record<number, { x: number; y: number }> = {
  1: { x: 480.0, y: 929.0 },
  2: { x: 543.0, y: 929.0 },
  3: { x: 605.0, y: 929.0 },
  4: { x: 667.0, y: 929.0 },
  5: { x: 728.0, y: 929.0 },
  6: { x: 728.0, y: 929.0 },
}

// Backwards-compat alias — kept for any callers still importing the old
// name. Same particles as CHARACTER_APPEAR_CENTRAL_PARTICLES (the prior
// firstOfEachName-by-name filter picked names that are only present under
// container/ef_appear in the bundle, so the resulting list is the same).
export const CHARACTER_APPEAR_PARTICLES: PSRecord[] = CHARACTER_APPEAR_CENTRAL_PARTICLES

// Cosmic-galaxy BACKGROUND particle systems per rarity tier. Filtered from
// the prefab's `container/centers/ef_sageBg/ef_view_<rarity>` subtree, which
// XIUIFrame.ChangeByIndex activates exactly one of at runtime.
//
// Per-rarity content (from the extracted particle materials JSON):
//   R           → 3 systems (appearAura_00_R variant + circleSmoke + circleCore)
//   SR          → 3 systems (appearAura_00_SR, circleSmoke_00, circle_03)
//   SSR         → 4 systems (adds a tier-specific extra)
//   SSRUltimate → 10 systems (adds kirakira_00/01, MagicCircle, Particle_01)
//   UREx        → 10 systems
//   URUltimate  → 10 systems (Rarity6 variants + AuraUR_01 + circle_00_URUltimate)
//
// The label must match the prefab's `ef_view_<X>` naming exactly:
//   "R" | "SR" | "SSR" | "SSRUltimate" | "UREx" | "URUltimate".
export function characterAppearBgParticles(rarityLabel: string): PSRecord[] {
  return appearSystems.filter((s) => isBgPath(s.path, rarityLabel))
}

// Material/texture bindings extracted from each ParticleSystemRenderer's
// material PPtr chain (see scripts/extract_particle_materials_and_textures.py).
// Bindings are keyed by `path` (matches PSRecord.path). LotteryParticles
// loads the texture file from /UI/lottery_particles/<file>.png and renders
// the real sprite (with rotation/tint/lifetime modules), falling back to
// the additive radial gradient + console warning if a binding is missing
// (documented as a hard error path).
export const CHARACTER_APPEAR_PARTICLE_MATERIALS: PSMaterialBinding[] =
  (particleMaterials as { systems: PSMaterialBinding[] }).systems.map((m) => ({
    path: m.path,
    texture_file: m.texture_file ?? null,
    material_name: m.material_name ?? null,
    blend_mode: m.blend_mode ?? null,
    shader_name: m.shader_name ?? null,
  }))

// Per-emitter spawn origin (design-space 1920×1080) + UIParticle scale,
// extracted by _work/extract_particle_emitter_transforms.py from each
// ParticleSystem's RectTransform cascade and nearest UIParticle ancestor's
// m_Scale3D. Used by LotteryParticles to spawn each particle at the prefab's
// real per-emitter location instead of canvas centre. The transforms JSON
// re-uses the prefab `path` field so LotteryParticles can join by path.
export const CHARACTER_APPEAR_PARTICLE_TRANSFORMS: PSEmitterTransform[] =
  (particleTransforms as { emitters: PSEmitterTransform[] }).emitters

// Full ParticleSystem typetree (ShapeModule + ParticleSystemRenderer + scaling
// mode) for each emitter. LotteryParticles uses this for Donut/Cone ring
// sampling with arc + radiusThickness + donutRadius and for renderMode-aware
// maxParticleSize clamping. See _work/extract_full_shape_and_renderer.py for
// the extraction script.
export const CHARACTER_APPEAR_PARTICLE_FULL: PSEmitterFull[] =
  (particleFull as { emitters: PSEmitterFull[] }).emitters

// Result UI: per-card inEffectsRarity<N>/uiParticle/* particles. We filter by
// the rarity key passed in by the caller (resultCardRarityKeyFor) so each
// card only mounts the particles relevant to its in-effects subtree.
type ResultSystem = PSRecord & { path?: string | null }
const resultSystems = (result as { systems: ResultSystem[] }).systems

const RESULT_RARITY_KEY_TO_PATH_SUFFIX: Record<string, string> = {
  _3: "inEffectsRarity3",
  _4: "inEffectsRarity4",
  _5: "inEffectsRarity5",
  _5_6_Ultimate: "inEffectsRarity5-6Ultimate",
  _5_6_UltimatePlus: "inEffectsRarity5-6UltimatePlus",
  _6_Epic: "inEffectsRarity6Epic",
}

export function resultCardInEffectParticles(cardRarityKey: string): PSRecord[] {
  const suffix = RESULT_RARITY_KEY_TO_PATH_SUFFIX[cardRarityKey]
  if (!suffix) return []
  // Match `<…>/<suffix>/uiParticle/<particleName>` paths only (skip the
  // shorter inShortEffects + itemEffects variants — those are different
  // entry/exit timings the card animator switches between; the static
  // result UI state shows the long-form inEffects).
  return resultSystems.filter((s) => {
    const p = s.path ?? ""
    return p.includes(`/${suffix}/uiParticle/`)
  })
}

export const RESULT_PARTICLE_MATERIALS: PSMaterialBinding[] =
  (resultParticleMaterials as { systems: PSMaterialBinding[] }).systems.map((m) => ({
    path: m.path,
    texture_file: m.texture_file ?? null,
    material_name: m.material_name ?? null,
    blend_mode: m.blend_mode ?? null,
    shader_name: m.shader_name ?? null,
  }))
