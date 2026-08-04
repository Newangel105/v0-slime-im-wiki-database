import { LoupLoupeShell } from "@/components/loup-loupe-shell"
import { getAllEnemies } from "@/lib/enemies"
import { getLoupLoupeFloors } from "@/lib/loup-loupe"
import { getDesign } from "@/lib/design"
import { NkBoard, NkHeaderPod } from "@/components/nightink/pod-kit"

export const metadata = { title: "Loup Loupe | SLIME-WIKI" }

export default async function LoupLoupePage() {
  const floors = await getLoupLoupeFloors()
  const enemyIds = new Set(
    floors.flatMap((floor) =>
      floor.tiles
        .map((tile) => tile.event?.icon_master_enemy_id ?? 0)
        .filter((enemyId) => enemyId > 0),
    ),
  )
  const allEnemies = await getAllEnemies()
  const enemies = allEnemies.filter((enemy) => enemyIds.has(enemy.master_enemy_id))
  const design = await getDesign()

  if (design === "nightink") {
    return (
      <NkBoard>
        <NkHeaderPod
          kicker="Labyrinth Map"
          title="Loup "
          accent="Loupe"
          sub="Explore the Loup-Loupe labyrinth — every floor, tile, reward and enemy encounter."
        />
        <div className="nk-toolskin" style={{ marginTop: 28 }}>
          <LoupLoupeShell floors={floors} enemies={enemies} />
        </div>
      </NkBoard>
    )
  }

  return (
    <main className="site-page slime-page-loup-loupe px-2 py-3 sm:px-4">
      <div className="mx-auto w-full max-w-[96rem]">
        <LoupLoupeShell floors={floors} enemies={enemies} classic={design === "classic"} />
      </div>
    </main>
  )
}
