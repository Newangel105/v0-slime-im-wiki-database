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
  // summon-data.ts reads summon.generated.json via fs at runtime (not via
  // `import`, to keep webpack out of it). Next's tracing can't see that
  // implicit dependency, so list it explicitly for every route that uses
  // getSummonData() — otherwise the JSON won't be packaged into the
  // serverless function and fs.readFileSync throws ENOENT.
  outputFileTracingIncludes: {
    "/summon": ["./summon.generated.json"],
    "/summon/diag": ["./summon.generated.json"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Vercel Hobby's 8 GB build container OOMs when Next.js spawns parallel
  // workers because summon.generated.json (55 MB) gets pulled into webpack
  // and balloons per-worker heap. cpus:1 forces sequential builds so peak
  // memory stays bounded. The proper fix is to lazy-load that JSON instead
  // of import-ing it, but until that refactor lands this keeps deploys green.
  experimental: {
    workerThreads: false,
    cpus: 1,
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