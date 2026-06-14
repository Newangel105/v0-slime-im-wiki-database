import { cookies, headers } from "next/headers"

// "nightink" is THE site design (default, all viewports) — see
// app/night-ink.css and components/nightink/*. The two old designs are kept
// wired purely as an emergency rollback behind the slime-design cookie
// (no UI sets it anymore; set it manually in devtools to roll back):
//   slime-design=ocean   -> beach/archive-lite design (desktop only)
//   slime-design=classic -> original flat-dark design
export type Design = "nightink" | "ocean" | "classic"

export const DESIGN_COOKIE = "slime-design"

// (rollback-only gates) The ocean design is built around fixed wide-screen PNG
// frames and only works on real desktops, so when the rollback cookie asks for
// ocean we keep its two old downgrade layers: mobile User-Agents and the
// slime-force-classic cookie (set by DesignViewportGuard on non-desktop
// screens) both fall back to classic. The nightink design serves ALL
// viewports and ignores both gates.
const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i
export const FORCE_CLASSIC_COOKIE = "slime-force-classic"

export async function getDesign(): Promise<Design> {
  const store = await cookies()
  const pref = store.get(DESIGN_COOKIE)?.value
  if (pref === "classic") return "classic"
  if (pref === "ocean") {
    const headerStore = await headers()
    if (MOBILE_UA.test(headerStore.get("user-agent") ?? "")) return "classic"
    if (store.get(FORCE_CLASSIC_COOKIE)?.value === "1") return "classic"
    return "ocean"
  }
  return "nightink"
}
