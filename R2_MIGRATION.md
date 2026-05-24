# R2 Migration — moving big media off the repo

Vercel's Hobby build container disk (~13–23 GB) couldn't hold this repo's
git history (5.6 GB) + node_modules (1 GB) + built output (8.7 GB) all at
once, so `vercel build` failed with ENOSPC. The fix is to host the heavy
bytes — `public/Movie/` (3.4 GB) and `public/Video/` (~100 MB) — on
Cloudflare R2 and reference them via an external CDN URL at runtime.

The code side is already wired (`lib/media-cdn.ts` + the few `<video>`
sites). What's left is the operational migration.

## 1. Create the R2 bucket

1. Cloudflare dashboard → R2 → Create bucket. Name it e.g. `slimewiki-media`.
2. Bucket → Settings → **Public Access** → enable the `r2.dev` development
   URL (free) OR connect a custom domain like `media.slimewiki.app` if you
   have one in Cloudflare DNS (also free, prettier).
3. Note the public base URL — e.g. `https://pub-abc123.r2.dev` or
   `https://media.slimewiki.app`.

## 2. Upload the media

The directory structure on R2 must mirror what the website requests, so:
- `public/Movie/SpecialSkill/X.mp4` becomes `Movie/SpecialSkill/X.mp4`
  inside the bucket (no leading slash, no `public/` prefix).

Two reliable upload tools:

### Option A: Cloudflare Wrangler CLI
```bash
npm install -g wrangler
wrangler login
# from the repo root:
wrangler r2 object put slimewiki-media/Movie --file ./public/Movie --recursive
wrangler r2 object put slimewiki-media/Video --file ./public/Video --recursive
```

### Option B: `rclone` (faster for thousands of files, parallel)
```bash
rclone config   # add an "r2" remote with the bucket's S3-compatible creds
rclone copy ./public/Movie r2:slimewiki-media/Movie --transfers 16
rclone copy ./public/Video r2:slimewiki-media/Video --transfers 16
```

Cloudflare's R2 dashboard generates the S3-compatible Access Key ID +
Secret Key under "Manage R2 API Tokens" → "Create Token".

After upload, sanity check from a browser:
- `https://<base>/Movie/AnalysisCut/lottery_analysis_cut_SSR.mp4` should play.
- `https://<base>/Video/character_appear/vfx_bg_R.webm` should play.

Set cache headers when uploading (rclone supports `--header-upload`):
```
Cache-Control: public, max-age=31536000, immutable
```
This lets Cloudflare's CDN cache aggressively in front of R2 and keeps R2
Class B operations low.

## 3. Set the Vercel env var

Vercel dashboard → project → Settings → Environment Variables → add:
```
Name:        NEXT_PUBLIC_MEDIA_CDN
Value:       https://media.slimewiki.app   # (or your r2.dev URL, no trailing slash)
Environment: Production, Preview, Development
```

After saving, redeploy. `lib/media-cdn.ts` will start prefixing
`/Movie/*` and `/Video/*` paths automatically.

## 4. Remove the media from the repo + history

Once R2 is live and confirmed serving, delete the local copies and rewrite
git history so the 5.6 GB pack file shrinks:

```bash
# stop tracking the directories (.gitignore already excludes them)
git rm -r --cached public/Movie public/Video
git commit -m "stop tracking public/Movie + public/Video (moved to R2 cdn)"

# rewrite history to drop the old blobs entirely (git-filter-repo is the
# modern replacement for filter-branch; install via `pip install git-filter-repo`)
git filter-repo --invert-paths --path public/Movie --path public/Video --force

# force-push the cleaned history
git push --force origin main
```

⚠️ Force-pushing rewrites all commit hashes — anyone else cloning the repo
will need to re-clone. Since this is your personal repo, that's a non-issue.

After the rewrite the GitHub repo + the Vercel cloned working copy both
drop to ~1.2 GB total, well under any quota.

## 5. Verify

- Vercel build no longer fails with ENOSPC.
- Browser network tab on `https://your-site.vercel.app/summon`: `/Movie/...`
  requests resolve to `https://media.slimewiki.app/Movie/...` and return 200.
- Local dev (`npm run dev`) still serves from `public/Movie/` etc. on disk
  if you keep the files locally — `mediaUrl()` is a no-op when
  `NEXT_PUBLIC_MEDIA_CDN` is unset.
