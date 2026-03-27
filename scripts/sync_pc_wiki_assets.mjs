import { mkdir, readFile, rm, copyFile, access } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")
const jsonPath = path.join(projectRoot, "pc_wiki.generated.json")
const extractorRoot = path.resolve(projectRoot, "..", "..", "Slime_Extractor", "Assets", "AssetBundles")
const externalBlessRoot = path.join("D:", "Full Extracted Files", "Assets", "AssetBundles", "Image", "IcElementBless")
const externalTacticsRoot = path.join("D:", "Full Extracted Files", "Assets", "AssetBundles", "Image", "Tactics")
const publicRoot = path.join(projectRoot, "public")
const imageRoot = path.join(publicRoot, "Image")

const enhancedBlessIconMap = {
  EnhancedAir: "IcElementBlessEnhancedAir.png",
  EnhancedDark: "IcElementBlessEnhancedDark.png",
  EnhancedEarth: "IcElementBlessEnhancedEarth.png",
  EnhancedFire: "IcElementBlessEnhancedFire.png",
  EnhancedHoly: "IcElementBlessEnhancedHoly.png",
  EnhancedWater: "IcElementBlessEnhancedWater.png",
  EnhancedWind: "IcElementBlessEnhancedWind.png",
}

const tacticsIcons = ["charge.png", "defense.png", "normal.png", "speed.png"]

function withPngExtension(assetPath) {
  return /\.[a-z0-9]+$/i.test(assetPath) ? assetPath : `${assetPath}.png`
}

function collectAssetPaths(characters) {
  const assetPaths = new Set()

  for (const character of characters) {
    assetPaths.add(withPngExtension(character.images.icon))
    assetPaths.add(withPngExtension(character.images.full))

    for (const force of character.forces) {
      assetPaths.add(withPngExtension(force.icon_path))
    }

    for (const skill of character.skills) {
      assetPaths.add(withPngExtension(skill.icon_path))
    }

    for (const trait of character.traits) {
      assetPaths.add(withPngExtension(trait.icon_path))
    }
  }

  return [...assetPaths].sort()
}

function collectBlessIconCopies(characters) {
  const fileNames = new Set()

  for (const character of characters) {
    const fileName = enhancedBlessIconMap[character.element]
    if (fileName) {
      fileNames.add(fileName)
    }
  }

  return [...fileNames].sort()
}

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function main() {
  const payload = JSON.parse(await readFile(jsonPath, "utf8"))
  const assetPaths = collectAssetPaths(payload.characters)
  const blessIcons = collectBlessIconCopies(payload.characters)

  await rm(imageRoot, { recursive: true, force: true })

  const missing = []
  let copied = 0

  for (const assetPath of assetPaths) {
    const sourcePath = path.join(extractorRoot, assetPath)
    const destinationPath = path.join(publicRoot, assetPath)

    if (!(await exists(sourcePath))) {
      missing.push(assetPath)
      continue
    }

    await mkdir(path.dirname(destinationPath), { recursive: true })
    await copyFile(sourcePath, destinationPath)
    copied += 1
  }

  for (const fileName of blessIcons) {
    const sourcePath = path.join(externalBlessRoot, fileName)
    const destinationPath = path.join(publicRoot, "Image", "IcElementBless", fileName)

    if (!(await exists(sourcePath))) {
      missing.push(path.join("Image", "IcElementBless", fileName))
      continue
    }

    await mkdir(path.dirname(destinationPath), { recursive: true })
    await copyFile(sourcePath, destinationPath)
    copied += 1
  }

  for (const fileName of tacticsIcons) {
    const sourcePath = path.join(externalTacticsRoot, fileName)
    const destinationPath = path.join(publicRoot, "Image", "Tactics", fileName)

    if (!(await exists(sourcePath))) {
      missing.push(path.join("Image", "Tactics", fileName))
      continue
    }

    await mkdir(path.dirname(destinationPath), { recursive: true })
    await copyFile(sourcePath, destinationPath)
    copied += 1
  }

  console.log(`Copied ${copied} assets into ${publicRoot}`)

  if (missing.length) {
    console.log(`Missing ${missing.length} assets:`)
    for (const assetPath of missing) {
      console.log(`  ${assetPath}`)
    }
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})