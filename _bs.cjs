const pw = require('playwright')
const URL = 'https://slimewiki.vercel.app/summon'
;(async () => {
  for (const name of ['firefox', 'chromium']) {
    const br = await pw[name].launch({ headless: true })
    const pg = await br.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
    let loaded = false
    for (let i = 0; i < 6 && !loaded; i++) { try { await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 }); loaded = true } catch (e) { await pg.waitForTimeout(2500) } }
    await pg.waitForSelector('.summon-draw-button button', { timeout: 60000 }); await pg.waitForTimeout(2000)
    await pg.evaluate(() => {
      const four = (str) => { const p = str.trim().split(/\s+/); return p.length === 1 ? [p[0], p[0], p[0], p[0]] : p.length === 2 ? [p[0], p[1], p[0], p[1]] : p }
      for (const b of document.querySelectorAll('.summon-draw-button')) {
        for (const d of b.querySelectorAll('div')) {
          const s = getComputedStyle(d)
          if (!s.borderImageSource || s.borderImageSource === 'none') continue
          const [top, right, bottom, left] = four(s.borderImageWidth)
          const cp = document.createElement('div')
          cp.style.cssText = `position:absolute;left:${left};right:${right};top:${top};bottom:${bottom};` +
            `background-image:${s.borderImageSource};background-repeat:no-repeat;` +
            `background-size:calc(100% + ${left} + ${right}) calc(100% + ${top} + ${bottom});` +
            `background-position:-${left} -${top};pointer-events:none;`
          d.parentElement.insertBefore(cp, d)
        }
      }
    })
    await pg.waitForTimeout(800)
    await pg.screenshot({ path: `_bs_${name}.png`, clip: { x: 1150, y: 452, width: 240, height: 135 } })
    await br.close()
  }
})().catch(e => { console.error('FATAL', (e && e.stack) || e); process.exit(1) })
