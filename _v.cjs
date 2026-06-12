const pw = require('playwright')
const URL = 'http://localhost:3000/summon'
;(async () => {
  for (const name of ['firefox', 'chromium']) {
    const br = await pw[name].launch({ headless: true })
    const pg = await br.newPage({ viewport: { width: 1600, height: 900 } })
    let loaded = false
    for (let i = 0; i < 8 && !loaded; i++) { try { await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 }); loaded = true } catch (e) { await pg.waitForTimeout(3000) } }
    await pg.waitForSelector('.summon-draw-button button', { timeout: 90000 }); await pg.waitForTimeout(2500)
    const m = await pg.evaluate(() => {
      const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}` }
      return {
        rootZoom: getComputedStyle(document.documentElement).zoom,
        bodyTransform: getComputedStyle(document.body).transform,
        stage: r(document.querySelector('.summon-main-stage')),
        btn: r(document.querySelector('.summon-draw-button')),
      }
    })
    console.log(name, JSON.stringify(m))
    await pg.screenshot({ path: `_v_${name}.png` })
    await br.close()
  }
})().catch(e => { console.error('FATAL', (e && e.stack) || e); process.exit(1) })
