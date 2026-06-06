"use client"

import { useEffect, useId, useState } from "react"
import type { CSSProperties } from "react"

/**
 * Wordmark on an SVG arc (wooden-sign name + affiliation ribbon).
 *
 * Chromium honors `textLength` on a `<textPath>` and fits the text itself — we leave it 100%
 * alone (full 82px). Firefox (incl. Tor) IGNORES `textLength` on a textPath, so long labels
 * overran the arc and the ends dropped ("ELMESIA EL RU THALION" -> "ESIA EL RU THAL").
 *
 * On Firefox only, we reduce the font-size (which Firefox does respect). We use a
 * character-count estimate rather than a live pixel measurement on purpose: the site applies
 * a global CSS `zoom` that scales by resolution and skews JS measurements (fits at 2K, clips
 * at 1080p). The estimate is zoom-independent, so it behaves identically at every resolution.
 * Gated to Firefox, so Chromium never changes.
 */
interface OceanArchTextProps {
  text: string
  pathD: string
  viewBox: string
  svgClassName: string
  textClassName: string
  /** CSS custom property the text class reads for its font-size (e.g. "--cds-name-fs"). */
  fontVar: string
  /** Full size used on Chromium (matches the CSS fallback): 82 name, 46 ribbon. */
  baseFontSize: number
  /** Reduced size applied on Firefox/Tor so the label fits the arc. */
  firefoxFontSize: number
  /** Chromium textLength (kept; Chromium uses it, Firefox ignores it). */
  textLength: number
}

export function OceanArchText({
  text,
  pathD,
  viewBox,
  svgClassName,
  textClassName,
  fontVar,
  baseFontSize,
  firefoxFontSize,
  textLength,
}: OceanArchTextProps) {
  const pathId = `arc-${useId().replace(/[:]/g, "")}`
  const [fontSize, setFontSize] = useState(baseFontSize)

  useEffect(() => {
    if (typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent)) {
      setFontSize(firefoxFontSize)
    }
  }, [firefoxFontSize])

  return (
    <svg className={svgClassName} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <path id={pathId} d={pathD} fill="transparent" />
      </defs>
      <text textAnchor="middle" className={textClassName} style={{ [fontVar]: `${fontSize}px` } as CSSProperties}>
        <textPath href={`#${pathId}`} startOffset="50%" textLength={textLength} lengthAdjust="spacingAndGlyphs">
          {text}
        </textPath>
      </text>
    </svg>
  )
}
