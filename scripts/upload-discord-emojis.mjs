// Uploads the game's header + force icons as your Discord app's "Application
// Emojis", then writes lib/discord-emojis.json (icon basename -> "<:name:id>")
// which the bot uses to render real icons instead of text.
//
// Run once locally (re-running is safe — existing emojis are reused, not dupes):
//   Windows PowerShell (from the repo root):
//     $env:DISCORD_APP_ID="1511724712873426985"; $env:DISCORD_BOT_TOKEN="<token>"; node scripts/upload-discord-emojis.mjs
//
// Then commit lib/discord-emojis.json and redeploy. The bot token is ONLY used
// here locally — never deploy it to Vercel.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const APP_ID = process.env.DISCORD_APP_ID
const TOKEN = process.env.DISCORD_BOT_TOKEN
if (!APP_ID || !TOKEN) {
  console.error("Set DISCORD_APP_ID and DISCORD_BOT_TOKEN environment variables first.")
  process.exit(1)
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PUBLIC = path.join(ROOT, "public")
const maps = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/discord-card-icon-maps.json"), "utf8"))
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "pc_wiki.generated.json"), "utf8"))

const API = `https://discord.com/api/v10/applications/${APP_ID}/emojis`
const AUTH = { Authorization: `Bot ${TOKEN}` }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = (p) => p.split("/").pop().replace(/\.webp$/i, "")

// `--force=<substr>` re-uploads (delete + recreate, so they get the new image) any
// emoji whose key contains <substr> — e.g. --force=starChara to redo the stars.
const forceArg = process.argv.find((a) => a.startsWith("--force="))
const FORCE_SUBSTR = forceArg ? forceArg.slice("--force=".length) : null

// ── Collect every distinct icon path: all header maps + every force badge ──
const paths = new Set()
for (const key of Object.keys(maps)) {
  if (key.startsWith("_")) continue
  for (const v of Object.values(maps[key])) paths.add(v)
}
for (const c of data.characters) {
  for (const f of c.forces || []) {
    if (f.icon_path) paths.add("/" + String(f.icon_path).replace(/^\//, "") + ".webp")
  }
  // Skill glyphs (Image/Skill/* — active/leader skills). Secret skills use the
  // character card as their icon, which we skip. Resolve {1}->3, {0}->L (matches
  // toPublicAssetPath so the bot's emoji key lines up).
  for (const sk of c.skills || []) {
    if (sk.icon_path && sk.icon_path.startsWith("Image/Skill/")) {
      paths.add("/" + sk.icon_path.replace(/\{1\}/g, "3").replace(/\{0\}/g, "L") + ".webp")
    }
  }
}

// Resolve to files, drop missing, dedupe by basename, stable order (deterministic names).
const byKey = new Map()
for (const p of [...paths].sort()) {
  const key = base(p)
  if (byKey.has(key)) continue
  const file = path.join(PUBLIC, p.replace(/^\//, ""))
  if (!fs.existsSync(file)) { console.warn("  · missing on disk, skipping:", p); continue }
  byKey.set(key, { key, file })
}
const list = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))

// Deterministic Discord emoji name: <=32 chars, [a-zA-Z0-9_], unique within the app.
const used = new Set()
function emojiName(key) {
  let n = key.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30) || "icon"
  if (n.length < 2) n = "ic" + n
  let cand = n, i = 2
  while (used.has(cand.toLowerCase())) { const suf = String(i); cand = n.slice(0, 32 - suf.length) + suf; i++ }
  used.add(cand.toLowerCase())
  return cand
}

async function listExisting() {
  const res = await fetch(API, { headers: AUTH })
  if (!res.ok) { console.error("Failed to list app emojis:", res.status, await res.text()); process.exit(1) }
  const json = await res.json()
  const arr = Array.isArray(json) ? json : json.items || []
  const m = new Map()
  for (const e of arr) m.set(e.name, e.id)
  return m
}

async function uploadOne(name, file) {
  // Star rows are wide (~1.3:1) and shrink in Discord's square emoji box, so stretch
  // them to a square — they're a compact "★N" badge, so it just makes them full height.
  const isStar = /CommonRarityAtlas[\\/]starChara/i.test(file)
  const png = await sharp(file).resize(128, 128, { fit: isStar ? "fill" : "inside" }).png().toBuffer()
  if (png.length > 256 * 1024) throw new Error("png exceeds 256KB")
  const image = `data:image/png;base64,${png.toString("base64")}`
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(API, { method: "POST", headers: { ...AUTH, "Content-Type": "application/json" }, body: JSON.stringify({ name, image }) })
    if (res.status === 429) { const j = await res.json().catch(() => ({})); await sleep((j.retry_after || 1) * 1000 + 250); continue }
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    return (await res.json()).id
  }
  throw new Error("still rate-limited after retries")
}

;(async () => {
  console.log(`Found ${list.length} distinct icons. Checking existing app emojis…`)
  const existing = await listExisting()
  const out = {}
  let created = 0, reused = 0, failed = 0
  for (const it of list) {
    const name = emojiName(it.key)
    let id = existing.get(name)
    if (id && FORCE_SUBSTR && it.key.includes(FORCE_SUBSTR)) {
      await fetch(`${API}/${id}`, { method: "DELETE", headers: AUTH }).catch(() => {})
      await sleep(300); id = undefined
    }
    if (id) {
      reused++
    } else {
      try { id = await uploadOne(name, it.file); created++; await sleep(350) }
      catch (e) { console.error("  ✖", it.key, "—", e.message); failed++; continue }
    }
    out[it.key] = `<:${name}:${id}>`
    if ((created + reused) % 15 === 0) console.log(`  …${created + reused}/${list.length}`)
  }
  fs.writeFileSync(path.join(ROOT, "lib/discord-emojis.json"), JSON.stringify(out, null, 2) + "\n")
  console.log(`\n✔ ${created} created, ${reused} reused${failed ? `, ${failed} failed` : ""}. Wrote lib/discord-emojis.json (${Object.keys(out).length} icons).`)
  console.log("Next: commit lib/discord-emojis.json and redeploy — the bot will switch from text to icons automatically.")
})()
