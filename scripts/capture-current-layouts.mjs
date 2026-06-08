import { chromium, devices } from "playwright"
import fs from "node:fs/promises"
import path from "node:path"

const baseUrl = process.env.SLIME_CAPTURE_BASE_URL ?? "http://localhost:3000"
const outDir = path.resolve("reports/christmas-vision/current-layouts")

const routes = [
  { name: "home", path: "/" },
  { name: "characters", path: "/characters" },
  {
    name: "characters-filters-open",
    path: "/characters",
    afterLoad: async (page) => {
      await clickByText(page, "Show Filters")
      await page.waitForTimeout(600)
    },
  },
  {
    name: "characters-card-mode",
    path: "/characters",
    afterLoad: async (page) => {
      await clickCardModeToggle(page)
      await page.waitForTimeout(600)
    },
  },
  { name: "character-detail", path: "/characters/130001" },
  {
    name: "character-detail-variants",
    path: "/characters/130001",
    afterLoad: async (page) => {
      const variantText = page.getByText(/variant|rigurd/i).last()
      if (await variantText.count().catch(() => 0)) {
        await variantText.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(async () => {
          await page.mouse.wheel(0, 2200)
        })
      } else {
        await page.mouse.wheel(0, 2400)
      }
      await page.waitForTimeout(700)
    },
  },
  { name: "forces", path: "/forces" },
  {
    name: "forces-expanded",
    path: "/forces",
    afterLoad: async (page) => {
      await page.keyboard.press("Escape").catch(() => {})
      await page.locator("main.slime-page-forces button[aria-expanded]").first().click({ timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(700)
    },
  },
  { name: "gauge-builder", path: "/gauge-builder" },
  { name: "guides", path: "/guides" },
  {
    name: "guide-detail",
    path: "/guides",
    afterLoad: async (page) => {
      const link = page.locator('a[href^="/guides/"]').first()
      const href = await link.getAttribute("href", { timeout: 20000 }).catch(() => null)
      if (href) {
        await page.goto(new URL(href, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 45000 })
        await page.waitForLoadState("load", { timeout: 12000 }).catch(() => {})
        await page.waitForTimeout(900)
      }
    },
  },
  { name: "guides-admin", path: "/guides/admin" },
  { name: "guides-admin-new", path: "/guides/admin/new" },
  { name: "heartprints", path: "/heartprints" },
  {
    name: "heartprints-lower",
    path: "/heartprints",
    afterLoad: async (page) => {
      await page.goto(new URL("/heartprints", baseUrl).toString(), { waitUntil: "commit", timeout: 90000 })
      await page.waitForLoadState("domcontentloaded", { timeout: 90000 }).catch(() => {})
      await page.waitForTimeout(2000)
      await page.getByText("Not Equipable", { exact: true }).first().scrollIntoViewIfNeeded({ timeout: 30000 }).catch(async () => {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.72))
      })
      await page.waitForTimeout(900)
    },
  },
  {
    name: "heartprints-end",
    path: "/heartprints",
    afterLoad: async (page) => {
      await page.waitForTimeout(2200)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(700)
    },
  },
  { name: "loup-loupe", path: "/loup-loupe" },
  { name: "model-viewer", path: "/model-viewer" },
  {
    name: "model-viewer-loaded",
    path: "/model-viewer",
    afterLoad: async (page) => {
      await waitForModelViewer(page)
    },
  },
  {
    name: "model-viewer-movie",
    path: "/model-viewer",
    afterLoad: async (page) => {
      await waitForModelViewer(page)
      await page.getByRole("tab", { name: "Movie" }).first().click({ timeout: 15000 })
      await page.waitForTimeout(3500)
    },
  },
  { name: "orb-converter", path: "/orb-converter" },
  { name: "preset-viewer", path: "/preset-viewer" },
  { name: "skill-viewer", path: "/skill-viewer" },
  {
    name: "skill-viewer-entry-open",
    path: "/skill-viewer",
    afterLoad: async (page) => {
      await page.getByRole("button", { name: /Skills/i }).first().click({ timeout: 15000 })
      await page.locator('[role="checkbox"]').first().click({ timeout: 15000 })
      await page.keyboard.press("Escape").catch(() => {})
      await page.waitForTimeout(1600)
    },
  },
  { name: "summon", path: "/summon" },
  { name: "team-builder", path: "/team-builder" },
  { name: "tier-maker", path: "/tier-maker" },
]

const requestedRoutes = new Set(
  (process.env.SLIME_CAPTURE_ROUTES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
)

const activeRoutes = requestedRoutes.size
  ? routes.filter((route) => requestedRoutes.has(route.name) || requestedRoutes.has(route.path))
  : routes

const modes = [
  {
    name: "desktop-ocean",
    viewport: { width: 1440, height: 900 },
    cookieValue: "ocean",
  },
  {
    name: "desktop-classic",
    viewport: { width: 1440, height: 900 },
    cookieValue: "classic",
  },
  {
    name: "mobile",
    viewport: { width: 390, height: 844 },
    device: devices["iPhone 14"],
    cookieValue: "classic",
  },
]

const requestedModes = new Set(
  (process.env.SLIME_CAPTURE_MODES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
)

const activeModes = requestedModes.size ? modes.filter((mode) => requestedModes.has(mode.name)) : modes

async function captureRoute(page, mode, route) {
  const url = new URL(route.path, baseUrl).toString()
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 })
  await page.waitForLoadState("load", { timeout: 12000 }).catch(() => {})
  await page.waitForTimeout(900)
  if (route.afterLoad) await route.afterLoad(page)

  const status = response?.status() ?? 0
  const title = await page.title().catch(() => "")
  const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")
  const file = path.join(outDir, `${route.name}__${mode.name}.png`)
  await saveViewportScreenshot(page, file)

  return {
    route: route.path,
    name: route.name,
    mode: mode.name,
    status,
    title,
    textSample: bodyText.replace(/\s+/g, " ").slice(0, 260),
    screenshot: path.relative(process.cwd(), file),
  }
}

async function clickByText(page, text) {
  const target = page.getByText(text, { exact: true }).first()
  await target.click({ timeout: 10000 })
}

async function clickCardModeToggle(page) {
  const buttons = await page.locator("button").all()
  for (const button of buttons) {
    const label = `${await button.innerText().catch(() => "")} ${await button.getAttribute("aria-label").catch(() => "") ?? ""} ${await button.getAttribute("title").catch(() => "") ?? ""}`
    if (/card|grid|view/i.test(label) && !/filter/i.test(label)) {
      await button.click({ timeout: 10000 })
      return
    }
  }
  await page.keyboard.press("Tab")
}

async function waitForModelViewer(page) {
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(16000)
}

async function saveViewportScreenshot(page, file) {
  try {
    await page.screenshot({ path: file, fullPage: false, timeout: 20000 })
    return
  } catch (error) {
    const session = await page.context().newCDPSession(page)
    const result = await session.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      fromSurface: true,
    })
    await fs.writeFile(file, Buffer.from(result.data, "base64"))
  }
}

async function main() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const results = []

  for (const mode of activeModes) {
    const context = await browser.newContext({
      ...(mode.device ?? {}),
      viewport: mode.viewport,
      locale: "en-US",
      colorScheme: mode.cookieValue === "classic" ? "dark" : "light",
    })

    await context.addCookies([
      {
        name: "slime-design",
        value: mode.cookieValue,
        domain: "localhost",
        path: "/",
      },
      {
        name: "slime-force-classic",
        value: "",
        domain: "localhost",
        path: "/",
        expires: 0,
      },
    ])

    const page = await context.newPage()
    for (const route of activeRoutes) {
      try {
        const result = await captureRoute(page, mode, route)
        results.push(result)
        console.log(`${mode.name} ${route.path} -> ${result.status}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push({ route: route.path, name: route.name, mode: mode.name, error: message })
        console.log(`${mode.name} ${route.path} -> ERROR ${message}`)
      }
    }
    await context.close()
  }

  await browser.close()
  await fs.writeFile(path.join(outDir, "capture-manifest.json"), JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
