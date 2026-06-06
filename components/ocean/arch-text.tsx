"use client"

import { useEffect, useId, useRef, useState } from "react"
import type { CSSProperties } from "react"

/**
 * Wordmark on an SVG arc (wooden-sign name + affiliation ribbon).
 *
 * Chromium honors `textLength` on a `<textPath>` and fits the text itself — we leave it
 * 100% alone (full 82px). Firefox (incl. Tor) IGNORES `textLength` on a textPath, so long
 * labels overran the arc and the ends dropped ("ELMESIA EL RU THALION" -> "ESIA EL RU THAL").
 *
 * Firefox DOES respect a plain font-size, so on Firefox only we measure the real rendered
 * width and reduce the font-size just enough to fit. Gated to Firefox, so Chromium never
 * changes. If measurement is unavailable (e.g. Tor's fingerprint resistance), fall back to a
 * length-based estimate so it still shrinks.
 */
interface OceanArchTextProps {
  text: string
  pathD: string
  viewBox: string
  svgClassName: string
  textClassName: string
  /** CSS custom property the text class reads for its font-size (e.g. "--cds-name-fs"). */
  fontVar: string
  /** Full size (matches the CSS fallback): 82 name, 46 ribbon. Used on Chromium + measuring. */
  baseFontSize: number
  /** Largest width (viewBox units) that fits the arc — the Firefox shrink target. */
  maxTextWidth: number
  /** Chromium textLength (kept; Chromium uses it, Firefox ignores it). */
  textLength: number
  /** Length-based size used on Firefox if the live measurement can't be read. */
  fallbackFontSize: number
}

export function OceanArchText({
  text,
  pathD,
  viewBox,
  svgClassName,
  textClassName,
  fontVar,
  baseFontSize,
  maxTextWidth,
  textLength,
  fallbackFontSize,
}: OceanArchTextProps) {
  const pathId = `arc-${useId().replace(/[:]/g, "")}`
  const measureRef = useRef<SVGTextElement | null>(null)
  const [fontSize, setFontSize] = useState(baseFontSize)

  useEffect(() => {
    // Chromium fits via textLength; only Firefox/Tor need a real font-size reduction.
    if (typeof navigator === "undefined" || !/firefox/i.test(navigator.userAgent)) return
    const el = measureRef.current
    let width = 0
    if (el) {
      try {
        width = el.getComputedTextLength()
      } catch {
        width = 0
      }
    }
    if (width > 0 && width < 100000) {
      setFontSize(width > maxTextWidth ? Math.max(20, Math.floor((baseFontSize * maxTextWidth) / width)) : baseFontSize)
    } else {
      setFontSize(fallbackFontSize)
    }
  }, [text, baseFontSize, maxTextWidth, fallbackFontSize])

  return (
    <svg className={svgClassName} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <path id={pathId} d={pathD} fill="transparent" />
      </defs>
      {/* Hidden full-size copy, measured to drive the Firefox shrink. Explicit font props
          (not the CSS class) so the measurement is deterministic. */}
      <text
        ref={measureRef}
        x={-99999}
        y={0}
        aria-hidden="true"
        style={{
          visibility: "hidden",
          fontFamily: "inherit",
          fontWeight: 950,
          fontSize: `${baseFontSize}px`,
          letterSpacing: 0,
          textTransform: "uppercase",
        }}
      >
        {text}
      </text>
      <text textAnchor="middle" className={textClassName} style={{ [fontVar]: `${fontSize}px` } as CSSProperties}>
        <textPath href={`#${pathId}`} startOffset="50%" textLength={textLength} lengthAdjust="spacingAndGlyphs">
          {text}
        </textPath>
      </text>
    </svg>
  )
}
