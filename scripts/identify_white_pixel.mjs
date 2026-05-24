import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
await page.goto("http://localhost:3000/summon/diag?stage=fullArt&unit=shion-ssr", { waitUntil: "domcontentloaded" })
await page.waitForSelector("main h1", { timeout: 30_000 })
await page.waitForTimeout(3000)

// The capture is the stage frame at viewport scale. The stage frame is at
// CSS pixel coords inside main > div:nth-of-type(2). At viewport 1920x1080,
// the stage is roughly at (160, 120) to (1760, 1020) sized 1600x900.
// Need to translate capture coords (x_cap, y_cap in 1600x900) to viewport
// coords. Stage's top-left in viewport = (stageX, stageY).
const stageBox = await page.evaluate(() => {
  const el = document.querySelector("main > div:nth-of-type(2)")
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})
console.log("Stage:", stageBox)

// White rect center in capture coords: roughly (500, 720) in 1600x900
const capPoints = [{ x: 500, y: 720, label: "white-center" }, { x: 470, y: 700, label: "white-left" }, { x: 600, y: 750, label: "white-right" }]
for (const p of capPoints) {
  // Map to viewport coords assuming the stage is fit "contain" in the
  // bounding box. The capture file is the stage el's exact screenshot.
  const vx = stageBox.x + (p.x / 1600) * stageBox.w
  const vy = stageBox.y + (p.y / 900) * stageBox.h
  const probe = await page.evaluate(([px, py]) => {
    const els = document.elementsFromPoint(px, py).slice(0, 6)
    return els.map((e) => {
      const cs = getComputedStyle(e)
      return {
        tag: e.tagName,
        path: e.getAttribute?.("data-path"),
        src: e.tagName === "IMG" ? e.getAttribute("src") : null,
        bg: cs.backgroundColor,
        opacity: cs.opacity,
        mixBlend: cs.mixBlendMode,
        mask: (cs.maskImage || cs.webkitMaskImage || "none").slice(0, 100),
        rect: { w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) },
      }
    })
  }, [vx, vy])
  console.log(`\n--- ${p.label} cap=(${p.x},${p.y}) → vp=(${Math.round(vx)},${Math.round(vy)})`)
  for (const e of probe) {
    console.log(`  ${e.tag} path=${e.path} src=${e.src} bg=${e.bg} mask=${e.mask}`)
  }
}
await browser.close()
