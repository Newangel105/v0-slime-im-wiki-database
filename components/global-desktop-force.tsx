"use client"

import { usePathname } from "next/navigation"
import { ForceDesktopViewport } from "./force-desktop-viewport"

// The night-ink pods + their connectors (.v2-bridge / .v2-stem) are positioned for
// desktop widths; reflowing the layout narrow on a phone snaps the connectors and
// looks broken. So on phones we render the FULL desktop layout scaled-to-fit (the
// browser's "Desktop site" behaviour) for every route — EXCEPT the routes that have
// genuine responsive/mobile layouts of their own:
//   • /            (home — dedicated mobile layout: compact altar hero + stacked sections)
//   • /characters  (the list page — real mobile layout: filter drawer + grid)
//   • /summon      (the gacha simulator letterboxes itself to the viewport)
// (/characters/<id> detail pages ARE forced desktop — only the exact list is excluded.)
//
// Home used to be forced to 1366 (altar on the right), but the scaled-desktop layout
// is shorter than a tall phone screen, leaving dead space at the bottom — so it now
// has a purpose-built mobile layout instead.
export function GlobalDesktopForce() {
  const pathname = usePathname()
  const responsive =
    pathname === "/" ||
    pathname.startsWith("/characters") ||
    pathname === "/model-viewer" ||
    pathname === "/summon" ||
    pathname.startsWith("/summon/")
  if (responsive) return null
  return <ForceDesktopViewport width={1024} />
}
