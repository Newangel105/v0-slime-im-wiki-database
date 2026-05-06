/**
 * Convert PNGs inside selected public/Image/SkillStill folders to WebP.
 *
 * Usage:
 *   node scripts/convert-to-webp.mjs
 */
import sharp from "sharp"
import { readdir, unlink } from "fs/promises"
import { join, extname } from "path"

const PUBLIC = join(process.cwd(), "public")

const TARGET_DIRS = [
  join(PUBLIC, "icons"),
]

async function* walkAll(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    console.error(`Could not read directory: ${dir}`)
    return
  }

  for (const e of entries) {
    const full = join(dir, e.name)

    if (e.isDirectory()) {
      yield* walkAll(full)
    } else if (e.isFile()) {
      yield { full, name: e.name }
    }
  }
}

let spritesDeleted = 0
let converted = 0
let pngsDeleted = 0
let errors = 0

for (const dir of TARGET_DIRS) {
  console.log(`Processing: ${dir}`)

  for await (const { full, name } of walkAll(dir)) {
    const ext = extname(name).toLowerCase()

    // Delete Unity atlas artefacts
    if (name.includes("_Sprite")) {
      await unlink(full).catch(() => {})
      spritesDeleted++
      continue
    }

    // Only convert PNG files
    if (ext !== ".png") continue

    const webpPath = full.replace(/\.png$/i, ".webp")

    try {
      await sharp(full)
        .webp({ quality: 82, effort: 4 })
        .toFile(webpPath)

      converted++

      // Delete original PNG only after successful conversion
      await unlink(full).catch(() => {})
      pngsDeleted++
    } catch (e) {
      console.error(`CONVERT ERROR: ${full} — ${e.message}`)
      errors++
    }
  }
}

console.log(`\nDone!`)
console.log(`  _Sprite files deleted : ${spritesDeleted}`)
console.log(`  PNGs converted to WebP: ${converted}`)
console.log(`  PNGs deleted          : ${pngsDeleted}`)
if (errors) console.log(`  Errors                : ${errors}`)