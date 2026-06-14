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
    // Decide "is this a phone?" from the PHYSICAL screen, not innerWidth/innerHeight —
    // the instant we set the meta to `width=<width>` the layout viewport (and thus
    // window.innerWidth) becomes that width, which would make a re-check read "not a
    // phone". screen.width is the fixed device width (≈390) and never changes.
    const sw = window.screen?.width ?? window.innerWidth
    const sh = window.screen?.height ?? window.innerHeight
    const small = Math.min(sw, sh) < 820
    if (!coarse || !small) return

    const desktop = `width=${width}`
    const original =
      (document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null)?.getAttribute("content") ??
      "width=device-width, initial-scale=1"

    const apply = () => {
      const m = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
      if (m && m.getAttribute("content") !== desktop) m.setAttribute("content", desktop)
    }
    apply()
    // Tag <html> so globals.css can zero the page min-height while forced — otherwise the
    // main's min-h-screen (= the now-huge layout viewport height) leaves a giant void.
    document.documentElement.classList.add("force-desktop-vp")

    // CRITICAL: Next.js owns this <meta> via the root `viewport` export and rewrites it
    // back to width=device-width every time it reconciles <head> — which fires when the
    // page's streaming / Suspense boundaries resolve (the 3D altar finishing its load is
    // the "after everything loads" moment), snapping the page to the mobile layout. A
    // one-shot setAttribute loses that race. Re-assert our width on every <head> mutation
    // (covers both an attribute rewrite and a full re-render of the tag) so it sticks.
    const obs = new MutationObserver(apply)
    obs.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["content"],
    })

    return () => {
      obs.disconnect()
      const m = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
      if (m) m.setAttribute("content", original)
      document.documentElement.classList.remove("force-desktop-vp")
    }
  }, [width])

  return null
}
