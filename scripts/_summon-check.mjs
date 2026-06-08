import { chromium } from "playwright"
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: {width:430,height:932}, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await ctx.addCookies([{name:"slime-force-classic",value:"1",url:"http://localhost:3000"},{name:"slime-design",value:"classic",url:"http://localhost:3000"}])
const page = await ctx.newPage()
await page.goto("http://localhost:3000/summon", { waitUntil:"domcontentloaded", timeout:90000 }).catch(()=>{})
await page.waitForTimeout(6000)
const info = await page.evaluate(() => {
  const e = document.querySelector(".summon-main-stage"); const r = e.getBoundingClientRect(); const c = getComputedStyle(e)
  return JSON.stringify({ ar: c.aspectRatio, rotWidth: Math.round(r.width), rotHeight: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right), fitsWidth: r.left >= -2 && r.right <= 432 })
})
console.log("mainStage:", info)
await page.screenshot({ path: "reports/summon-check/portrait.png" })
await browser.close()
