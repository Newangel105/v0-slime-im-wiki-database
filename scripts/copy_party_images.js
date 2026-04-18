const fs = require('fs')
const path = require('path')

// Usage: node scripts/copy_party_images.js "D:/Slime Isekai Memories Game Files/Slime_Extractor/All_Text/Assets/AssetBundles"
const srcRoot = process.argv[2]
if (!srcRoot) {
  console.error('Provide source root path as first arg')
  process.exit(2)
}

const wiki = require('../pc_wiki.generated.json')
const outDir = path.resolve(__dirname, '..', 'public', 'partyL')
const framesOut = path.resolve(__dirname, '..', 'public', 'frames')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
if (!fs.existsSync(framesOut)) fs.mkdirSync(framesOut, { recursive: true })

function tryCopy(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest)
    return true
  }
  return false
}

for (const c of wiki.characters) {
  const img = c.images && c.images.icon
  if (!img) continue
  // img example: Image/Character/PC/RimuruDefault/5/RimuruDefault_5_CharaPartyM
  const parts = img.split('/')
  const category = parts[2] || 'PC' // e.g. PC or Bless
  const folder = parts[3]
  const rarity = String(c.rarity || parts[4] || '5')
  const candidates = []
  // common patterns using category (PC, Bless, etc)
  candidates.push(path.join(srcRoot, 'Image', 'Character', category, folder, rarity, `${folder}_${rarity}_CharaPartyL.webp`))
  candidates.push(path.join(srcRoot, 'Image', 'Character', category, folder, rarity, `${folder}_${rarity}_CharaInfoPartyL.webp`))
  // bless-specific patterns (some assets use BlessPartyL suffix)
  candidates.push(path.join(srcRoot, 'Image', 'Character', category, folder, rarity, `${folder}_${rarity}_BlessPartyL.webp`))
  candidates.push(path.join(srcRoot, 'Image', 'Character', category, folder, rarity, `${folder}_${rarity}_BlessInfoPartyL.webp`))
  // try other rarity folders (3..7) for common and bless patterns
  for (let r = 3; r <= 7; r++) {
    candidates.push(path.join(srcRoot, 'Image', 'Character', category, folder, String(r), `${folder}_${r}_CharaPartyL.webp`))
    candidates.push(path.join(srcRoot, 'Image', 'Character', category, folder, String(r), `${folder}_${r}_BlessPartyL.webp`))
  }

  let copied = false
  for (const cand of candidates) {
    const dest = path.join(outDir, `${c.master_pc_id}.webp`)
    if (tryCopy(cand, dest)) {
      console.log(`Copied ${cand} -> ${dest}`)
      copied = true
      break
    }
  }
  if (!copied) {
    // fallback: scan the folder for any *PartyL.webp files
    const scanDirs = [path.join(srcRoot, 'Image', 'Character', category, folder, rarity)]
    for (let r = 3; r <= 7; r++) scanDirs.push(path.join(srcRoot, 'Image', 'Character', category, folder, String(r)))
    for (const d of scanDirs) {
      try {
        if (!fs.existsSync(d)) continue
        const files = fs.readdirSync(d)
        for (const f of files) {
          if (f.endsWith('PartyL.webp')) {
            const src = path.join(d, f)
            const dest = path.join(outDir, `${c.master_pc_id}.webp`)
            if (tryCopy(src, dest)) {
              console.log(`Copied ${src} -> ${dest} (wildcard)`)
              copied = true
              break
            }
          }
        }
      } catch (e) {
        // ignore read errors
      }
      if (copied) break
    }
    if (!copied) {
      console.warn(`No PartyL found for ${c.name} (${c.master_pc_id}) - tried ${candidates.length} candidates`)
    }
  }
}

// Copy frames if available in source
const frameNames = ['frameMemberL3.webp','frameMemberL4.webp','frameMemberL5.webp','frameMemberL6.webp','frameMemberL6up.webp']
for (const f of frameNames) {
  const src = path.join(srcRoot, 'UI', 'Texture', 'CommonRarityAtlas', f)
  const dest = path.join(framesOut, f)
  if (tryCopy(src, dest)) console.log(`Copied frame ${f}`)
}

console.log('Done')
