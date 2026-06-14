// Night-ink pod kit — small reusable wrappers over the .v2-* / .board.v2
// vocabulary already in app/night-ink.css, so every tool page is the SAME
// interlocking-pod organism as the home + character pages (board canvas,
// pods with hard offset shadows + ink-blob radii + double outline, bridges/
// stems with concave fillets, red accent tabs, header pod). Each page is
// self-contained: it paints its own .board.v2 canvas and inherits the global
// NightInkSiteNav from app/layout.tsx — no global theme switch required.
import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"
import { ArchiveBackground } from "./archive-background"

/* the full-viewport night-ink board canvas + inner column. ArchiveBackground is
   the generative streak/halftone canvas the home page uses — rendered here too
   so every night-ink page shares the EXACT same background as home. */
export function NkBoard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main className={`board v2 grain ${className}`}>
      <ArchiveBackground />
      <div className="v2-inner">{children}</div>
    </main>
  )
}

/* the page header pod — serif display title with the red italic accent */
export function NkHeaderPod({
  kicker,
  title,
  accent,
  sub,
  actions,
}: {
  kicker?: ReactNode
  title: ReactNode
  accent?: ReactNode
  sub?: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="v2-head nk-head" aria-label="Page heading">
      <div className="v2-head-left">
        {kicker ? <span className="cap">{kicker}</span> : null}
        <h1 className="v2-h1">
          {title}
          {accent ? <em>{accent}</em> : null}
        </h1>
        {sub ? <p className="v2-head-sub">{sub}</p> : null}
      </div>
      {actions ? <div className="nk-head-actions">{actions}</div> : null}
    </section>
  )
}

/* a pod container (dark navy, hard offset shadow, double outline, ink-blob
   radius). `radius` overrides the default asymmetric corner set. */
export function NkPod({
  children,
  className = "",
  radius,
  style,
  label,
}: {
  children: ReactNode
  className?: string
  radius?: string
  style?: CSSProperties
  label?: string
}) {
  return (
    <section
      className={`v2-pod nk-pod ${className}`}
      style={{ ...(radius ? { borderRadius: radius } : null), ...style }}
      aria-label={label}
    >
      {children}
    </section>
  )
}

/* a red (or default) accent tab that pokes off a pod edge */
export function NkTab({ children, alt = false }: { children: ReactNode; alt?: boolean }) {
  return <span className={`v2-tab nk-tab${alt ? " alt" : ""}`}>{children}</span>
}

/* a vertical connector bridge between a pod above and below. Pass the inline
   geometry (matches the prototype's hand-placed bridges). */
export function NkBridge({
  vertical = true,
  style,
}: {
  vertical?: boolean
  style: CSSProperties
}) {
  return (
    <div className={`v2-bridge ${vertical ? "v" : "h"}`} style={style} aria-hidden="true">
      <i className="tl" />
      <i className="tr" />
      <i className="bl" />
      <i className="br" />
    </div>
  )
}

/* the connecting stem under the header (same scoop geometry as the prototype) */
export function NkStem({ style }: { style?: CSSProperties }) {
  return <div className="v2-stem" style={style} aria-hidden="true" />
}

/* a back/secondary nav chip (e.g. "← Archive") */
export function NkChipLink({ href, children, alt = false }: { href: string; children: ReactNode; alt?: boolean }) {
  return (
    <Link href={href} className={`page-btn nk-chip${alt ? " nk-chip-alt" : ""}`}>
      {children}
    </Link>
  )
}
