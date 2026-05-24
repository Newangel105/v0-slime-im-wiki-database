// Render the result UI with the bg loop hidden + a WHITE page bg so any
// soft halo coming from inside the card frame is obvious.
import { chromium } from "playwright"
const url = "http://localhost:3000/summon/diag?stage=result&unit=shion-ssr&mix=chara"
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on("pageerror", (e) => console.log("[pageerror]", e.message))
await page.goto(url, { waitUntil: "domcontentloaded" })
await page.waitForSelector("main h1", { timeout: 20_000 })
await page.waitForTimeout(3500)
await page.addStyleTag({ content: `
  video { display: none !important; }
  body { background: #fff !important; }
` })
await page.waitForTimeout(500)
await page.screenshot({ path: "_work/result_ui_audit/_card_on_white.png", fullPage: false })
console.log("saved _work/result_ui_audit/_card_on_white.png")
await browser.close()
