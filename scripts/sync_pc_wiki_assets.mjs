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
const externalFieldBuildingRoot = path.join("D:", "Full Extracted Files", "Assets", "AssetBundles", "Image", "FieldBuilding")
const publicRoot = path.join(projectRoot, "public")
const imageRoot = path.join(publicRoot, "Image")

const enhancedBlessIconMap = {
  EnhancedAir: "IcElementBlessEnhancedAir.webp",
  EnhancedDark: "IcElementBlessEnhancedDark.webp",
  EnhancedEarth: "IcElementBlessEnhancedEarth.webp",
  EnhancedFire: "IcElementBlessEnhancedFire.webp",
  EnhancedHoly: "IcElementBlessEnhancedHoly.webp",
  EnhancedWater: "IcElementBlessEnhancedWater.webp",
  EnhancedWind: "IcElementBlessEnhancedWind.webp",
}

const baseElementBlessIcons = ["IcElementBlessHoly.webp"]

const tacticsIcons = ["charge.webp", "defense.webp", "normal.webp", "speed.webp"]

// Each entry: { id, ver } maps to FieldBuilding_{id}_{ver}_icon.webp
const facilityIconEntries = [
  { id: "1206", ver: "02" }, // Trading Post
  { id: "1209", ver: "02" }, // Armory
  { id: "1213", ver: "01" }, // Traditional Inn
  { id: "1214", ver: "01" }, // Japanese Style Tavern
  { id: "1216", ver: "01" }, // Tempest Wheel
  { id: "1218", ver: "01" }, // Mini Coaster
  { id: "1225", ver: "01" }, // Honey Café
  { id: "1301", ver: "03" }, // Farm
  { id: "1302", ver: "03" }, // Mountain Supply Corps Base
  { id: "1303", ver: "03" }, // Ocean Supply Corps Base
  { id: "1304", ver: "03" }, // Forest Supply Corps Base
  { id: "1305", ver: "02" }, // Clothing Store
  { id: "1306", ver: "03" }, // Restaurant
  { id: "1307", ver: "02" }, // Tavern
  { id: "1308", ver: "02" }, // Café
  { id: "1309", ver: "02" }, // Digsite for Stamina Magistones
  { id: "1310", ver: "02" }, // Digsite for Attack Magistones
  { id: "1311", ver: "02" }, // Protection Magistone Digsite
  { id: "1312", ver: "02" }, // Digsite for Training Magistones
  { id: "1313", ver: "03" }, // Field
  { id: "1314", ver: "03" }, // Training Ground
  { id: "1315", ver: "02" }, // Digsite for Defense Magistones
  { id: "1316", ver: "02" }, // Inn
  { id: "1317", ver: "02" }, // Sawmill
  { id: "1318", ver: "02" }, // Brewery
  { id: "1320", ver: "02" }, // Weaving Workshop
  { id: "1321", ver: "01" }, // Digsite for Defense Magigems
  { id: "1322", ver: "01" }, // Digsite for Stamina Magigems
  { id: "1323", ver: "01" }, // Digsite for Training Magigems
  { id: "1324", ver: "01" }, // Digsite for Attack Magigems
  { id: "1325", ver: "01" }, // Traditional Brewery
  { id: "1326", ver: "01" }, // Encampment
  { id: "1327", ver: "01" }, // Ice Cream Cart
  { id: "1328", ver: "01" }, // Ramen Shop
  { id: "1329", ver: "01" }, // Savory Pancake Stall
  { id: "1330", ver: "01" }, // Fruit Stall
  { id: "1331", ver: "01" }, // Shishkabob Stall
  { id: "1332", ver: "01" }, // Weapon Magicubeite Digsite
  { id: "1333", ver: "01" }, // Armor Magicubeite Digsite
  { id: "1334", ver: "01" }, // Decoration Magicubeite Digsite
  { id: "1335", ver: "01" }, // Gift Shop
  { id: "1336", ver: "01" }, // Hot Dog Stall
  { id: "1337", ver: "01" }, // Hamburger Stall
  { id: "1338", ver: "01" }, // Churros Stall
  { id: "1339", ver: "01" }, // Sweets Shop
  { id: "1341", ver: "01" }, // Geological Survey Station
  { id: "1344", ver: "01" }, // Elemental Colossus Bay
  { id: "1345", ver: "01" }, // Monster Museum
  { id: "1346", ver: "01" }, // Water Purification Station
  { id: "1347", ver: "01" }, // Crystal Restaurant
  { id: "1348", ver: "01" }, // Magic Fang Atelier
  { id: "1349", ver: "01" }, // Magic Hide Atelier
  { id: "1350", ver: "01" }, // Magic Feather Atelier
  { id: "1351", ver: "01" }, // Shaved Ice Shop
  { id: "1352", ver: "02" }, // Purple Magicluster Digsite
  { id: "1353", ver: "02" }, // Red Magicluster Digsite
  { id: "1354", ver: "01" }, // Paper Mill
  { id: "1355", ver: "01" }, // Orchard
  { id: "1356", ver: "01" }, // Tableware Store
  { id: "1357", ver: "01" }, // Juice Stand
  { id: "1359", ver: "01" }, // Obstacle Course
  { id: "1360", ver: "01" }, // Dojo
  { id: "1362", ver: "02" }, // Photo Studio
  { id: "1365", ver: "01" }, // Flour Mill
  { id: "1422", ver: "02" }, // Feast Hot Pot
  { id: "1453", ver: "01" }, // Crystal Hotel
  { id: "1523", ver: "01" }, // Snack Bar Jura
  { id: "1551", ver: "01" }, // Dango Shop
  { id: "1568", ver: "01" }, // Traditional Snack Shop
  { id: "1570", ver: "01" }, // Souvenir Shop
  { id: "1606", ver: "02" }, // Laboratory
  { id: "1607", ver: "01" }, // Fire Magic Device
  { id: "1608", ver: "01" }, // Water Magic Device
  { id: "1609", ver: "01" }, // Earth Magic Device
  { id: "1610", ver: "01" }, // Wind Magic Device
  { id: "1611", ver: "01" }, // Space Magic Device
  { id: "1612", ver: "01" }, // Light Magic Device
  { id: "1613", ver: "01" }, // Dark Magic Device
  { id: "1614", ver: "01" }, // Symbol of Protection
  { id: "1627", ver: "02" }, // Fire Arts Shrine
  { id: "1628", ver: "02" }, // Water Arts Shrine
  { id: "1629", ver: "02" }, // Earth Arts Shrine
  { id: "1630", ver: "02" }, // Wind Arts Shrine
  { id: "1631", ver: "02" }, // Space Arts Shrine
  { id: "1632", ver: "02" }, // Light Arts Shrine
  { id: "1633", ver: "02" }, // Dark Arts Shrine
]

function withPngExtension(assetPath) {
  return /\.[a-z0-9]+$/i.test(assetPath) ? assetPath : `${assetPath}.webp`
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

  for (const fileName of baseElementBlessIcons) {
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

  for (const { id, ver } of facilityIconEntries) {
    const fileName = `FieldBuilding_${id}_${ver}_icon.webp`
    const sourcePath = path.join(externalFieldBuildingRoot, id, ver, fileName)
    const destinationPath = path.join(publicRoot, "Image", "FieldBuilding", id, ver, fileName)

    if (!(await exists(sourcePath))) {
      missing.push(path.join("Image", "FieldBuilding", id, ver, fileName))
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