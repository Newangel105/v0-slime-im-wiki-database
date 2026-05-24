// Capture screenshots of the focused visual-gate states via Playwright,
// then write them to _work/visual_gate_captures/ for review and SSIM diff
// against the real-game reference frames in D:/video_compare/frames/.
//
// Run: npx playwright install chromium  (first time only)
//      node scripts/capture_visual_gates.mjs
//
// Assumes the dev server is running on http://localhost:3000.
//
// Output layout:
//   _work/visual_gate_captures/
//     character_appear/
//       dord_r.png
//       shion_sr.png
//       shion_ssr.png
//       elmesia_ur_ultimate.png
//     result_ui/
//       chara.png
//       bless.png
//       mixed.png
//
// Each capture grabs the 1600×900 design-fit frame INSIDE the diag page's
// `aspectRatio: 16/9` container (NOT the full viewport — that includes the
// picker chrome). Bounding box derived from the parent div with maxWidth
// 1600 / aspectRatio 16/9 = 1600×900.

import { chromium } from "playwright"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = resolve(__dirname, "..")
const OUT_DIR = resolve("C:/Users/Angel105/Documents/cenas/_work/visual_gate_captures")
const BASE_URL = process.env.DIAG_BASE_URL || "http://localhost:3000"

const CHARACTER_APPEAR_CAPTURES = [
  { name: "dord_r",              query: "stage=fullArt&unit=dord",        settleMs: 3000, refFrame: "nomovie_2_0s.jpg" },
  { name: "shion_sr",            query: "stage=fullArt&unit=shion-sr",    settleMs: 3000, refFrame: "nomovie_2_0s.jpg" },
  { name: "shion_ssr",           query: "stage=fullArt&unit=shion-ssr",   settleMs: 3000, refFrame: "nomovie_2_0s.jpg" },
  { name: "elmesia_ur_ultimate", query: "stage=fullArt&unit=elmesia-uru", settleMs: 4000, refFrame: null },
]

const RESULT_UI_CAPTURES = [
  { name: "chara",  query: "stage=result&mix=chara",  settleMs: 2500, refFrame: null },
  { name: "bless",  query: "stage=result&mix=bless",  settleMs: 2500, refFrame: null },
  { name: "mixed",  query: "stage=result&mix=mixed",  settleMs: 2500, refFrame: null },
]

// Stage container in the diag page: maxWidth: 1600, aspectRatio: 16/9.
// We screenshot the [data-stage-container] element if present, else fall
// back to the maxWidth wrapper div via a CSS selector.
const STAGE_SELECTOR = "main > div:nth-of-type(2)" // the wrapper div with the stage frame
const VIEWPORT = { width: 1920, height: 1080 }


async function captureOne(browser, { name, query, settleMs }, category) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const url = `${BASE_URL}/summon/diag?${query}`
  const consoleErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`))

  try {
    // CharacterAppear keeps WAAPI animations running indefinitely (no
    // networkidle), so use domcontentloaded + an explicit settle delay.
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 })
    if (!resp || !resp.ok()) {
      throw new Error(`HTTP ${resp?.status() ?? "?"} for ${url}`)
    }
    // Wait for the inner stage to mount (the diag shows "Loading diag…" until
    // the dynamic import resolves).
    await page.waitForSelector("main h1", { timeout: 30_000 })
    // Wait for the WAAPI animations to settle to a representative frame.
    await page.waitForTimeout(settleMs)

    const dir = resolve(OUT_DIR, category)
    await mkdir(dir, { recursive: true })
    const out = resolve(dir, `${name}.png`)
    const stageEl = await page.$(STAGE_SELECTOR)
    if (!stageEl) {
      // Fallback: full-page screenshot
      await page.screenshot({ path: out, fullPage: false })
    } else {
      await stageEl.screenshot({ path: out })
    }
    console.log(`  [OK] ${category}/${name}.png  ${url}`)
    if (consoleErrors.length) {
      console.log(`       (with ${consoleErrors.length} console error(s))`)
      for (const e of consoleErrors.slice(0, 5)) console.log(`         ${e.slice(0, 200)}`)
    }
    return { name, ok: true, path: out, consoleErrors: consoleErrors.slice(0, 20) }
  } catch (err) {
    console.log(`  [FAIL] ${category}/${name}: ${err.message}`)
    return { name, ok: false, error: err.message, consoleErrors: consoleErrors.slice(0, 20) }
  } finally {
    await ctx.close()
  }
}


async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const results = { character_appear: [], result_ui: [] }
  console.log("Capturing CharacterAppear...")
  for (const cfg of CHARACTER_APPEAR_CAPTURES) {
    const r = await captureOne(browser, cfg, "character_appear")
    results.character_appear.push({ ...r, refFrame: cfg.refFrame })
  }
  console.log("Capturing Result UI...")
  for (const cfg of RESULT_UI_CAPTURES) {
    const r = await captureOne(browser, cfg, "result_ui")
    results.result_ui.push({ ...r, refFrame: cfg.refFrame })
  }
  await browser.close()

  const summary = resolve(OUT_DIR, "capture_summary.json")
  await writeFile(summary, JSON.stringify(results, null, 2), "utf8")
  console.log(`\nWrote ${summary}`)

  const okCount = (results.character_appear.filter((r) => r.ok).length + results.result_ui.filter((r) => r.ok).length)
  const totalCount = results.character_appear.length + results.result_ui.length
  console.log(`\nCaptured ${okCount}/${totalCount} frames successfully.`)
  process.exit(okCount === totalCount ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
