/**
 * Convert key PNG images to WebP for significant bandwidth savings.
 * Targets: partyL (character portraits), SkillStill (heartprint images),
 *          frame (shared card frames), stars (rarity stars).
 */
import sharp from "sharp"
import { readdir, stat } from "fs/promises"
import { join, extname, basename } from "path"

const PUBLIC = join(process.cwd(), "public")

const FOLDERS = [
  { path: join(PUBLIC, "partyL"),    recursive: false },
  { path: join(PUBLIC, "SkillStill"), recursive: true  },
  { path: join(PUBLIC, "frame"),     recursive: false },
  { path: join(PUBLIC, "stars"),     recursive: false },
]

async function* walkPngs(dir, recursive) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory() && recursive) {
      yield* walkPngs(full, true)
    } else if (e.isFile() && extname(e.name).toLowerCase() === ".png") {
      yield full
    }
  }
}

let converted = 0
let skipped = 0
let errors = 0

for (const { path: dir, recursive } of FOLDERS) {
  console.log(`\nProcessing: ${dir}`)
  for await (const pngPath of walkPngs(dir, recursive)) {
    const webpPath = pngPath.replace(/\.png$/i, ".webp")
    // Skip if webp already exists and is newer than png
    try {
      const [pngStat, webpStat] = await Promise.all([stat(pngPath), stat(webpPath).catch(() => null)])
      if (webpStat && webpStat.mtimeMs >= pngStat.mtimeMs) {
        skipped++
        continue
      }
    } catch { /* continue */ }

    try {
      await sharp(pngPath)
        .webp({ quality: 82, effort: 4 })
        .toFile(webpPath)
      converted++
      if (converted % 50 === 0) process.stdout.write(`  ${converted} converted...\r`)
    } catch (e) {
      console.error(`  ERROR: ${pngPath} — ${e.message}`)
      errors++
    }
  }
}

console.log(`\nDone: ${converted} converted, ${skipped} up-to-date, ${errors} errors`)
