import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
await page.goto("http://localhost:3000/summon/diag?stage=fullArt&unit=shion-ssr", { waitUntil: "domcontentloaded" })
await page.waitForSelector("main h1", { timeout: 30_000 })
await page.waitForTimeout(3000)

const info = await page.evaluate(() => {
  // Find the pattern IMG
  const patternImg = Array.from(document.querySelectorAll('img')).find(i => (i.src || '').includes('298ca5321a8f9b37'))
  if (!patternImg) return { error: 'no pattern img' }
  let el = patternImg
  const chain = []
  while (el && chain.length < 12) {
    const cs = getComputedStyle(el)
    chain.push({
      tag: el.tagName,
      path: el.getAttribute?.('data-path') || null,
      src: el.tagName === 'IMG' ? el.getAttribute('src') : null,
      bg: cs.backgroundColor,
      opacity: cs.opacity,
      mixBlendMode: cs.mixBlendMode,
      filter: cs.filter,
      transform: cs.transform,
      mask: (cs.maskImage || cs.webkitMaskImage || 'none').slice(0, 80),
    })
    el = el.parentElement
  }
  return { chain }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
