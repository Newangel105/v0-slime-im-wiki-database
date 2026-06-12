const pw = require('playwright')
const URL = 'http://localhost:3000/_bt.html'
;(async () => {
  for (const name of ['firefox', 'chromium']) {
    const br = await pw[name].launch({ headless: true })
    const pg = await br.newPage({ viewport: { width: 340, height: 820 }, deviceScaleFactor: 2 })
    let loaded = false
    for (let i = 0; i < 8 && !loaded; i++) { try { await pg.goto(URL, { waitUntil: 'load', timeout: 20000 }); loaded = true } catch (e) { await pg.waitForTimeout(2000) } }
    await pg.waitForTimeout(1500)
    await pg.screenshot({ path: `_bt_${name}.png` })
    await br.close()
  }
})().catch(e => { console.error('FATAL', (e && e.stack) || e); process.exit(1) })
