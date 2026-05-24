import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
await page.goto("http://localhost:3000/summon/diag?stage=fullArt&unit=shion-ssr", { waitUntil: "domcontentloaded" })
await page.waitForSelector("main h1", { timeout: 30_000 })
await page.waitForTimeout(3000)

// Disable the bloom filter on every element that has it
const n = await page.evaluate(() => {
  let changed = 0
  document.querySelectorAll('*').forEach((el) => {
    const f = getComputedStyle(el).filter
    if (f && f.includes('lottery-character-appear-bloom')) {
      el.style.filter = 'none'
      changed += 1
    }
  })
  return changed
})
console.log(`Disabled bloom on ${n} element(s)`)

// Also probe the actual pattern IMG element's properties
const patternInfo = await page.evaluate(() => {
  const img = Array.from(document.querySelectorAll('img')).find(i => (i.src || '').includes('298ca5321a8f9b37'))
  if (!img) return null
  const r = img.getBoundingClientRect()
  const cs = getComputedStyle(img)
  return {
    src: img.src,
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    opacity: cs.opacity,
    visibility: cs.visibility,
    display: cs.display,
    width: cs.width, height: cs.height,
    naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
    parent_filter: getComputedStyle(img.parentElement).filter,
  }
})
console.log("Pattern IMG:", JSON.stringify(patternInfo, null, 2))

// Look at the parent chain for any filter or background that would paint white
const parents = await page.evaluate(() => {
  const img = Array.from(document.querySelectorAll('img')).find(i => (i.src || '').includes('298ca5321a8f9b37'))
  if (!img) return []
  let el = img.parentElement
  const chain = []
  while (el && chain.length < 10) {
    const cs = getComputedStyle(el)
    chain.push({
      tag: el.tagName,
      path: el.getAttribute?.('data-path') || null,
      filter: cs.filter,
      bg: cs.backgroundColor,
      mixBlend: cs.mixBlendMode,
      isolation: cs.isolation,
      mask: (cs.maskImage || cs.webkitMaskImage || 'none').slice(0, 60),
      opacity: cs.opacity,
    })
    el = el.parentElement
  }
  return chain
})
console.log("Parent chain:")
parents.forEach(p => console.log("  ", JSON.stringify(p)))
await page.waitForTimeout(300)
const stageBox = await page.evaluate(() => {
  const el = document.querySelector("main > div:nth-of-type(2)")
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})
const stageEl = await page.$("main > div:nth-of-type(2)")
await stageEl.screenshot({ path: "C:/Users/Angel105/Documents/cenas/_work/visual_gate_captures/shion_ssr_NO_BLOOM.png" })
console.log("Wrote shion_ssr_NO_BLOOM.png  stage:", stageBox)
await browser.close()
