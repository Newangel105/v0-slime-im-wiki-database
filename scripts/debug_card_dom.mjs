// Inspect the DOM of one result card: dump every element + its computed
// `filter`, `mix-blend-mode`, `box-shadow`, `mask-image`, and `opacity` so
// we can see exactly what (if anything) is applying a glow/light effect.
import { chromium } from "playwright"
const url = "http://localhost:3000/summon/diag?stage=result&unit=shion-ssr&mix=chara"
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on("pageerror", (e) => console.log("[pageerror]", e.message))
await page.goto(url, { waitUntil: "domcontentloaded" })
await page.waitForSelector("main h1", { timeout: 20_000 })
await page.waitForTimeout(2500)
// Hide the video so we definitely see what's coming from the cards only.
await page.addStyleTag({ content: "video { display: none !important; } body { background:#000 !important; }" })
await page.waitForTimeout(500)
// Find the FIRST result card wrapper (positioned absolute child of the
// resultList replacement).
const cards = await page.evaluate(() => {
  function walk(el, out, depth = 0) {
    if (depth > 14 || out.length > 40) return
    const cs = getComputedStyle(el)
    const interesting =
      (cs.filter && cs.filter !== "none") ||
      (cs.mixBlendMode && cs.mixBlendMode !== "normal") ||
      (cs.boxShadow && cs.boxShadow !== "none") ||
      (cs.maskImage && cs.maskImage !== "none") ||
      (cs.backdropFilter && cs.backdropFilter !== "none") ||
      (parseFloat(cs.opacity) < 1)
    if (interesting) {
      out.push({
        tag: el.tagName,
        cls: el.className?.toString?.().slice?.(0, 60),
        depth,
        filter: cs.filter,
        mixBlend: cs.mixBlendMode,
        shadow: cs.boxShadow,
        mask: cs.maskImage?.slice?.(0, 40),
        backdrop: cs.backdropFilter,
        opacity: cs.opacity,
      })
    }
    for (const c of el.children) walk(c, out, depth + 1)
  }
  // Pick the first card: any direct child of the slotsReplaceSubtree wrapper
  // (which is `<div style="position:absolute;inset:0">{cards}</div>`).
  // Heuristic: find the first <div> that contains a chibi character image.
  const all = document.querySelectorAll('img[src*="CharaCard"], img[src*="CharaPartyM"]')
  if (!all[0]) return { error: "no card image found" }
  // Walk up to find the card wrapper (about 4 ancestors)
  let card = all[0]
  for (let i = 0; i < 6; i++) card = card.parentElement || card
  const out = []
  walk(card, out)
  return { cardClass: card.className?.toString?.() || "", found: all.length, log: out }
})
console.log(JSON.stringify(cards, null, 2))
await browser.close()
