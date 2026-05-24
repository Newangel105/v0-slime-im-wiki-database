import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
await page.goto("http://localhost:3000/summon/diag?stage=fullArt&unit=shion-ssr", { waitUntil: "domcontentloaded" })
await page.waitForSelector("main h1", { timeout: 30_000 })
await page.waitForTimeout(3000)

// The stage frame is at maxWidth 1600 / aspect 16/9 in main > div:nth-of-type(2).
// At viewport 1920×1080 the design canvas is fitted to (most likely) 1600×900.
// The white box appears at roughly lower-left of the visible frame —
// let's identify the topmost (deepest) element at a few sample points.
const samples = await page.evaluate(() => {
  // 5 sample points in design-space roughly inside the nameplate area
  // Stage rendered at ~(160, 30) to (1760, 930) with a 1600×900 size.
  // Lower-left of nameplate (where the white box is in shion_ssr).
  const points = [
    { name: "white-box-center", x: 350, y: 700 }, // around the white area
    { name: "name-text-spot",    x: 500, y: 720 }, // where "Shion" name should be
    { name: "title-text-spot",   x: 800, y: 760 }, // where title text appears
    { name: "name-frame-left",   x: 240, y: 700 },
  ]
  return points.map((p) => {
    const els = document.elementsFromPoint(p.x, p.y).slice(0, 6)
    return {
      ...p,
      stack: els.map((e) => ({
        tag: e.tagName,
        path: e.getAttribute?.("data-path") || null,
        src: e.tagName === "IMG" ? e.getAttribute("src") : null,
        clsName: typeof e.className === "string" ? e.className.slice(0, 80) : null,
        opacity: getComputedStyle(e).opacity,
        bg: getComputedStyle(e).backgroundColor,
        mask: getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage,
        size: { w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) },
      })),
    }
  })
})
console.log(JSON.stringify(samples, null, 2))
await browser.close()
