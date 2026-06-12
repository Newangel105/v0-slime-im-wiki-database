const pw = require('playwright')
const URL = 'http://localhost:3000/summon'
;(async () => {
  const br = await pw.firefox.launch({ headless: true })
  const pg = await br.newPage({ viewport: { width: 1600, height: 900 } })
  let loaded = false
  for (let i = 0; i < 8 && !loaded; i++) { try { await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 }); loaded = true } catch (e) { await pg.waitForTimeout(3000) } }
  await pg.waitForSelector('.summon-draw-button button', { timeout: 90000 }); await pg.waitForTimeout(2000)
  const info = await pg.evaluate(() => {
    const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1
    document.documentElement.style.setProperty('zoom', 'normal', 'important')
    document.body.style.transform = `scale(${z})`
    document.body.style.transformOrigin = 'top left'
    document.body.style.width = `${100 / z}%`
    return { z }
  })
  console.log('zoom was', info.z)
  await pg.waitForTimeout(1500)
  await pg.screenshot({ path: '_tz_ff.png', fullPage: false })
  await br.close()
})().catch(e => { console.error('FATAL', (e && e.stack) || e); process.exit(1) })
