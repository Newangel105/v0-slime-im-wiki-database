// Test hypothesis: the "white box" is one of the rarity star / rarityNEffect
// nodes still mid-animation OR holding at large scale.
import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
await page.goto("http://localhost:3000/summon/diag?stage=fullArt&unit=shion-ssr", { waitUntil: "domcontentloaded" })
await page.waitForSelector("main h1", { timeout: 30_000 })
await page.waitForTimeout(3000)

// Capture WAAPI state of rarity stars + rarityNEffect at the moment of capture
const animState = await page.evaluate(() => {
  const out = []
  for (let i = 1; i <= 6; i++) {
    const star = document.querySelector(`[data-path$="/rarityStar/rarity${i}"]`)
    const effect = document.querySelector(`[data-path$="/rarityStar/rarity${i}Effect/effect"]`)
    if (star) {
      const r = star.getBoundingClientRect()
      out.push({ name: `rarity${i}`, transform: getComputedStyle(star).transform, opacity: getComputedStyle(star).opacity, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })
    }
    if (effect) {
      const r = effect.getBoundingClientRect()
      out.push({ name: `rarity${i}Effect/effect`, transform: getComputedStyle(effect).transform, opacity: getComputedStyle(effect).opacity, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })
    }
  }
  return out
})
console.log("Rarity star/effect states at capture time:")
animState.forEach(s => console.log("  ", JSON.stringify(s)))

// Now hide each candidate group and screenshot.
const stageEl = await page.$("main > div:nth-of-type(2)")

// 1. Hide rarity1Effect..rarity6Effect (the per-star burst flares)
await page.evaluate(() => {
  for (let i = 1; i <= 6; i++) {
    document.querySelectorAll(`[data-path$="/rarityStar/rarity${i}Effect"], [data-path*="/rarityStar/rarity${i}Effect/"]`).forEach(el => { el.style.display = 'none' })
  }
})
await page.waitForTimeout(200)
await stageEl.screenshot({ path: "C:/Users/Angel105/Documents/cenas/_work/visual_gate_captures/shion_ssr_hide_starEffects.png" })

// Restore, then hide rarity1..rarity6 (the star pop nodes)
await page.evaluate(() => {
  document.querySelectorAll('[data-path*="rarity"]').forEach(el => { el.style.display = '' })
  for (let i = 1; i <= 6; i++) {
    document.querySelectorAll(`[data-path$="/rarityStar/rarity${i}"]`).forEach(el => { el.style.display = 'none' })
  }
})
await page.waitForTimeout(200)
await stageEl.screenshot({ path: "C:/Users/Angel105/Documents/cenas/_work/visual_gate_captures/shion_ssr_hide_stars.png" })

// Restore, then hide rarityStar wrapper entirely
await page.evaluate(() => {
  document.querySelectorAll('[data-path*="rarity"]').forEach(el => { el.style.display = '' })
  document.querySelectorAll('[data-path$="/characterName/rarityStar"]').forEach(el => { el.style.display = 'none' })
})
await page.waitForTimeout(200)
await stageEl.screenshot({ path: "C:/Users/Angel105/Documents/cenas/_work/visual_gate_captures/shion_ssr_hide_rarityStar.png" })

console.log("Wrote test captures")
await browser.close()
