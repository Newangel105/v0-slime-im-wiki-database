const pw = require('playwright')
;(async () => {
  const br = await pw.chromium.launch({ headless: true })
  const pg = await br.newPage({ viewport: { width: 1600, height: 900 } })
  const missing = []
  pg.on('response', r => { if (r.url().includes('/assets/') && r.status() >= 400) missing.push(r.status() + ' ' + r.url().split('/assets/')[1]) })
  let loaded = false
  for (let i = 0; i < 8 && !loaded; i++) { try { await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 }); loaded = true } catch (e) { await pg.waitForTimeout(3000) } }
  await pg.waitForTimeout(2500)
  await pg.screenshot({ path: '_beach_home.png' })
  console.log('asset 4xx/5xx on home:', JSON.stringify(missing.slice(0, 20)))
  await br.close()
})().catch(e => { console.error('FATAL', (e && e.stack) || e); process.exit(1) })
