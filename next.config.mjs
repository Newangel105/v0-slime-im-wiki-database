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
  // Vercel Hobby's 8 GB build container OOMs when Next.js spawns parallel
  // build workers — each worker process gets its own ~4 GB heap and the
  // 2-core machine ends up trying to allocate >8 GB. Force the build to
  // a single process so peak memory stays bounded.
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