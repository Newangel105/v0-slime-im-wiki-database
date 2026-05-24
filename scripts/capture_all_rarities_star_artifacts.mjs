// Headless capture: visit the diag fullArt stage for every rarity preset and
// screenshot the stage at a fixed time (~3s in — after the star pop, before
// any TextAnnounce hand-off so we can see the placed stars + any residual
// flare artifacts). Writes images to _work/star_audit/<preset>.png so we
// can iterate on flare/star fixes without manual pulls.
//
// Run:  npx playwright install chromium  (one time)
//       node scripts/capture_all_rarities_star_artifacts.mjs
// Requires the dev server running on http://localhost:3000.

import { chromium } from "playwright"
import { mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = resolve(__dirname, "..")
const OUT_DIR = resolve(PROJECT_DIR, "_work", "star_audit")
const BASE_URL = process.env.DIAG_BASE_URL || "http://localhost:3000"
const VIEWPORT = { width: 1920, height: 1080 }

// One preset per rarity tier. The settleMs is chosen so all WAAPI animations
// have completed (stars placed, flare bursts faded) — that's when we want to
// inspect the final state for placeholder artifacts.
const CAPTURES = [
  { preset: "dord",           rarity: "R"            },
  { preset: "shion-sr",       rarity: "SR"           },
  { preset: "shion-ssr",      rarity: "SSR"          },
  { preset: "shion-ssrult",   rarity: "SSRUltimate"  },
  { preset: "elmesia-urex",   rarity: "UREx"         },
  { preset: "elmesia-uru",    rarity: "URUltimate"   },
]
const SETTLE_MS = 4500

async function captureOne(browser, preset, rarity) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const url = `${BASE_URL}/summon/diag?stage=fullArt&unit=${preset}`
  const errs = []
  page.on("console", (msg) => { if (msg.type() === "error") errs.push(msg.text()) })
  page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`))
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 })
    if (!resp || !resp.ok()) throw new Error(`HTTP ${resp?.status() ?? "?"}`)
    await page.waitForSelector("main h1", { timeout: 30_000 })
    await page.waitForTimeout(SETTLE_MS)
    const outPath = resolve(OUT_DIR, `${rarity.toLowerCase()}_${preset}.png`)
    await mkdir(dirname(outPath), { recursive: true })
    await page.screenshot({ path: outPath, fullPage: false })
    console.log(`[ok] ${rarity.padEnd(12)} → ${outPath}${errs.length ? ` (${errs.length} console errors)` : ""}`)
    if (errs.length) for (const e of errs.slice(0, 3)) console.log(`     ${e}`)
  } catch (e) {
    console.log(`[fail] ${rarity}: ${e.message}`)
  } finally {
    await ctx.close()
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const { preset, rarity } of CAPTURES) {
      await captureOne(browser, preset, rarity)
    }
  } finally {
    await browser.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
