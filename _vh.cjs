const pw = require('playwright')
const URL = 'http://localhost:3000/'
;(async () => {
  for (const name of ['firefox', 'chromium']) {
    const br = await pw[name].launch({ headless: true })
    const pg = await br.newPage({ viewport: { width: 1600, height: 900 } })
    let loaded = false
    for (let i = 0; i < 8 && !loaded; i++) { try { await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 }); loaded = true } catch (e) { await pg.waitForTimeout(3000) } }
    await pg.waitForTimeout(3500)
    const m = await pg.evaluate(() => ({
      bodyTransform: getComputedStyle(document.body).transform.slice(0, 24),
      docScrollH: document.documentElement.scrollHeight,
      bodyRectH: Math.round(document.body.getBoundingClientRect().height),
      innerH: window.innerHeight,
    }))
    console.log(name, JSON.stringify(m))
    await pg.screenshot({ path: `_vh_${name}.png` })
    // scroll to bottom to check for dead space
    await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await pg.waitForTimeout(800)
    await pg.screenshot({ path: `_vh_${name}_bottom.png` })
    await br.close()
  }
})().catch(e => { console.error('FATAL', (e && e.stack) || e); process.exit(1) })
