// Render the page and use Playwright's accessibility tree to inspect what
// actually paints at the white-rect pixel. Try toggling element visibility
// to identify the painter.
import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
await page.goto("http://localhost:3000/summon/diag?stage=fullArt&unit=shion-ssr", { waitUntil: "domcontentloaded" })
await page.waitForSelector("main h1", { timeout: 30_000 })
await page.waitForTimeout(3000)

// Sample pixel at (660, 876) viewport coords (white-center of the capture)
async function pixelAt(x, y, label) {
  const buf = await page.screenshot({ clip: { x, y, width: 1, height: 1 }, type: "png" })
  // PNG with IDAT for 1x1 — decode last 4 bytes before IEND? Easier: encode the 1x1 via b64 and let Node convert.
  // Use sharp if available, else fall back to pngjs parsing. Skip — instead just log the buf size + capture a larger region for the human.
  console.log(`${label}: png buf size = ${buf.length}`)
}

// Walk the DOM hierarchy at (660, 876) hiding each element progressively
// to identify the one that paints the white.
const targets = await page.evaluate(([px, py]) => {
  return document.elementsFromPoint(px, py).map((e, i) => ({ i, tag: e.tagName, path: e.getAttribute?.("data-path"), src: e.tagName === "IMG" ? e.getAttribute("src") : null }))
}, [660, 876])
console.log("Stack at (660, 876):")
for (const t of targets) console.log("  ", t)

// Sample baseline
await page.screenshot({ path: "C:/Users/Angel105/Documents/cenas/_work/visual_gate_captures/probe_baseline.png", clip: { x: 0, y: 156, width: 1600, height: 900 } })

// Now hide the IMG (line) and check
await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img')).filter(i => (i.src || '').includes('e3b99e18e490a17f'))
  imgs.forEach(i => { i.style.display = 'none' })
  return imgs.length
})
await page.waitForTimeout(200)
await page.screenshot({ path: "C:/Users/Angel105/Documents/cenas/_work/visual_gate_captures/probe_no_line.png", clip: { x: 0, y: 156, width: 1600, height: 900 } })

// Reset, then hide the IMG (pattern)
await page.evaluate(() => {
  Array.from(document.querySelectorAll('img')).forEach(i => { i.style.display = '' })
  const imgs = Array.from(document.querySelectorAll('img')).filter(i => (i.src || '').includes('298ca5321a8f9b37'))
  imgs.forEach(i => { i.style.display = 'none' })
  return imgs.length
})
await page.waitForTimeout(200)
await page.screenshot({ path: "C:/Users/Angel105/Documents/cenas/_work/visual_gate_captures/probe_no_pattern.png", clip: { x: 0, y: 156, width: 1600, height: 900 } })

// Reset, hide pattern + line + gradation
await page.evaluate(() => {
  Array.from(document.querySelectorAll('img')).forEach(i => { i.style.display = '' })
  const hashes = ['298ca5321a8f9b37', 'e3b99e18e490a17f', '294b5d76f3d9f9b1', '65fdaaf6e4fd1457']
  let hidden = 0
  for (const h of hashes) {
    Array.from(document.querySelectorAll('img')).filter(i => (i.src || '').includes(h)).forEach(i => { i.style.display = 'none'; hidden += 1 })
  }
  return hidden
})
await page.waitForTimeout(200)
await page.screenshot({ path: "C:/Users/Angel105/Documents/cenas/_work/visual_gate_captures/probe_no_nameplate_overlays.png", clip: { x: 0, y: 156, width: 1600, height: 900 } })

await browser.close()
console.log("Wrote probe screenshots to _work/visual_gate_captures/")
