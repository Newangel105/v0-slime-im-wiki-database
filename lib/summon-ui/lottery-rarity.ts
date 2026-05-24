// Per-rarity helpers for the lottery reveal pipeline. Every classification
// rule here is sourced from the IL2CPP enums + the UILottery* prefab
// structure dumps (see lottery-view-rules.json _meta.sources). Do NOT
// hand-edit the thresholds — update lottery-view-rules.json instead.
import { VIEW_RULES } from "./specs"
import type { CharacterAppearViewRarity, PromotionViewRarity, ResultCardRarityKey } from "./specs"

export type RarityInputs = {
  // The Rarity field in CharacterAcquisitionElement (3..7 in this game).
  rarity: number
  // ui_thumb.arousal_type_raw mirrors MasterArousalType from the dump:
  //   0 = none, 1 = Special, 2 = SpecialPlus, 3 = Epic.
  arousal_type_raw?: number | null
  // True when the pulled element's pcId is in
  // banner.pickup_animation_character_details_ids. Promotion IL2CPP only uses
  // this for the RandomStringRainbow SR-start branch; arousal_type_raw >= 2
  // still fixes to SSRUltimatePlusPU without it.
  is_pickup?: boolean
}

function inList<T extends number | null>(value: T, allowed: T[] | undefined | null): boolean {
  if (!allowed) return false
  return allowed.includes(value)
}

// CharacterAcquisitionElement.Rarity + ArousalType ->
// UILotteryCharacterAppear.RarityType (R/SR/SSR/SSRUltimate/UREx/URUltimate).
// Mirrors the prefab's ef_view_<rarity> / gradation* / frame* selection.
export function characterAppearRarityFor({ rarity, arousal_type_raw }: RarityInputs): CharacterAppearViewRarity {
  const ar = arousal_type_raw ?? 0
  // Match URUltimate first (highest), since rarity 6+ chars have arousal_type 3.
  if (rarity >= 7 || ar >= 3) return "URUltimate"
  if (ar === 2) return "UREx"
  if (ar === 1) return "SSRUltimate"
  if (rarity >= 6) return "URUltimate" // 6★ non-arousal -> URUltimate per shadow_tint table
  if (rarity >= 5) return "SSR"
  if (rarity >= 4) return "SR"
  return "R"
}

// CharacterAcquisitionElement -> UILotteryPromotion.Entity.ViewRarity.
// UICharacterAcquisitionAnimationPresenter.ShowLotteryPromotionAsync runs for
// each element and writes UILotteryPromotion.Entity.startRarity/fixRarity.
// IsPromotionFiveStar(patternAnimationType) only gates the first 5-star
// SR->SSR tease; it does not gate whether Promotion appears at all.
export function promotionViewRarityFor(
  inputs: RarityInputs,
  patternAnimationType: number | null,
  fiveStarOrdinalInBatch: number,
): { startRarity: PromotionViewRarity; fixRarity: PromotionViewRarity } {
  const { rarity, arousal_type_raw } = inputs
  const ar = arousal_type_raw ?? 0
  if (rarity >= 5) {
    if (ar >= 2) {
      // IL2CPP branch: fixRarity is SSRUltimatePlusPU for arousalType >= 2.
      // If the result is a pickup, RandomStringRainbow may instead start at
      // SR and promote to SSRUltimatePlusPU; that random outcome is not in the
      // current frontend payload, so the deterministic no-rainbow branch is
      // used and documented in the Promotion status.
      return { startRarity: "SSRUltimatePlusPU", fixRarity: "SSRUltimatePlusPU" }
    }
    // First 5★ in batch on a promotion-pattern banner: start SR then morph to
    // SSR (the rarity-ascending tease). Subsequent 5★+ skip the tease.
    if (fiveStarOrdinalInBatch === 1 && isPromotionFiveStarPattern(patternAnimationType)) {
      return { startRarity: "SR", fixRarity: "SSR" }
    }
    return { startRarity: "SSR", fixRarity: "SSR" }
  }
  if (rarity >= 4) return { startRarity: "SR", fixRarity: "SR" }
  return { startRarity: "R", fixRarity: "R" }
}

export function isPromotionFiveStarPattern(patternAnimationType: number | null): boolean {
  // arm64 disasm of Tempest.LotteryPattern.LotteryPatterMovieUtility
  //   .IsPromotionFiveStar:
  //     and w8, w0, #0xfffffffe
  //     cmp w8, #2
  return patternAnimationType === 2 || patternAnimationType === 3
}

// CharacterAcquisitionElement.Rarity + ArousalType ->
// XIUILotteryResult card variant. Selects the right
// inEffects/inShortEffects/itemEffects sub-tree on the resultTemplate prefab.
export function resultCardRarityKeyFor({ rarity, arousal_type_raw }: RarityInputs): ResultCardRarityKey {
  const ar = arousal_type_raw ?? 0
  if (rarity >= 7 || ar >= 3) return "_6_Epic"
  if (rarity >= 6) {
    if (ar >= 2) return "_5_6_UltimatePlus"
    if (ar >= 1) return "_5_6_Ultimate"
    return "_6_Epic"
  }
  if (rarity === 5) {
    if (ar >= 2) return "_5_6_UltimatePlus"
    if (ar >= 1) return "_5_6_Ultimate"
    return "_5"
  }
  if (rarity === 4) return "_4"
  return "_3"
}

// Which gradation/frame GameObjects to HIDE for a given ViewRarity. This is
// now driven 1:1 by the decoded Appear<Rarity> AnimationClip m_IsActive
// values (character_appear_anim.json.rarities.<R>.gradationActive), NOT by
// hand-authored lists. A node is hidden iff its clip m_IsActive == 0.
//   R   : gradation=1                                  (rest 0)
//   SR  : gradation=1                                  (rest 0)
//   SSR : gradation=1, gradationSSR=1                  (rest 0)
//   SSRUltimate / UREx : gradationUltimate=1           (rest 0)
//   URUltimate : frameURUltimate=1                     (rest 0)
import characterAppearAnim from "./lottery_runtime_data/character_appear_anim.json"

type AppearAnimGrad = { gradationActive: Record<string, number> }
const APPEAR_GRAD = (characterAppearAnim as unknown as {
  rarities: Record<string, AppearAnimGrad>
}).rarities

export function characterAppearHideList(viewRarity: CharacterAppearViewRarity): string[] {
  const rec = APPEAR_GRAD[viewRarity]
  if (!rec) {
    throw new Error(`character_appear_anim.json is missing gradationActive for view rarity "${viewRarity}". Re-extract the Appear<Rarity> clip instead of using a fallback.`)
  }
  const active = rec.gradationActive || {}
  // Top-level gradation/frame siblings; hide those whose clip m_IsActive is 0.
  const topNodes = ["gradation", "gradationSSR", "gradationUltimate", "frameURUltimate"]
  const hide: string[] = []
  for (const n of topNodes) {
    if ((active[n] ?? 0) === 0) {
      hide.push(`UILotteryCharacterAppear/container/${n}`)
    }
  }
  // addURUltimateEffectContainer rides with frameURUltimate (URUltimate only).
  if ((active["frameURUltimate"] ?? 0) === 0) {
    hide.push("UILotteryCharacterAppear/container/addURUltimateEffectContainer")
  }
  // Nameplate / per-star overlays driven by sprite 70f63a6ba627100e.png
  // (rainbow gradient — the same texture in MULTIPLE prefab nodes). The
  // muscle-clip m_IsActive samples can't be decoded reliably (Hermite
  // tangent overshoots produce non-binary mid-frame values), so the
  // suppression rule for non-Ultimate-tier rarities is anchored in:
  //
  //   (a) the prefab name convention ("efUltimate" suffix = Ultimate-tier-
  //       only effect), AND
  //   (b) the visible texture content (the 70f63a6ba627100e.png is a
  //       pastel rainbow gradient that visibly mismatches the real-game
  //       R/SR/SSR nameplate, which is opaque ornate without that tint).
  //
  // For non-Ultimate-tier rarities (R/SR/SSR) we hide every node whose
  // prefab sprite is the rainbow gradient — both base/efUltimate AND the
  // rarity<N>Effect/flareImage / flareImage_2 children.
  const isUltimateTier = viewRarity === "SSRUltimate" || viewRarity === "UREx" || viewRarity === "URUltimate"
  // Hide base/* overlays per clip-data flag OR prefab-naming rule.
  for (const sub of ["gradation", "pattern", "efUltimate", "line", "rimuru"] as const) {
    const v = active[`base/${sub}`]
    if (v != null && v === 0) {
      hide.push(`UILotteryCharacterAppear/container/characterName/base/${sub}`)
    } else if (sub === "efUltimate" && !isUltimateTier) {
      hide.push(`UILotteryCharacterAppear/container/characterName/base/${sub}`)
    }
  }
  // Per-star inner effect + starLight overlays under rarity<N>.
  for (let i = 1; i <= 6; i += 1) {
    for (const sub of ["effect", "starLight"] as const) {
      const v = active[`rarity${i}/${sub}`]
      if (v != null && v === 0) {
        hide.push(`UILotteryCharacterAppear/container/characterName/rarityStar/rarity${i}/${sub}`)
      } else if (!isUltimateTier) {
        hide.push(`UILotteryCharacterAppear/container/characterName/rarityStar/rarity${i}/${sub}`)
      }
    }
  }
  // Per-star BURST CONTAINER children under rarity<N>Effect. The
  // flareImage / flareImage_2 use the rainbow gradient sprite at alpha
  // 0.39 / 0.125 in the prefab; visible-game R/SR/SSR shows none of
  // them. Inner ParticleSystem children (ef_e_*) are gated separately by
  // their own emission.enabled flag in the canvas integrator.
  for (let i = 1; i <= 6; i += 1) {
    for (const sub of ["flareImage", "flareImage_2"] as const) {
      if (!isUltimateTier) {
        hide.push(`UILotteryCharacterAppear/container/characterName/rarityStar/rarity${i}Effect/${sub}`)
      }
    }
  }
  return hide
}

export function nameplateSpritesFor(viewRarity: CharacterAppearViewRarity) {
  return VIEW_RULES.characterAppear.nameplate_sprites_per_rarity[viewRarity]
}

export function backgroundSpritesFor(viewRarity: CharacterAppearViewRarity) {
  return VIEW_RULES.characterAppear.background_per_rarity[viewRarity]
}

export function starCountFor(viewRarity: CharacterAppearViewRarity): number {
  return VIEW_RULES.characterAppear.starCount[viewRarity]
}

export function shadowTintFor(viewRarity: CharacterAppearViewRarity): [number, number, number, number] {
  return VIEW_RULES.characterAppear.shadow_tint_per_rarity[viewRarity]
}

// XIUIFrame.ChangeByLabel reproduction for UILotteryCharacterAppear:
//
// dump.cs (TypeDefIndex 33829): XIUIFrame holds `List<GameObject> FrameKeys`
// and on `ChangeByLabel(string)` activates ONLY the matching frame and
// deactivates the rest. The prefab wires up two XIUIFrame components:
//
//   container/centers/ef_sageBg     <- rarityEffectView          (UILotteryCharacterAppear field 0xE0)
//   container/ef_appear             <- rarityEffectAppearView    (UILotteryCharacterAppear field 0xE8)
//
// Each holds 6 frame children named `ef_view_<RarityType>` where RarityType is
// the UILotteryCharacterAppear.RarityType enum label: R, SR, SSR, SSRUltimate,
// UREx, URUltimate. UILotteryCharacterAppear.Set(entity) passes entity.viewRarity
// (RVA 0xA38F384) to both frames, so at any moment exactly one ef_view_<X>
// child is active in each container.
//
// The prefab DEFAULT has ef_view_URUltimate active and the other five inactive.
// That's why a static PrefabTree render correctly shows the URUltimate
// background but is WRONG for every other rarity unless we apply the
// activation here. This helper returns the full hide list for both XIUIFrame
// containers in a single call.
const CHARACTER_APPEAR_VIEW_RARITY_LABELS: readonly CharacterAppearViewRarity[] = [
  "R", "SR", "SSR", "SSRUltimate", "UREx", "URUltimate",
]

export function characterAppearEfViewHideList(viewRarity: CharacterAppearViewRarity): string[] {
  if (!CHARACTER_APPEAR_VIEW_RARITY_LABELS.includes(viewRarity)) {
    throw new Error(`Unknown CharacterAppearViewRarity "${viewRarity}". XIUIFrame.ChangeByLabel only accepts the six UILotteryCharacterAppear.RarityType labels.`)
  }
  const hide: string[] = []
  for (const label of CHARACTER_APPEAR_VIEW_RARITY_LABELS) {
    if (label === viewRarity) continue
    hide.push(`UILotteryCharacterAppear/container/centers/ef_sageBg/ef_view_${label}`)
    hide.push(`UILotteryCharacterAppear/container/ef_appear/ef_view_${label}`)
  }
  return hide
}

// SSRUltimateParticle is a UIParticle child of characterName/rarityStar that
// only appears for Ultimate-tier rarities. Prefab default is m_IsActive=1; the
// UILotteryCharacterAppear.Set IL2CPP body toggles it based on viewRarity. The
// observed real-game behaviour activates it for SSRUltimate, UREx, URUltimate
// (the same group that uses gradationUltimate / frameURUltimate). Lower
// rarities must hide it explicitly because the prefab default is active.
export function characterAppearSSRUltimateParticleVisible(viewRarity: CharacterAppearViewRarity): boolean {
  return viewRarity === "SSRUltimate" || viewRarity === "UREx" || viewRarity === "URUltimate"
}
