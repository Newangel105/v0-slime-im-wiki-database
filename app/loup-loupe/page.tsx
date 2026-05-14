import { LoupLoupeBrowser } from "@/components/loup-loupe-browser"
import { getAllEnemies } from "@/lib/enemies"
import { getLoupLoupeFloors } from "@/lib/loup-loupe"

export const metadata = { title: "Loup Loupe | SLIME-WIKI" }

export default function LoupLoupePage() {
  const floors = getLoupLoupeFloors()
  const enemyIds = new Set(
    floors.flatMap((floor) =>
      floor.tiles
        .map((tile) => tile.event?.icon_master_enemy_id ?? 0)
        .filter((enemyId) => enemyId > 0),
    ),
  )
  const enemies = getAllEnemies().filter((enemy) => enemyIds.has(enemy.master_enemy_id))

  return (
    <main className="site-page px-2 py-3 text-white sm:px-4">
      <div className="mx-auto w-full max-w-[96rem]">
        <LoupLoupeBrowser floors={floors} enemies={enemies} />
      </div>
    </main>
  )
}
