/**
 * Convert ALL PNG images in public/ to WebP for bandwidth savings.
 *
 * Usage:
 *   node scripts/convert-to-webp.mjs [--delete-png] [--all]
 *
 * Flags:
 *   --delete-png   Remove the source .png after a successful conversion.
 *   --all          Process every PNG in public/ (default behaviour).
 *                  Without this flag the script still processes everything;
 *                  it is kept for explicit invocation clarity.
 *
 * Behaviour:
 *   - Skips files whose name contains "__Sprite_" (Unity atlas artefacts).
 *   - Skips conversion if a .webp already exists AND is newer than the .png.
 *   - Processes all sub-directories recursively.
 */
import sharp from "sharp"
import { readdir, stat, unlink } from "fs/promises"
import { join, extname } from "path"
import { argv } from "process"

const PUBLIC = join(process.cwd(), "public")
const DELETE_PNG = argv.includes("--delete-png")

async function* walkPngs(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      yield* walkPngs(full)
    } else if (e.isFile() && extname(e.name).toLowerCase() === ".png") {
      if (e.name.includes("__Sprite_")) continue  // skip Unity atlas duplicates
      yield full
    }
  }
}

let converted = 0
let skipped = 0
let deleted = 0
let errors = 0

console.log(`Converting ALL PNGs in: ${PUBLIC}`)
console.log(`Delete originals: ${DELETE_PNG}\n`)

for await (const pngPath of walkPngs(PUBLIC)) {
  const webpPath = pngPath.replace(/\.png$/i, ".webp")

  // Skip if webp already exists and is at least as new as the png
  try {
    const [pngStat, webpStat] = await Promise.all([
      stat(pngPath),
      stat(webpPath).catch(() => null),
    ])
    if (webpStat && webpStat.mtimeMs >= pngStat.mtimeMs) {
      skipped++
      if (DELETE_PNG) {
        await unlink(pngPath).catch(() => {})
        deleted++
      }
      continue
    }
  } catch { /* continue */ }

  try {
    await sharp(pngPath)
      .webp({ quality: 82, effort: 4 })
      .toFile(webpPath)
    converted++
    if ((converted + skipped) % 100 === 0) {
      process.stdout.write(`  ${converted} converted, ${skipped} up-to-date...\r`)
    }
    if (DELETE_PNG) {
      await unlink(pngPath).catch(() => {})
      deleted++
    }
  } catch (e) {
    console.error(`  ERROR: ${pngPath} — ${e.message}`)
    errors++
  }
}

console.log(`\nDone: ${converted} converted, ${skipped} up-to-date, ${errors} errors`)
if (DELETE_PNG) console.log(`Deleted: ${deleted} source PNG files`)
