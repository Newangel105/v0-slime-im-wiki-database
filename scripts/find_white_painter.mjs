// Hide elements one-by-one to find which DOM tree paints the white pixels.
import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
await page.goto("http://localhost:3000/summon/diag?stage=fullArt&unit=shion-ssr", { waitUntil: "domcontentloaded" })
await page.waitForSelector("main h1", { timeout: 30_000 })
await page.waitForTimeout(3000)

// Stage frame is at viewport (160, 156) with width 1600 height 900 (from earlier inspection).
// The white box center in capture coords is around (530, 700).
// Translate to viewport: vp = (160 + 530, 156 + 700) = (690, 856).

// Densest white cluster center from PIL scan: capture (544, 672) → viewport (704, 828)
const target = { x: 704, y: 828, label: "densest-white" }

// Get ALL elements at this point (deep stack)
const stack = await page.evaluate(([px, py]) => {
  return document.elementsFromPoint(px, py).slice(0, 12).map((e, i) => ({
    idx: i,
    tag: e.tagName,
    path: e.getAttribute?.("data-path") || null,
    src: e.tagName === "IMG" ? e.getAttribute("src") : null,
    cls: typeof e.className === 'string' ? e.className.slice(0, 60) : null,
    bg: getComputedStyle(e).backgroundColor,
    filter: getComputedStyle(e).filter,
    mask: (getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage || "none").slice(0, 80),
  }))
}, [target.x, target.y])
console.log("Full stack at", target, ":")
for (const s of stack) console.log("  ", s)
await browser.close()
