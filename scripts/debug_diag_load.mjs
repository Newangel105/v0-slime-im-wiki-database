// Quick diag: load /summon/diag?stage=result, log console errors, dump
// the rendered HTML after 8s so we can see why the diag bundle isn't
// resolving (capture script was timing out on `main h1`).
import { chromium } from "playwright"
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on("console", (m) => console.log(`[${m.type()}]`, m.text()))
page.on("pageerror", (e) => console.log("[pageerror]", e.message))
const url = process.argv[2] || "http://localhost:3000/summon/diag?stage=result&unit=benimaru&mix=chara"
await page.goto(url, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(8000)
const html = await page.content()
console.log("---")
console.log("h1 count:", (html.match(/<h1/g) || []).length)
console.log("Loading diag present:", html.includes("Loading diag"))
const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)
console.log("main inner length:", main ? main[1].length : 0)
console.log("main preview:", main ? main[1].slice(0, 200) : "")
await browser.close()
