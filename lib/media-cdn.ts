// Resolve a media asset path against an optional CDN base URL.
//
// Why this exists: the heavy media in this repo (public/Movie ~3.4 GB,
// public/Video ~100 MB, etc.) blows past Vercel's build container disk
// quota and forces the deploy to fail with ENOSPC. The fix is to host
// those bytes on an external CDN (Cloudflare R2 in our case) and reference
// them via absolute URLs at runtime, while keeping the code-side paths
// untouched.
//
// Behavior:
//   - If NEXT_PUBLIC_MEDIA_CDN is set (production), absolute paths like
//     "/Movie/x.mp4" become "/r2/Movie/x.mp4" — a SAME-ORIGIN path that the
//     next.config rewrite proxies to the CDN. This matters because mediaUrl is
//     only ever called from CLIENT components, and some networks can't resolve
//     the raw "*.r2.dev" host (DNS filters/ad-blockers/regions) — so the model
//     viewer's .glb fetches failed for them. Going through /r2 means the browser
//     only talks to our own domain; Vercel forwards to R2 server-side (the same
//     reason the SSR summon/models-manifest fetches work for everyone).
//   - If unset (local dev), paths are returned untouched so Next.js serves
//     them straight from the public/ folder.
//   - Already-absolute http(s) URLs and data: URIs pass through unchanged.
//
// The set of path prefixes we redirect is intentional: only the dirs we
// actually move to R2. Other public/ paths (small JSON, UI atlases, etc.)
// keep serving from Vercel.
const CDN_BASE = (process.env.NEXT_PUBLIC_MEDIA_CDN || "").replace(/\/+$/, "")

const CDN_PREFIXES = [
  "/Movie/",
  "/Video/",
  "/models/",
]

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return ""
  if (/^(https?:)?\/\//.test(path)) return path
  if (path.startsWith("data:")) return path
  if (!CDN_BASE) return path
  const matchesPrefix = CDN_PREFIXES.some((p) => path.startsWith(p))
  if (!matchesPrefix) return path
  // Same-origin proxy path; next.config rewrites /r2/* -> CDN_BASE/* server-side.
  return "/r2" + path
}
