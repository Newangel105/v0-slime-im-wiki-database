import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this project. Without this, Next.js auto-detects
  // by finding the nearest lockfile and accidentally picks one in the parent
  // directory (an unrelated experiment), which mis-routes serverless file
  // tracing.
  outputFileTracingRoot: __dirname,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Same-origin proxy for client-side media (model .glb/.visibility.json, movies).
  // mediaUrl() emits /r2/* so the browser only ever hits our own domain; Vercel
  // forwards to the CDN server-side. Fixes clients whose network can't resolve the
  // raw *.r2.dev host. Server-side fetches (summon, models manifest) still hit the
  // CDN directly via process.env, so this only affects in-browser requests.
  async rewrites() {
    const cdn = (process.env.NEXT_PUBLIC_MEDIA_CDN || "").replace(/\/+$/, "")
    if (!cdn) return []
    return [{ source: "/r2/:path*", destination: `${cdn}/:path*` }]
  },
  async headers() {
    return [
      {
        // Cache all images for 7 days
        source: "/:path*.(png|jpg|jpeg|gif|webp|svg|ico)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        // Cache JSON data files for 1 hour
        source: "/:path*.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ]
  },
}

export default nextConfig