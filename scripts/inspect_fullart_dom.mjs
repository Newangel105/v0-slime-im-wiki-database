import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
const consoleErrors = []
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300))
})
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message))

const args = process.argv.slice(2)
const unit = args[0] || "shion-sr"
console.log("Inspecting unit:", unit)
await page.goto(`http://localhost:3000/summon/diag?stage=fullArt&unit=${unit}`, { waitUntil: "domcontentloaded" })
await page.waitForSelector("main h1", { timeout: 30_000 })
await page.waitForTimeout(3000)

const info = await page.evaluate(() => {
  const allDataPaths = Array.from(document.querySelectorAll('[data-path]'))
    .map(e => e.getAttribute('data-path'))
    .filter(p => (p || '').includes('charaModel'))
    .slice(0, 12)
  const d2 = document.querySelector('[data-path*="container/charaModel/d2Container/d2"]')
  const all = Array.from(document.querySelectorAll('img'))
  const imgs = all.slice(0, 60).map(i => ({ src: i.src, w: i.naturalWidth, h: i.naturalHeight, displayed: !!i.complete && i.naturalWidth > 0 }))
  const charImgs = all.filter(i => (i.src || '').includes('Image/Character/'))
  // Inspect specific nameplate nodes that might render the rainbow rect
  const probePaths = [
    'container/characterName',
    'container/characterName/characterName',
    'container/characterName/characterTitle',
    'container/characterName/base',
    'container/characterName/base/efUltimate',
    'container/characterName/base/line',
    'container/characterName/base/rimuru',
    'container/characterName/base/gradation',
    'container/characterName/base/pattern',
    'container/characterName/shadow',
    'container/characterName/decoStarL',
    'container/characterName/decoStarR',
  ]
  const probe = probePaths.map(p => {
    const sel = `[data-path$="${p}"]`
    const el = document.querySelector(sel)
    if (!el) return { path: p, present: false }
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return { path: p, present: true, rect: { w: Math.round(r.width), h: Math.round(r.height) }, opacity: cs.opacity, transform: cs.transform, display: cs.display, visibility: cs.visibility, html: el.outerHTML.slice(0, 250) }
  })
  return {
    allCharaModelPaths: allDataPaths,
    d2Present: !!d2,
    d2Rect: d2 ? d2.getBoundingClientRect() : null,
    d2InnerHtml: d2 ? d2.innerHTML.slice(0, 500) : null,
    charImgUrls: charImgs.map(i => ({ src: i.src, w: i.naturalWidth, complete: i.complete })),
    probe,
    imgCount: all.length,
    firstFewImgs: imgs.filter(i => !i.displayed).slice(0, 5),
  }
})
console.log(JSON.stringify(info, null, 2))
console.log("Console errors:", consoleErrors.slice(0, 10))
await browser.close()
