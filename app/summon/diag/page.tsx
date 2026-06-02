"use client"

// Visual-parity diagnostic. Renders each reveal STAGE COMPONENT (the same
// thing the orchestrator ships) with a synthetic test result so the
// rendered output can be diffed against the recorded real-game frames in
// D:\video_compare\.
//
// Open: /summon/diag

import { useEffect, useState } from "react"
import type { SummonBanner, SummonCharacter, SummonPayload } from "@/lib/summon-data"
// Same-unit diag presets — each preset matches a specific reference frame
// in the real-game capture videos so visual stage-gate is comparing
// LIKE-FOR-LIKE units, not arbitrary placeholders.
//   - "dord"       R  reference: pull_r.mp4 frame 33 (Dord, 3-star Bless protector)
//   - "shion-ssr"  SSR reference: pull_sr_ssr.mp4 frame 020 (Shion default 5-star)
//   - "elmesia-uru" URUltimate reference: 6-star Elmesia
//   - "benimaru"   legacy placeholder, no real-game frame match
// IDs sourced from pc_wiki.generated.json + character_appear_master_manifest.json.
const DIAG_PRESETS = {
  benimaru: {
    label: "Benimaru (placeholder, no real-game frame)",
    master_pc_id: 100002,
    name: "Benimaru",
    affiliation_name: "Spy General",
    rarity: 5,
    arousal: 0,
    images: {
      icon: "Image/Character/PC/BenimaruDefault/5/BenimaruDefault_5_CharaPartyM",
      full: "Image/Character/PC/BenimaruDefault/5/BenimaruDefault_5_CharaInfo",
      card: "Image/Character/PC/BenimaruDefault/5/BenimaruDefault_5_CharaCard",
    },
  },
  dord: {
    label: "Dord (R) — pull_r.mp4 frame 33",
    master_pc_id: 230004,
    name: "Dord",
    affiliation_name: "The Skilled Artisan",
    rarity: 3,
    arousal: 0,
    images: {
      icon: "Image/Character/Bless/DordDefault/3/DordDefault_3_BlessPartyM",
      full: "Image/Character/Bless/DordDefault/3/DordDefault_3_BlessInfo",
      card: "Image/Character/Bless/DordDefault/3/DordDefault_3_BlessCard",
    },
  },
  // Long-name R-tier test preset. Uses Dord's sprite + affiliation but with
  // a deliberately-long synthesised name to verify how the nameplate handles
  // long character names without truncating / overflowing / breaking layout.
  "dord-longname": {
    label: "Dord (R, long-name test)",
    master_pc_id: 230004,
    name: "Sir Reginald Algernon Bartholomew",
    affiliation_name: "The Skilled Artisan of the Sovereign Realm",
    rarity: 3,
    arousal: 0,
    images: {
      icon: "Image/Character/Bless/DordDefault/3/DordDefault_3_BlessPartyM",
      full: "Image/Character/Bless/DordDefault/3/DordDefault_3_BlessInfo",
      card: "Image/Character/Bless/DordDefault/3/DordDefault_3_BlessCard",
    },
  },
  "shion-ssr": {
    label: "Shion (SSR default) — pull_sr_ssr.mp4 1:17-1:20",
    master_pc_id: 100003,
    name: "Shion",
    affiliation_name: "The Talented Secretary",
    rarity: 5,
    arousal: 0,
    images: {
      icon: "Image/Character/PC/ShionDefault/5/ShionDefault_5_CharaPartyM",
      full: "Image/Character/PC/ShionDefault/5/ShionDefault_5_CharaInfo",
      card: "Image/Character/PC/ShionDefault/5/ShionDefault_5_CharaCard",
    },
  },
  "elmesia-uru": {
    // master_pc_id 160661 is ElmesiaHA2026 (NOT ElmesiaDefault) per the
    // refreshed character_appear_master_manifest.json + pc_wiki.generated.json
    // illustration path. Stale paths fixed 2026-05-22.
    label: "Elmesia El Ru Thalion (URUltimate, ElmesiaHA2026)",
    master_pc_id: 160661,
    name: "Elmesia El Ru Thalion",
    affiliation_name: "Celestial Sovereign",
    rarity: 6,
    arousal: 3,
    images: {
      icon: "Image/Character/PC/ElmesiaHA2026/7/ElmesiaHA2026_7_CharaPartyM",
      full: "Image/Character/PC/ElmesiaHA2026/7/ElmesiaHA2026_7_CharaInfo",
      card: "Image/Character/PC/ElmesiaHA2026/7/ElmesiaHA2026_7_CharaCard",
    },
  },
  // Additional preset for the SR tier of Shion (ShionBefore, 4-star).
  // Real-game reference: pull_sr_ssr.mp4 1:01 (SR variant).
  "shion-sr": {
    label: "Shion (SR / ShionBefore) — pull_sr_ssr.mp4 SR variant",
    master_pc_id: 140014,
    name: "Shion",
    affiliation_name: "Future Confidant",
    rarity: 4,
    arousal: 0,
    images: {
      icon: "Image/Character/PC/ShionBefore/4/ShionBefore_4_CharaPartyM",
      full: "Image/Character/PC/ShionBefore/4/ShionBefore_4_CharaInfo",
      card: "Image/Character/PC/ShionBefore/4/ShionBefore_4_CharaCard",
    },
  },
  // SSRUltimate tier (5-star with Ultimate-tier effects). Use Shion default
  // boosted to SSRUltimate by setting rarity=5, arousal=1 (puts the star
  // count at 5 and triggers the SSRUltimate effects in the rarity rules).
  "shion-ssrult": {
    label: "Shion (SSRUltimate, arousal=1)",
    master_pc_id: 100003,
    name: "Shion",
    affiliation_name: "The Talented Secretary",
    rarity: 5,
    arousal: 1,
    images: {
      icon: "Image/Character/PC/ShionDefault/5/ShionDefault_5_CharaPartyM",
      full: "Image/Character/PC/ShionDefault/5/ShionDefault_5_CharaInfo",
      card: "Image/Character/PC/ShionDefault/5/ShionDefault_5_CharaCard",
    },
  },
  // UREx (UR Extra) tier — 5-star with UR effects. Elmesia is the available UR
  // character; URUltimate uses arousal=3; UREx uses arousal=2.
  "elmesia-urex": {
    label: "Elmesia El Ru Thalion (UREx, arousal=2)",
    master_pc_id: 160661,
    name: "Elmesia El Ru Thalion",
    affiliation_name: "Celestial Sovereign",
    rarity: 6,
    arousal: 2,
    images: {
      icon: "Image/Character/PC/ElmesiaHA2026/7/ElmesiaHA2026_7_CharaPartyM",
      full: "Image/Character/PC/ElmesiaHA2026/7/ElmesiaHA2026_7_CharaInfo",
      card: "Image/Character/PC/ElmesiaHA2026/7/ElmesiaHA2026_7_CharaCard",
    },
  },
} as const
type PresetId = keyof typeof DIAG_PRESETS

type SummonModule = typeof import("@/components/summon-simulator")

function buildTestResult(rarity: number, arousal = 0, presetId: PresetId = "benimaru"): {
  id: string
  bucket: { show_rarity: number; rate: number; rate_percent: number } | null
  character: SummonCharacter
  groupId: number
  position: number
} {
  const p = DIAG_PRESETS[presetId]
  // Resolved rarity/arousal: the URL picker controls the rarity tier the
  // CharacterAppear prefab uses, but the CHARACTER (sprite/setting/manifest
  // join) comes from the preset. This lets us test e.g. "render Dord at
  // SR-tier prefab" if needed, while default behaviour is preset.rarity.
  const effRarity = rarity ?? p.rarity
  const effArousal = arousal ?? p.arousal
  // Detect Bless by illustration path (matches the generator's heuristic
  // when lottery_reward_type is unavailable). Bless characters route through
  // RuntimeThumbRewardBless + Bless settings lookup in FullArtRevealStage.
  const isBless = p.images.full?.startsWith("Image/Character/Bless/") ?? false
  // Compute rarity_index per MEMBER_RARITY_ASSETS scheme so the Result UI
  // sprite mapping lookup hits the right tier (Special/SpecialPlus/Epic).
  const rarityIndex = effArousal === 3 ? 30 + effRarity : effArousal === 2 ? 20 + effRarity : effArousal === 1 ? 10 + effRarity : effRarity
  return {
    id: `diag-${presetId}-${effRarity}-${effArousal}-${Math.random()}`,
    bucket: { show_rarity: effRarity, rate: 1, rate_percent: 1 } as any,
    character: {
      master_pc_id: p.master_pc_id,
      name: p.name,
      affiliation_name: p.affiliation_name,
      rarity: effRarity,
      element: "Fire",
      attack_type: "Physical",
      character_role: "Attacker",
      ultimate_type: null,
      forces: [],
      thumb_type: isBless ? "Bless" : "Chara",
      // For Bless presets, also surface a representative secondary element so
      // IcElementBless2 renders (mirrors the real BlessPc data where most
      // Protectors carry a primary + secondary element).
      bless_element_icons: isBless ? { primary: "Magic", secondary: "Holy" } : null,
      ui_thumb: {
        base_rarity: effRarity,
        display_rarity: effRarity,
        rarity_index: rarityIndex,
        arousal_type_raw: effArousal,
        arousal_type: effArousal === 3 ? "Epic" : effArousal === 2 ? "SpecialPlus" : effArousal === 1 ? "Special" : null,
        limit_break_count: 0,
        max_level: 100,
      } as any,
      images: p.images,
    } as SummonCharacter,
    groupId: 0,
    position: 1,
  }
}

const TEST_BANNER = { master_ogc_lottery_shop_id: 999000, pickup_animation_character_details_ids: [], featured_characters: [] } as unknown as SummonBanner

type StageId = "promotion" | "textAnnounce" | "movie" | "fullArt" | "result"

// `mix` controls the composition of the synthetic x10 Result pull on the
// result stage. `chara` = all 10 are Chara (existing behaviour); `bless` =
// all 10 are Bless (Dord-style); `mixed` = 5 Chara + 5 Bless. Drives the
// focused Result UI visual gate Chara + Bless + mixed cases.
type ResultMix = "chara" | "bless" | "mixed"

function readInitial(): { stage: StageId; rarity: number; arousal: number; unit: PresetId; mix: ResultMix } {
  if (typeof window === "undefined") return { stage: "fullArt", rarity: 5, arousal: 0, unit: "benimaru", mix: "chara" }
  const sp = new URLSearchParams(window.location.search)
  const allowedStages: StageId[] = ["promotion", "textAnnounce", "movie", "fullArt", "result"]
  const stageRaw = (sp.get("stage") || "fullArt") as StageId
  const stage = allowedStages.includes(stageRaw) ? stageRaw : "fullArt"
  const unitRaw = (sp.get("unit") || "benimaru") as PresetId
  const unit: PresetId = unitRaw in DIAG_PRESETS ? unitRaw : "benimaru"
  const mixRaw = (sp.get("mix") || "chara") as ResultMix
  const mix: ResultMix = (["chara", "bless", "mixed"] as const).includes(mixRaw as ResultMix) ? mixRaw : "chara"
  // When no explicit rarity/arousal in URL, use the preset's defaults so
  // ?unit=dord auto-renders R-tier.
  const sp_rarity = sp.get("rarity")
  const sp_arousal = sp.get("arousal")
  const preset = DIAG_PRESETS[unit]
  const rarity = sp_rarity == null ? preset.rarity : Math.min(6, Math.max(3, Number(sp_rarity) || preset.rarity))
  const arousal = sp_arousal == null ? preset.arousal : Math.min(3, Math.max(0, Number(sp_arousal) || preset.arousal))
  return { stage, rarity, arousal, unit, mix }
}

export default function SummonDiagPage() {
  const [mod, setMod] = useState<SummonModule | null>(null)
  const init = typeof window !== "undefined" ? readInitial() : { stage: "fullArt" as StageId, rarity: 5, arousal: 0, unit: "benimaru" as PresetId, mix: "chara" as ResultMix }
  const [stage, setStage] = useState<StageId>(init.stage)
  const [rarity, setRarity] = useState<number>(init.rarity)
  const [arousal, setArousal] = useState<number>(init.arousal)
  const [unit, setUnit] = useState<PresetId>(init.unit)
  const [mix, setMix] = useState<ResultMix>(init.mix)

  useEffect(() => {
    // Dynamic import — the simulator pulls heavy generated JSON that we
    // only need for the diag, keep the main bundle lean.
    import("@/components/summon-simulator").then(setMod)
  }, [])

  // Reflect picker state back into URL so headless screenshots and shareable
  // links work without driving the dropdowns.
  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    url.searchParams.set("stage", stage)
    url.searchParams.set("rarity", String(rarity))
    url.searchParams.set("arousal", String(arousal))
    url.searchParams.set("unit", unit)
    url.searchParams.set("mix", mix)
    window.history.replaceState(null, "", url.toString())
  }, [stage, rarity, arousal, unit, mix])

  if (!mod) {
    return (
      <main style={{ background: "hsl(var(--background))", color: "hsl(var(--foreground))", padding: 24, minHeight: "100vh" }}>
        Loading diag…
      </main>
    )
  }

  const result = buildTestResult(rarity, arousal, unit)
  const message = rarity >= 5
    ? { master_pc_id: 160001, lottery_message: "Covert operations, huh? Acting as Souei's backup might be a good experience for me.", voice_path: null, movie_path: null, release_label: null, is_play_movie: false, movie: null, voice: null }
    : null

  // We use internal stage components via a bridge: the simulator exports
  // them through a hidden test hook so diag can render in isolation.
  // (See summon-simulator.tsx __diag export.)
  const D = (mod as unknown as { __diag?: Record<string, React.ComponentType<any>> }).__diag
  const Promotion = D?.PromotionRevealScreen
  const TextAnnounce = D?.TextAnnounceRevealScreen
  const Movie = D?.AcquisitionMovieReveal
  const FullArt = D?.FullArtRevealStage
  const Results = D?.ResultsPanelPrefab

  return (
    <main style={{ background: "hsl(var(--background))", color: "hsl(var(--foreground))", padding: 16, minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ marginBottom: 8 }}>Summon reveal — visual parity diagnostic</h1>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <label>Stage:&nbsp;
          <select value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} style={{ background: "hsl(var(--card))", color: "hsl(var(--card-foreground))", padding: 4, border: "1px solid hsl(var(--border))", borderRadius: 4 }}>
            <option value="promotion">UILotteryPromotion (hieroglyph)</option>
            <option value="textAnnounce">UILotteryTextAnnounce (voice line)</option>
            <option value="movie">UILotteryMovie (movie)</option>
            <option value="fullArt">UILotteryCharacterAppear (full art)</option>
            <option value="result">UILotteryResult (final results)</option>
          </select>
        </label>
        <label>Rarity:&nbsp;
          <select value={rarity} onChange={(e) => setRarity(Number(e.target.value))} style={{ background: "hsl(var(--card))", color: "hsl(var(--card-foreground))", padding: 4, border: "1px solid hsl(var(--border))", borderRadius: 4 }}>
            <option value={3}>3★ (R)</option>
            <option value={4}>4★ (SR)</option>
            <option value={5}>5★ (SSR/Ult/UREx)</option>
            <option value={6}>6★ (URUltimate)</option>
          </select>
        </label>
        <label>Arousal:&nbsp;
          <select value={arousal} onChange={(e) => setArousal(Number(e.target.value))} style={{ background: "hsl(var(--card))", color: "hsl(var(--card-foreground))", padding: 4, border: "1px solid hsl(var(--border))", borderRadius: 4 }}>
            <option value={0}>0 (none)</option>
            <option value={1}>1 (Special)</option>
            <option value={2}>2 (SpecialPlus)</option>
            <option value={3}>3 (Epic)</option>
          </select>
        </label>
        <label>Unit:&nbsp;
          <select value={unit} onChange={(e) => {
            const u = e.target.value as PresetId
            setUnit(u)
            // Auto-snap rarity/arousal to the preset's natural tier when switching unit.
            const p = DIAG_PRESETS[u]
            setRarity(p.rarity)
            setArousal(p.arousal)
          }} style={{ background: "hsl(var(--card))", color: "hsl(var(--card-foreground))", padding: 4, border: "1px solid hsl(var(--border))", borderRadius: 4 }}>
            {(Object.keys(DIAG_PRESETS) as PresetId[]).map((k) => (
              <option key={k} value={k}>{DIAG_PRESETS[k].label}</option>
            ))}
          </select>
        </label>
        <label>Result mix:&nbsp;
          <select value={mix} onChange={(e) => setMix(e.target.value as ResultMix)} style={{ background: "hsl(var(--card))", color: "hsl(var(--card-foreground))", padding: 4, border: "1px solid hsl(var(--border))", borderRadius: 4 }}>
            <option value="chara">All Chara (default)</option>
            <option value="bless">All Bless/Protector</option>
            <option value="mixed">Mixed (5 Chara + 5 Bless)</option>
          </select>
        </label>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 1600,
          margin: "0 auto",
          aspectRatio: "16 / 9",
          background: "#000",
          overflow: "hidden",
          border: "1px solid #333",
        }}
      >
        {stage === "fullArt" && FullArt && (
          <FullArt result={result} onAdvance={() => {}} onSkipAll={() => {}} />
        )}
        {stage === "promotion" && Promotion && (
          <Promotion result={result} banner={TEST_BANNER} patternAnimationType={2} fiveStarOrdinal={1} onAdvance={() => {}} />
        )}
        {stage === "textAnnounce" && TextAnnounce && (
          <TextAnnounce message={message} onAdvance={() => {}} />
        )}
        {stage === "movie" && Movie && (
          <Movie src="" onAdvance={() => {}} onSkipAll={() => {}} />
        )}
        {stage === "result" && Results && (() => {
          // Pick the unit preset PER-SLOT based on `mix` so Bless vs Chara
          // routing surfaces in the rendered grid.
          //   chara → all 10 use the current `unit` preset
          //   bless → all 10 use "dord" (the only Bless preset)
          //   mixed → odd slots use Chara, even slots use Bless
          const slotPreset = (i: number): PresetId => {
            if (mix === "bless") return "dord"
            if (mix === "mixed") return i % 2 === 0 ? unit : "dord"
            return unit
          }
          // Cycle all 10 slots through every rarity+arousal variant the
          // sprite-mappings JSON ships, so a single capture shows every
          // frame the game can render. Order matches THUMB_SPRITE_MAPPINGS
          // .{base,frame}_sprite_by_rarity_index Chara/Bless keys:
          //   0: 3★ base               (frameMemberM3 / frameBlessM3)
          //   1: 4★ base               (frameMemberM4)
          //   2: 5★ base = SSR         (frameMemberM5)
          //   3: 5★ Special = SSRUlt   (frameMemberM5_Special, arousal=1)
          //   4: 5★ SpecialPlus = UREx (frameMemberM5_SpecialPlus, ar=2)
          //   5: 6★ base = UREx 6★    (frameMemberM6, arousal=0)
          //   6: 6★ Special           (frameMemberM6_Special, arousal=1)
          //   7: 6★ SpecialPlus = UREx 6★ EX (frameMemberM6_SpecialPlus, ar=2)
          //   8: 6★ Epic = URUlt       (frameMemberM7_Epic, arousal=3)
          //   9: 5★ base again (filler)
          const slotVariants: Array<[number, number]> = [
            [3, 0], [4, 0], [5, 0], [5, 1], [5, 2],
            [6, 0], [6, 1], [6, 2], [6, 3], [5, 0],
          ]
          const results = slotVariants.map(([r, a], i) => {
            const presetId = slotPreset(i)
            return buildTestResult(r, a, presetId)
          })
          return (
            <Results
              banner={TEST_BANNER}
              results={results}
              bazaarPoints={10}
              bgSources={[]}
              onRecruitMore={() => {}}
              onClose={() => {}}
            />
          )
        })()}
        {!D && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "hsl(var(--muted-foreground))" }}>
            Stage components not exported &mdash; add an <code>__diag</code> export to summon-simulator.tsx
          </div>
        )}
      </div>

      <p style={{ color: "hsl(var(--muted-foreground))", marginTop: 12, fontSize: 13 }}>
        Compare with the recorded real-game frames in <code>D:\video_compare\frames\</code>.
      </p>
    </main>
  )
}
