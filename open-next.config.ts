// Disable the remote R2 incremental cache to avoid deployment failures from
// cache upload retries. The app already uses explicit route-level caching.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
