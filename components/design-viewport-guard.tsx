"use client"

import { useEffect } from "react"

// The ocean ("summer") design only works on actual desktops (wide screen + a
// real mouse/trackpad). getDesign() already sends phones to the classic design
// server-side, but UA sniffing can't catch modern iPads (they report a desktop
// Mac UA) or narrow desktop windows / touch tablets. This guard finishes the
// job on the client:
//
//   - If this ISN'T a desktop and the ocean design slipped through, set the
//     slime-force-classic cookie and reload (→ classic).
//   - If this IS a genuine desktop but was previously force-classic'd on a
//     smaller screen, clear the cookie and reload (→ restore the user's design).
//
// It runs ONCE at page load (no resize listener), so resizing a real desktop
// window never flips the design — only a fresh load below the threshold would.
const DESKTOP_QUERY = "(min-width: 1280px) and (pointer: fine)"
const FORCE_COOKIE = "slime-force-classic"

function isForced() {
  return /(?:^|;)\s*slime-force-classic=1/.test(document.cookie)
}

function writeForce(on: boolean) {
  try {
    document.cookie = on
      ? `${FORCE_COOKIE}=1;path=/;max-age=31536000;samesite=lax`
      : `${FORCE_COOKIE}=;path=/;max-age=0;samesite=lax`
  } catch {}
}

export function DesignViewportGuard() {
  useEffect(() => {
    const isDesktop = window.matchMedia(DESKTOP_QUERY).matches

    if (isDesktop) {
      // Genuine desktop: undo any earlier small-screen force so the user's
      // chosen design (ocean by default) comes back.
      if (isForced()) {
        writeForce(false)
        window.location.reload()
      }
      return
    }

    // Not a desktop: the ocean design must not be used. Only act if it actually
    // slipped through (currently rendering ocean = <html> without `.dark`), so
    // phones already on classic never trigger a needless reload.
    const renderingOcean = !document.documentElement.classList.contains("dark")
    if (renderingOcean && !isForced()) {
      writeForce(true)
      window.location.reload()
    }
  }, [])

  return null
}
