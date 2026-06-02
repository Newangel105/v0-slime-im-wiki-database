"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

type Design = "ocean" | "classic"

// The active design is stored in the `slime-design` cookie so the server can
// render the correct component tree AND <html> theme signals (the two designs
// differ in markup, not just colour). Toggling flips the cookie then does a
// full reload so SSR re-renders the whole tree for the new design — reliable
// (router.refresh can miss the just-set cookie) and flash-free since the
// server paints the right design.
export function DesignToggle() {
  const [design, setDesign] = useState<Design>("ocean")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDesign(document.documentElement.classList.contains("dark") ? "classic" : "ocean")
    setMounted(true)
  }, [])

  function toggle() {
    const next: Design = design === "ocean" ? "classic" : "ocean"
    try {
      document.cookie = `slime-design=${next};path=/;max-age=31536000;samesite=lax`
    } catch {}
    window.location.reload()
  }

  // Stable icon until mounted to avoid a hydration mismatch.
  const showMoon = !mounted || design === "ocean"

  return (
    <button
      type="button"
      onClick={toggle}
      className="slime-design-toggle"
      aria-label={design === "ocean" ? "Switch to classic dark design" : "Switch to beach day design"}
      title={design === "ocean" ? "Classic (dark) design" : "Beach (day) design"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: 9999,
        border: "2px solid currentColor",
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
        flexShrink: 0,
        opacity: 0.85,
      }}
    >
      {showMoon ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  )
}
