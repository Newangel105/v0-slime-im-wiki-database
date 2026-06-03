import { cookies, headers } from "next/headers"

// Two complete designs live in this repo, switched at runtime by a cookie so
// SSR renders the correct markup (the designs differ structurally, not just in
// colour). DAY = "ocean" (beach/archive-lite); DARK = "classic" (the original
// dark design, html.dark + Inter). Default is ocean.
export type Design = "ocean" | "classic"

export const DESIGN_COOKIE = "slime-design"

// The ocean ("summer") design is built around fixed wide-screen PNG frames and
// only works on actual desktops (wide viewport + a real mouse). It is gated in
// two layers:
//   1. Server (here): a mobile User-Agent always gets classic, so phones render
//      classic immediately with NO flash.
//   2. Client (DesignViewportGuard): catches what UA can't — modern iPads send a
//      desktop Mac UA, plus tablets / narrow windows — by setting the
//      slime-force-classic cookie (read below) whenever the screen isn't a
//      desktop (min-width:1280px AND a fine pointer). Kept separate from the
//      slime-design preference cookie so it never clobbers a desktop user's
//      chosen design.
const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i
export const FORCE_CLASSIC_COOKIE = "slime-force-classic"

export async function getDesign(): Promise<Design> {
  const headerStore = await headers()
  if (MOBILE_UA.test(headerStore.get("user-agent") ?? "")) return "classic"
  const store = await cookies()
  if (store.get(FORCE_CLASSIC_COOKIE)?.value === "1") return "classic"
  return store.get(DESIGN_COOKIE)?.value === "classic" ? "classic" : "ocean"
}
