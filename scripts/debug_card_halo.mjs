// Isolate a single result card on a SOLID BLACK BG (loop video hidden) so
// we can see if the "weird white halo" survives without the bg loop. If
// yes → the halo is from CSS / frame sprite / PrefabTree. If no → it's
// from the loop video.
import { chromium } from "playwright"
const url = "http://localhost:3000/summon/diag?stage=result&unit=shion-ssr&mix=chara"
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on("pageerror", (e) => console.log("[pageerror]", e.message))
await page.goto(url, { waitUntil: "domcontentloaded" })
await page.waitForSelector("main h1", { timeout: 20_000 })
await page.waitForTimeout(2500)
// Hide the loop video by injecting CSS, then take screenshot.
await page.addStyleTag({ content: `
  video { display: none !important; }
  /* solid black behind the prefab tree so any halo on cards is obvious */
  body { background: #000 !important; }
` })
await page.waitForTimeout(800)
await page.screenshot({ path: "_work/result_ui_audit/_isolated_no_video.png", fullPage: false })
console.log("saved _work/result_ui_audit/_isolated_no_video.png")
await browser.close()
