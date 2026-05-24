"use client"

// TenslafontText — render text using the Tenslafont SDF atlas extracted
// from Assets/AssetBundles/UI/Font/TextMeshPro/Tenslafont/Tenslafont.asset
// (TMP_FontAsset, 77 glyphs, 256x256 atlas). The face was named
// "Tenslafont005 Regular" in the extracted m_FaceInfo. Each glyph is
// rendered via CSS mask so the rarity-tinted backdrop colour drives the
// final paint; the SDF alpha gives the glyph silhouette.
//
// This mirrors the in-game UILotteryPromotion's TextMeshProUGUI panels
// (BackText/MiddleText/FrontText), each driven by SimpleTweenTMPSage
// (TypeDefIndex 13993): per-character staggered alpha+vertex animation
// with gradient colour. Stagger is controlled by `interval`, total
// per-character animation by `charDuration`.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import fontDataRaw from "@/lib/summon-ui/tenslafont.json"

const ATLAS_URL = "/UI/summon/Tenslafont_atlas.png"

type CharRect = { x: number; y: number; w: number; h: number; bx: number; by: number; adv: number }
type FontData = {
  atlas: string
  atlas_w: number
  atlas_h: number
  padding: number
  face_pointSize: number | null
  face_lineHeight: number | null
  face_ascentLine: number | null
  face_descentLine: number | null
  face_scale: number | null
  chars: Record<string, CharRect>
}
const fontData = fontDataRaw as unknown as FontData

const FACE = {
  pointSize: fontData.face_pointSize ?? 24,
  lineHeight: fontData.face_lineHeight ?? 26.16,
  ascent: fontData.face_ascentLine ?? 19.2,
}

// Lookup a Tenslafont glyph for a Unicode code point. Returns null when the
// font has no glyph for that code (the atlas only ships 77 glyphs — basic
// ASCII letters + a few punctuation). Unmapped chars are rendered as blank
// space using the atlas's space advance.
function glyphForChar(ch: string): CharRect | null {
  const code = ch.codePointAt(0)
  if (code == null) return null
  const rect = fontData.chars[String(code)]
  if (!rect || rect.w === 0) return null
  return rect
}

const SPACE_ADVANCE = fontData.chars["32"]?.adv ?? 3.84 // ASCII space

export type TenslafontTextProps = {
  text: string
  // px size for the cap-height; the atlas is rendered at pointSize=24 so
  // sizing scales atlas px → output px by (fontSize / FACE.ascent).
  fontSize?: number
  // tint colour for the rendered glyphs (the SDF alpha is used as a mask
  // and this colour fills the visible silhouette)
  color?: string
  // CSS opacity 0..1 multiplier
  opacity?: number
  // Per-character stagger (ms) — matches SimpleTweenTMPSage.interval
  staggerMs?: number
  // Per-character fade-in duration (ms) — matches SimpleTweenTMPSage.charDuration
  charDurationMs?: number
  // Animation delay before the FIRST char fades in (ms)
  startDelayMs?: number
  // Re-trigger the stagger animation when this key changes
  animationKey?: string | number
  // Optional className/style for the outer wrapper
  className?: string
  style?: CSSProperties
  // Extra style for each masked glyph fill. Promotion uses this to bind
  // extracted TMP material/ColorGradient data without replacing the prefab
  // hierarchy that owns the mask.
  glyphStyle?: CSSProperties
  // Letter spacing in EM
  letterSpacingEm?: number
  // Line height multiplier (default 1.1)
  lineHeightMul?: number
}

export function TenslafontText({
  text,
  fontSize = 64,
  color = "#ffffff",
  opacity = 1,
  staggerMs = 35,
  charDurationMs = 350,
  startDelayMs = 0,
  animationKey,
  className,
  style,
  glyphStyle,
  letterSpacingEm = 0.04,
  lineHeightMul = 1.15,
}: TenslafontTextProps) {
  const [tick, setTick] = useState(0)
  const lastKey = useRef<string | number | undefined>(animationKey)
  useEffect(() => {
    if (animationKey !== lastKey.current) {
      lastKey.current = animationKey
      setTick((t) => t + 1)
    }
  }, [animationKey])

  // Scale atlas px → output px so a glyph rendered at its atlas h matches
  // the requested ascent height. Atlas glyphs are sized for pointSize=24
  // with AscentLine=19.2, so the conversion is fontSize / FACE.ascent.
  const scale = fontSize / FACE.ascent
  const lineHeight = FACE.lineHeight * scale * lineHeightMul

  const lines = useMemo(() => text.split(/\r?\n/), [text])

  let globalIdx = 0
  return (
    <div
      key={tick}
      className={className}
      style={{
        ...style,
        opacity,
        fontFamily: "Tenslafont005",
        lineHeight: `${lineHeight}px`,
      }}
    >
      {lines.map((line, lineNo) => (
        <div key={lineNo} style={{ display: "flex", flexWrap: "wrap", minHeight: lineHeight }}>
          {[...line].map((ch, chIdx) => {
            const idx = globalIdx++
            const delay = startDelayMs + idx * staggerMs
            const rect = glyphForChar(ch)
            if (!rect) {
              // Unmapped char (or whitespace) — advance horizontally only
              const advance = (fontData.chars[String(ch.codePointAt(0) ?? 32)]?.adv ?? SPACE_ADVANCE) * scale
              return (
                <span
                  key={`${lineNo}-${chIdx}`}
                  style={{
                    display: "inline-block",
                    width: `${advance + fontSize * letterSpacingEm}px`,
                    height: `${lineHeight}px`,
                  }}
                />
              )
            }
            const w = rect.w * scale
            const h = rect.h * scale
            const bx = rect.bx * scale
            const by = rect.by * scale
            const adv = rect.adv * scale
            // Atlas is bottom-up in Unity coords; convert glyph Y from
            // bottom-origin to top-origin for CSS background-position.
            const atlasY = fontData.atlas_h - rect.y - rect.h
            return (
              <span
                key={`${lineNo}-${chIdx}`}
                style={{
                  display: "inline-block",
                  width: `${adv + fontSize * letterSpacingEm}px`,
                  height: `${lineHeight}px`,
                  position: "relative",
                  verticalAlign: "baseline",
                }}
              >
                <span
                  className="tenslafont-glyph"
                  style={{
                    position: "absolute",
                    left: `${bx}px`,
                    // Top-align so the cap sits at the line cap height
                    top: `${(FACE.ascent * scale) - by}px`,
                    width: `${w}px`,
                    height: `${h}px`,
                    backgroundColor: color,
                    ...glyphStyle,
                    WebkitMaskImage: `url(${ATLAS_URL})`,
                    WebkitMaskRepeat: "no-repeat",
                    WebkitMaskSize: `${fontData.atlas_w * scale}px ${fontData.atlas_h * scale}px`,
                    WebkitMaskPosition: `-${rect.x * scale}px -${atlasY * scale}px`,
                    maskImage: `url(${ATLAS_URL})`,
                    maskRepeat: "no-repeat",
                    maskSize: `${fontData.atlas_w * scale}px ${fontData.atlas_h * scale}px`,
                    maskPosition: `-${rect.x * scale}px -${atlasY * scale}px`,
                    opacity: 0,
                    animation: `tenslafont-fadein ${charDurationMs}ms ease-out ${delay}ms forwards`,
                  }}
                />
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
