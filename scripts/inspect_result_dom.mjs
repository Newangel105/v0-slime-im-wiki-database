import { chromium } from "playwright"
import { writeFile } from "node:fs/promises"

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
await page.goto("http://localhost:3000/summon/diag?stage=result&mix=bless", { waitUntil: "domcontentloaded" })
await page.waitForSelector("main h1", { timeout: 30_000 })
await page.waitForTimeout(2500)

const cardInfo = await page.evaluate(() => {
  const blessNodes = document.querySelectorAll('[data-thumb-type="Bless"]')
  const blockerNodes = document.querySelectorAll('[data-blocker]')
  // Check character images on the page
  const allImgs = Array.from(document.querySelectorAll('img'))
  const imgs = allImgs.filter(i => (i.src || '').includes('Image/Character/'))
    .slice(0, 6)
    .map(i => i.src)
  const allImgSources = allImgs.slice(0, 30).map(i => i.src || i.getAttribute('src') || '')
  // Dump ALL data-thumb-type attributes
  const allDataThumbTypes = Array.from(document.querySelectorAll('[data-thumb-type]')).map(e => e.getAttribute('data-thumb-type'))
  const resultList = document.querySelector('[data-path*="resultList"]')
  // Look for the OUTER ResultCardWrapper divs — these are positioned siblings
  // of each card, NOT data-path nodes (they're the WAAPI animation wrappers).
  // Look for the resultList's children directly.
  const directChildren = resultList ? Array.from(resultList.children).slice(0, 5) : []
  const childInfos = directChildren.map((c, i) => {
    const r = c.getBoundingClientRect()
    const cs = getComputedStyle(c)
    return {
      index: i,
      tag: c.tagName,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      opacity: cs.opacity,
      transform: cs.transform,
      visibility: cs.visibility,
      childCount: c.children.length,
      outerHtml: c.outerHTML.slice(0, 400),
    }
  })
  // Also look inside the first slot-wrapping div to find the actual card cells
  const slotsReplaceContainer = resultList ? resultList.querySelector("div > div") : null
  const cells = slotsReplaceContainer ? Array.from(slotsReplaceContainer.children).slice(0, 5) : []
  const cellInfos = cells.map((c, i) => {
    const r = c.getBoundingClientRect()
    const cs = getComputedStyle(c)
    return {
      index: i,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      opacity: cs.opacity,
      transform: cs.transform,
      width: cs.width, height: cs.height,
      left: cs.left, top: cs.top,
      childCount: c.children.length,
      outerHtml: c.outerHTML.slice(0, 500),
    }
  })
  return {
    resultListPresent: !!resultList,
    resultListRect: resultList ? resultList.getBoundingClientRect() : null,
    resultListChildren: childInfos,
    cellInfos,
    blessNodeCount: blessNodes.length,
    blockerNodeCount: blockerNodes.length,
    characterImgSamples: imgs,
    allDataThumbTypes,
    allImgSourcesSample: allImgSources,
  }
})
console.log(JSON.stringify(cardInfo, null, 2))
await writeFile("C:/Users/Angel105/Documents/cenas/_work/visual_gate_captures/result_dom_chara.json", JSON.stringify(cardInfo, null, 2))
await browser.close()
