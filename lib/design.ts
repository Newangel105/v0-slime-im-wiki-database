// "nightink" is THE site design — and now the ONLY one any visitor can reach.
// The old ocean/classic designs still exist in the repo (components/ocean,
// components/classic, app/archive-lite.css) as dead code, but getDesign() always
// resolves to "nightink", so the slime-design rollback cookie is fully IGNORED for
// every visitor. A stale cookie left over from earlier testing no longer surfaces
// the old design. To roll back you must edit this function — there is no cookie or
// UI path anymore.
export type Design = "nightink" | "ocean" | "classic"

// Exports kept so existing imports (e.g. the now-inert design-viewport-guard) still
// resolve without edits; nothing reads these to choose a design any longer.
export const DESIGN_COOKIE = "slime-design"
export const FORCE_CLASSIC_COOKIE = "slime-force-classic"

export async function getDesign(): Promise<Design> {
  return "nightink"
}
