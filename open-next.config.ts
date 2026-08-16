// ISR / `revalidate` routes need an incremental-cache backend on Cloudflare Workers,
// or the Worker throws at request time (error 1101, seen on /characters/* and the
// data API routes). Use a KV namespace (bound as NEXT_INC_CACHE_KV in wrangler.jsonc)
// — KV avoids the R2 cache-upload-retry deployment failures we hit before.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
