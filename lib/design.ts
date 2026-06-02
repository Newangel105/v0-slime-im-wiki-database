import { cookies } from "next/headers"

// Two complete designs live in this repo, switched at runtime by a cookie so
// SSR renders the correct markup (the designs differ structurally, not just in
// colour). DAY = "ocean" (beach/archive-lite); DARK = "classic" (the original
// dark design, html.dark + Inter). Default is ocean.
export type Design = "ocean" | "classic"

export const DESIGN_COOKIE = "slime-design"

export async function getDesign(): Promise<Design> {
  const store = await cookies()
  return store.get(DESIGN_COOKIE)?.value === "classic" ? "classic" : "ocean"
}
