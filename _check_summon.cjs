const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const png = new Set(), webp = new Set();
  page.on("request", (r) => {
    const m = r.url().match(/\/UI\/summon\/([a-f0-9]+)\.(png|webp)/);
    if (m) (m[2] === "png" ? png : webp).add(m[1]);
  });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  let loaded = false;
  for (let a = 0; a < 50 && !loaded; a++) {
    try { await page.goto("http://localhost:3000/summon", { waitUntil: "domcontentloaded", timeout: 120000 }); loaded = true; }
    catch (e) { if (/ECONNREFUSED|ERR_CONNECTION/.test(String(e.message))) await page.waitForTimeout(3000); else { console.log("goto err:", e.message); break; } }
  }
  if (!loaded) { console.log("dev server never accepted connections"); await browser.close(); return; }
  await page.waitForTimeout(7000);
  let clicked = false;
  for (const re of [/Recruit x10/i, /Recruit x1/i]) {
    const b = page.getByText(re).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); clicked = true; break; }
  }
  console.log("recruit clicked:", clicked);
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(2500);
    const s = page.getByText(/^\s*SKIP\s*$/i).first();
    if (await s.isVisible().catch(() => false)) await s.click().catch(() => {});
    await page.mouse.click(960, 500).catch(() => {});
  }
  console.log("=== /UI/summon over the whole pull ===");
  console.log("  PNG (want 0):", png.size, [...png].slice(0, 12));
  console.log("  WEBP loaded:", webp.size);
  if (errs.length) console.log("  pageerrors:", errs.slice(0, 3));
  await browser.close();
})();
