"use client"

import { usePathname } from "next/navigation"
import { ForceDesktopViewport } from "./force-desktop-viewport"

// The night-ink pods + their connectors (.v2-bridge / .v2-stem) are positioned for
// desktop widths; reflowing the layout narrow on a phone snaps the connectors and
// looks broken. So on phones we render the FULL desktop layout scaled-to-fit (the
// browser's "Desktop site" behaviour) for every route — EXCEPT the two that have
// genuine responsive layouts of their own:
//   • /characters  (the list page — gets a real mobile layout: filter drawer + grid)
//   • /summon      (the gacha simulator letterboxes itself to the viewport)
// (/characters/<id> detail pages ARE forced desktop — only the exact list is excluded.)
export function GlobalDesktopForce() {
  const pathname = usePathname()
  const responsive = pathname === "/characters" || pathname === "/summon" || pathname.startsWith("/summon/")
  if (responsive) return null
  // Home only: the hero goes side-by-side (copy left / altar right) above 1340px and
  // STACKS below it (the 108px title can't share a row with the 620px altar column at
  // 1024). So force home to 1366 — just past the breakpoint — to reproduce the real
  // desktop hero with the altar on the right. Every other forced route keeps the
  // approved 1024 (zoom=1, larger text). 1366 lands in the same 0.70 zoom tier a real
  // ~1366 desktop uses, so it matches the desktop render exactly.
  const width = pathname === "/" ? 1366 : 1024
  return <ForceDesktopViewport width={width} />
}
