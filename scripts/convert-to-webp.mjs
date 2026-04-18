/**
 * Clean up public/ images:
 *   1. Delete all files whose name contains "_Sprite" (Unity atlas artefacts).
 *   2. Convert every remaining .webp to .webp (always re-convert so no staleness).
 *   3. Delete every .webp file (including ones that already had a .webp).
 *
 * Usage:
 *   node scripts/convert-to-webp.mjs
 */
import sharp from "sharp"
import { readdir, unlink } from "fs/promises"
import { join, extname } from "path"

const PUBLIC = join(process.cwd(), "public")

async function* walkAll(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
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

console.log(`Public dir: ${PUBLIC}\n`)

// Step 1 + 2 + 3 in one pass
for await (const { full, name } of walkAll(PUBLIC)) {
  const ext = extname(name).toLowerCase()

  // Step 1: delete _Sprite files (any extension)
  if (name.includes("_Sprite")) {
    await unlink(full).catch(() => {})
    spritesDeleted++
    continue
  }

  if (ext !== ".webp") continue

  const webpPath = full.replace(/\.webp$/i, ".webp")

  // Step 2: convert to webp
  try {
    await sharp(full)
      .webp({ quality: 82, effort: 4 })
      .toFile(webpPath)
    converted++
  } catch (e) {
    console.error(`  CONVERT ERROR: ${full} — ${e.message}`)
    errors++
  }

  // Step 3: delete the png (even if conversion failed, remove it)
  await unlink(full).catch(() => {})
  pngsDeleted++

  const total = spritesDeleted + converted + pngsDeleted
  if (total % 200 === 0) {
    process.stdout.write(`  sprites removed: ${spritesDeleted}  converted: ${converted}  pngs deleted: ${pngsDeleted}\r`)
  }
}

console.log(`\n\nDone!`)
console.log(`  _Sprite files deleted : ${spritesDeleted}`)
console.log(`  PNGs converted to webp: ${converted}`)
console.log(`  PNGs deleted          : ${pngsDeleted}`)
if (errors) console.log(`  Errors               : ${errors}`)
