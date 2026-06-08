"use client"

import { useEffect } from "react"

/**
 * Forces the page into a fixed wide layout viewport on phones — exactly what the browser's
 * "Desktop site" toggle does. The summon panel is a pixel-faithful 16:9 game screen built from
 * interlocked vw/px/% units tuned for a desktop render; at a phone's narrow layout viewport
 * those units diverge and the panel clumps/crops. Pinning the layout viewport to `width` makes
 * the browser lay the page out as if it were that wide (so the units stay in proportion — and
 * the global :root zoom tiers in globals.css kick in just like on a real desktop) and then
 * scales the whole thing to fit the device. Restores the responsive viewport on unmount, and
 * leaves real desktops/tablets (fine pointer or wide) completely untouched.
 */
// 1024 keeps the page under the :root zoom=1 breakpoint (1080px in globals.css), so the panel
// isn't shrunk by the desktop zoom tiers — it fills the width edge-to-edge, then scales to the
// device. This matches the browser's own "Desktop site" width.
export function ForceDesktopViewport({ width = 1024 }: { width?: number }) {
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches
    const small = Math.min(window.innerWidth, window.innerHeight) < 820
    if (!coarse || !small) return
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
    if (!meta) return
    const prev = meta.getAttribute("content") ?? "width=device-width, initial-scale=1"
    meta.setAttribute("content", `width=${width}`)
    // Tag <html> so globals.css can zero the page min-height while forced — otherwise the
    // main's min-h-screen (= the now-huge layout viewport height) leaves a giant void below
    // the 16:9 panel. Scoped to this class so real desktops/tablets are unaffected.
    document.documentElement.classList.add("force-desktop-vp")
    return () => {
      meta.setAttribute("content", prev)
      document.documentElement.classList.remove("force-desktop-vp")
    }
  }, [width])

  return null
}
