// Headless capture: visit the diag `result` stage with each mix variant
// (all-chara, all-bless, mixed) plus several unit-preset combinations so
// we can iterate on the Result UI background loop / cards / frames
// without manual reproduction.
//
// Writes images to _work/result_ui_audit/<variant>.png.
//
// Run:  npx playwright install chromium  (one time)
//       node scripts/capture_result_ui.mjs
// Requires the dev server running on http://localhost:3000.

import { chromium } from "playwright"
import { mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = resolve(__dirname, "..")
const OUT_DIR = resolve(PROJECT_DIR, "_work", "result_ui_audit")
const BASE_URL = process.env.DIAG_BASE_URL || "http://localhost:3000"
const VIEWPORT = { width: 1920, height: 1080 }

// Each capture targets a specific Result UI variant we want to inspect.
// `unit` drives the chara preset shown for Chara slots; `mix` controls
// chara/bless composition of the synthetic x10 grid.
const CAPTURES = [
  { name: "all_chara_benimaru",  unit: "benimaru",     mix: "chara"  },
  { name: "all_chara_shion_ssr", unit: "shion-ssr",    mix: "chara"  },
  { name: "all_chara_ssrult",    unit: "shion-ssrult", mix: "chara"  },
  { name: "all_chara_urex",      unit: "elmesia-urex", mix: "chara"  },
  { name: "all_chara_uruult",    unit: "elmesia-uru",  mix: "chara"  },
  { name: "all_bless",           unit: "dord",         mix: "bless"  },
  { name: "mixed_benimaru",      unit: "benimaru",     mix: "mixed"  },
  { name: "mixed_urult",         unit: "elmesia-uru",  mix: "mixed"  },
]
const SETTLE_MS = 3500

async function captureOne(browser, { name, unit, mix }) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const url = `${BASE_URL}/summon/diag?stage=result&unit=${unit}&mix=${mix}`
  const errs = []
  page.on("console", (msg) => { if (msg.type() === "error") errs.push(msg.text()) })
  page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`))
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 })
    if (!resp || !resp.ok()) throw new Error(`HTTP ${resp?.status() ?? "?"}`)
    await page.waitForSelector("main h1", { timeout: 30_000 })
    await page.waitForTimeout(SETTLE_MS)
    const outPath = resolve(OUT_DIR, `${name}.png`)
    await mkdir(dirname(outPath), { recursive: true })
    await page.screenshot({ path: outPath, fullPage: false })
    console.log(`[ok] ${name.padEnd(22)} → ${outPath}${errs.length ? ` (${errs.length} console errors)` : ""}`)
    if (errs.length) for (const e of errs.slice(0, 3)) console.log(`     ${e}`)
  } catch (e) {
    console.log(`[fail] ${name}: ${e.message}`)
  } finally {
    await ctx.close()
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const cap of CAPTURES) {
      await captureOne(browser, cap)
    }
  } finally {
    await browser.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
